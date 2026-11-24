# Scientific UDA-StrokeSeg modules

This package is the import-safe Python extraction of
`notes/UDA_StrokeSeg_Rigorous_Scientific_Pipeline.ipynb`.

- `interfaces.py`: shared dependencies, configuration, device, and domain constants.
- `data.py`: download helpers, cohort partitioning, registration, preprocessing, and dataset class.
- `models.py`: 3D network, FDA transform, and training losses.
- `metrics.py`: segmentation and lesion-level metrics.
- `train.py`: single-condition training loop.
- `evaluate.py`: model evaluation and statistical analysis.
- `figures.py`: profiling, atlas/territory analysis, and clinical overlays.
- `publish.py`: clean result packaging.

Notebook-only execution blocks are deliberately excluded from module import time. Call the functions explicitly from a notebook, experiment runner, or CLI after configuring data paths and dependencies.
