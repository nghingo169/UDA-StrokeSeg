# 3D backbone, selective FDA, and physics-gated losses.
from __future__ import annotations
from .interfaces import *

class SEBlock3D(nn.Module):
    def __init__(self, channels: int, reduction: int = 4):
        super().__init__()
        mid = max(4, channels // reduction)
        self.fc = nn.Sequential(
            nn.AdaptiveAvgPool3d(1),
            nn.Conv3d(channels, mid, kernel_size=1),
            nn.LeakyReLU(0.01, inplace=True),
            nn.Conv3d(mid, channels, kernel_size=1),
            nn.Sigmoid()
        )
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return x * self.fc(x)

class AttentionGate3D(nn.Module):
    def __init__(self, f_g: int, f_l: int, f_int: int):
        super().__init__()
        self.W_g = nn.Sequential(nn.Conv3d(f_g, f_int, 1, bias=False), nn.InstanceNorm3d(f_int, affine=True))
        self.W_x = nn.Sequential(nn.Conv3d(f_l, f_int, 1, bias=False), nn.InstanceNorm3d(f_int, affine=True))
        self.psi = nn.Sequential(nn.LeakyReLU(0.01, inplace=True), nn.Conv3d(f_int, 1, 1), nn.Sigmoid())
    def forward(self, g: torch.Tensor, x: torch.Tensor) -> torch.Tensor:
        if g.shape[2:] != x.shape[2:]:
            g = F.interpolate(g, size=x.shape[2:], mode="trilinear", align_corners=False)
        return x * self.psi(self.W_g(g) + self.W_x(x))

class ResConvBlock3D(nn.Module):
    def __init__(self, in_ch: int, out_ch: int):
        super().__init__()
        self.conv1 = nn.Conv3d(in_ch, out_ch, kernel_size=3, padding=1, bias=False)
        self.norm1 = nn.InstanceNorm3d(out_ch, affine=True)
        self.act = nn.LeakyReLU(0.01, inplace=True)
        self.conv2 = nn.Conv3d(out_ch, out_ch, kernel_size=3, padding=1, bias=False)
        self.norm2 = nn.InstanceNorm3d(out_ch, affine=True)
        self.se = SEBlock3D(out_ch)
        self.skip = nn.Conv3d(in_ch, out_ch, kernel_size=1, bias=False) if in_ch != out_ch else nn.Identity()
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        identity = self.skip(x)
        out = self.act(self.norm1(self.conv1(x)))
        out = self.norm2(self.conv2(out))
        out = self.se(out)
        return self.act(out + identity)

class ScientificStrokeNet3D(nn.Module):
    def __init__(self, in_channels: int = 3, base_filters: int = 16, proj_dim: int = 128):
        super().__init__()
        f1, f2, f3, f4 = base_filters, base_filters * 2, base_filters * 4, base_filters * 8
        self.enc1 = ResConvBlock3D(in_channels, f1)
        self.pool1 = nn.MaxPool3d(2)
        self.enc2 = ResConvBlock3D(f1, f2)
        self.pool2 = nn.MaxPool3d(2)
        self.enc3 = ResConvBlock3D(f2, f3)
        self.pool3 = nn.MaxPool3d(2)
        self.bottleneck = ResConvBlock3D(f3, f4)
        
        self.ag3 = AttentionGate3D(f4, f3, f3 // 2)
        self.up3 = nn.ConvTranspose3d(f4, f3, kernel_size=2, stride=2)
        self.dec3 = ResConvBlock3D(f3 * 2, f3)
        
        self.ag2 = AttentionGate3D(f3, f2, f2 // 2)
        self.up2 = nn.ConvTranspose3d(f3, f2, kernel_size=2, stride=2)
        self.dec2 = ResConvBlock3D(f2 * 2, f2)
        
        self.ag1 = AttentionGate3D(f2, f1, f1 // 2)
        self.up1 = nn.ConvTranspose3d(f2, f1, kernel_size=2, stride=2)
        self.dec1 = ResConvBlock3D(f1 * 2, f1)
        
        self.seg_head = nn.Conv3d(f1, 1, kernel_size=1)
        self.sdf_head = nn.Sequential(
            nn.Conv3d(f1, f1 // 2, kernel_size=3, padding=1, bias=False),
            nn.InstanceNorm3d(f1 // 2, affine=True),
            nn.LeakyReLU(0.01, inplace=True),
            nn.Conv3d(f1 // 2, 1, kernel_size=1),
            nn.Tanh()
        )
        self.proj_head = nn.Sequential(
            nn.Conv3d(f2 + f3, proj_dim, kernel_size=1, bias=False),
            nn.InstanceNorm3d(proj_dim, affine=True),
            nn.LeakyReLU(0.01, inplace=True),
            nn.Conv3d(proj_dim, proj_dim, kernel_size=1)
        )
        
    def forward(self, x: torch.Tensor, return_feat: bool = False, return_sdf: bool = False):
        e1 = self.enc1(x)
        e2 = self.enc2(self.pool1(e1))
        e3 = self.enc3(self.pool2(e2))
        b = self.bottleneck(self.pool3(e3))
        
        u3 = self.up3(b)
        d3 = self.dec3(torch.cat([u3, self.ag3(b, e3)], dim=1))
        u2 = self.up2(d3)
        d2 = self.dec2(torch.cat([u2, self.ag2(d3, e2)], dim=1))
        u1 = self.up1(d2)
        d1 = self.dec1(torch.cat([u1, self.ag1(d2, e1)], dim=1))
        
        logit = self.seg_head(d1)
        out = [logit]
        
        if return_feat:
            e3_up = F.interpolate(e3, size=e2.shape[2:], mode="trilinear", align_corners=False)
            feat = F.normalize(self.proj_head(torch.cat([e2, e3_up], dim=1)), p=2, dim=1)
            out.append(feat)
            
        if return_sdf:
            sdf = self.sdf_head(d1)
            out.append(sdf)
            
        return out[0] if len(out) == 1 else tuple(out)


def selective_3d_fda(src: torch.Tensor, trg: torch.Tensor, beta: float = 0.05) -> torch.Tensor:
    """Applies 3D FDA strictly to DWI (ch 0) and FLAIR (ch 2), preserving quantitative ADC (ch 1)."""
    if beta <= 0.0:
        return src
    out = src.clone()
    for ch in [0, 2]:
        vol_s = src[:, ch:ch+1]
        vol_t = trg[:, ch:ch+1]
        _, _, D, H, W = vol_s.shape
        
        fft_s = torch.fft.fftn(vol_s, dim=(-3, -2, -1))
        fft_t = torch.fft.fftn(vol_t, dim=(-3, -2, -1))
        
        amp_s, pha_s = torch.abs(fft_s), torch.angle(fft_s)
        amp_t = torch.abs(fft_t)
        
        amp_s_shift = torch.fft.fftshift(amp_s, dim=(-3, -2, -1)).clone()
        amp_t_shift = torch.fft.fftshift(amp_t, dim=(-3, -2, -1))
        
        b_d = max(1, int(np.floor(D * beta / 2.0)))
        b_h = max(1, int(np.floor(H * beta / 2.0)))
        b_w = max(1, int(np.floor(W * beta / 2.0)))
        c_d, c_h, c_w = D // 2, H // 2, W // 2
        
        amp_s_shift[:, :, c_d-b_d:c_d+b_d, c_h-b_h:c_h+b_h, c_w-b_w:c_w+b_w] = \
            amp_t_shift[:, :, c_d-b_d:c_d+b_d, c_h-b_h:c_h+b_h, c_w-b_w:c_w+b_w]
            
        amp_mix = torch.fft.ifftshift(amp_s_shift, dim=(-3, -2, -1))
        adapted = torch.fft.ifftn(torch.polar(amp_mix, pha_s), dim=(-3, -2, -1)).real
        out[:, ch:ch+1] = adapted
    return out

class AsymmetricUnifiedLoss(nn.Module):
    def __init__(self, gamma: float = 2.0, delta: float = 0.65):
        super().__init__()
        self.gamma = gamma
        self.delta = delta
        
    def forward(self, logit: torch.Tensor, target: torch.Tensor) -> torch.Tensor:
        p = torch.sigmoid(logit)
        t = target.float()
        
        inter = (p * t).sum(dim=(1, 2, 3, 4))
        union = p.sum(dim=(1, 2, 3, 4)) + t.sum(dim=(1, 2, 3, 4))
        l_dice = 1.0 - (2.0 * inter + 1e-5) / (union + 1e-5)
        
        bce = F.binary_cross_entropy_with_logits(logit, t, reduction="none")
        p_t = p * t + (1.0 - p) * (1.0 - t)
        focal_weight = self.delta * t + (1.0 - self.delta) * (1.0 - t)
        l_focal = (focal_weight * ((1.0 - p_t) ** self.gamma) * bce).mean()
        
        return l_dice.mean() + l_focal  # Trả về scalar

class CorrectedPhysicalContrastiveLoss(nn.Module):
    """
    Symmetric Physics-Gated Contrastive Loss (MoCo/SupCon chuẩn Khosla et al.):
    - Trích xuất mẫu dương miền đích dựa trên Cổng Vật Lý Lõi Não (Eroded Brain Mask & 0.20 <= ADC <= 0.62 & DWI > 0.5)
      kết hợp Tiên nghiệm Sinh lý Lõi (Gaussian mu=0.45) và Độ tự tin của EMA Teacher.
    - Cập nhật đạo hàm HAI CHIỀU (Bidirectional Gradient):
      1. Kéo đặc trưng Student miền nguồn (feat_s) về phía Prototype & Positives của EMA Teacher miền đích (feat_t_tea).
      2. Kéo đặc trưng Student miền đích (feat_t_stu) tại các vị trí cổng vật lý về phía Prototype lõi miền nguồn (proto_s).
    """
    def __init__(self, cfg: ScientificPipelineConfig):
        super().__init__()
        self.cfg = cfg
        
    def forward(
        self,
        z_s: torch.Tensor,
        z_t_tea: torch.Tensor,
        z_t_stu: Optional[torch.Tensor],
        prob_t_tea: Optional[torch.Tensor],
        msk_s: torch.Tensor,
        sdf_s: torch.Tensor,
        x_t: torch.Tensor,
        bmask_t: torch.Tensor
    ) -> torch.Tensor:
        z_t_tea = z_t_tea.detach()  # Cố định đặc trưng đích từ EMA Teacher
        B = min(z_s.shape[0], z_t_tea.shape[0], x_t.shape[0])
        _, C, D, H, W = z_s.shape
        device = z_s.device
        
        msk_s_ds = F.interpolate(msk_s.float(), size=(D, H, W), mode="nearest").squeeze(1) > 0.5
        sdf_s_ds = F.interpolate(sdf_s.float(), size=(D, H, W), mode="trilinear", align_corners=False).squeeze(1)
        x_t_ds = F.interpolate(x_t.float(), size=(D, H, W), mode="trilinear", align_corners=False)
        bmask_t_ds = F.interpolate(bmask_t.float().unsqueeze(1), size=(D, H, W), mode="nearest").squeeze(1) > 0.5
        
        # Co nhẹ mặt nạ não 1 bước ở độ phân giải đặc trưng (~4mm) để loại bỏ triệt để nhiễu cảm ứng từ sát vỏ sọ
        core_bmask_t = (-F.max_pool3d(-bmask_t_ds.float().unsqueeze(1), kernel_size=3, stride=1, padding=1).squeeze(1)) > 0.5
        prob_t_ds = F.interpolate(prob_t_tea.float(), size=(D, H, W), mode="trilinear", align_corners=False).squeeze(1) if prob_t_tea is not None else None
        
        adc_t = x_t_ds[:, 1]
        dwi_t = x_t_ds[:, 0]
        
        losses = []
        for b in range(B):
            pos_mask = msk_s_ds[b] & (sdf_s_ds[b] <= -self.cfg.delta_pos_mm)
            if not pos_mask.any():
                pos_mask = msk_s_ds[b]
            if not pos_mask.any():
                continue
                
            hn_mask = (~msk_s_ds[b]) & (sdf_s_ds[b] > 0.0) & (sdf_s_ds[b] <= self.cfg.delta_neg_mm)
            
            # Ưu tiên lấy cổng vật lý bên trong vùng lõi nhu mô não (core_bmask_t), fallback về bmask_t_ds nếu tổn thương sát vỏ
            t_gate = (adc_t[b] >= 0.20) & (adc_t[b] <= self.cfg.adc_cytotoxic_threshold) & (dwi_t[b] > 0.5) & core_bmask_t[b]
            if not t_gate.any():
                t_gate = (adc_t[b] >= 0.20) & (adc_t[b] <= self.cfg.adc_cytotoxic_threshold) & (dwi_t[b] > 0.5) & bmask_t_ds[b]
            t_bg_mask = (adc_t[b] > self.cfg.adc_cytotoxic_threshold) & (dwi_t[b] <= 0.0) & bmask_t_ds[b]
            
            feat_s = z_s[b].permute(1, 2, 3, 0)
            feat_t_tea = z_t_tea[b].permute(1, 2, 3, 0)
            
            u_anchors = feat_s[pos_mask]
            if len(u_anchors) > 64:
                u_anchors = u_anchors[torch.randperm(len(u_anchors), device=device)[:64]]
                
            v_hard_negs = feat_s[hn_mask]
            v_sdfs = sdf_s_ds[b][hn_mask]
            if len(v_hard_negs) > 128:
                p_idx = torch.randperm(len(v_hard_negs), device=device)[:128]
                v_hard_negs = v_hard_negs[p_idx]
                v_sdfs = v_sdfs[p_idx]
                
            w_hn = 1.0 + self.cfg.hard_neg_alpha * torch.exp(-v_sdfs / self.cfg.sdf_sigma_mm)
            
            cand_t_tea = feat_t_tea[t_gate]
            adc_t_vals = adc_t[b][t_gate]
            t_bg = feat_t_tea[t_bg_mask]
            if len(t_bg) > 64:
                t_bg = t_bg[torch.randperm(len(t_bg), device=device)[:64]]
                
            if len(cand_t_tea) == 0:
                continue
                
            k_top = min(16, len(cand_t_tea))
            phys_core_prior = torch.exp(-((adc_t_vals - 0.45) ** 2) / 0.04)
            
            if prob_t_ds is not None:
                prob_tea_vals = prob_t_ds[b][t_gate]
                sel_score = (prob_tea_vals * phys_core_prior) if (prob_tea_vals >= 0.30).any() else phys_core_prior
            else:
                sel_score = phys_core_prior
                
            phys_rank_idx = torch.topk(sel_score, k_top).indices
            top_cand_t = cand_t_tea[phys_rank_idx]
            
            proto_t = F.normalize(top_cand_t.mean(dim=0, keepdim=True), p=2, dim=-1)
            pos_targets = torch.cat([top_cand_t, proto_t], dim=0)  # (K+1, C)
            
            # 1. Chiều Source Student -> Target EMA Teacher (SupCon L_out chuẩn)
            sim_pos = torch.matmul(u_anchors, pos_targets.T) / self.cfg.temperature  # (Nu, K+1)
            max_sim = sim_pos.max(dim=1, keepdim=True).values.detach()
            exp_pos = torch.exp(sim_pos - max_sim)  # (Nu, K+1)
            
            neg_sum = torch.zeros((len(u_anchors), 1), device=device)
            if len(v_hard_negs) > 0:
                sim_hn = torch.matmul(u_anchors, v_hard_negs.T) / self.cfg.temperature
                neg_sum = neg_sum + (w_hn.unsqueeze(0) * torch.exp(sim_hn - max_sim)).sum(dim=1, keepdim=True)
            if len(t_bg) > 0:
                sim_bg = torch.matmul(u_anchors, t_bg.T) / self.cfg.temperature
                neg_sum = neg_sum + torch.exp(sim_bg - max_sim).sum(dim=1, keepdim=True)
                
            log_prob_s2t = sim_pos - max_sim - torch.log(exp_pos.sum(dim=1, keepdim=True) + neg_sum + 1e-8)
            loss_s2t = -log_prob_s2t.mean()
            
            # 2. Chiều Target Student -> Source Core Prototype (Giúp Encoder học trực tiếp trên dữ liệu đích x_t)
            if z_t_stu is not None:
                feat_t_stu = z_t_stu[b].permute(1, 2, 3, 0)
                u_t_stu = feat_t_stu[t_gate][phys_rank_idx]  # Có đạo hàm trực tiếp
                proto_s = F.normalize(u_anchors.detach().mean(dim=0, keepdim=True), p=2, dim=-1)
                
                sim_t2s_pos = torch.matmul(u_t_stu, proto_s.T) / self.cfg.temperature  # (K, 1)
                all_t2s_sims = [sim_t2s_pos]
                if len(t_bg) > 0:
                    all_t2s_sims.append(torch.matmul(u_t_stu, t_bg.T) / self.cfg.temperature)
                if len(v_hard_negs) > 0:
                    all_t2s_sims.append(torch.matmul(u_t_stu, v_hard_negs.detach().T) / self.cfg.temperature)
                cat_t2s = torch.cat(all_t2s_sims, dim=1)
                max_t2s = cat_t2s.max(dim=1, keepdim=True).values.detach()
                exp_t2s = torch.exp(cat_t2s - max_t2s)
                loss_t2s = -torch.log(exp_t2s[:, :1] / (exp_t2s.sum(dim=1, keepdim=True) + 1e-8) + 1e-8).mean()
                losses.append(0.5 * (loss_s2t + loss_t2s))
            else:
                losses.append(loss_s2t)
                
        if len(losses) == 0:
            return torch.tensor(0.0, device=device, requires_grad=True)
        return torch.stack(losses).mean()





