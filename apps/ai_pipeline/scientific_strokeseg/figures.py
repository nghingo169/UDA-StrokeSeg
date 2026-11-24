# Profiling diagnostics, arterial atlas analysis, and clinical overlays.
from __future__ import annotations
from .interfaces import *
from .data import *
from .metrics import *
from .models import *

from scipy.stats import rankdata

def auc_score(pos, neg, cap=200000, seed=0):
    rng = np.random.default_rng(seed)
    if len(pos) > cap: pos = rng.choice(pos, cap, replace=False)
    if len(neg) > cap: neg = rng.choice(neg, cap, replace=False)
    r = rankdata(np.concatenate([pos, neg]))
    return (r[:len(pos)].sum() - len(pos) * (len(pos) + 1) / 2) / (len(pos) * len(neg))

def gate_deep_report(cache, split, use_oracle, cfg, rim_erode=5, seed=0):
    rng = np.random.default_rng(seed)
    rows, adc_in, adc_out, dwi_in, dwi_out = [], [], [], [], []
    for v in cache.values():
        if v["uda_split"] != split: continue
        msk = v["_oracle_mask"] if use_oracle else v["mask"]
        if msk is None or msk.sum() == 0: continue
        gt = msk[0] > 0.5
        dwi, adc, bm = v["image"][0].astype(np.float32), v["image"][1].astype(np.float32), v["brain_mask"]
        # ĐỒNG BỘ: Chặn dưới sinh lý 0.20 <= ADC <= 0.62
        gate = (adc >= 0.20) & (adc <= cfg.adc_cytotoxic_threshold) & (dwi > 0.5) & bm
        core = ndi.binary_erosion(bm, iterations=rim_erode)   # 5 voxel = 10 mm
        rows.append(dict(
            gt_ml=gt.sum() * 0.008, gt_n=int(gt.sum()), gate_n=int(gate.sum()),
            tp=int((gate & gt).sum()),
            rim_frac=float((gate & ~core).sum() / max(1, gate.sum()))))
        adc_in.append(adc[gt]); dwi_in.append(dwi[gt])
        out_idx = np.flatnonzero((bm & ~gt).ravel())
        if len(out_idx) > 0:
            out_idx = rng.choice(out_idx, min(5000, len(out_idx)), replace=False)
            adc_out.append(adc.ravel()[out_idx]); dwi_out.append(dwi.ravel()[out_idx])
            
    df = pd.DataFrame(rows)
    ai, ao = np.concatenate(adc_in), np.concatenate(adc_out)
    di, do = np.concatenate(dwi_in), np.concatenate(dwi_out)
    print(f"\n--- {split} (n={len(df)}) ---")
    print(f"Pooled precision: {df.tp.sum()/max(1,df.gate_n.sum())*100:.1f}% | "
          f"pooled recall: {df.tp.sum()/df.gt_n.sum()*100:.1f}%")
    print(f"% voxel qua gate nằm ở viền ngoài (cách mặt não <10mm): median {df.rim_frac.median()*100:.1f}%")
    print(f"AUC(ADC_in < ADC_out) = {auc_score(-ai, -ao):.4f}")
    print(f"AUC(DWI_in > DWI_out) = {auc_score(di, do):.4f}")
    return df

