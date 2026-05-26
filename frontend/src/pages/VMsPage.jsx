import { useState, useMemo, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import { T, STATUS, STATUS_SOFT } from "../theme";
import { Dot, StatusBadge, GaugeBar, KV, SectionHead, Tag, SearchBar } from "../components/ui";
import { FilterPanel, applyFilters, countActive, EMPTY_FILTERS } from "../components/FilterPanel";

/* ── Column definitions ──────────────────────────────────────────────────── */
const COLUMNS = [
  { key:"name",        label:"Name",         width:220 },
  { key:"power_state", label:"State",        width:110 },
  { key:"os",          label:"OS",           width:195 },
  { key:"ip",          label:"IP Address",   width:135 },
  { key:"vlan",        label:"Network/VLAN", width:155 },
  { key:"host",        label:"Host Node",    width:155 },
  { key:"vcpus",       label:"vCPUs",        width:75  },
  { key:"mem",         label:"RAM (GB)",     width:88  },
  { key:"uptime",      label:"Uptime",       width:115 },
];

function accessor(vm, key, hostMap) {
  switch (key) {
    case "name":        return vm.name ?? "";
    case "power_state": return vm.power_state ?? "";
    case "os":          return vm.os ?? "";
    case "ip":          return (vm.ips ?? []).filter(a => !a.includes(":"))[0] ?? "";
    case "vlan":        return (vm.vlans ?? [])[0] ?? "";
    case "host":        return hostMap[vm.host_ref]?.name ?? "";
    case "vcpus":       return vm.vcpus ?? 0;
    case "mem":         return vm.mem_total_gb ?? 0;
    case "uptime":      return vm.uptime_sec ?? 0;
    default:            return "";
  }
}

function doExport(rows, hostMap, fmt) {
  const data = rows.map(vm => ({
    Name:            vm.name,
    "Power State":   vm.power_state,
    OS:              vm.os ?? "—",
    "IP Address":    (vm.ips ?? []).filter(a => !a.includes(":")).join(", ") || "—",
    "IPv6":          (vm.ips ?? []).filter(a =>  a.includes(":")).join(", ") || "—",
    "Network/VLAN":  (vm.vlans ?? []).join(", ") || "—",
    "Host Node":     hostMap[vm.host_ref]?.name ?? "—",
    "vCPUs":         vm.vcpus ?? "",
    "RAM (GB)":      vm.mem_total_gb ?? "",
    "Mem Used (GB)": vm.mem_used_gb  ?? "",
    "Mem %":         vm.mem_pct      ?? "",
    "Uptime":        vm.uptime_str   ?? "—",
    Tags:            (vm.tags ?? []).join(", "),
    ID:              vm.id,
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "VMs");
  ws["!cols"] = [{wch:30},{wch:12},{wch:36},{wch:16},{wch:16},{wch:24},{wch:24},
                 {wch:7},{wch:10},{wch:12},{wch:8},{wch:10},{wch:22},{wch:38}];
  XLSX.writeFile(wb, `xo-vms-${new Date().toISOString().slice(0,10)}.${fmt}`,
    fmt === "csv" ? { bookType:"csv" } : {});
}

const PAGE_SIZE = 100;

/* ── Main component ──────────────────────────────────────────────────────── */
export function VMsPage({ vms, hosts }) {
  const hostMap = useMemo(() =>
    Object.fromEntries((hosts ?? []).map(h => [h.id, h])), [hosts]);

  const [search,      setSearch]      = useState("");
  const [filters,     setFilters]     = useState(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [sortKey,     setSortKey]     = useState("name");
  const [sortDir,     setSortDir]     = useState("asc");
  const [selected,    setSelected]    = useState(null);
  const [page,        setPage]        = useState(0);

  const toggleSort = useCallback((key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
    setPage(0);
  }, [sortKey]);

  /* apply all filters + search */
  const filtered = useMemo(() =>
    applyFilters(vms, filters, search, hostMap),
    [vms, filters, search, hostMap]
  );

  /* sort */
  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = accessor(a, sortKey, hostMap);
      const bv = accessor(b, sortKey, hostMap);
      return (typeof av === "number" ? av - bv : String(av).localeCompare(String(bv))) * dir;
    });
  }, [filtered, sortKey, sortDir, hostMap]);

  const pageCount = Math.ceil(sorted.length / PAGE_SIZE);
  const pageRows  = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const activeFilters = countActive(filters);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 100px)" }}>

      {/* ── Toolbar ── */}
      <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap",
        paddingBottom:10, flexShrink:0 }}>
        <SearchBar value={search}
          onChange={v => { setSearch(v); setPage(0); }}
          placeholder="Quick search name, OS, IP, VLAN, host…" />

        {/* Filter toggle */}
        <button onClick={() => setShowFilters(s => !s)} style={{
          padding:"8px 16px", borderRadius:50, fontSize:12, fontWeight:700,
          cursor:"pointer", transition:"all 0.15s",
          border:`1.5px solid ${showFilters || activeFilters > 0 ? T.primary : T.border}`,
          background: showFilters ? T.primarySoft
                    : activeFilters > 0 ? T.primarySoft : "rgba(255,255,255,0.7)",
          color: showFilters || activeFilters > 0 ? T.primary : T.textDim,
          boxShadow: activeFilters > 0 ? `0 2px 8px rgba(255,55,95,0.25)` : "none",
          display:"flex", alignItems:"center", gap:6,
        }}>
          🎛 Filters
          {activeFilters > 0 && (
            <span style={{ padding:"1px 7px", borderRadius:20, fontSize:10,
              fontWeight:800, background:T.gradPrimary, color:"#fff" }}>
              {activeFilters}
            </span>
          )}
        </button>

        <span style={{ fontSize:11, color:T.textDim, fontWeight:500, whiteSpace:"nowrap" }}>
          {sorted.length.toLocaleString()} / {vms.length.toLocaleString()} VMs
        </span>
        <div style={{ flex:1 }} />
        <ExportMenu onExport={fmt => doExport(sorted, hostMap, fmt)} />
      </div>

      {/* ── Filter panel (collapsible) ── */}
      {showFilters && (
        <FilterPanel
          vms={vms}
          filters={filters}
          onChange={f => { setFilters(f); setPage(0); }}
          onClose={() => setShowFilters(false)}
        />
      )}

      {/* ── Table ── */}
      <div style={{ flex:1, overflow:"auto", borderRadius:16,
        border:`1.5px solid ${T.border}`,
        boxShadow:"0 4px 24px rgba(255,55,95,0.07)" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", minWidth:1100 }}>
          <thead>
            <tr style={{ background:`linear-gradient(135deg,${T.primarySoft},${T.accentSoft})`,
              position:"sticky", top:0, zIndex:10 }}>
              {COLUMNS.map(col => (
                <Th key={col.key} col={col} sortKey={sortKey} sortDir={sortDir}
                  onSort={() => toggleSort(col.key)} />
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((vm, i) => (
              <DataRow key={vm.id} vm={vm} hostMap={hostMap} index={i}
                selected={selected?.id === vm.id}
                onClick={() => setSelected(selected?.id === vm.id ? null : vm)} />
            ))}
            {pageRows.length === 0 && (
              <tr><td colSpan={COLUMNS.length}
                style={{ textAlign:"center", padding:60, color:T.textDim, fontSize:13 }}>
                <div style={{ fontSize:32, marginBottom:10 }}>🔍</div>
                No VMs match your filters
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {pageCount > 1 && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center",
          gap:6, paddingTop:10, flexShrink:0 }}>
          <PageBtn onClick={() => setPage(0)}        disabled={page===0}>«</PageBtn>
          <PageBtn onClick={() => setPage(p => p-1)} disabled={page===0}>‹</PageBtn>
          {Array.from({ length:Math.min(pageCount,7) }, (_,i) => {
            const p = pageCount<=7 ? i : page<4 ? i
                    : page>pageCount-5 ? pageCount-7+i : page-3+i;
            return <PageBtn key={p} onClick={() => setPage(p)} active={page===p}>{p+1}</PageBtn>;
          })}
          <PageBtn onClick={() => setPage(p => p+1)}    disabled={page>=pageCount-1}>›</PageBtn>
          <PageBtn onClick={() => setPage(pageCount-1)} disabled={page>=pageCount-1}>»</PageBtn>
          <span style={{ fontSize:11, color:T.textDim, marginLeft:8, fontWeight:500 }}>
            {page*PAGE_SIZE+1}–{Math.min((page+1)*PAGE_SIZE, sorted.length)} of {sorted.length.toLocaleString()}
          </span>
        </div>
      )}

      {/* ── Detail drawer ── */}
      {selected && (
        <DetailDrawer vm={selected} hostMap={hostMap} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

/* ── Sub-components (unchanged from previous version) ───────────────────── */
function Th({ col, sortKey, sortDir, onSort }) {
  const active = sortKey === col.key;
  return (
    <th onClick={onSort} style={{
      padding:"11px 12px", textAlign:"left", fontSize:10, fontWeight:800,
      letterSpacing:"0.08em", color: active ? T.primary : T.textMid,
      background:"transparent", cursor:"pointer", userSelect:"none", whiteSpace:"nowrap",
      borderBottom:`2px solid ${active ? T.primary : "rgba(255,55,95,0.1)"}`,
      minWidth:col.width, maxWidth:col.width, transition:"color 0.15s",
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:4 }}>
        {col.label}
        <span style={{ display:"inline-flex", flexDirection:"column", gap:0, lineHeight:1 }}>
          <span style={{ fontSize:8, opacity: active && sortDir==="asc"  ? 1 : 0.2 }}>▲</span>
          <span style={{ fontSize:8, opacity: active && sortDir==="desc" ? 1 : 0.2 }}>▼</span>
        </span>
      </div>
    </th>
  );
}

function DataRow({ vm, hostMap, index, selected, onClick }) {
  const sc   = STATUS[vm.power_state] ?? T.textDim;
  const ipv4 = (vm.ips ?? []).filter(a => !a.includes(":"));
  const host = hostMap[vm.host_ref]?.name ?? "—";
  const base = index % 2 === 0 ? "#ffffff" : T.surface;

  return (
    <tr onClick={onClick}
      style={{ background: selected ? T.primarySoft : base,
        borderBottom:`1px solid ${T.border}`, cursor:"pointer", transition:"background 0.12s",
        outline: selected ? `2px solid ${T.primary}` : "none" }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = T.cardHi; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = base; }}>

      <td style={td()}> {/* Name */}
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <Dot color={sc} pulse={vm.power_state==="Running"} />
          <span style={{ fontFamily:"'SF Mono','JetBrains Mono',monospace", fontSize:12,
            fontWeight:700, color:T.text, overflow:"hidden", textOverflow:"ellipsis",
            whiteSpace:"nowrap", maxWidth:185 }}>{vm.name}</span>
        </div>
      </td>
      <td style={td()}><StatusBadge state={vm.power_state} /></td>
      <td style={td(T.textMid)}>
        <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
          display:"block", maxWidth:185, fontSize:12 }}>{vm.os || "—"}</span>
      </td>
      <td style={td(T.accent, true)}>
        {ipv4[0] ?? <span style={{ color:T.textDim }}>—</span>}
      </td>
      <td style={td(T.amber, true)}>
        <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
          display:"block", maxWidth:145 }}>
          {(vm.vlans ?? [])[0] ?? <span style={{ color:T.textDim }}>—</span>}
        </span>
      </td>
      <td style={td(T.purple, true)}>
        <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
          display:"block", maxWidth:145 }}>{host}</span>
      </td>
      <td style={{ ...td(T.primary, true), textAlign:"center" }}>{vm.vcpus ?? "—"}</td>
      <td style={{ ...td(T.teal,    true), textAlign:"center" }}>{vm.mem_total_gb ?? "—"}</td>
      <td style={td(T.textDim)}>
        <span style={{ fontSize:11 }}>
          {vm.power_state==="Running" ? (vm.uptime_str||"—") : "—"}
        </span>
      </td>
    </tr>
  );
}

