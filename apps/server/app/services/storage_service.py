def object_url(bucket: str, key: str) -> str:
    return f"demo://{bucket}/{key}"


def storage_usage() -> dict:
    return {
        "used_gb": 68.4,
        "capacity_gb": 100,
        "last_backup": "2026-09-13T02:00:00Z",
        "restore_via": "CLI / Bastion only - not available in Web UI",
    }
