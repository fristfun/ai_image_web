# AI Image Generator Monorepo

This repository contains a split architecture MVP:

- `web`: Next.js App Router frontend (user + admin pages)
- `api`: FastAPI backend (auth, generation, wallet, templates, admin APIs)

## Tech Stack

- Frontend: Next.js, TypeScript, Tailwind CSS
- Backend: FastAPI, SQLAlchemy, Alembic, PostgreSQL
- AI: OpenAI `gpt-image-2` via server-side API calls only

## Quick Start

1. Configure backend env from `api/.env.example`.
2. Configure frontend env from `web/.env.example`.
3. Start PostgreSQL.
4. Run backend:
   - `cd api`
   - `python -m venv .venv`
   - `.venv\Scripts\activate`
   - `pip install -r requirements.txt`
   - `uvicorn app.main:app --reload --port 8000`
5. Run frontend:
   - `cd web`
   - `npm install`
   - `npm run dev`

## Notes

- File storage currently uses local disk implementation.
- The storage provider abstraction is ready for OSS/R2 replacement.
- Billing is points-based and priced by `size + quality`.
