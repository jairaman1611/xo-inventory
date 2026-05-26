import { useState, useMemo, useCallback } from "react";
import { T, STATUS, STATUS_SOFT } from "../theme";
import { Dot, StatusBadge, GaugeBar, KV, SectionHead, Tag, SearchBar } from "../components/ui";

const COLUMNS = [
  { key:"name",        label:"Name",        width:170 },
  { key:"power_state", label:"State",       width:90  },
  { key:"dc",          label:"DC",          width:55  },
  { key:"address",     label:"Mgmt IP",     width:115 },
  { key:"idrac_ip",    label:"iDRAC IP",    width:115 },
  { key:"resident_vms",label:"VMs",         width:55  },
  { key:"cpu_count",   label:"CPUs",        width:55  },
  { key:"cpu_pct",     label:"CPU %",       width:90  },
  { key:"mem_total",   label:"RAM (GB)",    width:80  },
  { key:"mem_pct",     label:"MEM %",       width:90  },
  { key:"xs_version",  label:"XS Version",  width:105 },
  { key:"uptime",      label:"Uptime",      width:110 },
];

function accessor(h, key) {
  switch(key) {
    case "name":         return h.name ?? "";
    case "power_state":  return h.power_state ?? "";
    case "dc":           return h.dc ?? "";
    case "address":      return h.address ?? "";
    case "idrac_ip":     return h.idrac_ip ?? "";
    case "resident_vms": return h.resident_vms ?? 0;
    case "cpu_count":    return h.cpu_count ?? 0;
    case "cpu_pct":      return h.cpu_usage_pct ?? 0;
    case "mem_total":    return h.mem_total_gb ?? 0;
    case "mem_pct":      return h.mem_pct ?? 0;
    case "xs_version":   return h.xs_version ?? "";
    case "uptime":       return h.uptime_str ?? "";
    default:             return "";
  }
}

const DC_COLORS = { SV:"#3B9EFF", NL:"#FF9F0A", UK:"#30D158", NJ:"#BF5AF2" };