def audit_bmask_and_positive_selection(cache, split, use_oracle, cfg, k=16):
    rows = []
    for v in cache.values():
        if v["uda_split"] != split: continue
        msk = v["_oracle_mask"] if use_oracle else v["mask"]
        if msk is None or msk.sum() == 0: continue
        gt, bm = msk[0] > 0, v["brain_mask"]
        dwi, adc = v["image"][0].astype(np.float32), v["image"][1].astype(np.float32)
        # ĐỒNG BỘ: Chặn dưới sinh lý 0.20 <= ADC <= 0.62
        gate = (adc >= 0.20) & (adc <= cfg.adc_cytotoxic_threshold) & (dwi > 0.5) & bm
        row = dict(gt_in_bm=float((gt & bm).sum() / gt.sum()), gate_n=int(gate.sum()))
        if gate.any():
            idx, vals = np.flatnonzero(gate.ravel()), adc[gate]
            # Tiên nghiệm lõi nhồi máu cấp ADC ~ 0.45 để loại bỏ nhiễu cảm ứng từ biên sọ
            core_score = np.exp(-((vals - 0.45) ** 2) / 0.04)
            sel = idx[np.argsort(-core_score)[:min(k, len(vals))]]
            row.update(sel_in_gt=float(gt.ravel()[sel].mean()),
                       sel_adc_med=float(np.median(adc.ravel()[sel])),
                       gate_adc_lt_0p2=float((vals < 0.2).mean()))
        rows.append(row)
    df = pd.DataFrame(rows)
    print(f"\n--- Positive Selection & Brain Mask Audit: {split} (n={len(df)}) ---")
    print(df.describe().loc[["mean", "50%", "min"]].round(3).to_string())
    print("Số ca có >5% GT nằm ngoài brain mask:", int((df.gt_in_bm < 0.95).sum()))
    return df

"""Interactive profiling calls from the notebook are intentionally not run at import time."""



# ==============================================================================
# STAGE 7: ARTERIAL VASCULAR TERRITORY MAPPING & CLINICAL HITL OVERLAY
# (Nâng cấp: Đăng ký không gian MNI152 thực tế & Giao trực tiếp với pred_bin)
# ==============================================================================
from typing import Optional

# Arterial Vascular Territory Taxonomy (Liu et al., Nature Scientific Data 2023)
ARTERIAL_TAXONOMY = {
    "MCA cortical-subcortical": "MCA Cortical/Subcortical (ĐM Não Giữa - Vỏ não & Dưới vỏ)",
    "Deep: lenticulostriate (BG/IC)": "MCA Deep Lenticulostriate (ĐM Não Giữa Sâu - Nhân Nền & Bao Trong)",
    "ACA cortical": "ACA Cortical (ĐM Não Trước - Vỏ não & Cạnh đường giữa)",
    "PCA cortical": "PCA Cortical (ĐM Não Sau - Thùy Chẩm & Thái Dương Dưới)",
    "Deep: choroidal/thalamoperforator (thalamus)": "PCA Deep Thalamoperforator (ĐM Não Sau Sâu - Đồi Thị)",
    "Cerebellum (SCA/ICA)": "VBA Cerebellum (Hệ Sống-Nền - Tiểu Não SCA/AICA/PICA)",
    "Brainstem (basilar)": "VBA Brainstem (Hệ Sống-Nền - Thân Não / ĐM Thân Nền)",
    "Periventricular": "Periventricular / Lateral Ventricle (Vùng Quanh Não Thất)"
}

# Ánh xạ nhãn Level-1 (1..32) của ArterialAtlas.nii -> Nhóm giải phẫu & Bán cầu
ATLAS_GROUP = {}
for _k in (1, 2): ATLAS_GROUP[_k] = "ACA cortical"
for _k in (3, 4, 5, 6): ATLAS_GROUP[_k] = "Deep: lenticulostriate (BG/IC)"
for _k in range(7, 17): ATLAS_GROUP[_k] = "MCA cortical-subcortical"
for _k in range(17, 21): ATLAS_GROUP[_k] = "PCA cortical"
for _k in range(21, 25): ATLAS_GROUP[_k] = "Deep: choroidal/thalamoperforator (thalamus)"
for _k in (25, 26): ATLAS_GROUP[_k] = "Brainstem (basilar)"
for _k in range(27, 31): ATLAS_GROUP[_k] = "Cerebellum (SCA/ICA)"
for _k in (31, 32): ATLAS_GROUP[_k] = "Periventricular"
ATLAS_HEMI = {_k: ("Left" if _k % 2 == 1 else "Right") for _k in range(1, 33)}

_MNI_CACHE = None

