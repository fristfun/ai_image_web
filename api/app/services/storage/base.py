from abc import ABC, abstractmethod


class StorageProvider(ABC):
    @abstractmethod
    def save_bytes(self, content: bytes, relative_path: str) -> str:
        raise NotImplementedError