export function HostsPage({ hosts }) {
  const [search,   setSearch]   = useState("");
  const [sortKey,  setSortKey]  = useState("name");
  const [sortDir,  setSortDir]  = useState("asc");
  const [selected, setSelected] = useState(null);
  const [dcFilter, setDcFilter] = useState("ALL");

  const toggleSort = useCallback((key) => {
    if (sortKey === key) setSortDir(d => d==="asc"?"desc":"asc");
    else { setSortKey(key); setSortDir("asc"); }
  }, [sortKey]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return hosts.filter(h => {
      if (dcFilter !== "ALL" && h.dc !== dcFilter) return false;
      if (!q) return true;
      return [h.name, h.address, h.idrac_ip, h.dc, h.xs_version, ...(h.tags||[])]
        .some(f => f?.toLowerCase().includes(q));
    });
  }, [hosts, search, dcFilter]);

  const sorted = useMemo(() => {
    const dir = sortDir==="asc" ? 1 : -1;
    return [...filtered].sort((a,b) => {
      const av = accessor(a, sortKey);
      const bv = accessor(b, sortKey);
      return (typeof av==="number" ? av-bv : String(av).localeCompare(String(bv))) * dir;
    });
  }, [filtered, sortKey, sortDir]);

  /* DC counts */
  const dcCounts = useMemo(() => {
    const m = {};
    hosts.forEach(h => { m[h.dc] = (m[h.dc]||0)+1; });
    return m;
  }, [hosts]);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 100px)" }}>

      {/* Toolbar */}
      <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap",
        paddingBottom:10, flexShrink:0 }}>
        <SearchBar value={search} onChange={setSearch}
          placeholder="Search host name, IP, iDRAC, DC…" />

        {/* DC filter pills */}
        {["ALL","SV","NL","UK","NJ"].map(dc => {
          const active = dcFilter === dc;
          const color  = dc==="ALL" ? T.primary : (DC_COLORS[dc]||T.primary);
          return (
            <button key={dc} onClick={() => setDcFilter(dc)} style={{
              padding:"7px 14px", borderRadius:50, fontSize:11, fontWeight:700,
              cursor:"pointer", transition:"all 0.15s",
              border:`1.5px solid ${active ? color : T.border}`,
              background: active ? `${color}22` : "rgba(255,255,255,0.7)",
              color: active ? color : T.textDim,
              boxShadow: active ? `0 2px 8px ${color}30` : "none",
              display:"flex", alignItems:"center", gap:5 }}>
              {dc === "ALL" ? "All DCs" : dc}
              {dc !== "ALL" && dcCounts[dc] && (
                <span style={{ fontSize:10, padding:"1px 6px", borderRadius:10,
                  background: active ? `${color}30` : "rgba(0,0,0,0.06)",
                  color: active ? color : T.textDim, fontWeight:800 }}>
                  {dcCounts[dc]}
                </span>
              )}
            </button>
          );
        })}

        <span style={{ fontSize:11, color:T.textDim, fontWeight:500, whiteSpace:"nowrap" }}>
          {sorted.length}/{hosts.length} hosts
        </span>
      </div>

      {/* Table */}
      <div style={{ flex:1, overflow:"auto", borderRadius:16,
        border:`1.5px solid ${T.border}`,
        boxShadow:"0 4px 24px rgba(255,55,95,0.07)" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", tableLayout:"fixed" }}>
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
            {sorted.map((h, i) => (
              <HostRow key={h.id} host={h} index={i}
                selected={selected?.id===h.id}
                onClick={() => setSelected(selected?.id===h.id ? null : h)} />
            ))}
            {/* Inline detail panel */}
            {selected && sorted.some(r => r.id === selected.id) && (
              <tr>
                <td colSpan={COLUMNS.length} style={{ padding:0, background:T.surface }}>
                  <HostInlineDetail host={selected} onClose={() => setSelected(null)} />
                </td>
              </tr>
            )}
            {sorted.length === 0 && (
              <tr><td colSpan={COLUMNS.length}
                style={{ textAlign:"center", padding:60, color:T.textDim, fontSize:13 }}>
                <div style={{ fontSize:32, marginBottom:10 }}>🔍</div>
                No hosts match
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}

function Th({ col, sortKey, sortDir, onSort }) {
  const active = sortKey === col.key;
  return (
    <th onClick={onSort} style={{
      padding:"11px 12px", textAlign:"left", fontSize:10, fontWeight:800,
      letterSpacing:"0.08em", color: active ? T.primary : T.textMid,
      background:"transparent", cursor:"pointer", userSelect:"none", whiteSpace:"nowrap",
      borderBottom:`2px solid ${active ? T.primary : "rgba(255,55,95,0.1)"}`,
      minWidth:col.width, maxWidth:col.width, transition:"color 0.15s" }}>
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

function HostRow({ host:h, index, selected, onClick }) {
  const sc    = STATUS[h.power_state] ?? T.textDim;
  const dcCol = DC_COLORS[h.dc] || T.textDim;
  const base  = index % 2 === 0 ? "#ffffff" : T.surface;

  return (
    <tr onClick={onClick}
      style={{ background: selected ? T.primarySoft : base,
        borderBottom:`1px solid ${T.border}`, cursor:"pointer", transition:"background 0.12s",
        outline: selected ? `2px solid ${T.primary}` : "none" }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background=T.cardHi; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background=base; }}>

      {/* Name */}
      <td style={td()}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <Dot color={sc} pulse={h.power_state==="Online"} />
          <span style={{ fontFamily:"'SF Mono','JetBrains Mono',monospace", fontSize:12,
            fontWeight:700, color:T.text, overflow:"hidden", textOverflow:"ellipsis",
            whiteSpace:"nowrap", maxWidth:175 }}>{h.name}</span>
        </div>
      </td>

      {/* State */}
      <td style={td()}><StatusBadge state={h.power_state} /></td>

      {/* DC */}
      <td style={td()}>
        <span style={{ padding:"2px 8px", borderRadius:20, fontSize:11, fontWeight:800,
          background:`${dcCol}18`, color:dcCol, border:`1px solid ${dcCol}35` }}>
          {h.dc||"—"}
        </span>
      </td>

      {/* Mgmt IP */}
      <td style={td(T.accent, true)}>{h.address||"—"}</td>

      {/* iDRAC IP */}
      <td style={td(T.teal, true)}>
        {h.idrac_ip
          ? <a href={`https://${h.idrac_ip}`} target="_blank" rel="noreferrer"
              onClick={e => e.stopPropagation()}
              style={{ color:T.teal, textDecoration:"none", fontFamily:"'SF Mono','JetBrains Mono',monospace",
                fontSize:12 }}>
              {h.idrac_ip} ↗
            </a>
          : <span style={{ color:T.textDim }}>—</span>}
      </td>

      {/* VMs */}
      <td style={{ ...td(T.accent, true), textAlign:"center" }}>{h.resident_vms??0}</td>

      {/* CPUs */}
      <td style={{ ...td(T.textMid, true), textAlign:"center" }}>{h.cpu_count??"-"}</td>

      {/* CPU % */}
      <td style={{ ...td(), minWidth:90 }}>
        {h.cpu_usage_pct != null ? (
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:T.primary,
              fontFamily:"'SF Mono','JetBrains Mono',monospace",
              marginBottom:3 }}>{h.cpu_usage_pct}%</div>
            <GaugeBar pct={h.cpu_usage_pct} color={T.primary} height={4} />
          </div>
        ) : <span style={{ color:T.textDim }}>—</span>}
      </td>

      {/* RAM */}
      <td style={{ ...td(T.textMid, true), textAlign:"center" }}>
        {h.mem_total_gb??"-"}
      </td>

      {/* MEM % */}
      <td style={{ ...td(), minWidth:90 }}>
        {h.mem_pct != null ? (
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:T.purple,
              fontFamily:"'SF Mono','JetBrains Mono',monospace",
              marginBottom:3 }}>{h.mem_pct}%</div>
            <GaugeBar pct={h.mem_pct} color={T.purple} height={4} />
          </div>
        ) : <span style={{ color:T.textDim }}>—</span>}
      </td>

      {/* XS Version */}
      <td style={td(T.textDim)}>
        <span style={{ fontSize:11 }}>{h.xs_version||"—"}</span>
      </td>

      {/* Uptime */}
      <td style={td(T.textDim)}>
        <span style={{ fontSize:11, fontFamily:"'SF Mono','JetBrains Mono',monospace" }}>
          {h.uptime_str||"—"}
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

/* ── Detail drawer ───────────────────────────────────────────────────────── */
function HostInlineDetail({ host:h, onClose }) {
  const dcCol = DC_COLORS[h.dc] || T.primary;
  return (
    <div style={{ borderTop:`2px solid ${dcCol}`, padding:"20px 24px",
      background:`linear-gradient(135deg,${dcCol}15,${T.accentSoft}20)`,
      animation:"fadeIn 0.2s ease" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
        marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontFamily:"'SF Mono','JetBrains Mono',monospace",
            fontSize:14, fontWeight:800, color:T.text }}>{h.name}</span>
          <StatusBadge state={h.power_state} />
          <span style={{ padding:"2px 9px", borderRadius:50, fontSize:11, fontWeight:800,
            background:`${dcCol}18`, color:dcCol, border:`1px solid ${dcCol}35` }}>
            {h.dc}
          </span>
          {h.env && <span style={{ fontSize:11, color:T.textDim }}>{h.location} · {h.env}</span>}
        </div>
        <button onClick={onClose} style={{ background:`${dcCol}15`,
          border:`1.5px solid ${dcCol}30`, color:dcCol, borderRadius:50,
          padding:"4px 12px", fontSize:11, fontWeight:700, cursor:"pointer" }}>
          ✕ Close
        </button>
      </div>

      <div style={{ display:"grid",
        gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:14 }}>

        <Panel title="IDENTITY" color={T.primary}>
          <KV label="Mgmt IP"    value={h.address||"—"}    mono accent={T.accent} />
          <KV label="iDRAC IP"   value={h.idrac_ip||"—"}   mono accent={T.teal} />
          <KV label="Xen"        value={h.xen_version||"—"} />
          <KV label="XS Version" value={h.xs_version||"—"} />
          <KV label="Uptime"     value={h.uptime_str||"—"} mono accent={T.teal} />
          {h.tags?.length > 0 && (
            <div style={{ marginTop:8, display:"flex", flexWrap:"wrap", gap:4 }}>
              {h.tags.map(t => <Tag key={t} label={t} />)}
            </div>
          )}
        </Panel>

        <Panel title="COMPUTE" color={T.accent}>
          <KV label="vCPUs"     value={h.cpu_count||"—"} mono />
          <KV label="CPU Used"  value={h.cpu_usage_pct!=null?`${h.cpu_usage_pct}%`:"—"}
            mono accent={T.primary} />
          {h.cpu_usage_pct != null && <GaugeBar pct={h.cpu_usage_pct} color={T.primary} height={5} />}
          <div style={{ marginTop:8 }} />
          <KV label="Total RAM" value={h.mem_total_gb?`${h.mem_total_gb} GB`:"—"} mono />
          <KV label="Used RAM"  value={h.mem_used_gb?`${h.mem_used_gb} GB`:"—"}  mono accent={T.purple} />
          <KV label="Free RAM"  value={h.mem_free_gb?`${h.mem_free_gb} GB`:"—"}  mono accent={T.green} />
          {h.mem_pct != null && <GaugeBar pct={h.mem_pct} color={T.purple} height={5} />}
        </Panel>

        <Panel title="WORKLOAD" color={T.green}>
          <KV label="Resident VMs" value={h.resident_vms??0}  mono accent={T.accent} />
          <KV label="HA"           value={h.ha_enabled?"Enabled":"Disabled"}
            accent={h.ha_enabled?T.green:T.textDim} />
          <KV label="Pool"         value={h.pool_ref||"—"}    mono />
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, color, children }) {
  return (
    <div style={{ background:"rgba(255,255,255,0.85)", borderRadius:14,
      padding:"14px 16px", border:`1.5px solid ${color}20`,
      borderTop:`3px solid ${color}` }}>
      <SectionHead title={title} color={color} />
      {children}
    </div>
  );
}
