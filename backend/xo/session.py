"""
xo/session.py

XO MFA reality (confirmed by probe):
  - Step 1: send username + password alone  → always returns error code 3
  - Step 2: send username + password + otp  → succeeds if OTP is correct

So the correct flow is:
  1. connect_password()  → stores creds, sets status="needs_otp" IMMEDIATELY
                           (we skip the password-only attempt entirely)
  2. submit_otp(otp)     → sends all three fields together, connects on success

Token auth is unaffected (no OTP needed).
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Literal

from .client import XOClient, XOError
from .normalise import norm_vm, norm_host, norm_sr, norm_network, norm_pool

log = logging.getLogger("xo.session")

Status = Literal["disconnected", "connecting", "needs_otp", "connected", "error"]


@dataclass
class SessionState:
    status: Status = "disconnected"
    error:  str    = ""
    _pending_host:     str  = field(default="", repr=False)
    _pending_username: str  = field(default="", repr=False)
    _pending_password: str  = field(default="", repr=False)
    _pending_verify:   bool = field(default=False, repr=False)


class XOSession:
    def __init__(self):
        self._client: XOClient | None = None
        self._lock  = asyncio.Lock()
        self.state  = SessionState()

    @property
    def connected(self) -> bool:
        return self.state.status == "connected"

    def status_dict(self) -> dict:
        return {"status": self.state.status, "error": self.state.error}

    # ── password auth ─────────────────────────────────────────────────────────

    async def connect_password(self, host: str, username: str, password: str,
                               verify_ssl: bool = False) -> dict:
        """
        Store credentials and open the WebSocket.
        Always transitions to 'needs_otp' — XO requires OTP even if MFA is
        not configured (in that case submit_otp('') will be called with empty string,
        but in practice we always ask the user).
        The actual sign-in happens in submit_otp().
        """
        async with self._lock:
            await self._close()
            client = XOClient(host, verify_ssl=verify_ssl)
            try:
                await client.connect()
                self._client = client
                self.state = SessionState(
                    status="needs_otp",
                    _pending_host=host,
                    _pending_username=username,
                    _pending_password=password,
                    _pending_verify=verify_ssl,
                )
                log.info("WebSocket open, waiting for OTP from user")
            except Exception as e:
                await client.disconnect()
                self.state = SessionState(status="error", error=str(e))
        return self.status_dict()

    async def submit_otp(self, otp: str) -> dict:
        """
        Send username + password + otp together — the only call that works with MFA.
        """
        async with self._lock:
            if self.state.status != "needs_otp" or not self._client:
                return {"status": "error", "error": "No pending session — connect first"}
            try:
                await self._client.sign_in(
                    self.state._pending_username,
                    self.state._pending_password,
                    otp=otp,
                )
                self.state.status = "connected"
                self.state.error  = ""
                log.info("Signed in as %s", self.state._pending_username)
            except XOError as e:
                self.state.status = "error"
                self.state.error  = str(e)
            except Exception as e:
                self.state.status = "error"
                self.state.error  = str(e)
        return self.status_dict()

    # ── token auth ────────────────────────────────────────────────────────────

    async def connect_token(self, host: str, token: str, verify_ssl: bool = False) -> dict:
        async with self._lock:
            await self._close()
            client = XOClient(host, verify_ssl=verify_ssl)
            try:
                await client.connect()
                await client.sign_in_token(token)
                self._client = client
                self.state = SessionState(status="connected")
                log.info("Signed in via token")
            except Exception as e:
                await client.disconnect()
                self.state = SessionState(status="error", error=str(e))
        return self.status_dict()

    # ── disconnect ────────────────────────────────────────────────────────────

    async def disconnect(self) -> dict:
        async with self._lock:
            await self._close()
            self.state = SessionState()
        return self.status_dict()

    async def _close(self):
        if self._client:
            try:
                await self._client.disconnect()
            except Exception:
                pass
            self._client = None

    # ── inventory ─────────────────────────────────────────────────────────────

    def _require(self):
        if not self.connected or not self._client:
            raise RuntimeError("Not connected to XO")

    async def fetch_inventory(self) -> dict:
        self._require()
        c = self._client

        vms_raw, hosts_raw, srs_raw, nets_raw, pools_raw, vifs_raw, pifs_raw = \
            await asyncio.gather(
                c.get_vms(), c.get_hosts(), c.get_srs(),
                c.get_networks(), c.get_pools(), c.get_vifs(), c.get_pifs(),
            )

        # Index VIFs by both their uuid ("id") AND their OpaqueRef ("$ref").
        # VM.VIFs lists OpaqueRef strings, so we need the $ref key for lookups;
        # the uuid key is kept for any future direct-id lookups.
        vif_map = {}
        for v in (vifs_raw or []):
            key_id  = v.get("id") or v.get("uuid", "")
            key_ref = v.get("$ref") or v.get("ref", "")
            if key_id:  vif_map[key_id]  = v
            if key_ref: vif_map[key_ref] = v
        pif_map = {}
        for p in (pifs_raw or []):
            key_id  = p.get("id") or p.get("uuid", "")
            key_ref = p.get("$ref") or p.get("ref", "")
            if key_id:  pif_map[key_id]  = p
            if key_ref: pif_map[key_ref] = p
        net_map = {n.get("id") or n.get("uuid", ""): n for n in (nets_raw or [])}

        vms   = [norm_vm(v, vif_map, net_map) for v in (vms_raw   or [])
                 if not v.get("is_template") and not v.get("is_snapshot")]
        hosts = [norm_host(h, vms)            for h in (hosts_raw or [])]
        srs   = [norm_sr(s)                   for s in (srs_raw   or [])]
        nets  = [norm_network(n, pif_map)     for n in (nets_raw  or [])]
        pools = [norm_pool(p)                 for p in (pools_raw or [])]

        running_vms = [v for v in vms if v["power_state"] == "Running"]
        total_mem   = sum(h["mem_total_gb"] or 0 for h in hosts)
        used_mem    = sum(h["mem_used_gb"]  or 0 for h in hosts)
        total_stor  = sum(s["total_gb"]     or 0 for s in srs)
        used_stor   = sum(s["used_gb"]      or 0 for s in srs)

        return {
            "vms":      vms,
            "hosts":    hosts,
            "storage":  srs,
            "networks": nets,
            "pools":    pools,
            "summary": {
                "total_vms":      len(vms),
                "running_vms":    len(running_vms),
                "halted_vms":     len([v for v in vms if v["power_state"] == "Halted"]),
                "paused_vms":     len([v for v in vms if v["power_state"] == "Paused"]),
                "total_hosts":    len(hosts),
                "online_hosts":   len([h for h in hosts if h["power_state"] == "Online"]),
                "total_pools":    len(pools),
                "total_networks": len(nets),
                "total_srs":      len(srs),
                "mem_total_gb":   round(total_mem, 1),
                "mem_used_gb":    round(used_mem, 1),
                "mem_pct":        round(used_mem / total_mem * 100, 1) if total_mem else 0,
                "stor_total_gb":  round(total_stor, 1),
                "stor_used_gb":   round(used_stor, 1),
                "stor_pct":       round(used_stor / total_stor * 100, 1) if total_stor else 0,
                "total_vcpus":    sum(v["vcpus"] or 0 for v in running_vms),
                "avg_cpu_pct":    round(
                    sum(h["cpu_usage_pct"] or 0 for h in hosts) / len(hosts), 1
                ) if hosts else 0,
            },
        }


# singleton
session = XOSession()
