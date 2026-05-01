from enum import Enum


class UserRole(str, Enum):
    USER = "USER"
    ADMIN = "ADMIN"


class TaskStatus(str, Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"


class LedgerType(str, Enum):
    TOPUP = "TOPUP"
    FREEZE = "FREEZE"
    CAPTURE = "CAPTURE"
    RELEASE = "RELEASE"
    REFUND = "REFUND"
    ARREARS_INCUR = "ARREARS_INCUR"
    ARREARS_SETTLE = "ARREARS_SETTLE"


class ImageSize(str, Enum):
    AUTO = "auto"
    S256 = "256x256"
    S512 = "512x512"
    S1024 = "1024x1024"
    P1024x1792 = "1024x1792"
    P1024x1536 = "1024x1536"
    L1536x1024 = "1536x1024"
    L1792x1024 = "1792x1024"
    S2048 = "2048x2048"
    L2048x1152 = "2048x1152"
    P2160x3840 = "2160x3840"
    L3840x2160 = "3840x2160"
    P1088x1920 = "1088x1920"
    L1920x1088 = "1920x1088"
    S1440 = "1440x1440"
    P1280x1920 = "1280x1920"
    L1920x1280 = "1920x1280"


class ImageQuality(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ImageFormat(str, Enum):
    WEBP = "webp"
    PNG = "png"
    JPEG = "jpeg"
