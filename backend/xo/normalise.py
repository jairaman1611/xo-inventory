"""
xo/normalise.py
Transforms raw XAPI objects into clean, frontend-ready dicts.
"""
from __future__ import annotations
import time


def _mb(b: int | None) -> float | None:
    return round(b / 1_048_576, 1) if b else None

def _gb(b: int | None) -> float | None:
    return round(b / 1_073_741_824, 2) if b else None

def _pct(used: int | None, total: int | None) -> float | None:
    if used and total and total > 0:
        return round(used / total * 100, 1)
    return None

def _uptime_str(seconds: int | None) -> str:
    if not seconds or seconds < 0:
        return "—"
    d = seconds // 86400
    h = (seconds % 86400) // 3600
    m = (seconds % 3600) // 60
    if d: return f"{d}d {h}h {m}m"
    if h: return f"{h}h {m}m"
    return f"{m}m"


# ── VMs ───────────────────────────────────────────────────────────────────────

def norm_vm(raw: dict, vif_map: dict, network_map: dict) -> dict:
    mem_used  = raw.get("memory", {}).get("usage")
    mem_total = raw.get("memory", {}).get("size")

    # IPs come directly from VM.addresses: {"0/ipv4/0": "1.2.3.4", "0/ipv6/0": "fe80::..."}
    addresses = raw.get("addresses") or {}
    ipv4s = [v for k, v in addresses.items() if "/ipv4/" in k]
    ipv6s = [v for k, v in addresses.items() if "/ipv6/" in k]
    ips   = list(dict.fromkeys(ipv4s + ipv6s))  # ipv4 first, deduplicated

    # VLAN names still come from VIFs (network membership, not IPs)
    vlans = []
    for vif_ref in raw.get("VIFs", []):
        vif = vif_map.get(vif_ref, {})
        net = network_map.get(vif.get("$network") or vif.get("network", ""), {})
        name = net.get("name_label") or net.get("name") or ""
        if name and name not in vlans:
            vlans.append(name)

    state_raw = (raw.get("power_state") or "").lower()
    state_map = {"running": "Running", "halted": "Halted", "paused": "Paused",
                 "suspended": "Suspended", "migrating": "Migrating"}

    return {
        "id":             raw.get("id") or raw.get("uuid", ""),
        "name":           raw.get("name_label") or raw.get("name", ""),
        "type":           "vm",
        "power_state":    state_map.get(state_raw, state_raw.title()),
        "os":             raw.get("os_version", {}).get("name") if isinstance(raw.get("os_version"), dict) else raw.get("os_version") or "—",
        "vcpus":          raw.get("CPUs", {}).get("number") or raw.get("cpus", {}).get("number"),
        "mem_total_gb":   _gb(mem_total),
        "mem_used_gb":    _gb(mem_used),
        "mem_pct":        _pct(mem_used, mem_total),
        "uptime_sec":     raw.get("startTime") and int(time.time()) - raw.get("startTime", 0),
        "uptime_str":     _uptime_str(raw.get("startTime") and int(time.time()) - raw.get("startTime", 0)),
        "ips":            list(dict.fromkeys(ips)),   # deduplicate, preserve order
        "vlans":          vlans,
        "tags":           raw.get("tags") or [],
        "host_ref":       raw.get("$container") or raw.get("resident_on", ""),
        "pool_ref":       raw.get("$pool", ""),
        "dc":             _get_dc(raw.get("name_label") or raw.get("name", "")).get("dc", "Unknown"),
        "ha_restart":     raw.get("ha_restart_priority", ""),
        "template":       raw.get("is_template", False),
        "snapshot":       raw.get("is_snapshot", False) or ("snapshot" in raw.get("type", "").lower()),
    }


# ── Hosts ─────────────────────────────────────────────────────────────────────

def _extract_idrac(raw: dict) -> str:
    """
    Try common XO / XenCenter locations where iDRAC / BMC IP is stored.
    Returns empty string if not found.
    """
    # 1. XenCenter custom fields stored in other_config
    oc = raw.get("other_config") or {}
    for key in ("XenCenter.CustomFields.iDRAC", "XenCenter.CustomFields.idrac",
                "XenCenter.CustomFields.IDRAC", "XenCenter.CustomFields.BMC",
                "XenCenter.CustomFields.iLO",  "XenCenter.CustomFields.IPMI",
                "idrac_ip", "bmc_ip", "ipmi_ip"):
        val = oc.get(key, "")
        if val:
            return val
    # 2. Sometimes stored directly as tags with prefix "idrac:"
    for tag in (raw.get("tags") or []):
        if tag.lower().startswith(("idrac:", "bmc:", "ipmi:", "ilo:")):
            return tag.split(":", 1)[1].strip()
    return ""


# DC prefix → datacenter mapping
_DC_MAP = {
    "nl":  {"dc": "NL", "location": "Netherlands",  "env_prefix": {"nl-stgjob": "EU STG", "nl-job": "EU PRD"}},
    "sv":  {"dc": "SV", "location": "Sunnyvale",    "env_prefix": {"sv-stgjob": "US STG", "sv-job": "US PRD"}},
    "uk":  {"dc": "UK", "location": "United Kingdom","env_prefix": {"uk-drjob":  "UK DR",  "uk-job": "UK TB"}},
    "nj":  {"dc": "NJ", "location": "New Jersey",   "env_prefix": {"nj-drjob":  "NJ DR",  "nj-job": "NJ TB"}},
}

