# Dataset download, cohort partitioning, physical preprocessing, and Dataset implementation.
from __future__ import annotations
from .interfaces import *

ZENODO_BASE = "https://zenodo.org/api/records/7960856/files"
ZIP_URL     = f"{ZENODO_BASE}/ISLES-2022.zip/content"
CENTER_URL  = f"{ZENODO_BASE}/center_ids.xlsx/content"
ZIP_TOTAL   = 1692717470

def download_dataset_if_needed(cfg: ScientificPipelineConfig):
    cfg.isles_dir.mkdir(parents=True, exist_ok=True)
    if not cfg.center_xlsx.exists():
        print("⬇️ Downloading center_ids.xlsx...")
        urllib.request.urlretrieve(CENTER_URL, cfg.center_xlsx)
        
    found_cases = list(cfg.isles_dir.glob("sub-strokecase*"))
    if len(found_cases) >= 200:
        print(f"✅ Found {len(found_cases)} ISLES-2022 cases ready in {cfg.isles_dir}.")
        return cfg.isles_dir
        
    zip_dest = cfg.work_dir / "ISLES-2022.zip"
    if not zip_dest.exists() or zip_dest.stat().st_size != ZIP_TOTAL:
        print("⬇️ Downloading ISLES-2022.zip (1.69 GB)...")
        urllib.request.urlretrieve(ZIP_URL, zip_dest)
        
    print("📦 Extracting ISLES-2022.zip...")
    with zipfile.ZipFile(zip_dest, "r") as zf:
        zf.extractall(cfg.isles_dir.parent)
    print("✅ Extraction complete.")
    return cfg.isles_dir

class TargetMaskVault:
    def __init__(self):
        self._vault = {}
        self._is_sealed = True
        
    def deposit(self, case_id: str, mask_path: Path):
        self._vault[case_id] = mask_path
        
    def retrieve_mask(self, case_id: str) -> nib.Nifti1Image:
        if self._is_sealed:
            raise PermissionError(f"🔒 TARGET MASK VAULT IS SEALED! Cannot access mask for {case_id} during training.")
        return nib.as_closest_canonical(nib.load(str(self._vault[case_id])))
        
    def freeze_training_and_unseal(self):
        self._is_sealed = False
        print("🔓 TargetMaskVault unsealed for independent evaluation.")

def find_case_file_ci(case_dir: Path, pattern_sub: str) -> Optional[Path]:
    """Case-insensitive file search within a directory tree."""
    for p in case_dir.rglob("*.nii.gz"):
        if pattern_sub.lower() in p.name.lower():
            return p
    return None

