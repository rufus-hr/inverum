"""
File storage abstraction — S3-ready interface.
Current implementation: local filesystem.
Phase 2: swap implementation for S3/MinIO without changing callers.
"""

import os
import uuid
from pathlib import Path

# Base directory for import file storage.
# Override with IMPORT_STORAGE_ROOT env var for production.
_STORAGE_ROOT = Path(os.getenv("IMPORT_STORAGE_ROOT", "/tmp/inverum-imports"))


class FileStorage:
    def save(
        self,
        tenant_id: uuid.UUID,
        job_id: uuid.UUID,
        filename: str,
        content: bytes,
    ) -> str:
        """
        Save uploaded file and return the storage path.
        Path format: /imports/{tenant_id}/{job_id}/original.{ext}
        """
        # TODO: implement
        raise NotImplementedError

    def read(self, path: str) -> bytes:
        """Read file content from storage path."""
        # TODO: implement
        raise NotImplementedError

    def delete(self, path: str) -> None:
        """Delete file from storage."""
        # TODO: implement
        raise NotImplementedError

    def _ext(self, filename: str) -> str:
        return Path(filename).suffix.lower().lstrip(".")

    def _build_path(self, tenant_id: uuid.UUID, job_id: uuid.UUID, ext: str) -> Path:
        return _STORAGE_ROOT / "imports" / str(tenant_id) / str(job_id) / f"original.{ext}"


storage = FileStorage()