def _arr_to_sitk_ras(arr: np.ndarray, affine: np.ndarray, dtype=np.float32) -> sitk.Image:
    """Chuyển đổi mảng 3D RAS+ sang đối tượng SimpleITK LPS+ trong bộ nhớ."""
    lps_aff = np.diag([-1.0, -1.0, 1.0, 1.0]) @ affine
    spacing = tuple(float(np.linalg.norm(lps_aff[:3, i])) for i in range(3))
    img = sitk.GetImageFromArray(arr.astype(dtype).transpose(2, 1, 0))
    img.SetSpacing(spacing)
    img.SetOrigin(tuple(float(x) for x in lps_aff[:3, 3]))
    dir_mat = np.column_stack([lps_aff[:3, i] / spacing[i] for i in range(3)])
    img.SetDirection(tuple(float(x) for x in dir_mat.flatten()))
    return img

def _load_mni_atlas_templates():
    """Tìm và nạp MNI152 T2 template cùng bản đồ 3D ArterialAtlas.nii (Liu et al., 2023)."""
    global _MNI_CACHE
    if _MNI_CACHE is not None:
        return _MNI_CACHE
    roots = [
        Path("./research/strokeseg/_atlas"),
        Path("./_atlas"),
        Path("/Users/t1nt1n/Documents/Projects/UDA/research/strokeseg/_atlas")
    ]
    for r in roots:
        t2_p = r / "icbm152_2009/mni_icbm152_nlin_sym_09a/mni_icbm152_t2_tal_nlin_sym_09a.nii.gz"
        m_p = r / "icbm152_2009/mni_icbm152_nlin_sym_09a/mni_icbm152_t1_tal_nlin_sym_09a_mask.nii.gz"
        art_p = r / "Arterial_Atlas/data/Atlas_182/ArterialAtlas.nii"
        if not art_p.exists():
            art_p = r / "Arterial_Atlas/data/Atlas/ArterialAtlas.nii"
        if t2_p.exists() and m_p.exists() and art_p.exists():
            fsl_aff = np.array([[-1, 0, 0, 90], [0, 1, 0, -126], [0, 0, 1, -72], [0, 0, 0, 1]], float)
            t2_nii = nib.load(str(t2_p))
            m_nii = nib.load(str(m_p))
            art_nii = nib.load(str(art_p))
            fx_arr = np.asanyarray(t2_nii.dataobj) * (np.asanyarray(m_nii.dataobj) > 0)
            fx_sitk = _arr_to_sitk_ras(fx_arr, t2_nii.affine, np.float32)
            mni_mask_sitk = _arr_to_sitk_ras(np.asanyarray(m_nii.dataobj) > 0, m_nii.affine, np.uint8)
            atlas_sitk = _arr_to_sitk_ras(np.asanyarray(art_nii.dataobj).squeeze(), fsl_aff, np.int16)
            _MNI_CACHE = (fx_sitk, mni_mask_sitk, atlas_sitk)
            return _MNI_CACHE
    return None