def ingest_and_partition_cohort(isles_root: Path, center_xlsx: Path, cfg: ScientificPipelineConfig):
    center_map = {}
    if center_xlsx.exists():
        cdf = pd.read_excel(center_xlsx)
        c_col = "case" if "case" in cdf.columns else ("case_id" if "case_id" in cdf.columns else cdf.columns[0])
        val_col = "center" if "center" in cdf.columns else cdf.columns[1]
        center_map = dict(zip(cdf[c_col].astype(str), cdf[val_col].astype(str)))
        
    # Đọc danh sách ca loại trừ chính thức theo ISLES-2022 (3 ca empty-mask: sub-strokecase0150, 0151, 0170 & 1 duplicate: 0169)
    excluded_cids = {"sub-strokecase0150", "sub-strokecase0151", "sub-strokecase0170", "sub-strokecase0169"}
    ex_csv = Path("./eda/excluded_cases.csv")
    if not ex_csv.exists():
        ex_csv = Path("excluded_cases.csv")
    if ex_csv.exists():
        edf = pd.read_csv(ex_csv)
        col = "case" if "case" in edf.columns else edf.columns[0]
        excluded_cids.update(edf[col].astype(str).tolist())
        
    derivatives_dir = isles_root / "derivatives"
    case_dirs = sorted([d for d in isles_root.iterdir() if d.is_dir() and d.name.startswith("sub-strokecase")])
    actual_excluded = [cdir.name for cdir in case_dirs if cdir.name in excluded_cids]
    
    records = []
    for cdir in case_dirs:
        cid = cdir.name
        if cid in excluded_cids:
            continue
            
        dwi_p = find_case_file_ci(cdir, "_dwi.nii.gz")
        adc_p = find_case_file_ci(cdir, "_adc.nii.gz")
        flair_p = find_case_file_ci(cdir, "_flair.nii.gz")
        
        msk_p = None
        if derivatives_dir.exists():
            deriv_case = derivatives_dir / cid
            if deriv_case.exists():
                msk_p = find_case_file_ci(deriv_case, "_msk.nii.gz")
        if msk_p is None:
            msk_p = find_case_file_ci(cdir, "_msk.nii.gz")
            
        if not (dwi_p and adc_p and flair_p):
            continue
            
        hdr = nib.load(str(dwi_p)).header
        dwi_sz = float(hdr.get_zooms()[2])
        f_hdr = nib.load(str(flair_p)).header
        flair_sz = float(f_hdr.get_zooms()[2])
        center = center_map.get(cid, "Center 1" if dwi_sz < 3.0 else "Center 2")
        
        if center in ("Center 1", "1") and dwi_sz <= 2.5:
            domain = DOM_D1 if flair_sz <= 1.5 else DOM_D2
        else:
            domain = DOM_D3
            
        records.append({
            "case_id": cid,
            "center": center,
            "domain": domain,
            "dwi_sz": dwi_sz,
            "flair_sz": flair_sz,
            "dwi_path": str(dwi_p),
            "adc_path": str(adc_p),
            "flair_path": str(flair_p),
            "_mask_path": str(msk_p) if msk_p else None
        })
        
    df = pd.DataFrame(records)
    print(f"📊 Discovered {len(case_dirs)} total subject folders. Excluded {len(actual_excluded)} cases (Empty masks/duplicate): {actual_excluded}")
    print(f"   • Total valid analyzed cases: {len(df)}")
    
    if cfg.max_cases_per_run is not None and len(df) > cfg.max_cases_per_run:
        df = pd.concat([
            df[df["domain"]==DOM_D1].iloc[:int(cfg.max_cases_per_run*0.45)],
            df[df["domain"]==DOM_D2].iloc[:int(cfg.max_cases_per_run*0.25)],
            df[df["domain"]==DOM_D3].iloc[:int(cfg.max_cases_per_run*0.30)]
        ]).reset_index(drop=True)
        
    vault = TargetMaskVault()
    df["mask_path"] = None
    df["uda_split"] = ""
    
    # D1 Source
    d1_idx = df[df["domain"]==DOM_D1].index.tolist()
    n_val = max(1, int(0.20 * len(d1_idx)))
    df.loc[d1_idx[:-n_val], "uda_split"] = "D1_source_train"
    df.loc[d1_idx[-n_val:], "uda_split"] = "D1_source_val"
    for idx in d1_idx:
        df.loc[idx, "mask_path"] = df.loc[idx, "_mask_path"]
        
    # D2 Zero-Shot Shift
    d2_idx = df[df["domain"]==DOM_D2].index.tolist()
    df.loc[d2_idx, "uda_split"] = "D2_flair_shift_eval"
    for idx in d2_idx:
        if df.loc[idx, "_mask_path"]:
            vault.deposit(df.loc[idx, "case_id"], Path(df.loc[idx, "_mask_path"]))
            
    # D3 Inductive Split: 67% Adapt (unlabeled), 33% Held-Out Test
    d3_idx = df[df["domain"]==DOM_D3].index.tolist()
    np.random.seed(42)
    perm_d3 = np.random.permutation(d3_idx)
    n_test_d3 = max(1, int(len(d3_idx) * 0.33))
    adapt_d3 = perm_d3[n_test_d3:]
    test_d3 = perm_d3[:n_test_d3]
    
    df.loc[adapt_d3, "uda_split"] = "D3_target_adapt"
    df.loc[test_d3, "uda_split"] = "D3_target_test"
    for idx in d3_idx:
        if df.loc[idx, "_mask_path"]:
            vault.deposit(df.loc[idx, "case_id"], Path(df.loc[idx, "_mask_path"]))
            
    # Vệ sinh dữ liệu: drop _mask_path để MANIFEST_DF không lưu đường dẫn nhãn của Target/Shift
    df = df.drop(columns=["_mask_path"])
    
    print(f"🔒 TargetMaskVault populated with {len(vault._vault)} held-out target/shift masks. State: SEALED.")
    print("\n📦 Phân chia phân vùng dữ liệu thực tế (Cohort Partitioning Summary):")
    display(df.groupby(["domain", "uda_split"]).size().unstack(fill_value=0))
    return df, vault


