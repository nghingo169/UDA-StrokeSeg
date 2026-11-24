# Evaluation, threshold tuning, bootstrap intervals, and statistical tests.
from __future__ import annotations
from .interfaces import *
from .metrics import *

@torch.no_grad()
def evaluate_condition_rigorous(
    model: nn.Module,
    cache: Dict[str, dict],
    vault: TargetMaskVault,
    split_name: str,
    opt_th: float,
    cfg: ScientificPipelineConfig,
    case_id_subset: Optional[List[str]] = None
) -> pd.DataFrame:
    model.eval()
    vault.freeze_training_and_unseal()
    cases = [v for v in cache.values() if v["uda_split"] == split_name]
    if case_id_subset is not None:
        cases = [v for v in cases if v["case_id"] in case_id_subset]
    records = []
    
    for c in cases:
        x = torch.from_numpy(c["image"]).float().unsqueeze(0).to(DEVICE)
        prob = torch.sigmoid(model(x))[0, 0].cpu().numpy()
        pred_bin = (prob >= opt_th).astype(np.uint8)
        pred_bin = remove_small_components(pred_bin, cfg.min_lesion_volume_ml, cfg.target_spacing)
        
        gt_nii = vault.retrieve_mask(c["case_id"])
        native_spacing = c["native_spacing"]
        gt_raw = (np.asarray(gt_nii.dataobj).squeeze() > 0.5).astype(np.uint8)
        gt_phys = resample_arr_to_physical_spacing(gt_raw, native_spacing, cfg.target_spacing, order=0)
        gt_bin = crop_or_pad_around_brain_bbox(gt_phys, c["brain_mask_phys"], cfg.patch_size, 0)
        
        dsc = compute_dsc_exact(pred_bin, gt_bin)
        hd95 = compute_hd95_exact(pred_bin, gt_bin, cfg.target_spacing)
        avd = compute_avd_ml_exact(pred_bin, gt_bin, cfg.target_spacing)
        f1, prec, rec = compute_lesion_level_f1(pred_bin, gt_bin, min_vol_ml=cfg.min_lesion_volume_ml, spacing=cfg.target_spacing)
        
        gt_vol = gt_bin.sum() * 0.008
        if gt_vol < 5.0:
            stratum = "<5mL (Micro-infarct)"
        elif gt_vol <= 20.0:
            stratum = "5-20mL (Moderate)"
        else:
            stratum = ">20mL (Large territorial)"
            
        records.append({
            "case_id": c["case_id"],
            "DSC": dsc,
            "HD95_mm": hd95,
            "AVD_mL": avd,
            "Lesion_F1": f1,
            "Precision": prec,
            "Recall": rec,
            "GT_Vol_mL": gt_vol,
            "vol_stratum": stratum
        })
        
    return pd.DataFrame(records)


def bootstrap_ci_95(arr: np.ndarray, n_boot: int = 2000, seed: int = 42) -> Tuple[float, float]:
    rng = np.random.default_rng(seed)
    means = [rng.choice(arr, size=len(arr), replace=True).mean() for _ in range(n_boot)]
    return float(np.percentile(means, 2.5)), float(np.percentile(means, 97.5))

def holm_bonferroni_correction(p_vals: List[float]) -> List[float]:
    m = len(p_vals)
    if m == 0:
        return []
    order = np.argsort(p_vals)
    adj_p = np.zeros(m)
    running_max = 0.0
    for rank, idx in enumerate(order):
        corr = min(1.0, p_vals[idx] * (m - rank))
        running_max = max(running_max, corr)
        adj_p[idx] = running_max
    return adj_p.tolist()

def perform_multi_baseline_statistics(res_dict: Dict[str, pd.DataFrame]):
    if "proposed_uda_strokeseg" not in res_dict:
        print("ℹ️ Chưa có kết quả cho [proposed_uda_strokeseg]. Bỏ qua kiểm định Wilcoxon.")
        return
        
    prop = res_dict["proposed_uda_strokeseg"]
    candidate_baselines = ["source_only_baseline", "source_only_thick_aug", "mean_teacher_thick_aug", "proposed_no_contrastive", "proposed_no_fda"]
    baselines = [b for b in candidate_baselines if b in res_dict]
    
    if not baselines:
        print("ℹ️ Chưa có baseline nào để so sánh với [proposed_uda_strokeseg].")
        return
        
    raw_records = []
    for base_name in baselines:
        base = res_dict[base_name]
        merged = pd.merge(prop, base, on="case_id", suffixes=("_prop", "_base"))
        for metric in ["DSC", "HD95_mm", "AVD_mL"]:
            w_stat, p_val = wilcoxon(merged[f"{metric}_prop"], merged[f"{metric}_base"], zero_method="zsplit")
            diff = (merged[f"{metric}_prop"] - merged[f"{metric}_base"]).values
            ci_l, ci_h = bootstrap_ci_95(diff)
            raw_records.append({
                "Baseline": base_name, "Metric": metric,
                "Mean_Diff": round(float(diff.mean()), 4),
                "95%_CI": f"[{ci_l:+.4f}, {ci_h:+.4f}]",
                "W_stat": w_stat, "p_raw": p_val
            })
            
    stat_df = pd.DataFrame(raw_records)
    stat_df["p_Holm_Bonferroni"] = holm_bonferroni_correction(stat_df["p_raw"].tolist())
    stat_df["Significant (α=0.05)"] = stat_df["p_Holm_Bonferroni"] < 0.05
    
    print("="*85)
    print("📊 PAIRED WILCOXON SIGNED-RANK TESTS WITH HOLM-BONFERRONI & 95% BOOTSTRAP CI:")
    print("="*85)
    display(stat_df)
    
    stat_csv = CFG.work_dir / "scientific_wilcoxon_holm_bonferroni.csv"
    stat_df.to_csv(stat_csv, index=False)
    
    print("\n" + "="*85)
    print("📈 PERFORMANCE STRATIFIED BY LESION VOLUME (D3 Held-Out Test Set):")
    print("="*85)
    strat = prop.groupby("vol_stratum")[["DSC", "HD95_mm", "AVD_mL", "Lesion_F1"]].agg(["mean", "median", "count"])
    display(strat)
    # Phân tích phân tầng theo Arterial Vascular Territory (kết nối với Proposal & Chương 4)
    atlas_csv = Path("./eda/stat_atlas_location.csv")
    if not atlas_csv.exists():
        atlas_csv = Path("stat_atlas_location.csv")
    if atlas_csv.exists():
        adf = pd.read_csv(atlas_csv)
        if "case" in adf.columns and "case_id" not in adf.columns:
            adf = adf.rename(columns={"case": "case_id", "region": "territory_primary"})
        merged_atlas = pd.merge(prop, adf[["case_id", "territory_primary", "hemisphere"]], on="case_id", how="left")
        if "territory_primary" in merged_atlas.columns and merged_atlas["territory_primary"].notna().any():
            print("\n" + "="*85)
            print("🧠 PERFORMANCE STRATIFIED BY ARTERIAL VASCULAR TERRITORY (Liu et al., 2023 Atlas):")
            print("="*85)
            terr_strat = merged_atlas.groupby("territory_primary")[["DSC", "HD95_mm", "AVD_mL", "Lesion_F1"]].agg(["mean", "median", "count"])
            display(terr_strat)


perform_multi_baseline_statistics(RESULTS_D3_TEST)





