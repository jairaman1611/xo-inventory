# XO Inventory

A full-stack local dashboard for Xen Orchestra — VMs, Hosts, Storage, Networks,
and resource metrics with charts. Runs entirely on your Mac via a Python backend
that holds the XO WebSocket session (handles MFA/TOTP correctly).

```
┌─────────────────────────────────────────────┐
│  Your Mac (localhost)                        │
│                                             │
│  Browser → :5173/:7755 → FastAPI :7755      │
│                            ↕ WebSocket      │
│                         XO Server           │
│                     (VPN required)          │
└─────────────────────────────────────────────┘
```

---

## Quick start

```bash
# 1 — connect VPN first
# 2 — unzip / clone, then:

cd xo-inventory
./start.sh          # builds frontend, starts server → http://localhost:7755
```

That's it. Open http://localhost:7755 in your browser.

### Dev mode (hot-reload)

```bash
./start.sh --dev    # backend :7755 + frontend :5173 with HMR
```

---

## Requirements

- **macOS** (any recent version)
- **Python 3.10+** — `python3 --version`
- **Node.js 18+** — `node --version`

Install with Homebrew if needed:
```bash
brew install python3 node
```

Python packages are auto-installed by `start.sh`:
`fastapi uvicorn httpx websockets python-dotenv`

---

## Auth & MFA

The app supports three login modes:

| Mode | When to use |
|---|---|
| **Password** | Standard username + password. If MFA is enabled, a TOTP prompt appears automatically. |
| **API Token** | Generate in XO → Settings → API tokens (XO ≥ 5.80). No MFA needed. |

**VPN**: connect your VPN before starting the app or before clicking Connect.
The Python backend holds the WebSocket session, so brief VPN interruptions
won't disconnect you mid-session as long as the connection recovers quickly.

---

## Features

### Overview tab
- KPI cards: total VMs, running, hosts, networks, SRs, vCPUs
- Radial gauges: CPU / Memory / Storage %
- VM state pie chart
- Host CPU & Memory bar chart
- Storage used vs free bar chart
- Cluster-wide summary gauges

### VMs tab
- All VMs with power state, uptime, IP, VLAN inline
- Expandable rows: identity, network (all IPs + VLANs), runtime + memory bar
- Search by name / OS / IP / VLAN / tag
- Filter by Running / Halted / Paused / Suspended

### Hosts tab
- CPU usage %, memory %, resident VM count inline
- Expandable: Xen/XS version, full RAM breakdown, workload, uptime

### Storage tab
- Per-SR capacity bar (colour-coded: green < 65%, amber < 85%, red ≥ 85%)
- Expandable: used / free / allocated / VDI count / type

### Networks tab
- Bridge name, VLAN tag, MTU, VIF count inline
- Expandable: full detail + PIF count

---

## Project structure

```
xo-inventory/
├── start.sh                   ← one-command launcher
├── backend/
│   ├── api/
│   │   └── main.py            ← FastAPI app, all REST routes
│   └── xo/
│       ├── client.py          ← XO WebSocket JSON-RPC client
│       ├── session.py         ← Session manager (MFA flow, singleton)
│       └── normalise.py       ← Raw XAPI → clean dicts
└── frontend/
    ├── vite.config.js         ← /api proxy to :7755
    └── src/
        ├── api/client.js      ← fetch wrapper
        ├── hooks/
        │   └── useInventory.js← auth + inventory state
        ├── components/
        │   ├── ConnectFlow.jsx ← login + MFA screens
        │   └── ui.jsx          ← shared primitives
        ├── pages/
        │   ├── OverviewPage.jsx
        │   ├── VMsPage.jsx
        │   ├── HostsPage.jsx
        │   └── StorageNetworkPages.jsx
        └── theme.js            ← colours + status map
```

---

## API endpoints (for scripting)

Once the backend is running and you're authenticated via the UI, you can also
query it from the terminal:

```bash
# Check connection status
curl http://localhost:7755/api/status

# Full inventory (JSON)
curl http://localhost:7755/api/inventory | python3 -m json.tool

# Just VMs
curl http://localhost:7755/api/inventory/vms

# Summary metrics
curl http://localhost:7755/api/inventory/summary
```
# PR access test