def _nib_to_sitk(nii: nib.Nifti1Image) -> sitk.Image:
    """
    Chuyển đổi chính xác NIfTI1Image (RAS+) sang SimpleITK Image (LPS+)
    bảo toàn tuyệt đối Spacing, Origin và Direction Cosine Matrix từ affine header.
    """
    arr = np.nan_to_num(np.asarray(nii.dataobj, dtype=np.float32).squeeze())
    itk_img = sitk.GetImageFromArray(arr.transpose(2, 1, 0))
    
    affine = nii.affine.astype(np.float64)
    spacing = tuple(float(x) for x in nii.header.get_zooms()[:3])
    
    # Chuyển hệ tọa độ từ RAS+ (NIfTI) sang LPS+ (ITK): đổi dấu trục X và Y
    ras_to_lps = np.diag([-1.0, -1.0, 1.0])
    R_ras = affine[:3, :3] / np.array(spacing)
    R_ras = R_ras / np.linalg.norm(R_ras, axis=0, keepdims=True)
    
    R_lps = ras_to_lps @ R_ras
    origin_lps = ras_to_lps @ affine[:3, 3]
    
    itk_img.SetSpacing(spacing)
    itk_img.SetOrigin(tuple(float(x) for x in origin_lps))
    itk_img.SetDirection(tuple(float(x) for x in R_lps.flatten()))
    return itk_img

def resample_flair_to_dwi_sitk(
    dwi_nii: nib.Nifti1Image, 
    flair_nii: nib.Nifti1Image, 
    do_rigid_reg: bool = False
) -> np.ndarray:
    """
    Căn chỉnh FLAIR về lưới tọa độ vật lý của DWI bằng SimpleITK.
    Hỗ trợ đăng ký Rigid 3D (Mattes Mutual Information) nếu đầu bệnh nhân dịch chuyển giữa 2 chuỗi xung.
    """
    fixed_dwi = _nib_to_sitk(dwi_nii)
    moving_flair = _nib_to_sitk(flair_nii)
    
    transform = sitk.Transform(3, sitk.sitkIdentity)
    if do_rigid_reg:
        reg = sitk.ImageRegistrationMethod()
        reg.SetMetricAsMattesMutualInformation(numberOfHistogramBins=32)
        reg.SetMetricSamplingStrategy(reg.RANDOM)
        reg.SetMetricSamplingPercentage(0.10)
        reg.SetInterpolator(sitk.sitkLinear)
        reg.SetOptimizerAsRegularStepGradientDescent(
            learningRate=1.0, minStep=1e-3, numberOfIterations=50, gradientMagnitudeTolerance=1e-4
        )
        reg.SetOptimizerScalesFromPhysicalShift()
        init_tx = sitk.CenteredTransformInitializer(
            fixed_dwi, moving_flair, sitk.Euler3DTransform(), sitk.CenteredTransformInitializerFilter.MOMENTS
        )
        reg.SetInitialTransform(init_tx, inPlace=False)
        transform = reg.Execute(fixed_dwi, moving_flair)

    resampler = sitk.ResampleImageFilter()
    resampler.SetReferenceImage(fixed_dwi)
    resampler.SetInterpolator(sitk.sitkLinear)
    resampler.SetDefaultPixelValue(0.0)
    resampler.SetTransform(transform)
    
    res_flair_itk = resampler.Execute(moving_flair)
    return sitk.GetArrayFromImage(res_flair_itk).transpose(2, 1, 0)

