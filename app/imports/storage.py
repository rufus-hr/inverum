import io
import uuid
from minio import Minio
from minio.error import S3Error
from app.core.config import settings


def _client() -> Minio:
    return Minio(
        settings.MINIO_ENDPOINT,
        access_key=settings.MINIO_ACCESS_KEY,
        secret_key=settings.MINIO_SECRET_KEY,
        secure=settings.MINIO_SECURE,
    )


def _build_path(tenant_id: uuid.UUID, job_id: uuid.UUID, ext: str) -> str:
    return f"imports/{tenant_id}/{job_id}/original.{ext}"


def _ext(filename: str) -> str:
    parts = filename.rsplit(".", 1)
    return parts[1].lower() if len(parts) == 2 else "bin"


class FileStorage:
    def save(self, tenant_id: uuid.UUID, job_id: uuid.UUID, filename: str, content: bytes) -> str:
        path = _build_path(tenant_id, job_id, _ext(filename))
        _client().put_object(
            settings.MINIO_BUCKET,
            path,
            io.BytesIO(content),
            length=len(content),
            content_type="application/octet-stream",
        )
        return path

    def read(self, path: str) -> bytes:
        response = _client().get_object(settings.MINIO_BUCKET, path)
        try:
            return response.read()
        finally:
            response.close()
            response.release_conn()

    def delete(self, path: str) -> None:
        try:
            _client().remove_object(settings.MINIO_BUCKET, path)
        except S3Error:
            pass

    def path_for_job(self, tenant_id: uuid.UUID, job_id: uuid.UUID, filename: str) -> str:
        return _build_path(tenant_id, job_id, _ext(filename))


storage = FileStorage()
