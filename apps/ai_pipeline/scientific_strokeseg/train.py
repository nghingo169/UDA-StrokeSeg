# Training loop for one scientific ablation condition.
from __future__ import annotations
from .interfaces import *
from .models import *
from .metrics import *
from .data import ScientificStrokeDataset

def train_scientific_condition(
    condition: str,
    cache: Dict[str, dict],
    cfg: ScientificPipelineConfig,
    run_seed: int = 42
) -> Tuple[ScientificStrokeNet3D, float]:
    # 1. Re-seed độc lập cho từng điều kiện để đảm bảo khởi tạo & thứ tự batch giống hệt nhau
    seed_everything(run_seed)
    print(f"\n{'='*70}\n🚀 TRAINING CONDITION: [{condition}] (Seed={run_seed})\n{'='*70}")
    
    # Chuẩn hóa thick-slice augmentation: MT_thick_aug, proposed_no_contrastive, proposed_no_fda, proposed_uda_strokeseg ĐỀU CÓ
    use_thick = (condition in ("source_only_thick_aug", "mean_teacher_thick_aug", "proposed_no_contrastive", "proposed_no_fda", "proposed_uda_strokeseg"))
    
    if condition == "target_oracle_supervised":
        d3_adapt_ids = sorted([k for k, v in cache.items() if v["uda_split"] == "D3_target_adapt"])
        src_train_ds = ScientificStrokeDataset(cache, "D3_target_adapt", allow_oracle_labels=True, case_id_subset=d3_adapt_ids[:30], is_train=True)
        src_val_ds = ScientificStrokeDataset(cache, "D3_target_adapt", allow_oracle_labels=True, case_id_subset=d3_adapt_ids[30:], is_train=False)
    else:
        src_train_ds = ScientificStrokeDataset(cache, "D1_source_train", thick_slice_aug=use_thick, is_train=True)
        # ✅ Deterministic thick-slice validation trên D1-val: Đo lường chính xác năng lực lát dày mà không rò rỉ nhãn D3!
        src_val_ds = ScientificStrokeDataset(cache, "D1_source_val", thick_slice_aug=False, deterministic_thick_slice=use_thick, is_train=False)
        
    trg_adapt_ds = ScientificStrokeDataset(cache, "D3_target_adapt", thick_slice_aug=False, is_train=True)
    
    src_loader = DataLoader(src_train_ds, batch_size=cfg.batch_size, shuffle=True, drop_last=False)
    trg_loader = DataLoader(trg_adapt_ds, batch_size=cfg.batch_size, shuffle=True, drop_last=False)
    
    model = ScientificStrokeNet3D(in_channels=3, base_filters=cfg.base_filters, proj_dim=cfg.proj_dim).to(DEVICE)
    optimizer = torch.optim.AdamW(model.parameters(), lr=cfg.lr, weight_decay=cfg.weight_decay)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=cfg.num_epochs, eta_min=1e-5)
    
    seg_criterion = AsymmetricUnifiedLoss(gamma=cfg.focal_gamma, delta=cfg.focal_delta)
    con_criterion = CorrectedPhysicalContrastiveLoss(cfg).to(DEVICE)
    
    teacher_model = None
    if condition in ("mean_teacher_thick_aug", "proposed_no_contrastive", "proposed_no_fda", "proposed_uda_strokeseg"):
        teacher_model = copy.deepcopy(model).to(DEVICE)
        for p in teacher_model.parameters():
            p.requires_grad = False
            
    best_val_dsc = -1.0
    best_epoch = 1
    best_weights = copy.deepcopy(model.state_dict())
    epochs_no_improve = 0
    
    for epoch in range(1, cfg.num_epochs + 1):
        model.train()
        ep_loss = 0.0
        steps = 0
        lam_con = cfg.lambda_con_max * min(1.0, epoch / max(1, cfg.rampup_epochs))
        
        trg_iter = iter(trg_loader)
        for src_batch in src_loader:
            try:
                trg_batch = next(trg_iter)
            except StopIteration:
                trg_iter = iter(trg_loader)
                trg_batch = next(trg_iter)
                
            x_s = src_batch["image"].to(DEVICE)
            if "mask" not in src_batch or src_batch["mask"] is None:
                raise RuntimeError(f"❌ LỖI: Điều kiện [{condition}] đang chạy nhưng src_batch không có mask!")
            y_s = src_batch["mask"].to(DEVICE)
            sdf_s = src_batch["sdf"].to(DEVICE)
            
            x_t, bmask_t = trg_batch["image"].to(DEVICE), trg_batch["brain_mask"].to(DEVICE)
            
            min_b = min(x_s.size(0), x_t.size(0))
            x_s, y_s, sdf_s = x_s[:min_b], y_s[:min_b], sdf_s[:min_b]
            x_t, bmask_t = x_t[:min_b], bmask_t[:min_b]
            
            optimizer.zero_grad()
            
            if condition in ("source_only_baseline", "source_only_thick_aug", "target_oracle_supervised"):
                logit_s, sdf_pred = model(x_s, return_feat=False, return_sdf=True)
                loss_seg = seg_criterion(logit_s, y_s)
                loss_sdf = F.smooth_l1_loss(sdf_pred, torch.clamp(sdf_s / 20.0, -1.0, 1.0))
                loss_total = loss_seg + cfg.lambda_sdf * loss_sdf
                
            elif condition == "mean_teacher_thick_aug":
                logit_s, sdf_pred = model(x_s, return_feat=False, return_sdf=True)
                loss_seg = seg_criterion(logit_s, y_s)
                loss_sdf = F.smooth_l1_loss(sdf_pred, torch.clamp(sdf_s / 20.0, -1.0, 1.0))
                
                noise = 0.03 * torch.randn_like(x_t)
                logit_t_stu = model(x_t + noise, return_feat=False, return_sdf=False)
                with torch.no_grad():
                    logit_t_tea = teacher_model(x_t, return_feat=False, return_sdf=False)
                # ✅ Giảm nhiễu không gian: Chỉ tính loss_cons bên trong nhu mô não bmask_t
                diff_sq = (torch.sigmoid(logit_t_stu) - torch.sigmoid(logit_t_tea)) ** 2
                loss_cons = (diff_sq * bmask_t.unsqueeze(1).float()).sum() / (bmask_t.sum() + 1e-5)
                loss_total = loss_seg + cfg.lambda_sdf * loss_sdf + lam_con * (5.0 * loss_cons)
                
            elif condition == "proposed_no_contrastive":
                # Đầy đủ FDA + Thick Aug + Mean Teacher + Dual-task SDF, NHƯNG KHÔNG CÓ Contrastive Loss
                x_s_fda = selective_3d_fda(x_s, x_t, beta=cfg.fda_beta)
                logit_s, sdf_pred = model(x_s_fda, return_feat=False, return_sdf=True)
                loss_seg = seg_criterion(logit_s, y_s)
                loss_sdf = F.smooth_l1_loss(sdf_pred, torch.clamp(sdf_s / 20.0, -1.0, 1.0))
                
                noise = 0.03 * torch.randn_like(x_t)
                logit_t_stu = model(x_t + noise, return_feat=False, return_sdf=False)
                with torch.no_grad():
                    logit_t_tea = teacher_model(x_t, return_feat=False, return_sdf=False)
                diff_sq = (torch.sigmoid(logit_t_stu) - torch.sigmoid(logit_t_tea)) ** 2
                loss_cons = (diff_sq * bmask_t.unsqueeze(1).float()).sum() / (bmask_t.sum() + 1e-5)
                loss_total = loss_seg + cfg.lambda_sdf * loss_sdf + lam_con * (5.0 * loss_cons)
                
            elif condition in ("proposed_no_fda", "proposed_uda_strokeseg"):
                x_s_in = selective_3d_fda(x_s, x_t, beta=cfg.fda_beta) if condition == "proposed_uda_strokeseg" else x_s
                logit_s, feat_s, sdf_pred = model(x_s_in, return_feat=True, return_sdf=True)
                loss_seg = seg_criterion(logit_s, y_s)
                loss_sdf = F.smooth_l1_loss(sdf_pred, torch.clamp(sdf_s / 20.0, -1.0, 1.0))
                
                # Nhánh EMA Teacher trên x_t (mỏ neo cố định không đạo hàm)
                with torch.no_grad():
                    logit_t_tea, feat_t_tea = teacher_model(x_t, return_feat=True, return_sdf=False)
                prob_t_tea = torch.sigmoid(logit_t_tea)
                
                # Nhánh Student trên x_t: vừa lấy logit_t_stu cho Mean Teacher, vừa lấy feat_t_stu có đạo hàm cho Contrastive
                noise = 0.03 * torch.randn_like(x_t)
                logit_t_stu, feat_t_stu = model(x_t + noise, return_feat=True, return_sdf=False)
                
                # Contrastive hai chiều: feat_s (Student) <-> feat_t_tea (Teacher) và feat_t_stu (Student) <-> proto_s
                loss_con = con_criterion(feat_s, feat_t_tea, feat_t_stu, prob_t_tea, y_s, sdf_s, x_t, bmask_t)
                
                diff_sq = (torch.sigmoid(logit_t_stu) - prob_t_tea) ** 2
                loss_cons = (diff_sq * bmask_t.unsqueeze(1).float()).sum() / (bmask_t.sum() + 1e-5)
                
                # Cân bằng thang đo chặt chẽ: MSE consistency (~1e-2) và InfoNCE (~4.0)
                loss_total = loss_seg + cfg.lambda_sdf * loss_sdf + lam_con * (5.0 * loss_cons + 0.15 * loss_con)
                
            loss_total.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 2.0)
            optimizer.step()
            
            # EMA Update Teacher
            if teacher_model is not None:
                for tp, sp in zip(teacher_model.parameters(), model.parameters()):
                    tp.data.mul_(0.99).add_(sp.data, alpha=0.01)
                    
            ep_loss += float(loss_total.item())
            steps += 1
            
        scheduler.step()
        
        # Validation on validation set
        eval_m = teacher_model if teacher_model is not None else model
        eval_m.eval()
        val_dscs = []
        with torch.no_grad():
            for vb in DataLoader(src_val_ds, batch_size=cfg.batch_size):
                vx, vy = vb["image"].to(DEVICE), vb["mask"].to(DEVICE) > 0.5
                vp = torch.sigmoid(eval_m(vx)) >= 0.40
                inter = (vp & vy).sum().item()
                union = vp.sum().item() + vy.sum().item()
                val_dscs.append((2.0 * inter + 1e-5) / (union + 1e-5))
        m_val = float(np.mean(val_dscs))
        
        # Tiêu chí lưu checkpoint tốt nhất:
        # Đối với các điều kiện UDA, ưu tiên chọn checkpoint sau giai đoạn rampup để mô hình đã thích nghi đầy đủ
        is_best = (m_val > best_val_dsc + 1e-4) and (epoch > cfg.rampup_epochs or epoch == cfg.num_epochs)
        if is_best:
            best_val_dsc = m_val
            best_epoch = epoch
            best_weights = copy.deepcopy(eval_m.state_dict())
            epochs_no_improve = 0
        else:
            epochs_no_improve += 1
            if epoch > cfg.rampup_epochs and epochs_no_improve >= cfg.early_stop_patience:
                print(f"⏹️ Early stopping kích hoạt tại epoch {epoch} (không cải thiện sau {cfg.early_stop_patience} epochs).")
                break
            
        if epoch % 10 == 0 or is_best:
            tag = "⭐ [BEST]" if is_best else ""
            print(f"  Ep {epoch:02d}/{cfg.num_epochs:02d} | Loss: {ep_loss/steps:.4f} | Val DSC: {m_val:.4f} {tag}")
            
    model.load_state_dict(best_weights)
    print(f"✅ Restored best weights from Ep {best_epoch} (Val DSC = {best_val_dsc:.4f})")
    
    # Chuẩn hóa ngưỡng cố định 0.40 cho asymmetric focal loss
    opt_th = 0.40
    
    ckpt_path = cfg.work_dir / f"scientific_{condition}_best.pt"
    torch.save({"condition": condition, "best_epoch": best_epoch, "val_dsc": best_val_dsc, "opt_threshold": opt_th, "state_dict": best_weights}, ckpt_path)
    return model, opt_th





