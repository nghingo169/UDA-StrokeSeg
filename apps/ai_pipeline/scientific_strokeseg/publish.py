# Clean scientific result packaging without raw target-mask leakage.
from __future__ import annotations
from .interfaces import *

def package_clean_scientific_outputs(cfg: ScientificPipelineConfig):
    in_kaggle = os.path.exists("/kaggle/working") or "KAGGLE_KERNEL_RUN_TYPE" in os.environ
    out_dir = Path("/kaggle/working") if in_kaggle else cfg.work_dir / "scientific_kaggle_ready"
    out_dir.mkdir(parents=True, exist_ok=True)
    
    zip_dest = out_dir / "uda_strokeseg_scientific_results.zip"
    print(f"📦 Packaging clean experimental results into {zip_dest}...")
    
    with zipfile.ZipFile(zip_dest, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in cfg.work_dir.glob("*.csv"):
            zf.write(f, arcname=f.name)
            print(f"  ✓ Added CSV: {f.name}")
        for f in cfg.work_dir.glob("*.png"):
            zf.write(f, arcname=f.name)
            print(f"  ✓ Added PNG: {f.name}")
        for f in cfg.work_dir.glob("*.pt"):
            if "cache" not in f.name:
                zf.write(f, arcname=f"checkpoints/{f.name}")
                print(f"  ✓ Added Model: {f.name}")
                
    print(f"\n🎉 Clean scientific package ready! File size: {zip_dest.stat().st_size / (1024*1024):.2f} MB.")






