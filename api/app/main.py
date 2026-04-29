import re

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from app.api.v1 import api_router
from app.core.config import settings
from app.core.errors import ApiError

app = FastAPI(title=settings.app_name)


LOCAL_ORIGIN_PATTERN = re.compile(r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$")


def is_allowed_origin(origin: str | None) -> bool:
    return bool(origin and LOCAL_ORIGIN_PATTERN.match(origin))


app.add_middleware(
    CORSMiddleware,
    # In local development the frontend port may change (3000/3001/3002...).
    # Let CORSMiddleware handle all origins, while fallback middleware below
    # still narrows reflected headers to localhost / 127.0.0.1.
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router)
app.mount("/uploads", StaticFiles(directory=settings.local_storage_dir), name="uploads")


@app.middleware("http")
async def cors_fallback_middleware(request: Request, call_next):
    origin = request.headers.get("origin")
    if request.method == "OPTIONS" and is_allowed_origin(origin):
        return Response(
            status_code=204,
            headers={
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
                "Access-Control-Allow-Headers": request.headers.get("access-control-request-headers", "*"),
                "Access-Control-Allow-Credentials": "true",
                "Vary": "Origin",
            },
        )

    response = await call_next(request)
    if is_allowed_origin(origin):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Vary"] = "Origin"
    return response


@app.get("/health")
def health():
    return {"ok": True}


@app.exception_handler(ApiError)
def api_error_handler(_: Request, exc: ApiError):
    detail = exc.detail if isinstance(exc.detail, dict) else {"code": "ERROR", "message": str(exc.detail)}
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "code": detail.get("code", "ERROR"),
            "message": detail.get("message", "请求失败"),
        },
    )


@app.exception_handler(RequestValidationError)
def validation_error_handler(_: Request, exc: RequestValidationError):
    errors = exc.errors()
    first = errors[0] if errors else {}
    err_type = first.get("type", "")
    loc = first.get("loc", [])
    field = loc[-1] if loc else "field"

    if field == "email":
        message = "邮箱格式不正确"
    elif field == "password" and "too_short" in err_type:
        message = "密码至少 8 位"
    elif field == "password":
        message = "密码不符合要求"
    else:
        message = f"参数校验失败: {field}"

    return JSONResponse(
        status_code=422,
        content={
            "code": "VALIDATION_ERROR",
            "message": message,
            "details": errors,
        },
    )


@app.exception_handler(Exception)
def unhandled_error_handler(_: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "code": "INTERNAL_SERVER_ERROR",
            "message": "服务内部错误，请稍后重试",
            "details": str(exc),
        },
    )
