# API Service (FastAPI)

## Run

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Database Migration

```bash
alembic upgrade head
```

## Seed Demo Data

```bash
python -m app.scripts.seed_demo
```

## Core Endpoints

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/generations`
- `GET /api/v1/me/wallet`
- `POST /api/v1/me/wallet/topup` (mock recharge)
- `GET /api/v1/me/generations`
- `GET /api/v1/admin/users`
- `GET /api/v1/admin/orders`
- `GET /api/v1/admin/ledgers`
- `GET /api/v1/admin/generations`
- `GET/POST /api/v1/admin/templates`