def _get_dc(name: str) -> dict:
    """Derive datacenter and environment from hostname prefix (nl1-, sv1-, uk1-, nj1-)."""
    n = name.lower().lstrip()
    for prefix, info in _DC_MAP.items():
        if n.startswith(prefix):
            # determine environment
            name_no_num = n.replace("1-","").replace("2-","").replace("3-","")
            for env_key, env_label in info["env_prefix"].items():
                if name_no_num.startswith(env_key.replace("-","")) or \
                   env_key.replace("-","") in name_no_num.replace("-",""):
                    return {"dc": info["dc"], "location": info["location"], "env": env_label}
            return {"dc": info["dc"], "location": info["location"], "env": ""}
    return {"dc": "Unknown", "location": "Unknown", "env": ""}


def _extract_serial(raw: dict) -> str:
    """
    Extract hardware serial number / service tag from bios_strings.
    Dell iDRAC uses enclosure-asset-tag (short 7-char service tag).
    HP/Lenovo/Supermicro typically use system-serial-number.
    Returns empty string when not present or meaningless.
    """
    _PLACEHOLDER = {"", "0", "n/a", "not specified", "to be filled by o.e.m.",
                    "default string", "system serial number", "none"}
    bios = raw.get("bios_strings") or {}
    serial = (
        bios.get("system-serial-number", "")
        or bios.get("enclosure-asset-tag", "")
    ).strip()
    return "" if serial.lower() in _PLACEHOLDER else serial


def norm_host(raw: dict, vm_list: list[dict]) -> dict:
    hid        = raw.get("id") or raw.get("uuid", "")
    name       = raw.get("name_label") or raw.get("name", "")
    mem_total  = raw.get("memory", {}).get("size") or raw.get("memory_total")
    mem_free   = raw.get("memory", {}).get("free")  or raw.get("memory_free")
    mem_used   = (mem_total - mem_free) if (mem_total and mem_free) else None
    cpu_count  = raw.get("CPUs", {}).get("cpu_count") or raw.get("cpu_count")
    cpu_usage  = raw.get("cpus", {}).get("usage")   # 0–1 float from metrics
    dc_info    = _get_dc(name)

    resident_vms = [v for v in vm_list if v.get("host_ref") == hid and v.get("power_state") == "Running"]

    return {
        "id":             hid,
        "name":           name,
        "type":           "host",
        "address":        raw.get("address", ""),
        "idrac_ip":       _extract_idrac(raw),
        "serial_number":  _extract_serial(raw),
        "dc":             dc_info["dc"],
        "location":       dc_info["location"],
        "env":            dc_info["env"],
        "enabled":        raw.get("enabled", True),
        "power_state":    "Online" if raw.get("enabled", True) else "Offline",
        "cpu_count":      cpu_count,
        "cpu_usage_pct":  round(cpu_usage * 100, 1) if cpu_usage is not None else None,
        "mem_total_gb":   _gb(mem_total),
        "mem_free_gb":    _gb(mem_free),
        "mem_used_gb":    _gb(mem_used),
        "mem_pct":        _pct(mem_used, mem_total),
        "xen_version":    raw.get("version") or raw.get("software_version", {}).get("xen"),
        "xs_version":     raw.get("software_version", {}).get("product_version"),
        "pool_ref":       raw.get("$pool", ""),
        "resident_vms":   len(resident_vms),
        "uptime_str":     _uptime_str(raw.get("uptime")),
        "tags":           raw.get("tags") or [],
    }


# ── Storage Repositories ──────────────────────────────────────────────────────

def norm_sr(raw: dict) -> dict:
    total = raw.get("size") or 0
    used  = raw.get("physical_usage") or 0
    alloc = raw.get("usage") or 0          # logical allocation

    return {
        "id":             raw.get("id") or raw.get("uuid", ""),
        "name":           raw.get("name_label") or raw.get("name", ""),
        "type":           "storage",
        "sr_type":        raw.get("SR_type") or raw.get("type", ""),
        "content_type":   raw.get("content_type", ""),
        "shared":         raw.get("shared", False),
        "total_gb":       _gb(total),
        "used_gb":        _gb(used),
        "alloc_gb":       _gb(alloc),
        "free_gb":        _gb(total - used) if total else None,
        "used_pct":       _pct(used, total),
        "vdi_count":      len(raw.get("VDIs") or []),
        "pool_ref":       raw.get("$pool", ""),
        "tags":           raw.get("tags") or [],
    }


# ── Networks ──────────────────────────────────────────────────────────────────

def norm_network(raw: dict, pif_map: dict) -> dict:
    vlan_tag = None
    bridge   = raw.get("bridge", "")

    # Pull VLAN from first attached PIF
    for pif_ref in (raw.get("PIFs") or [])[:1]:
        pif = pif_map.get(pif_ref, {})
        vlan_tag = pif.get("vlan") if pif.get("vlan", -1) != -1 else None

    return {
        "id":           raw.get("id") or raw.get("uuid", ""),
        "name":         raw.get("name_label") or raw.get("name", ""),
        "type":         "network",
        "bridge":       bridge,
        "mtu":          raw.get("MTU") or raw.get("mtu", 1500),
        "vlan":         vlan_tag,
        "vif_count":    len(raw.get("VIFs") or []),
        "pif_count":    len(raw.get("PIFs") or []),
        "managed":      raw.get("managed", True),
        "default":      raw.get("defaultIsLocked", False),
        "pool_ref":     raw.get("$pool", ""),
        "tags":         raw.get("tags") or [],
    }


# ── Pools ─────────────────────────────────────────────────────────────────────

def norm_pool(raw: dict) -> dict:
    return {
        "id":           raw.get("id") or raw.get("uuid", ""),
        "name":         raw.get("name_label") or raw.get("name", ""),
        "type":         "pool",
        "master_ref":   raw.get("master", ""),
        "ha_enabled":   raw.get("ha_enabled", False),
        "tags":         raw.get("tags") or [],
    }
