# Disaster Recovery (Out-of-band)

Web UI **must not** expose Restore. Use Bastion/SSH only.

1. Verify SHA-256 of latest snapshot
2. Provision isolated DB
3. `psql ... < backup_*.sql`
4. Sync MinIO buckets by `StorageObject.StorageID`
5. Run `tests/.../test_native_volumetry.py` before reopening API
