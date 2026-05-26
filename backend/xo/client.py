"""
xo/client.py  —  READ-ONLY XO WebSocket JSON-RPC client

SAFETY NOTICE:
  This client calls ONLY these two XO RPC methods:
    - session.signIn      (authenticate — no data mutation)
    - xo.getAllObjects    (read all XAPI objects — pure read, no side effects)

  NO vm.start / vm.stop / vm.reboot / vm.migrate / vm.snapshot / vm.delete
  NO host.restart / host.shutdown / sr.destroy / network.create or any
  other mutating method is present or callable from this codebase.

  If you add any method call here in future, verify it is read-only first.
"""

import asyncio
import json
import ssl
import logging
from typing import Any

import websockets

log = logging.getLogger("xo.client")

READ_ONLY_METHODS = frozenset({
    "session.signIn",
    "xo.getAllObjects",
})


class XOError(Exception):
    pass


class XOClient:
    def __init__(self, host: str, verify_ssl: bool = False):
        base = host.rstrip("/").replace("https://", "wss://").replace("http://", "ws://")
        if not base.startswith(("ws://", "wss://")):
            base = "wss://" + base
        self.url        = base + "/api/"
        self.verify_ssl = verify_ssl
        self._ws        = None
        self._id        = 0
        self._pending: dict[int, asyncio.Future] = {}
        self._reader: asyncio.Task | None = None

    # ── connection ────────────────────────────────────────────────────────────

    async def connect(self):
        ssl_ctx = None
        if self.url.startswith("wss://"):
            ssl_ctx = ssl.create_default_context()
            if not self.verify_ssl:
                ssl_ctx.check_hostname = False
                ssl_ctx.verify_mode    = ssl.CERT_NONE
        self._ws = await websockets.connect(
            self.url, ssl=ssl_ctx,
            ping_interval=20, ping_timeout=30,
            max_size=64 * 1024 * 1024,
        )
        self._reader = asyncio.create_task(self._read_loop())
        log.info("WebSocket connected to %s", self.url)

    async def disconnect(self):
        if self._reader:
            self._reader.cancel()
        if self._ws:
            await self._ws.close()

    # ── low-level RPC (read-only guard) ───────────────────────────────────────

    async def _read_loop(self):
        try:
            async for raw in self._ws:
                msg = json.loads(raw)
                mid = msg.get("id")
                if mid is not None and mid in self._pending:
                    self._pending[mid].set_result(msg)
        except Exception as exc:
            for fut in self._pending.values():
                if not fut.done():
                    fut.set_exception(exc)

    async def call(self, method: str, params: dict | None = None, timeout: float = 30) -> Any:
        # Hard guard — reject any method not on the read-only allowlist
        if method not in READ_ONLY_METHODS:
            raise PermissionError(
                f"Method '{method}' is not on the read-only allowlist. "
                f"Allowed: {sorted(READ_ONLY_METHODS)}"
            )

        self._id += 1
        mid     = self._id
        payload = json.dumps({"jsonrpc": "2.0", "id": mid,
                              "method": method, "params": params or {}})
        fut: asyncio.Future = asyncio.get_event_loop().create_future()
        self._pending[mid]  = fut
        await self._ws.send(payload)
        try:
            result = await asyncio.wait_for(fut, timeout=timeout)
        finally:
            self._pending.pop(mid, None)
        if "error" in result:
            raise XOError(result["error"].get("message", str(result["error"])))
        return result.get("result")

    # ── auth (read-only — signIn does not mutate data) ────────────────────────

    async def sign_in(self, username: str, password: str, otp: str | None = None):
        params: dict[str, Any] = {"username": username, "password": password}
        if otp:
            params["otp"] = otp
        result = await self.call("session.signIn", params)
        log.info("Signed in as %s", username)
        return result

    async def sign_in_token(self, token: str):
        result = await self.call("session.signIn", {"token": token})
        log.info("Signed in via token")
        return result

    # ── read-only object fetchers ─────────────────────────────────────────────

    async def get_all_objects(self, type_filter: str | None = None) -> dict:
        params = {}
        if type_filter:
            params["filter"] = {"type": type_filter}
        return await self.call("xo.getAllObjects", params, timeout=60)

    async def get_objects_of_type(self, xo_type: str) -> list[dict]:
        objects = await self.get_all_objects(type_filter=xo_type)
        if isinstance(objects, dict):
            return list(objects.values())
        return objects or []

    async def get_vms(self)      -> list[dict]: return await self.get_objects_of_type("VM")
    async def get_hosts(self)    -> list[dict]: return await self.get_objects_of_type("host")
    async def get_networks(self) -> list[dict]: return await self.get_objects_of_type("network")
    async def get_pools(self)    -> list[dict]: return await self.get_objects_of_type("pool")
    async def get_srs(self)      -> list[dict]: return await self.get_objects_of_type("SR")
    async def get_vdis(self)     -> list[dict]: return await self.get_objects_of_type("VDI")
    async def get_vifs(self)     -> list[dict]: return await self.get_objects_of_type("VIF")
    async def get_pifs(self)     -> list[dict]: return await self.get_objects_of_type("PIF")