function td(color, mono=false) {
  return { padding:"9px 12px", fontSize:12, color:color||T.textMid,
    fontFamily:mono?"'SF Mono','JetBrains Mono',monospace":undefined,
    verticalAlign:"middle", whiteSpace:"nowrap" };
}

function DetailDrawer({ vm, hostMap, onClose }) {
  const sc   = STATUS[vm.power_state] ?? T.textDim;
  const ipv4 = (vm.ips ?? []).filter(a => !a.includes(":"));
  const ipv6 = (vm.ips ?? []).filter(a =>  a.includes(":"));
  const host = hostMap[vm.host_ref];

  return (
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0,
        background:"rgba(61,0,26,0.25)", backdropFilter:"blur(4px)",
        zIndex:200, animation:"fadeIn 0.15s ease" }} />
      <div style={{ position:"fixed", top:0, right:0, bottom:0, width:"min(480px, 100vw)",
        background:"rgba(255,245,250,0.96)", backdropFilter:"blur(24px)",
        borderLeft:`1.5px solid ${T.border}`, zIndex:201, overflow:"auto",
        animation:"slideInRight 0.2s cubic-bezier(.34,1.2,.64,1)",
        boxShadow:"-8px 0 48px rgba(255,55,95,0.18)" }}>

        <div style={{ background:T.gradPrimary, padding:"24px 24px 20px",
          position:"sticky", top:0, zIndex:1 }}>
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                <span style={{ padding:"3px 10px", borderRadius:20, fontSize:11,
                  fontWeight:700, background:"rgba(255,255,255,0.25)", color:"#fff" }}>
                  {vm.power_state}
                </span>
              </div>
              <div style={{ fontFamily:"'SF Mono','JetBrains Mono',monospace",
                fontSize:15, fontWeight:800, color:"#fff", wordBreak:"break-all",
                lineHeight:1.3 }}>{vm.name}</div>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.7)", marginTop:4 }}>{vm.id}</div>
            </div>
            <button onClick={onClose} style={{ background:"rgba(255,255,255,0.2)",
              border:"none", color:"#fff", fontSize:16, cursor:"pointer",
              borderRadius:"50%", width:32, height:32,
              display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
          </div>
        </div>

        <div style={{ padding:"20px 24px" }}>
          {[
            { title:"IDENTITY",  color:T.primary,  items:[
              {l:"OS",    v:vm.os||"—"},
              {l:"vCPUs", v:vm.vcpus?`${vm.vcpus} cores`:"—", mono:true},
              {l:"RAM",   v:vm.mem_total_gb?`${vm.mem_total_gb} GB`:"—", mono:true},
            ], extra: vm.mem_pct != null ? "gauge" : null,
              tags: vm.tags },
            { title:"NETWORK",   color:T.accent, ips:{ ipv4, ipv6 }, vlans:vm.vlans },
            { title:"HOST NODE", color:T.purple, host },
            { title:"RUNTIME",   color:T.green,  items:[
              {l:"Power state", v:vm.power_state, accent:sc},
              {l:"Uptime",      v:vm.uptime_str||"—", mono:true, accent:T.teal},
              {l:"HA priority", v:vm.ha_restart||"—"},
            ]},
          ].map(sec => (
            <div key={sec.title} style={{ marginBottom:16, padding:"16px 18px", borderRadius:16,
              background:"rgba(255,255,255,0.8)", border:`1.5px solid ${sec.color}20`,
              borderTop:`3px solid ${sec.color}` }}>
              <SectionHead title={sec.title} color={sec.color} />

              {sec.items?.map((it,j) => <KV key={j} label={it.l} value={it.v}
                mono={it.mono} accent={it.accent} />)}

              {sec.extra==="gauge" && <>
                <div style={{ display:"flex", justifyContent:"space-between",
                  fontSize:11, color:T.textDim, margin:"6px 0 4px" }}>
                  <span>Memory usage</span>
                  <span style={{ color:T.accent, fontWeight:700 }}>
                    {vm.mem_used_gb} / {vm.mem_total_gb} GB
                  </span>
                </div>
                <GaugeBar pct={vm.mem_pct} color={T.accent} height={7} />
              </>}

              {sec.tags?.length > 0 && (
                <div style={{ marginTop:10, display:"flex", flexWrap:"wrap", gap:4 }}>
                  {sec.tags.map(t => <Tag key={t} label={t} />)}
                </div>
              )}

              {sec.ips && <>
                {sec.ips.ipv4.length > 0
                  ? sec.ips.ipv4.map((ip,i) =>
                      <KV key={i} label={`IPv4 ${i+1}`} value={ip} mono accent={T.accent} />)
                  : <KV label="IPv4" value="Not available" />}
                {sec.ips.ipv6.map((ip,i) =>
                  <KV key={i} label={`IPv6 ${i+1}`} value={ip} mono accent={T.purple} />)}
                {(sec.vlans||[]).map((v,i) =>
                  <KV key={i} label={`VLAN ${i+1}`} value={v} mono accent={T.amber} />)}
              </>}

              {sec.host !== undefined && <>
                <KV label="Host"     value={sec.host?.name ?? "—"} mono accent={T.purple} />
                {sec.host?.address    && <KV label="Address"    value={sec.host.address}    mono />}
                {sec.host?.cpu_count  && <KV label="Host CPUs"  value={`${sec.host.cpu_count} cores`} mono />}
                {sec.host?.xs_version && <KV label="XS Version" value={sec.host.xs_version} mono />}
              </>}
            </div>
          ))}
        </div>
      </div>
      <style>{`@keyframes slideInRight{from{transform:translateX(100%)}to{transform:none}}`}</style>
    </>
  );
}

