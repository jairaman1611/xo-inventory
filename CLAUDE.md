# XO Inventory — Claude Context

## What this project is
A read-only local infrastructure dashboard for Xen Orchestra (XO).
Python FastAPI backend + React/Vite frontend. Cotton Candy colour theme.
Rebranded as "PV AdaptiveWork Inventory" with Planview logo.

## Repo
- GitHub: https://github.com/jairaman1611/xo-inventory
- Stack: Python 3.14, FastAPI, uvicorn, websockets / Node 18+, React, Vite, Recharts, xlsx

## How to start a session
1. User provides token: `ghp_xxx`
2. Clone: `git clone https://<token>@github.com/jairaman1611/xo-inventory.git`
3. Make changes on a feature branch, raise a PR
4. User reviews and merges — never push directly to main

## Project structure
```
backend/
  api/main.py          — FastAPI routes (read-only, /api/*)
  xo/client.py         — XO WebSocket JSON-RPC (ONLY session.signIn + xo.getAllObjects)
  xo/session.py        — session manager, MFA/TOTP flow
  xo/normalise.py      — raw XAPI → clean dicts (VMs, hosts, SRs, networks, pools)
frontend/
  public/logo.png      — Planview logo (white bg, 236×80px)
  src/
    App.jsx              — root layout + nav tabs
    theme.js             — Cotton Candy colour tokens
    components/
      ConnectFlow.jsx    — login screen (password → OTP two-step)
      FilterPanel.jsx    — advanced VM filters (name/OS/IP/VLAN/state)
      ui.jsx             — shared primitives (Dot, StatusBadge, GaugeBar, KV, Button…)
    hooks/
      useInventory.js    — auth state + inventory fetch
    pages/
      OverviewPage.jsx   — DC region selector + charts
      VMsPage.jsx        — sortable data grid + filter panel + export
      HostsPage.jsx      — sortable data grid with iDRAC column
      StorageNetworkPages.jsx
```

## Infrastructure context
- 4 datacentres, 8 environments
- Hostname prefix → DC mapping:
  - sv1-* → SV (Sunnyvale)   | US PRD (sv1-job*) / US STG (sv1-stgjob*)
  - nl1-* → NL (Netherlands)  | EU PRD (nl1-job*) / EU STG (nl1-stgjob*)
  - uk1-* → UK                | UK TB  (uk1-job*) / UK DR  (uk1-drjob*)
  - nj1-* → NJ (New Jersey)   | NJ TB  (nj1-job*) / NJ DR  (nj1-drjob*)

## Auth flow (XO-specific behaviour)
- Password-only call always fails with code 3 (even with correct credentials)
- Must send username + password + otp together in one single call
- Backend handles this: connect_password() opens WS + sets needs_otp,
  submit_otp() sends all three fields together
- Token auth (ghp_*) skips MFA entirely

## Safety rules
- Backend is STRICTLY read-only
- client.py has a hard READ_ONLY_METHODS allowlist: {session.signIn, xo.getAllObjects}
- Any other method raises PermissionError before hitting the WebSocket
- Never add write/mutating XO calls under any circumstances

## Design system — Cotton Candy
- Primary: #FF375F  Accent: #636EFA  Green: #30D158  Amber: #FF9F0A
- Purple: #BF5AF2   Teal: #5AC8FA    Surface: #FFF5FA  Text: #3D001A
- Pill-shaped buttons with gradient backgrounds + soft shadows
- Frosted glass cards (rgba white + backdropFilter blur)
- Font: Plus Jakarta Sans (Google Fonts)

## Branding
- App name: "PV AdaptiveWork Inventory"
- Logo: /frontend/public/logo.png (Planview logo, white background, 236×80px)
- Nav: Planview logo image + "AdaptiveWork / INVENTORY" text beside it
- Login screen: Planview logo above "AdaptiveWork Inventory" title

## iDRAC
- Extracted from XO host other_config (XenCenter custom fields: iDRAC/BMC/iLO/IPMI)
- Or from tags with prefix idrac:/bmc:/ilo:
- Shown as clickable link in Hosts grid — opens iDRAC web console in new tab

## Known pending issues
- VM/Host detail drawer behaves like a fixed-width slider on large screens
  TODO: replace with inline expanded row or full-width panel instead of side drawer

## Git workflow
- Feature branches only, never commit to main directly
- PR title format: "feat/fix/chore: short description"
- Always run `npm run build` before pushing to confirm no compile errors
- Branch protection is enabled on main — PRs require 1 approval before merge