def register_and_intersect_arterial_atlas(
    dwi_vol: np.ndarray,
    pred_bin: np.ndarray,
    spacing_mm: Tuple[float, float, float],
    brain_mask: Optional[np.ndarray] = None
) -> Optional[dict]:
    """Đăng ký Affine ảnh DWI bệnh nhân về MNI152, warp ArterialAtlas.nii về không gian pred_bin và giao trực tiếp."""
    templates = _load_mni_atlas_templates()
    if templates is None or dwi_vol is None:
        return None
    fx_sitk, mni_mask_sitk, atlas_sitk = templates

    bm = (brain_mask > 0) if brain_mask is not None else (dwi_vol != 0)
    if not bm.any():
        return None
    # Đưa cường độ DWI về miền dương để tính moments khởi tạo tâm não chính xác
    dwi_pos = np.where(bm, dwi_vol - float(dwi_vol[bm].min()) + 1.0, 0.0).astype(np.float32)
    sx, sy, sz = spacing_mm
    gen_aff = np.array([
        [sx, 0, 0, -dwi_vol.shape[0] * sx / 2.0],
        [0, sy, 0, -dwi_vol.shape[1] * sy / 2.0],
        [0, 0, sz, -dwi_vol.shape[2] * sz / 2.0],
        [0, 0, 0, 1.0]
    ], dtype=float)
    mov_sitk = _arr_to_sitk_ras(dwi_pos, gen_aff, np.float32)

    tx0 = sitk.CenteredTransformInitializer(
        fx_sitk, mov_sitk, sitk.AffineTransform(3),
        sitk.CenteredTransformInitializerFilter.MOMENTS
    )
    R = sitk.ImageRegistrationMethod()
    R.SetMetricAsMattesMutualInformation(32)
    R.SetMetricSamplingStrategy(R.RANDOM)
    R.SetMetricSamplingPercentage(0.2, seed=0)
    R.SetInterpolator(sitk.sitkLinear)
    R.SetOptimizerAsRegularStepGradientDescent(1.0, 1e-4, 300, relaxationFactor=0.5)
    R.SetOptimizerScalesFromPhysicalShift()
    R.SetShrinkFactorsPerLevel([4, 2, 1])
    R.SetSmoothingSigmasPerLevel([2, 1, 0])
    R.SetInitialTransform(tx0, inPlace=False)
    tx = R.Execute(fx_sitk, mov_sitk)
    inv = tx.GetInverse()

    warped_atlas = sitk.GetArrayFromImage(
        sitk.Resample(atlas_sitk, mov_sitk, inv, sitk.sitkNearestNeighbor, 0)
    ).transpose(2, 1, 0)
    warped_mni_mask = sitk.GetArrayFromImage(
        sitk.Resample(mni_mask_sitk, mov_sitk, inv, sitk.sitkNearestNeighbor, 0)
    ).transpose(2, 1, 0) > 0
    reg_dice = float(2.0 * (warped_mni_mask & bm).sum() / (warped_mni_mask.sum() + bm.sum() + 1e-9))

    if not (pred_bin > 0).any():
        return {"reg_dice": reg_dice, "hemi": "None", "region_raw": "No Lesion", "f_mca": 0.0, "f_aca": 0.0, "f_pca": 0.0, "f_vba": 0.0}

    labels = warped_atlas[pred_bin > 0]
    labels = labels[labels > 0]
    if labels.size == 0:
        return {"reg_dice": reg_dice, "hemi": "Unlabeled", "region_raw": "Outside Atlas", "f_mca": 0.0, "f_aca": 0.0, "f_pca": 0.0, "f_vba": 0.0}

    # Tính bán cầu & phân bố mạch máu hoàn toàn từ các voxel dự đoán pred_bin
    h_counts = pd.Series([ATLAS_HEMI[int(k)] for k in labels]).value_counts(normalize=True)
    hemi = "Left" if h_counts.get("Left", 0.0) >= 0.80 else ("Right" if h_counts.get("Right", 0.0) >= 0.80 else "Bilateral")

    # Loại trừ não thất (31, 32) khi xác định nhánh động mạch chính nếu có nhu mô
    parenchymal = labels[(labels != 31) & (labels != 32)]
    use_labs = parenchymal if parenchymal.size > 0 else labels
    g_counts = pd.Series([ATLAS_GROUP[int(k)] for k in use_labs]).value_counts(normalize=True)
    region_raw = str(g_counts.index[0])

    f_mca = (g_counts.get("MCA cortical-subcortical", 0.0) + g_counts.get("Deep: lenticulostriate (BG/IC)", 0.0)) * 100.0
    f_aca = g_counts.get("ACA cortical", 0.0) * 100.0
    f_pca = (g_counts.get("PCA cortical", 0.0) + g_counts.get("Deep: choroidal/thalamoperforator (thalamus)", 0.0)) * 100.0
    f_vba = (g_counts.get("Cerebellum (SCA/ICA)", 0.0) + g_counts.get("Brainstem (basilar)", 0.0)) * 100.0

    return {
        "reg_dice": reg_dice,
        "hemi": hemi,
        "region_raw": region_raw,
        "f_mca": float(f_mca),
        "f_aca": float(f_aca),
        "f_pca": float(f_pca),
        "f_vba": float(f_vba),
    }