def verify_physical_alignment_and_checkerboard(manifest_df: pd.DataFrame, n_samples: int = 1):
    """Kiểm tra độ lệch origin và vẽ ảnh bàn cờ (checkerboard) DWI - FLAIR."""
    sample_rows = pd.concat([
        manifest_df[manifest_df["domain"] == DOM_D1].head(n_samples),
        manifest_df[manifest_df["domain"] == DOM_D3].head(n_samples)
    ])
    for _, row in sample_rows.iterrows():
        dwi_nii = nib.as_closest_canonical(nib.load(row["dwi_path"]))
        flair_nii = nib.as_closest_canonical(nib.load(row["flair_path"]))
        origin_diff = flair_nii.affine[:3, 3] - dwi_nii.affine[:3, 3]
        print(f"🔍 [{row['case_id']} | {row['domain']}] Origin Diff (FLAIR - DWI) (mm): {np.round(origin_diff, 2)}")
        
        dwi_arr = np.asarray(dwi_nii.dataobj, dtype=np.float32).squeeze()
        flair_aligned = resample_flair_to_dwi_sitk(dwi_nii, flair_nii, do_rigid_reg=False)
        
        z = dwi_arr.shape[2] // 2
        d_slice = (dwi_arr[:, :, z] - dwi_arr[:, :, z].min()) / (np.ptp(dwi_arr[:, :, z]) + 1e-8)
        f_slice = (flair_aligned[:, :, z] - flair_aligned[:, :, z].min()) / (np.ptp(flair_aligned[:, :, z]) + 1e-8)
        
        grid = ((np.arange(d_slice.shape[0])[:, None] // 16) + (np.arange(d_slice.shape[1])[None, :] // 16)) % 2
        checker = np.where(grid == 0, d_slice, f_slice)
        
        plt.figure(figsize=(4, 4), dpi=110)
        plt.imshow(checker.T, cmap="gray", origin="lower")
        plt.title(f"Checkerboard {row['case_id']} (Z={z})")
        plt.axis("off")
        plt.show()


def resample_arr_to_physical_spacing(
    arr: np.ndarray, 
    orig_spacing: Tuple[float, float, float], 
    target_spacing: Tuple[float, float, float], 
    order: int = 1
) -> np.ndarray:
    """Resamples a 3D numpy array to isotropic physical spacing via spline/nearest interpolation."""
    zoom_factors = [orig_spacing[i] / target_spacing[i] for i in range(3)]
    return ndi.zoom(arr, zoom_factors, order=order)

def extract_brain_mask_dwi(dwi: np.ndarray) -> np.ndarray:
    """
    Trích xuất mặt nạ não 3D đa bước chuẩn y khoa (có đệm viền tránh mất voxel ở mặt mảng z):
    1. Ngưỡng ban đầu theo phân vị cao (loại bỏ phông nền)
    2. Đệm viền (pad=6, mode='edge') để tránh phép closing xoá 3 voxel (6mm) khi não chạm mặt FOV
    3. Phép mở hình thái học (Opening 3D) cắt đứt cuống dính sọ/mắt/cổ
    4. Lọc thành phần liên thông lớn nhất (Largest Connected Component)
    5. Phép đóng hình thái học (Closing 3D) làm mịn vỏ não & bắc cầu qua rãnh cuộn não
    6. Lấp đầy toàn bộ lỗ rỗng bên trong (Fill Holes) bao trọn não thất và dịch não tủy
    7. Cắt bỏ lớp đệm viền để khôi phục chính xác kích thước ban đầu
    """
    pos = dwi[dwi > 0]
    if len(pos) == 0:
        return np.ones_like(dwi, dtype=bool)
        
    p98 = np.percentile(pos, 98)
    thr = 0.12 * p98
    mask = dwi > thr
    
    pad = 6
    mask_p = np.pad(mask, pad, mode="edge")
    st_6 = ndi.generate_binary_structure(3, 1)
    mask_open = ndi.binary_opening(mask_p, structure=st_6, iterations=2)
    lab, n_comp = ndi.label(mask_open)
    mask_brain = (lab == (np.bincount(lab.ravel())[1:].argmax() + 1)) if n_comp > 0 else mask_p
    mask_closed = ndi.binary_closing(mask_brain, structure=st_6, iterations=3)
    return ndi.binary_fill_holes(mask_closed)[pad:-pad, pad:-pad, pad:-pad]

def compute_bounding_box_3d(mask: np.ndarray, margin: int = 4) -> Tuple[slice, slice, slice]:
    where = np.where(mask)
    if len(where[0]) == 0:
        return slice(0, mask.shape[0]), slice(0, mask.shape[1]), slice(0, mask.shape[2])
    x_min, x_max = max(0, where[0].min() - margin), min(mask.shape[0], where[0].max() + margin)
    y_min, y_max = max(0, where[1].min() - margin), min(mask.shape[1], where[1].max() + margin)
    z_min, z_max = max(0, where[2].min() - margin), min(mask.shape[2], where[2].max() + margin)
    return slice(x_min, x_max), slice(y_min, y_max), slice(z_min, z_max)

def crop_or_pad_around_brain_bbox(
    arr: np.ndarray, 
    brain_mask: np.ndarray, 
    target_shape: Tuple[int, int, int], 
    pad_val: float = 0.0
) -> np.ndarray:
    """
    Cắt hoặc đệm volume xung quanh tâm thực tế của nhu mô não (từ compute_bounding_box_3d)
    đảm bảo cân đối hai đầu khi hộp sọ lớn hơn hoặc nhỏ hơn target_shape.
    """
    sx, sy, sz = compute_bounding_box_3d(brain_mask, margin=4)
    centers = [(sx.start + sx.stop) // 2, (sy.start + sy.stop) // 2, (sz.start + sz.stop) // 2]
    
    out = np.full(target_shape, pad_val, dtype=arr.dtype)
    s_src, s_dst = [], []
    
    for cur_dim, targ_dim, c in zip(arr.shape, target_shape, centers):
        if cur_dim >= targ_dim:
            start_s = max(0, min(cur_dim - targ_dim, c - targ_dim // 2))
            s_src.append(slice(start_s, start_s + targ_dim))
            s_dst.append(slice(0, targ_dim))
        else:
            start_d = (targ_dim - cur_dim) // 2
            s_src.append(slice(0, cur_dim))
            s_dst.append(slice(start_d, start_d + cur_dim))
            
    out[tuple(s_dst)] = arr[tuple(s_src)]
    return out

def compute_exact_signed_distance_mm(mask_bin: np.ndarray, spacing_mm: Tuple[float, float, float]) -> np.ndarray:
    """Calculates physical Euclidean Signed Distance Function Phi(v) in mm (Maurer et al., 2003)."""
    m_bool = mask_bin.astype(bool)
    if not m_bool.any():
        return np.full(mask_bin.shape, 100.0, dtype=np.float32)
    dist_out = ndi.distance_transform_edt(~m_bool, sampling=spacing_mm)
    dist_in = ndi.distance_transform_edt(m_bool, sampling=spacing_mm)
    return (dist_out - dist_in).astype(np.float32)


# ==============================================================================
# STAGE 2: PHYSICAL RESAMPLING & CRASH-PROOF DISK-BACKED CACHING
# ==============================================================================
import gc

def preprocess_case_rigorous(row_dict: dict, cfg: ScientificPipelineConfig, vault: TargetMaskVault) -> Tuple[str, dict]:
    cid = row_dict["case_id"]
    dwi_nii = nib.as_closest_canonical(nib.load(row_dict["dwi_path"]))
    adc_nii = nib.as_closest_canonical(nib.load(row_dict["adc_path"]))
    flair_nii = nib.as_closest_canonical(nib.load(row_dict["flair_path"]))
    
    native_spacing = tuple(float(x) for x in dwi_nii.header.get_zooms()[:3])
    dwi_raw = np.nan_to_num(np.asarray(dwi_nii.dataobj, dtype=np.float32).squeeze())
    adc_raw = np.nan_to_num(np.asarray(adc_nii.dataobj, dtype=np.float32).squeeze())
    
    # 1. Căn chỉnh FLAIR theo đúng affine vật lý (RAS -> LPS)
    flair_reg = resample_flair_to_dwi_sitk(dwi_nii, flair_nii, do_rigid_reg=False)
    dwi_nii.uncache(); adc_nii.uncache(); flair_nii.uncache()
    
    # 2. Resample về 2.0mm đẳng hướng
    tsp = cfg.target_spacing
    dwi_phys = resample_arr_to_physical_spacing(dwi_raw, native_spacing, tsp, order=1)
    adc_phys = resample_arr_to_physical_spacing(adc_raw, native_spacing, tsp, order=1)
    flair_phys = resample_arr_to_physical_spacing(flair_reg, native_spacing, tsp, order=1)
    del dwi_raw, adc_raw, flair_reg  # Dọn dẹp mảng gốc để bảo vệ RAM
    
    # 3. Tách mặt nạ não
    bmask = extract_brain_mask_dwi(dwi_phys)
    
    # 4. Chuẩn hóa cường độ
    dwi_vox = dwi_phys[bmask]
    p_low, p_high = np.percentile(dwi_vox, cfg.clip_percentiles)
    dwi_norm = ((np.clip(dwi_phys, p_low, p_high) - np.mean(dwi_vox)) / (np.std(dwi_vox) + 1e-8)) * bmask
    
    flair_vox = flair_phys[bmask]
    p_low, p_high = np.percentile(flair_vox, cfg.clip_percentiles)
    flair_norm = ((np.clip(flair_phys, p_low, p_high) - np.mean(flair_vox)) / (np.std(flair_vox) + 1e-8)) * bmask
    
    # CHUẨN HOÁ ADC 3 THANG ĐO CHUẨN VẬT LÝ [0.6 - 1.5]
    adc_pos_mask = bmask & (adc_phys > 0)
    adc_pos = adc_phys[adc_pos_mask]
    adc_med = float(np.median(adc_pos)) if adc_pos.size else 0.0
    if adc_med > 50.0:        # 1e-6 mm^2/s (ví dụ ~900)
        adc_factor = 1e-3
    elif adc_med < 0.05:      # mm^2/s (ví dụ ~0.0009)
        adc_factor = 1e3
    else:                     # 1e-3 mm^2/s (đã chuẩn ~0.9)
        adc_factor = 1.0
        
    adc_scaled = np.clip(adc_phys * adc_factor * bmask, 0.0, 3.0)
    del dwi_phys, adc_phys, flair_phys, adc_pos  # Dọn dẹp mảng tạm
    
    # 5. Crop xung quanh Bounding Box của não
    ps = cfg.patch_size
    img_tensor = np.stack([
        crop_or_pad_around_brain_bbox(dwi_norm, bmask, ps, 0.0),
        crop_or_pad_around_brain_bbox(adc_scaled, bmask, ps, 0.0),
        crop_or_pad_around_brain_bbox(flair_norm, bmask, ps, 0.0)
    ], axis=0).astype(np.float16)  # Tiết kiệm 50% RAM: float16
    
    bmask_tensor = crop_or_pad_around_brain_bbox(bmask.astype(np.uint8), bmask, ps, 0) > 0
    del dwi_norm, adc_scaled, flair_norm
    
    item = {
        "case_id": cid,
        "domain": row_dict["domain"],
        "uda_split": row_dict["uda_split"],
        "native_spacing": native_spacing,
        "image": img_tensor,
        "brain_mask": bmask_tensor,
        "brain_mask_phys": bmask.astype(bool),
        "adc_factor": adc_factor,
        "mask": None,
        "sdf": None,
        "_oracle_mask": None,
        "_oracle_sdf": None,
        "gt_retention_ratio": 1.0
    }
    
    msk_path = row_dict.get("mask_path")
    is_oracle_adapt = (row_dict["uda_split"] == "D3_target_adapt" and cid in vault._vault)
    if msk_path or is_oracle_adapt:
        actual_path = msk_path if msk_path else str(vault._vault[cid])
        msk_nii = nib.as_closest_canonical(nib.load(actual_path))
        msk_raw = (np.asarray(msk_nii.dataobj).squeeze() > 0.5).astype(np.uint8)
        msk_nii.uncache()
        msk_phys = resample_arr_to_physical_spacing(msk_raw, native_spacing, tsp, order=0)
        sdf_phys = compute_exact_signed_distance_mm(msk_phys, tsp)
        del msk_raw
        
        msk_crop = crop_or_pad_around_brain_bbox(msk_phys, bmask, ps, 0)
        sdf_crop = crop_or_pad_around_brain_bbox(sdf_phys, bmask, ps, 100.0)
        
        if msk_phys.sum() > 0:
            item["gt_retention_ratio"] = float(msk_crop.sum() / msk_phys.sum())
        del msk_phys, sdf_phys
            
        if msk_path:
            item["mask"] = msk_crop[None, ...].astype(np.uint8)
            item["sdf"] = sdf_crop[None, ...].astype(np.float16)
        elif is_oracle_adapt:
            item["_oracle_mask"] = msk_crop[None, ...].astype(np.uint8)
            item["_oracle_sdf"] = sdf_crop[None, ...].astype(np.float16)
            
    del bmask
    return cid, item

def preprocess_entire_cohort_rigorous(manifest_df: pd.DataFrame, vault: TargetMaskVault, cfg: ScientificPipelineConfig) -> Dict[str, dict]:
    cfg_sig = f"v8_adc_units_{cfg.target_spacing}_{cfg.patch_size}_{len(manifest_df)}"
    cfg_hash = hashlib.md5(cfg_sig.encode()).hexdigest()[:8]
    cache_dir = cfg.work_dir / f"cache_cases_{cfg_hash}"
    cache_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"⚙️ Chạy tiền xử lý an toàn (Lưu từng ca vào đĩa, chống OOM: {cache_dir})...")
    for idx, (_, row) in enumerate(tqdm(manifest_df.iterrows(), total=len(manifest_df))):
        cid = row["case_id"]
        case_file = cache_dir / f"{cid}.pt"
        if not case_file.exists():
            _, it = preprocess_case_rigorous(row.to_dict(), cfg, vault)
            torch.save(it, case_file)
            del it
            if (idx + 1) % 20 == 0:
                gc.collect()

    print("⚡ Nạp các ca từ đĩa vào RAM (Chỉ tốn ~2.0 GB RAM)...")
    cache = {}
    for _, row in manifest_df.iterrows():
        cid = row["case_id"]
        cache[cid] = torch.load(cache_dir / f"{cid}.pt", weights_only=False)
        
    ret_ratios = [v["gt_retention_ratio"] for v in cache.values() if v["mask"] is not None or v["_oracle_mask"] is not None]
    mean_ret = float(np.mean(ret_ratios))
    min_ret = float(np.min(ret_ratios))
    print(f"📐 Tỷ lệ thể tích GT giữ lại sau Bounding-Box Crop: Mean = {mean_ret*100:.2f}%, Min = {min_ret*100:.2f}%")
    assert min_ret >= 0.90, f"Cảnh báo nghiêm trọng: Bounding box crop làm mất tổn thương (Min retention = {min_ret*100:.2f}%)!"
    return cache


class ScientificStrokeDataset(Dataset):
    def __init__(
        self, 
        cache: Dict[str, dict], 
        split: str, 
        thick_slice_aug: bool = False,
        deterministic_thick_slice: bool = False,
        allow_oracle_labels: bool = False,
        case_id_subset: Optional[List[str]] = None,
        is_train: bool = True
    ):
        items = [v for v in cache.values() if v["uda_split"] == split]
        if case_id_subset is not None:
            items = [v for v in items if v["case_id"] in case_id_subset]
        self.items = items
        self.is_train = is_train
        self.thick_slice_aug = thick_slice_aug and is_train
        self.deterministic_thick_slice = deterministic_thick_slice and (not is_train)
        self.allow_oracle_labels = allow_oracle_labels
        
    def __len__(self):
        return len(self.items)
        
    def __getitem__(self, idx: int):
        it = self.items[idx]
        img = torch.from_numpy(it["image"]).float().clone()
        bmask = torch.from_numpy(it["brain_mask"]).clone()
        
        raw_mask = it["mask"] if it["mask"] is not None else (it["_oracle_mask"] if self.allow_oracle_labels else None)
        raw_sdf = it["sdf"] if it["sdf"] is not None else (it["_oracle_sdf"] if self.allow_oracle_labels else None)
        
        mask = torch.from_numpy(raw_mask).float().clone() if raw_mask is not None else None
        sdf = torch.from_numpy(raw_sdf).float().clone() if raw_sdf is not None else None
        
        # Sagittal flip along dim 1 ONLY during training
        if self.is_train and torch.rand(1).item() < 0.5:
            img = torch.flip(img, dims=[1])
            bmask = torch.flip(bmask, dims=[0])
            if mask is not None:
                mask = torch.flip(mask, dims=[1])
                sdf = torch.flip(sdf, dims=[1])
                
        # Deterministic Thick Slice Simulation for Validation (chống rò rỉ nhãn D3 nhưng đo đúng năng lực lát dày)
        if self.deterministic_thick_slice:
            z_dim = img.shape[-1]
            low_z = max(8, z_dim // 3)
            img_low = F.interpolate(img.unsqueeze(0), size=(img.shape[1], img.shape[2], low_z), mode="area")
            img = F.interpolate(img_low, size=img.shape[1:], mode="trilinear", align_corners=False).squeeze(0)
            
        # Stochastic 3-Channel Thick Slice Simulation ONLY during training
        elif self.thick_slice_aug and torch.rand(1).item() < 0.5:
            z_dim = img.shape[-1]
            low_z = max(8, z_dim // 3)
            img_low = F.interpolate(img.unsqueeze(0), size=(img.shape[1], img.shape[2], low_z), mode="area")
            img = F.interpolate(img_low, size=img.shape[1:], mode="trilinear", align_corners=False).squeeze(0)
            
        out = {"case_id": it["case_id"], "image": img, "brain_mask": bmask}
        if mask is not None:
            out["mask"] = mask
            out["sdf"] = sdf
        return out