function ExportMenu({ onExport }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position:"relative" }}>
      <button onClick={() => setOpen(o => !o)} style={{
        padding:"8px 16px", borderRadius:50, fontSize:12, fontWeight:700,
        cursor:"pointer", border:"none",
        background:T.gradAccent, color:"#fff",
        boxShadow:`0 4px 14px rgba(99,110,250,0.35)`,
        display:"flex", alignItems:"center", gap:6 }}>
        ↓ Export {open ? "▲" : "▼"}
      </button>
      {open && (
        <div style={{ position:"absolute", right:0, top:"calc(100% + 8px)", width:170,
          background:"rgba(255,255,255,0.97)", backdropFilter:"blur(16px)",
          border:`1.5px solid ${T.border}`, borderRadius:14, overflow:"hidden",
          zIndex:50, boxShadow:"0 8px 32px rgba(255,55,95,0.15)" }}>
          {[["xlsx","📊  Excel (.xlsx)"],["csv","📄  CSV (.csv)"]].map(([fmt,label]) => (
            <button key={fmt} onClick={() => { onExport(fmt); setOpen(false); }} style={{
              display:"block", width:"100%", padding:"12px 16px", textAlign:"left",
              background:"transparent", border:"none", color:T.text,
              fontSize:13, fontWeight:500, cursor:"pointer" }}
              onMouseEnter={e => e.target.style.background = T.primarySoft}
              onMouseLeave={e => e.target.style.background = "transparent"}>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PageBtn({ children, onClick, disabled, active }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width:32, height:32, borderRadius:10,
      border:`1.5px solid ${active ? T.primary : T.border}`,
      background: active ? T.gradPrimary : "rgba(255,255,255,0.8)",
      color: disabled ? T.textDim : active ? "#fff" : T.textMid,
      fontSize:12, fontWeight:700, cursor:disabled?"default":"pointer",
      boxShadow: active ? `0 2px 8px rgba(255,55,95,0.3)` : "none",
      transition:"all 0.12s" }}>
      {children}
    </button>
  );
}
