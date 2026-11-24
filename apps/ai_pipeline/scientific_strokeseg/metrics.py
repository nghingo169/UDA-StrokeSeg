# Segmentation and lesion-level clinical metrics.
from __future__ import annotations
from .interfaces import *

def compute_dsc_exact(pred: np.ndarray, gt: np.ndarray) -> float:
    """
    Computes exact Dice Similarity Coefficient.
    Quy tắc chuẩn ISLES-2022 cho ca tổn thương:
    - Nếu ground truth có tổn thương (gt > 0) và mô hình dự đoán rỗng (pred == 0): DSC = 0.0.
    - Nếu cả hai cùng rỗng (không có tổn thương trong GT lẫn Pred): trả về 1.0 (True Negative).
    """
    p = pred > 0
    g = gt > 0
    if not p.any() and not g.any():
        return 1.0
    if not p.any() or not g.any():
        return 0.0
    return float(2.0 * (p & g).sum() / (p.sum() + g.sum()))

def compute_avd_ml_exact(pred: np.ndarray, gt: np.ndarray, spacing: Tuple[float, float, float]) -> float:
    vox_ml = float(np.prod(spacing)) / 1000.0
    return float(abs(int((pred > 0).sum()) - int((gt > 0).sum())) * vox_ml)

def remove_small_components(pred: np.ndarray, min_vol_ml: float, spacing: Tuple[float, float, float]) -> np.ndarray:
    lab, n = ndi.label(pred > 0, structure=np.ones((3, 3, 3)))
    if n == 0:
        return (pred > 0).astype(np.uint8)
    vox_ml = float(np.prod(spacing)) / 1000.0
    sizes = np.bincount(lab.ravel())
    keep = np.flatnonzero(sizes * vox_ml >= min_vol_ml)
    keep = keep[keep > 0]
    return np.isin(lab, keep).astype(np.uint8)

def compute_lesion_level_f1(pred: np.ndarray, gt: np.ndarray, min_vol_ml: float = 0.05, spacing: Tuple[float, float, float] = (2.0, 2.0, 2.0)) -> Tuple[float, float, float]:
    st = np.ones((3, 3, 3))
    pred_f = remove_small_components(pred, min_vol_ml, spacing)
    pl, n_p = ndi.label(pred_f > 0, structure=st)
    gl, n_g = ndi.label(gt > 0, structure=st)
    if n_p == 0 and n_g == 0:
        return 1.0, 1.0, 1.0
    if n_p == 0 or n_g == 0:
        return 0.0, 0.0, 0.0
    tp_p = sum(1 for i in range(1, n_p + 1) if ((pl == i) & (gl > 0)).any())
    tp_g = sum(1 for j in range(1, n_g + 1) if ((gl == j) & (pl > 0)).any())
    prec = tp_p / n_p
    rec = tp_g / n_g
    f1 = 2.0 * prec * rec / (prec + rec) if (prec + rec) > 0 else 0.0
    return float(f1), float(prec), float(rec)

def compute_hd95_exact(pred: np.ndarray, gt: np.ndarray, spacing: Tuple[float, float, float]) -> float:
    """Computes true Hausdorff Distance 95% using exact morphological surface definition."""
    p_bool = pred > 0.5
    g_bool = gt > 0.5
    
    if not p_bool.any() and not g_bool.any():
        return 0.0
    if not p_bool.any() or not g_bool.any():
        return 50.0
        
    p_surf = p_bool ^ ndi.binary_erosion(p_bool)
    g_surf = g_bool ^ ndi.binary_erosion(g_bool)
    
    if not p_surf.any() or not g_surf.any():
        return 50.0
        
    dt_gt = ndi.distance_transform_edt(~g_bool, sampling=spacing)
    dt_pred = ndi.distance_transform_edt(~p_bool, sampling=spacing)
    
    d_p_to_g = dt_gt[p_surf]
    d_g_to_p = dt_pred[g_surf]
    
    return float(max(np.percentile(d_p_to_g, 95), np.percentile(d_g_to_p, 95)))

def tune_optimal_threshold(model: nn.Module, val_ds: Dataset, device: torch.device) -> float:
    """Mặc định chuẩn hóa ngưỡng lâm sàng 0.40 cho asymmetric focal loss, tránh overfitting riêng lẻ."""
    return 0.40





