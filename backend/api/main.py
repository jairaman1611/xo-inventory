"""
api/main.py  —  XO Inventory REST backend
Run with:  uvicorn api.main:app --reload --port 7755
"""
from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from xo.session import session

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(name)s  %(message)s")
log = logging.getLogger("xo.api")

app = FastAPI(title="XO Inventory", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Auth models ───────────────────────────────────────────────────────────────

class PasswordAuth(BaseModel):
    host:       str
    username:   str
    password:   str
    verify_ssl: bool = False

class TokenAuth(BaseModel):
    host:       str
    token:      str
    verify_ssl: bool = False

class OTPSubmit(BaseModel):
    otp: str


# ── Auth routes ───────────────────────────────────────────────────────────────

@app.get("/api/status")
async def get_status():
    return session.status_dict()

@app.post("/api/auth/password")
async def auth_password(body: PasswordAuth):
    result = await session.connect_password(
        body.host, body.username, body.password, body.verify_ssl
    )
    if result["status"] == "error":
        raise HTTPException(status_code=401, detail=result["error"])
    return result

@app.post("/api/auth/otp")
async def auth_otp(body: OTPSubmit):
    result = await session.submit_otp(body.otp)
    if result["status"] == "error":
        raise HTTPException(status_code=401, detail=result["error"])
    return result

@app.post("/api/auth/token")
async def auth_token(body: TokenAuth):
    result = await session.connect_token(body.host, body.token, body.verify_ssl)
    if result["status"] == "error":
        raise HTTPException(status_code=401, detail=result["error"])
    return result

@app.post("/api/auth/disconnect")
async def auth_disconnect():
    return await session.disconnect()


# ── Inventory routes ──────────────────────────────────────────────────────────

@app.get("/api/inventory")
async def get_inventory():
    if not session.connected:
        raise HTTPException(status_code=403, detail="Not connected to XO")
    try:
        return await session.fetch_inventory()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/inventory/vms")
async def get_vms():
    data = await get_inventory()
    return data["vms"]

@app.get("/api/inventory/hosts")
async def get_hosts():
    data = await get_inventory()
    return data["hosts"]

@app.get("/api/inventory/storage")
async def get_storage():
    data = await get_inventory()
    return data["storage"]

@app.get("/api/inventory/networks")
async def get_networks():
    data = await get_inventory()
    return data["networks"]

@app.get("/api/inventory/summary")
async def get_summary():
    data = await get_inventory()
    return data["summary"]




# ── Serve built React frontend ────────────────────────────────────────────────
# Resolve path relative to THIS file:
#   this file  → backend/api/main.py
#   project    → xo-inventory/
#   dist       → xo-inventory/frontend/dist/

_THIS   = Path(__file__).resolve()          # .../xo-inventory/backend/api/main.py
_BACK   = _THIS.parent.parent               # .../xo-inventory/backend/
_ROOT   = _BACK.parent                      # .../xo-inventory/
_DIST   = _ROOT / "frontend" / "dist"

log.info("Frontend dist path: %s  (exists=%s)", _DIST, _DIST.exists())

if _DIST.exists():
    _ASSETS = _DIST / "assets"
    if _ASSETS.exists():
        app.mount("/assets", StaticFiles(directory=str(_ASSETS)), name="assets")

    @app.get("/")
    async def serve_root():
        return FileResponse(str(_DIST / "index.html"))

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404)
        candidate = _DIST / full_path
        if candidate.exists() and candidate.is_file():
            return FileResponse(str(candidate))
        return FileResponse(str(_DIST / "index.html"))

else:
    log.warning("Frontend dist not found at %s — UI will not be served.", _DIST)

    @app.get("/")
    async def no_frontend():
        return {
            "error": "Frontend not built yet.",
            "fix":   "Run:  cd frontend && npm install && npm run build",
            "dist_expected": str(_DIST),
        }
