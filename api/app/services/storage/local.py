from pathlib import Path

from app.core.config import settings
from app.services.storage.base import StorageProvider


class LocalStorageProvider(StorageProvider):
    def __init__(self) -> None:
        self.root = Path(settings.local_storage_dir)
        self.root.mkdir(parents=True, exist_ok=True)

    def save_bytes(self, content: bytes, relative_path: str) -> str:
        target = self.root / relative_path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
        return str(target.as_posix())
