import base64
import os
from typing import List

import httpx
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_IMAGE_MODEL = os.getenv("OPENAI_IMAGE_MODEL", "gpt-image-2.5-flare")

ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]

app = FastAPI(title="Thumbnatior AI API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)

MAX_REFERENCE_BYTES = 10 * 1024 * 1024
ALLOWED_TYPES = {"image/png", "image/jpeg", "image/webp"}


def verify_supabase_user(authorization: str | None) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Please sign in to continue.")
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(status_code=503, detail="Authentication service is not configured.")

    token = authorization.split(" ", 1)[1].strip()
    try:
        response = httpx.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {token}",
            },
            timeout=10.0,
        )
    except httpx.HTTPError:
        raise HTTPException(status_code=503, detail="Could not reach the authentication service.")

    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Your session is invalid or expired.")
    return response.json()


def get_image_dimensions(aspect_ratio: str) -> str:
    sizes = {
        "16:9": "1536x864",
        "1:1": "1024x1024",
        "9:16": "864x1536",
    }
    if aspect_ratio not in sizes:
        raise HTTPException(status_code=400, detail="Unsupported aspect ratio.")
    return sizes[aspect_ratio]


@app.get("/health")
def health():
    return {"status": "ok", "service": "Thumbnatior AI API"}


@app.post("/generate")
def generate(
    prompt: str = Form(..., min_length=3, max_length=4000),
    aspect_ratio: str = Form("16:9"),
    quality: str = Form("low"),
    references: List[UploadFile] = File(default=[]),
    authorization: str | None = Header(default=None),
):
    verify_supabase_user(authorization)

    if not OPENAI_API_KEY:
        raise HTTPException(status_code=503, detail="Image generation is not configured yet.")
    if len(references) > 4:
        raise HTTPException(status_code=400, detail="You can upload up to 4 reference images.")
    if quality not in {"low", "medium", "high"}:
        raise HTTPException(status_code=400, detail="Unsupported render quality.")

    image_files = []
    for upload in references:
        if upload.content_type not in ALLOWED_TYPES:
            raise HTTPException(status_code=400, detail="Use PNG, JPEG, or WEBP reference images.")
        content = upload.file.read(MAX_REFERENCE_BYTES + 1)
        if len(content) > MAX_REFERENCE_BYTES:
            raise HTTPException(status_code=413, detail="Each reference image must be 10 MB or smaller.")
        if not content:
            raise HTTPException(status_code=400, detail="One of the reference images is empty.")
        image_files.append(
            (upload.filename or "reference.png", content, upload.content_type)
        )

    client = OpenAI(api_key=OPENAI_API_KEY)
    size = get_image_dimensions(aspect_ratio)

    try:
        if image_files:
            result = client.images.edit(
                model=OPENAI_IMAGE_MODEL,
                image=image_files,
                prompt=prompt,
                size=size,
                quality=quality,
                output_format="png",
            )
        else:
            result = client.images.generate(
                model=OPENAI_IMAGE_MODEL,
                prompt=prompt,
                size=size,
                quality=quality,
                output_format="png",
            )
    except Exception as exc:
        # Avoid returning secrets or provider internals to the browser.
        raise HTTPException(
            status_code=502,
            detail="The image service could not complete this request. Check API access, billing, and try again.",
        ) from exc

    encoded = result.data[0].b64_json if result.data else None
    if not encoded:
        raise HTTPException(status_code=502, detail="The image service returned an empty result.")

    return {"image_base64": encoded, "format": "png"}
