# Shared imports, reproducibility helpers, pipeline configuration, and domain constants.
from __future__ import annotations

import sys, os, subprocess

def install_packages():
    pkgs = ["nibabel", "SimpleITK", "scipy", "scikit-image", "matplotlib", "pandas", "tqdm", "openpyxl"]
    in_colab = "google.colab" in sys.modules
    in_kaggle = os.path.exists("/kaggle/working") or "KAGGLE_KERNEL_RUN_TYPE" in os.environ
    if in_colab or in_kaggle:
        print("🔧 Installing required scientific and imaging packages...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-q"] + pkgs)
    else:
        print("💻 Local environment detected.")


import os
import json
import time
import math
import copy
import shutil
import hashlib
import warnings
import zipfile
import urllib.request
from pathlib import Path
from dataclasses import dataclass
from typing import Dict, List, Tuple, Optional

import numpy as np
import pandas as pd
import scipy.ndimage as ndi
from scipy.stats import wilcoxon
import nibabel as nib
import SimpleITK as sitk
import matplotlib.pyplot as plt

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader
from tqdm.auto import tqdm

warnings.filterwarnings("ignore")
sitk.ProcessObject.SetGlobalDefaultNumberOfThreads(2)

def seed_everything(seed: int = 42):
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
        torch.backends.cudnn.deterministic = True
        torch.backends.cudnn.benchmark = False


DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"✅ PyTorch: {torch.__version__} | Device: {DEVICE}")


def _resolve_environment_paths():
    in_kaggle = os.path.exists("/kaggle/working") or "KAGGLE_KERNEL_RUN_TYPE" in os.environ
    if in_kaggle:
        k_input = Path("/kaggle/input")
        found_isles, found_xlsx = None, None
        if k_input.exists():
            for p in k_input.rglob("sub-strokecase*"):
                found_isles = p.parent
                break
            for x in k_input.rglob("*center*.xlsx"):
                found_xlsx = x
                break
        w_dir = Path("/kaggle/working/uda_strokeseg_workspace")
        i_dir = found_isles if found_isles is not None else w_dir / "ISLES-2022"
        c_xlsx = found_xlsx if found_xlsx is not None else w_dir / "center_ids.xlsx"
        return w_dir, i_dir, c_xlsx
    else:
        return (
            Path("./uda_strokeseg_workspace"),
            Path("./research/strokeseg/_isles/ISLES-2022"),
            Path("./research/strokeseg/_isles/center_ids.xlsx")
        )

_env_work_dir, _env_isles_dir, _env_center_xlsx = _resolve_environment_paths()

@dataclass
class ScientificPipelineConfig:
    work_dir: Path = _env_work_dir
    isles_dir: Path = _env_isles_dir
    center_xlsx: Path = _env_center_xlsx
    
    auto_download: bool = True
    max_cases_per_run: Optional[int] = None
    
    # Standard Physical Spacing & Geometry (72 slices covers full 144mm z-axis)
    target_spacing: Tuple[float, float, float] = (2.0, 2.0, 2.0)
    patch_size: Tuple[int, int, int] = (112, 112, 72)
    clip_percentiles: Tuple[float, float] = (0.5, 99.5)
    
    # Physics & Biology
    adc_cytotoxic_threshold: float = 0.62  # 620 x 10^-6 mm^2/s = 0.62 x 10^-3 mm^2/s
    delta_pos_mm: float = 4.0              # Deep lesion core (>= 2 voxels inside border)
    delta_neg_mm: float = 6.0              # Border hard negative band
    sdf_sigma_mm: float = 2.0
    hard_neg_alpha: float = 2.0
    
    # Architecture
    base_filters: int = 16
    proj_dim: int = 128
    temperature: float = 0.07
    
    # Selective FDA (DWI & FLAIR only)
    use_fda: bool = True
    fda_beta: float = 0.05
    
    # Training Hyperparameters
    batch_size: int = 2
    num_epochs: int = 70
    lr: float = 1e-3
    weight_decay: float = 1e-5
    focal_gamma: float = 2.0
    focal_delta: float = 0.65
    lambda_con_max: float = 0.40
    lambda_sdf: float = 0.25
    rampup_epochs: int = 8
    early_stop_patience: int = 14
    
    min_lesion_volume_ml: float = 0.05

CFG = ScientificPipelineConfig()
CFG.work_dir.mkdir(parents=True, exist_ok=True)

DOM_D1 = "D1: C1 DWI 2mm + 3D FLAIR"
DOM_D2 = "D2: C1 DWI 2mm + 2D FLAIR"
DOM_D3 = "D3: C2 thick DWI 4.8mm"