def load_arterial_atlas_metadata() -> Optional[pd.DataFrame]:
    """Nạp bảng metadata dự phòng khi chạy ở môi trường không có file NIfTI ArterialAtlas."""
    for p in [Path("./eda/stat_atlas_location.csv"), Path("stat_atlas_location.csv")]:
        if p.exists():
            df = pd.read_csv(p)
            if "case" in df.columns and "case_id" not in df.columns:
                df = df.rename(columns={"case": "case_id", "region": "territory_primary"})
            return df
    return None

ATLAS_METADATA_DF = None
def quantify_lesion_anatomy_and_territory(
    case_id: str,
    pred_bin: np.ndarray,
    spacing_mm: Tuple[float, float, float],
    dwi_vol: Optional[np.ndarray] = None,
    brain_mask: Optional[np.ndarray] = None,
    atlas_df: Optional[pd.DataFrame] = ATLAS_METADATA_DF
) -> dict:
    """Phân tích giải phẫu học trực tiếp từ mặt nạ dự đoán (ưu tiên đăng ký MNI152 thực tế)."""
    voxel_vol_ml = float(np.prod(spacing_mm)) / 1000.0
    total_vol_ml = float(pred_bin.sum() * voxel_vol_ml)
    
    # Đếm số lượng ổ tổn thương
    struct_26 = np.ones((3, 3, 3), dtype=int)
    lbl_arr, num_lesions = ndi.label(pred_bin, structure=struct_26)
    
    # Ưu tiên 1: Suy ra trực tiếp từ pred_bin bằng đăng ký không gian MNI152 + ArterialAtlas.nii
    reg_res = register_and_intersect_arterial_atlas(dwi_vol, pred_bin, spacing_mm, brain_mask)
    if reg_res is not None:
        hemi = reg_res["hemi"]
        region_raw = reg_res["region_raw"]
        terr_display = ARTERIAL_TAXONOMY.get(region_raw, region_raw)
        f_mca, f_aca, f_pca, f_vba = reg_res["f_mca"], reg_res["f_aca"], reg_res["f_pca"], reg_res["f_vba"]
        source_mode = f"Đăng ký MNI152 trực tiếp từ pred_bin (Reg Dice={reg_res['reg_dice']:.3f})"
    else:
        # Fallback khi thiếu file NIfTI Atlas trên môi trường cloud
        atlas_row = atlas_df[atlas_df["case_id"] == case_id] if atlas_df is not None else pd.DataFrame()
        if not atlas_row.empty:
            r = atlas_row.iloc[0]
            region_raw = str(r.get("territory_primary", "Unknown"))
            hemi = str(r.get("hemisphere", "Bilateral"))
            terr_display = ARTERIAL_TAXONOMY.get(region_raw, region_raw)
            f_mca = (r.get("f_MCA cortical-subcortical", 0.0) + r.get("f_Deep: lenticulostriate (BG/IC)", 0.0)) * 100.0
            f_aca = r.get("f_ACA cortical", 0.0) * 100.0
            f_pca = (r.get("f_PCA cortical", 0.0) + r.get("f_Deep: choroidal/thalamoperforator (thalamus)", 0.0)) * 100.0
            f_vba = (r.get("f_Cerebellum (SCA/ICA)", 0.0) + r.get("f_Brainstem (basilar)", 0.0)) * 100.0
            source_mode = "Fallback: Tra cứu bảng stat_atlas_location.csv (chưa có ArterialAtlas.nii)"
        else:
            mid_x = pred_bin.shape[0] // 2
            vol_left = pred_bin[:mid_x].sum()
            vol_right = pred_bin[mid_x:].sum()
            if vol_left > 0 or vol_right > 0:
                ratio_left = vol_left / (vol_left + vol_right)
                hemi = "Left" if ratio_left >= 0.70 else ("Right" if ratio_left <= 0.30 else "Bilateral")
            else:
                hemi = "None"
            terr_display = "Chưa xác định (Không có file ArterialAtlas.nii để đăng ký MNI152)"
            f_mca, f_aca, f_pca, f_vba = 0.0, 0.0, 0.0, 0.0
            source_mode = "Fallback: Không có dữ liệu Atlas"
        
    # Đánh giá tiêu chuẩn can thiệp cấp DAWN / DEFUSE-3
    dawn_eligible = total_vol_ml < 70.0
    dawn_status = "ĐỦ ĐIỀU KIỆN CAN THIỆP LẤY HUYẾT KHỐI EVT (Core < 70 mL)" if dawn_eligible else "QUÁ NGƯỠNG LÕI TỔN THƯƠNG EVT (Core >= 70 mL)"
    
    report_text = f"""
========================================================================================
🏥 BÁO CÁO ĐỊNH VỊ LÂM SÀNG & TỔNG HỢP GIẢI PHẪU HỌC ĐỘT QUỴ NÃO CẤP (UDA-StrokeSeg)
========================================================================================
• Mã Bệnh nhân (Case ID):         {case_id}
• Nguồn định danh giải phẫu:      {source_mode}
• Thể tích lõi tổn thương (Core): {total_vol_ml:.2f} mL  ({num_lesions} ổ tổn thương)
• Bán cầu tổn thương:             {hemi}
• Động mạch tổn thương chính:     {terr_display}
• Phân bố lưu vực tưới máu (Arterial Breakdown từ pred_bin):
  ├── Nhánh Động mạch Não Giữa (MCA):       {f_mca:5.1f}%
  ├── Nhánh Động mạch Não Trước (ACA):      {f_aca:5.1f}%
  ├── Nhánh Động mạch Não Sau (PCA):        {f_pca:5.1f}%
  └── Hệ Động mạch Sống - Nền (VBA):        {f_vba:5.1f}%
• Đánh giá Chỉ định Lâm sàng (DAWN / DEFUSE-3 Guideline):
  -> {dawn_status}
========================================================================================"""
    
    return {
        "case_id": case_id,
        "source_mode": source_mode,
        "volume_ml": round(total_vol_ml, 3),
        "lesion_count": int(num_lesions),
        "hemisphere": hemi,
        "dominant_territory": terr_display,
        "f_mca": round(f_mca, 1),
        "f_aca": round(f_aca, 1),
        "f_pca": round(f_pca, 1),
        "f_vba": round(f_vba, 1),
        "dawn_eligible": dawn_eligible,
        "dawn_status": dawn_status,
        "report_text": report_text
    }

