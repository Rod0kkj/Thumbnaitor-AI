# Thumbnatior AI

A cloud-based web app concept for creating and refining video thumbnails with text prompts and reference images. The interface is in English. Image generation is designed to run on a remote backend, not on the visitor's GPU.

> **Development status:** MVP 0.2. This is a starter project, not a deployed or production-ready service. Real account, storage, and image-generation flows require correctly configured provider projects and credentials.

## Repository structure

- `frontend/` — Next.js + React web interface and Supabase client.
- `backend/` — FastAPI service for authenticated image-generation requests.
- `supabase/schema.sql` — database table, private storage bucket, and row-level security policies.
- `.github/workflows/ci.yml` — basic automated frontend/backend checks on pushes and pull requests.

## Requirements

- Node.js 20+
- Python 3.10+
- A Supabase project
- An image-generation API account. API usage may incur charges.

## Run locally

### 1. Configure Supabase

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL Editor.
3. Configure email authentication.
4. Copy the project URL and publishable/anon key from the project settings.

### 2. Configure the frontend

In `frontend/`, copy `.env.local.example` to `.env.local` and set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL=http://localhost:8000`

Then run:

```bash
cd frontend
npm install
npm run dev
```

### 3. Configure the backend

In `backend/`, create and activate a virtual environment:

```bash
python -m venv .venv
```

Windows PowerShell:

```powershell
.venv\\Scripts\\Activate.ps1
```

macOS/Linux:

```bash
source .venv/bin/activate
```

Install dependencies and create `backend/.env` from `.env.example`:

```bash
pip install -r requirements.txt
```

Set the following backend-only values:

- `OPENAI_API_KEY`
- `OPENAI_IMAGE_MODEL` (the configured default must be checked for current provider availability)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `ALLOWED_ORIGINS=http://localhost:3000`

Start the API:

```bash
uvicorn main:app --reload --port 8000
```

In a second terminal, start the frontend with `npm run dev` from `frontend/`. Open `http://localhost:3000`.

## Current MVP scope

- Public sign-up and sign-in UI using Supabase email/password authentication.
- English-language interface and public landing page/workspace.
- Prompt-based image generation through the backend.
- Reference image uploads and iterative refinement using the previous result as a reference.
- Landscape 16:9, square 1:1, and portrait 9:16 output options.
- Project saving to the signed-in user's private Supabase storage and project history.

Some flows cannot be verified until valid Supabase and image-provider credentials are configured. No live deployment is included in this repository archive.

## GitHub safety

- Never commit `.env`, `.env.local`, API keys, access tokens, or service-role keys.
- The `.gitignore` excludes environment files, dependency folders, build output, and Python caches.
- Keep the repository **Private** while the project is under development.
- If a secret is accidentally committed, removing it in a later commit is not enough: revoke/rotate that secret immediately.

## Before public launch

Add per-user quotas and rate limits, abuse protection, prompt/image moderation, upload validation, privacy policy and terms, data deletion controls, HTTPS, monitoring, backups, spending limits, and thorough Supabase row-level-security tests using separate accounts. Review current provider model availability and pricing before enabling paid generation.

## Automated checks

GitHub Actions runs a TypeScript check for the frontend and a Python syntax check for the backend on pushes and pull requests to `main`. These checks do not replace end-to-end tests with real credentials.
