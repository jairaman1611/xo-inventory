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




@app.get("/api/debug/vm-ips")
async def debug_vm_ips():
    """Debug: show exactly where IPs live on a running VM object."""
    if not session.connected:
        raise HTTPException(status_code=403, detail="Not connected to XO")
    c = session._client
    vms_raw = await c.get_vms()

    # Find a running VM
    running = [v for v in vms_raw
               if v.get("power_state","").lower() == "running"
               and not v.get("is_template") and not v.get("is_snapshot")]
    if not running:
        return {"error": "no running VMs found"}

    vm = running[0]
    # Return full key list + any key that might hold IP data
    ip_candidates = {k: v for k, v in vm.items()
                     if any(x in k.lower() for x in
                            ["ip","addr","guest","net","vif","xen","tool"])}
    return {
        "vm_name":      vm.get("name_label") or vm.get("name"),
        "all_keys":     sorted(vm.keys()),
        "ip_candidates": ip_candidates,
        "VIFs_field":   vm.get("VIFs"),
        "addresses":    vm.get("addresses"),
        "guest_metrics":vm.get("guest_metrics"),
    }


@app.get("/api/debug/vifs")
async def debug_vifs():
    """Temporary debug endpoint — returns raw VIF sample + VM.VIFs list sample."""
    if not session.connected:
        raise HTTPException(status_code=403, detail="Not connected to XO")
    c = session._client
    vifs_raw = await c.get_vifs()
    vms_raw  = await c.get_vms()

    # Sample first VIF — show all its keys
    sample_vif = vifs_raw[0] if vifs_raw else {}

    # Sample first running VM with VIFs
    sample_vm = next(
        (v for v in vms_raw if v.get("VIFs") and v.get("power_state","").lower() == "running"),
        vms_raw[0] if vms_raw else {}
    )

    # Cross-reference: pick the first VIF ref from that VM and try to find it
    vm_vif_refs = sample_vm.get("VIFs", [])
    first_ref   = vm_vif_refs[0] if vm_vif_refs else None

    vif_by_id  = {v.get("id") or v.get("uuid",""): True for v in vifs_raw}
    vif_by_ref = {v.get("$ref") or v.get("ref",""): True for v in vifs_raw}

    found_by_id  = first_ref in vif_by_id  if first_ref else None
    found_by_ref = first_ref in vif_by_ref if first_ref else None

    # Show all unique keys present across all VIFs
    all_keys: set = set()
    for v in vifs_raw[:20]:
        all_keys.update(v.keys())

    return {
        "vif_count":        len(vifs_raw),
        "vif_keys_seen":    sorted(all_keys),
        "sample_vif":       {k: sample_vif.get(k) for k in sorted(sample_vif.keys())},
        "sample_vm_name":   sample_vm.get("name_label") or sample_vm.get("name"),
        "sample_vm_VIFs":   vm_vif_refs[:5],
        "first_vif_ref_from_vm": first_ref,
        "found_in_vif_map_by_id":  found_by_id,
        "found_in_vif_map_by_ref": found_by_ref,
        "sample_vif_id":    sample_vif.get("id"),
        "sample_vif_uuid":  sample_vif.get("uuid"),
        "sample_vif_$ref":  sample_vif.get("$ref"),
        "sample_vif_ref":   sample_vif.get("ref"),
        "sample_vif_ipv4":  sample_vif.get("ipv4_addresses"),
        "sample_vif_ipv6":  sample_vif.get("ipv6_addresses"),
    }


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