@torch.no_grad()
def generate_clinical_overlay_visualization(
    case_id: str,
    cache: Dict[str, dict],
    model: nn.Module,
    vault: TargetMaskVault,
    opt_th: float,
    out_dir: Path
):
    model.eval()
    item = cache[case_id]
    x = torch.from_numpy(item["image"]).float().unsqueeze(0).to(DEVICE)
    prob = torch.sigmoid(model(x))[0, 0].cpu().numpy()
    pred_bin = (prob >= opt_th).astype(np.uint8)
    pred_bin = remove_small_components(pred_bin, CFG.min_lesion_volume_ml, CFG.target_spacing)
    
    # Định danh vị trí giải phẫu học và vùng động mạch trực tiếp từ pred_bin qua MNI152
    anatomy_info = quantify_lesion_anatomy_and_territory(
        case_id, pred_bin, CFG.target_spacing,
        dwi_vol=item["image"][0], brain_mask=item.get("brain_mask")
    )
    print(anatomy_info["report_text"])
    
    gt_nii = vault.retrieve_mask(case_id)
    native_spacing = item["native_spacing"]
    gt_raw = (np.asarray(gt_nii.dataobj).squeeze() > 0.5).astype(np.uint8)
    gt_phys = resample_arr_to_physical_spacing(gt_raw, native_spacing, CFG.target_spacing, order=0)
    gt_bin = crop_or_pad_around_brain_bbox(gt_phys, item["brain_mask_phys"], CFG.patch_size, 0)
    
    z_scores = gt_bin.sum(axis=(0, 1))
    z_best = int(np.argmax(z_scores)) if z_scores.sum() > 0 else CFG.patch_size[2] // 2
    
    dwi_slice = item["image"][0, :, :, z_best].astype(np.float32)
    adc_slice = item["image"][1, :, :, z_best].astype(np.float32)
    flair_slice = item["image"][2, :, :, z_best].astype(np.float32)
    
    def norm_s(arr):
        p1, p99 = np.percentile(arr, [1, 99])
        return np.clip((arr - p1) / (p99 - p1 + 1e-8), 0.0, 1.0)
        
    fig, axes = plt.subplots(1, 4, figsize=(20, 5.0), dpi=120)
    
    # Banner tiêu đề lâm sàng với định danh vị trí động mạch
    fig.suptitle(
        f"UDA-StrokeSeg Clinical Review | Case: {case_id} | Vol: {anatomy_info['volume_ml']:.2f} mL | Territory: {anatomy_info['dominant_territory']}\n"
        f"Bán cầu: {anatomy_info['hemisphere']} | Khuyến nghị: {anatomy_info['dawn_status']}",
        fontsize=11, fontweight="bold", y=1.03
    )
    
    axes[0].imshow(norm_s(dwi_slice).T, cmap="gray", origin="lower")
    axes[0].set_title(f"{case_id} - DWI (b=1000)")
    axes[0].axis("off")
    
    axes[1].imshow(norm_s(adc_slice).T, cmap="gray", origin="lower")
    axes[1].set_title(f"{case_id} - ADC Map (Phys)")
    axes[1].axis("off")
    
    axes[2].imshow(norm_s(flair_slice).T, cmap="gray", origin="lower")
    axes[2].set_title(f"{case_id} - Co-reg FLAIR")
    axes[2].axis("off")
    
    base_rgb = np.stack([norm_s(dwi_slice).T]*3, axis=-1)
    gt_s = gt_bin[:, :, z_best].T
    pr_s = pred_bin[:, :, z_best].T
    
    base_rgb[gt_s > 0] = [0.0, 0.85, 0.2]  # True GT: Xanh lá cây
    base_rgb[pr_s > 0] = [0.95, 0.2, 0.1]  # Pred: Đỏ
    base_rgb[(gt_s > 0) & (pr_s > 0)] = [1.0, 0.9, 0.0]  # Overlap TP: Vàng
    
    axes[3].imshow(base_rgb, origin="lower")
    dsc_c = compute_dsc_exact(pred_bin, gt_bin)
    axes[3].set_title(f"Overlay Z={z_best} (DSC={dsc_c:.3f})\nGreen: GT | Red: Pred | Yellow: TP")
    axes[3].axis("off")
    
    plt.tight_layout()
    out_file = out_dir / f"{case_id}_scientific_overlay.png"
    plt.savefig(out_file, bbox_inches="tight")
    plt.show()
    print(f"🖼️ Đã lưu Clinical Overlay: {out_file.name}")

# Hàm chẩn đoán nhanh cho một ca bệnh bất kỳ (Interactive Inference Helper)
def diagnose_patient_case(case_id: str, cache: Optional[Dict[str, dict]] = None, model: Optional[nn.Module] = None, opt_th: Optional[float] = None):
    """Hàm hỗ trợ bác sĩ lâm sàng kiểm tra và đọc tên vùng tổn thương cho 1 ca cụ thể."""
    global PREPROCESSED_CACHE, prop_model, prop_th, TARGET_VAULT, CFG
    c = cache if cache is not None else PREPROCESSED_CACHE
    m = model if model is not None else prop_model
    th = opt_th if opt_th is not None else prop_th
    if case_id not in c:
        print(f"❌ Không tìm thấy ca '{case_id}' trong bộ nhớ cache.")
        return
    generate_clinical_overlay_visualization(case_id, c, m, TARGET_VAULT, th, CFG.work_dir)





