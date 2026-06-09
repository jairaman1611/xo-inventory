import { useState, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";
import { T, STATUS, STATUS_SOFT } from "../theme";
import { Dot, StatusBadge, GaugeBar, KV, SectionHead, Tag, SearchBar } from "../components/ui";

/* ── Columns ─────────────────────────────────────────────────────────────── */
const COLUMNS = [
  { key:"name",         label:"Name",       width:170 },
  { key:"power_state",  label:"State",      width:90  },
  { key:"dc",           label:"DC",         width:55  },
  { key:"address",      label:"Mgmt IP",    width:115 },
  { key:"idrac_ip",     label:"iDRAC IP",   width:115 },
  { key:"resident_vms", label:"VMs",        width:55  },
  { key:"cpu_count",    label:"CPUs",       width:55  },
  { key:"cpu_pct",      label:"CPU %",      width:90  },
  { key:"mem_total",    label:"RAM (GB)",   width:80  },
  { key:"mem_pct",      label:"MEM %",      width:90  },
  { key:"xs_version",   label:"XS Version", width:105 },
  { key:"uptime",       label:"Uptime",     width:110 },
];

function accessor(h, key) {
  switch (key) {
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

/* ── Export ──────────────────────────────────────────────────────────────── */
function doExport(rows, fmt) {
  const data = rows.map(h => ({
    Name:          h.name,
    "Power State": h.power_state,
    DC:            h.dc ?? "—",
    Location:      h.location ?? "—",
    Environment:   h.env ?? "—",
    "Mgmt IP":     h.address ?? "—",
    "iDRAC IP":    h.idrac_ip || "—",
    "Serial / S-Tag": h.serial_number || "—",
    "Resident VMs":h.resident_vms ?? 0,
    "vCPUs":       h.cpu_count ?? "",
    "CPU %":       h.cpu_usage_pct ?? "",
    "RAM Total (GB)": h.mem_total_gb ?? "",
    "RAM Used (GB)":  h.mem_used_gb  ?? "",
    "RAM Free (GB)":  h.mem_free_gb  ?? "",
    "MEM %":       h.mem_pct ?? "",
    "XS Version":  h.xs_version ?? "—",
    "Xen Version": h.xen_version ?? "—",
    Uptime:        h.uptime_str ?? "—",
    Tags:          (h.tags ?? []).join(", "),
    ID:            h.id,
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Hosts");
  ws["!cols"] = [{wch:28},{wch:10},{wch:6},{wch:14},{wch:16},{wch:16},
                 {wch:14},{wch:8},{wch:7},{wch:7},{wch:14},{wch:13},
                 {wch:13},{wch:7},{wch:14},{wch:14},{wch:14},{wch:20},{wch:36}];
  XLSX.writeFile(wb, `pv-hosts-${new Date().toISOString().slice(0,10)}.${fmt}`,
    fmt === "csv" ? { bookType:"csv" } : {});
}

/* ── Filter state ────────────────────────────────────────────────────────── */
const EMPTY_FILTERS = { name:"", state:[], dc:[], idrac:"any" };

function applyHostFilters(hosts, filters, search) {
  const q = search.toLowerCase().trim();
  return hosts.filter(h => {
    if (q && ![h.name, h.address, h.idrac_ip, h.dc, h.xs_version, ...(h.tags||[])]
               .some(f => f?.toLowerCase().includes(q))) return false;
    if (filters.name && !h.name?.toLowerCase().includes(filters.name.toLowerCase())) return false;
    if (filters.state.length > 0 && !filters.state.includes(h.power_state)) return false;
    if (filters.dc.length > 0    && !filters.dc.includes(h.dc))             return false;
    if (filters.idrac === "yes"  && !h.idrac_ip)  return false;
    if (filters.idrac === "no"   &&  h.idrac_ip)  return false;
    return true;
  });
}

/* ── Main component ──────────────────────────────────────────────────────── */
export function HostsPage({ hosts }) {
  const [search,      setSearch]      = useState("");
  const [filters,     setFilters]     = useState(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [sortKey,     setSortKey]     = useState("name");
  const [sortDir,     setSortDir]     = useState("asc");
  const [selected,    setSelected]    = useState(null);

  const toggleSort = useCallback((key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }, [sortKey]);

  const filtered = useMemo(() =>
    applyHostFilters(hosts, filters, search), [hosts, filters, search]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = accessor(a, sortKey);
      const bv = accessor(b, sortKey);
      return (typeof av === "number" ? av - bv : String(av).localeCompare(String(bv))) * dir;
    });
  }, [filtered, sortKey, sortDir]);

  const dcCounts  = useMemo(() => hosts.reduce((m,h) => { m[h.dc]=(m[h.dc]||0)+1; return m; }, {}), [hosts]);
  const activeFilters = countActiveHostFilters(filters);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 100px)" }}>

      {/* ── Toolbar ── */}
      <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap",
        paddingBottom:10, flexShrink:0 }}>
        <SearchBar value={search} onChange={v => { setSearch(v); }}
          placeholder="Search host name, IP, iDRAC, DC, version…" />

        {/* Filter toggle */}
        <button onClick={() => setShowFilters(s => !s)} style={{
          padding:"7px 14px", borderRadius:50, fontSize:11, fontWeight:700,
          cursor:"pointer", transition:"all 0.15s",
          border:`1.5px solid ${showFilters||activeFilters>0 ? T.primary : T.border}`,
          background: showFilters||activeFilters>0 ? T.primarySoft : "rgba(255,255,255,0.7)",
          color: showFilters||activeFilters>0 ? T.primary : T.textDim,
          boxShadow: activeFilters>0 ? `0 2px 8px rgba(255,55,95,0.25)` : "none",
          display:"flex", alignItems:"center", gap:6 }}>
          🎛 Filters
          {activeFilters > 0 && (
            <span style={{ padding:"1px 7px", borderRadius:20, fontSize:10,
              fontWeight:800, background:T.gradPrimary, color:"#fff" }}>
              {activeFilters}
            </span>
          )}
        </button>

        <span style={{ fontSize:11, color:T.textDim, fontWeight:500, whiteSpace:"nowrap" }}>
          {sorted.length}/{hosts.length} hosts
        </span>
        <div style={{ flex:1 }} />
        <ExportMenu onExport={fmt => doExport(sorted, fmt)} />
      </div>

      {/* ── Filter panel ── */}
      {showFilters && (
        <HostFilterPanel
          hosts={hosts} filters={filters}
          onChange={f => setFilters(f)}
          onClose={() => setShowFilters(false)}
        />
      )}

      {/* ── Table ── */}
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
                selected={selected?.id === h.id}
                onClick={() => setSelected(selected?.id === h.id ? null : h)} />
            ))}
            {/* Inline detail panel */}
            {selected && sorted.some(r => r.id === selected.id) && (
              <tr>
                <td colSpan={COLUMNS.length} style={{ padding:0 }}>
                  <HostInlineDetail host={selected} onClose={() => setSelected(null)} />
                </td>
              </tr>
            )}
            {sorted.length === 0 && (
              <tr><td colSpan={COLUMNS.length}
                style={{ textAlign:"center", padding:60, color:T.textDim, fontSize:13 }}>
                <div style={{ fontSize:32, marginBottom:10 }}>🔍</div>
                No hosts match your filters
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Filter panel ────────────────────────────────────────────────────────── */
function HostFilterPanel({ hosts, filters, onChange, onClose }) {
  const f   = filters;
  const set = (key, val) => onChange({ ...f, [key]: val });
  const active = countActiveHostFilters(f);

  return (
    <div style={{ background:"rgba(255,255,255,0.97)", backdropFilter:"blur(20px)",
      border:`1.5px solid ${T.border}`, borderRadius:20,
      boxShadow:`0 8px 40px rgba(255,55,95,0.14)`,
      padding:"20px 22px", marginBottom:14,
      animation:"slideIn 0.2s cubic-bezier(.34,1.2,.64,1)" }}>

      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
        marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:16 }}>🎛</span>
          <span style={{ fontWeight:800, fontSize:14, color:T.text }}>Host Filters</span>
          {active > 0 && (
            <span style={{ padding:"2px 8px", borderRadius:20, fontSize:11,
              fontWeight:700, background:T.gradPrimary, color:"#fff" }}>{active} active</span>
          )}
        </div>
        <div style={{ display:"flex", gap:8 }}>
          {active > 0 && (
            <button onClick={() => onChange(EMPTY_FILTERS)} style={ghostBtn()}>Clear all</button>
          )}
          <button onClick={onClose} style={ghostBtn()}>✕ Close</button>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",
        gap:16 }}>

        {/* Name */}
        <FilterSection title="Host Name" icon="🖧" color={T.primary}>
          <input value={f.name} onChange={e => set("name", e.target.value)}
            placeholder="e.g. nj1-xcp"
            style={inputStyle()} />
        </FilterSection>

        {/* Power state */}
        <FilterSection title="Power State" icon="⚡" color={T.green}>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {["Online","Offline"].map(s => {
              const on    = f.state.includes(s);
              const color = STATUS[s] ?? T.textDim;
              return (
                <button key={s} onClick={() => set("state",
                  on ? f.state.filter(x=>x!==s) : [...f.state,s])} style={{
                  padding:"5px 12px", borderRadius:50, fontSize:11, fontWeight:700,
                  cursor:"pointer", border:`1.5px solid ${on?color:T.border}`,
                  background:on?(STATUS_SOFT[s]??T.surface):"transparent",
                  color:on?color:T.textDim, transition:"all 0.15s",
                  display:"flex", alignItems:"center", gap:5 }}>
                  {on && <span style={{ width:5,height:5,borderRadius:"50%",
                    background:color,display:"inline-block" }} />}
                  {s}
                </button>
              );
            })}
          </div>
        </FilterSection>

        {/* DC */}
        <FilterSection title="Datacenter" icon="🌍" color={T.accent}>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {["SV","NL","UK","NJ"].map(dc => {
              const on  = f.dc.includes(dc);
              const col = DC_COLORS[dc] || T.accent;
              return (
                <button key={dc} onClick={() => set("dc",
                  on ? f.dc.filter(x=>x!==dc) : [...f.dc,dc])} style={{
                  padding:"5px 12px", borderRadius:50, fontSize:11, fontWeight:700,
                  cursor:"pointer", border:`1.5px solid ${on?col:T.border}`,
                  background:on?`${col}18`:"transparent",
                  color:on?col:T.textDim, transition:"all 0.15s" }}>
                  {dc}
                </button>
              );
            })}
          </div>
        </FilterSection>

        {/* iDRAC */}
        <FilterSection title="iDRAC / BMC" icon="🔌" color={T.teal}>
          <div style={{ display:"flex", gap:6 }}>
            {[["any","Any"],["yes","Has iDRAC"],["no","No iDRAC"]].map(([val,label]) => (
              <button key={val} onClick={() => set("idrac", val)} style={{
                padding:"5px 12px", borderRadius:50, fontSize:11, fontWeight:700,
                cursor:"pointer", border:`1.5px solid ${f.idrac===val?T.teal:T.border}`,
                background:f.idrac===val?`${T.teal}18`:"transparent",
                color:f.idrac===val?T.teal:T.textDim, transition:"all 0.15s" }}>
                {label}
              </button>
            ))}
          </div>
        </FilterSection>
      </div>

      {/* Active chips */}
      {active > 0 && (
        <div style={{ marginTop:14, paddingTop:12, borderTop:`1px solid ${T.border}`,
          display:"flex", flexWrap:"wrap", gap:6, alignItems:"center" }}>
          <span style={{ fontSize:11, color:T.textDim, fontWeight:600 }}>Active:</span>
          {f.name && <Chip label={`Name: "${f.name}"`} color={T.primary}
            onRemove={() => set("name","")} />}
          {f.state.map(s => <Chip key={s} label={s} color={STATUS[s]??T.textDim}
            onRemove={() => set("state",f.state.filter(x=>x!==s))} />)}
          {f.dc.map(d => <Chip key={d} label={d} color={DC_COLORS[d]??T.accent}
            onRemove={() => set("dc",f.dc.filter(x=>x!==d))} />)}
          {f.idrac !== "any" && <Chip label={f.idrac==="yes"?"Has iDRAC":"No iDRAC"}
            color={T.teal} onRemove={() => set("idrac","any")} />}
        </div>
      )}
    </div>
  );
}

function countActiveHostFilters(f) {
  return [f.name?1:0, f.state.length, f.dc.length, f.idrac!=="any"?1:0]
    .reduce((a,b)=>a+b,0);
}

/* ── Table components ────────────────────────────────────────────────────── */
function Th({ col, sortKey, sortDir, onSort }) {
  const active = sortKey === col.key;
  return (
    <th onClick={onSort} style={{
      padding:"11px 10px", textAlign:"left", fontSize:10, fontWeight:800,
      letterSpacing:"0.08em", color:active?T.primary:T.textMid,
      background:"transparent", cursor:"pointer", userSelect:"none", whiteSpace:"nowrap",
      borderBottom:`2px solid ${active?T.primary:"rgba(255,55,95,0.1)"}`,
      overflow:"hidden", textOverflow:"ellipsis", transition:"color 0.15s" }}>
      <div style={{ display:"flex", alignItems:"center", gap:3 }}>
        <span style={{ overflow:"hidden", textOverflow:"ellipsis" }}>{col.label}</span>
        <span style={{ display:"inline-flex", flexDirection:"column", lineHeight:1, flexShrink:0 }}>
          <span style={{ fontSize:8, opacity:active&&sortDir==="asc"  ?1:0.2 }}>▲</span>
          <span style={{ fontSize:8, opacity:active&&sortDir==="desc" ?1:0.2 }}>▼</span>
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
      style={{ background:selected?T.primarySoft:base,
        borderBottom:`1px solid ${T.border}`, cursor:"pointer",
        transition:"background 0.12s",
        outline:selected?`2px solid ${T.primary}`:"none" }}
      onMouseEnter={e => { if(!selected) e.currentTarget.style.background=T.cardHi; }}
      onMouseLeave={e => { if(!selected) e.currentTarget.style.background=base; }}>

      <td style={td()}>
        <div style={{ display:"flex", alignItems:"center", gap:7 }}>
          <Dot color={sc} pulse={h.power_state==="Online"} />
          <span style={{ fontFamily:"'SF Mono','JetBrains Mono',monospace", fontSize:12,
            fontWeight:700, color:T.text, overflow:"hidden", textOverflow:"ellipsis",
            whiteSpace:"nowrap" }}>{h.name}</span>
          {h.serial_number && (
            <span title="Serial / Service Tag" style={{
              fontSize:"0.67rem", fontFamily:"'SF Mono','JetBrains Mono',monospace",
              color:T.amber, background:`${T.amber}15`,
              border:`1px solid ${T.amber}35`, borderRadius:4,
              padding:"1px 5px", letterSpacing:"0.03em", flexShrink:0,
            }}>{h.serial_number}</span>
          )}
        </div>
      </td>
      <td style={td()}><StatusBadge state={h.power_state} /></td>
      <td style={td()}>
        <span style={{ padding:"2px 7px", borderRadius:20, fontSize:11, fontWeight:800,
          background:`${dcCol}18`, color:dcCol, border:`1px solid ${dcCol}35` }}>
          {h.dc||"—"}
        </span>
      </td>
      <td style={td(T.accent, true)}>{h.address||"—"}</td>
      <td style={td(T.teal, true)}>
        {h.idrac_ip
          ? <a href={`https://${h.idrac_ip}`} target="_blank" rel="noreferrer"
              onClick={e=>e.stopPropagation()}
              style={{ color:T.teal, textDecoration:"none",
                fontFamily:"'SF Mono','JetBrains Mono',monospace", fontSize:11 }}>
              {h.idrac_ip} ↗
            </a>
          : <span style={{ color:T.textDim }}>—</span>}
      </td>
      <td style={{ ...td(T.accent,true), textAlign:"center" }}>{h.resident_vms??0}</td>
      <td style={{ ...td(T.textMid,true), textAlign:"center" }}>{h.cpu_count??"-"}</td>
      <td style={td()}>
        {h.cpu_usage_pct!=null ? (
          <div>
            <div style={{ fontSize:11,fontWeight:700,color:T.primary,
              fontFamily:"'SF Mono','JetBrains Mono',monospace",marginBottom:2 }}>
              {h.cpu_usage_pct}%
            </div>
            <GaugeBar pct={h.cpu_usage_pct} color={T.primary} height={4} />
          </div>
        ) : <span style={{ color:T.textDim }}>—</span>}
      </td>
      <td style={{ ...td(T.textMid,true), textAlign:"center" }}>{h.mem_total_gb??"-"}</td>
      <td style={td()}>
        {h.mem_pct!=null ? (
          <div>
            <div style={{ fontSize:11,fontWeight:700,color:T.purple,
              fontFamily:"'SF Mono','JetBrains Mono',monospace",marginBottom:2 }}>
              {h.mem_pct}%
            </div>
            <GaugeBar pct={h.mem_pct} color={T.purple} height={4} />
          </div>
        ) : <span style={{ color:T.textDim }}>—</span>}
      </td>
      <td style={td(T.textDim)}>
        <span style={{ fontSize:11,overflow:"hidden",textOverflow:"ellipsis",
          display:"block",whiteSpace:"nowrap" }}>{h.xs_version||"—"}</span>
      </td>
      <td style={td(T.textDim)}>
        <span style={{ fontSize:11,fontFamily:"'SF Mono','JetBrains Mono',monospace" }}>
          {h.uptime_str||"—"}
        </span>
      </td>
    </tr>
  );
}

function td(color, mono=false) {
  return { padding:"9px 10px", fontSize:12, color:color||T.textMid,
    fontFamily:mono?"'SF Mono','JetBrains Mono',monospace":undefined,
    verticalAlign:"middle", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" };
}

/* ── Inline detail panel ─────────────────────────────────────────────────── */
function HostInlineDetail({ host:h, onClose }) {
  const dcCol = DC_COLORS[h.dc] || T.primary;
  return (
    <div style={{ borderTop:`2px solid ${dcCol}`, padding:"18px 22px",
      background:`linear-gradient(135deg,${dcCol}12,${T.accentSoft}20)`,
      animation:"fadeIn 0.2s ease" }}>

      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
        marginBottom:14 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          <span style={{ fontFamily:"'SF Mono','JetBrains Mono',monospace",
            fontSize:14, fontWeight:800, color:T.text }}>{h.name}</span>
          <StatusBadge state={h.power_state} />
          <span style={{ padding:"2px 9px", borderRadius:50, fontSize:11, fontWeight:800,
            background:`${dcCol}18`, color:dcCol, border:`1px solid ${dcCol}35` }}>
            {h.dc}
          </span>
          {h.env && (
            <span style={{ fontSize:11, color:T.textDim }}>{h.location} · {h.env}</span>
          )}
        </div>
        <button onClick={onClose} style={{ background:`${dcCol}15`,
          border:`1.5px solid ${dcCol}30`, color:dcCol, borderRadius:50,
          padding:"4px 12px", fontSize:11, fontWeight:700, cursor:"pointer" }}>
          ✕ Close
        </button>
      </div>

      <div style={{ display:"grid",
        gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))", gap:14 }}>

        <Panel title="IDENTITY" color={T.primary}>
          <KV label="Mgmt IP"    value={h.address||"—"}    mono accent={T.accent} />
          {h.serial_number && (
            <KV label="Serial / S-Tag" value={h.serial_number} mono accent={T.amber} />
          )}
          <KV label="iDRAC IP"   value={h.idrac_ip||"—"}   mono accent={T.teal} />
          <KV label="Xen"        value={h.xen_version||"—"} />
          <KV label="XS Version" value={h.xs_version||"—"} />
          <KV label="Uptime"     value={h.uptime_str||"—"} mono accent={T.teal} />
          {h.tags?.length>0 && (
            <div style={{ marginTop:8, display:"flex", flexWrap:"wrap", gap:4 }}>
              {h.tags.map(t=><Tag key={t} label={t} />)}
            </div>
          )}
        </Panel>

        <Panel title="COMPUTE" color={T.accent}>
          <KV label="vCPUs"     value={h.cpu_count||"—"} mono />
          <KV label="CPU Used"  value={h.cpu_usage_pct!=null?`${h.cpu_usage_pct}%`:"—"}
            mono accent={T.primary} />
          {h.cpu_usage_pct!=null && <GaugeBar pct={h.cpu_usage_pct} color={T.primary} height={5} />}
          <div style={{ marginTop:8 }} />
          <KV label="Total RAM" value={h.mem_total_gb?`${h.mem_total_gb} GB`:"—"} mono />
          <KV label="Used RAM"  value={h.mem_used_gb?`${h.mem_used_gb} GB`:"—"}  mono accent={T.purple} />
          <KV label="Free RAM"  value={h.mem_free_gb?`${h.mem_free_gb} GB`:"—"}  mono accent={T.green} />
          {h.mem_pct!=null && <GaugeBar pct={h.mem_pct} color={T.purple} height={5} />}
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

/* ── Export menu ─────────────────────────────────────────────────────────── */
function ExportMenu({ onExport }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position:"relative" }}>
      <button onClick={() => setOpen(o=>!o)} style={{
        padding:"8px 16px", borderRadius:50, fontSize:12, fontWeight:700,
        cursor:"pointer", border:"none", background:T.gradAccent, color:"#fff",
        boxShadow:`0 4px 14px rgba(99,110,250,0.35)`,
        display:"flex", alignItems:"center", gap:6 }}>
        ↓ Export {open?"▲":"▼"}
      </button>
      {open && (
        <div style={{ position:"absolute", right:0, top:"calc(100% + 8px)", width:170,
          background:"rgba(255,255,255,0.97)", backdropFilter:"blur(16px)",
          border:`1.5px solid ${T.border}`, borderRadius:14, overflow:"hidden",
          zIndex:50, boxShadow:"0 8px 32px rgba(255,55,95,0.15)" }}>
          {[["xlsx","📊  Excel (.xlsx)"],["csv","📄  CSV (.csv)"]].map(([fmt,label])=>(
            <button key={fmt} onClick={()=>{onExport(fmt);setOpen(false);}} style={{
              display:"block", width:"100%", padding:"12px 16px", textAlign:"left",
              background:"transparent", border:"none", color:T.text,
              fontSize:13, fontWeight:500, cursor:"pointer" }}
              onMouseEnter={e=>e.target.style.background=T.primarySoft}
              onMouseLeave={e=>e.target.style.background="transparent"}>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Shared helpers ──────────────────────────────────────────────────────── */
function FilterSection({ title, icon, color, children }) {
  return (
    <div style={{ background:`${color}08`, borderRadius:14, padding:"14px 16px",
      border:`1.5px solid ${color}20` }}>
      <div style={{ fontSize:10, fontWeight:800, letterSpacing:"0.1em", color,
        marginBottom:10, display:"flex", alignItems:"center", gap:5 }}>
        <span>{icon}</span> {title}
      </div>
      {children}
    </div>
  );
}

function Chip({ label, color, onRemove }) {
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5,
      padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:600,
      background:`${color}18`, color, border:`1.5px solid ${color}35` }}>
      {label}
      <button onClick={onRemove} style={{ background:"none", border:"none",
        color, cursor:"pointer", fontSize:12, padding:0, opacity:0.7 }}>✕</button>
    </span>
  );
}

function inputStyle() {
  return {
    width:"100%", background:"rgba(255,255,255,0.9)",
    border:`1.5px solid ${T.border}`, borderRadius:10,
    padding:"7px 11px", fontSize:12, color:T.text,
    outline:"none", boxSizing:"border-box", fontFamily:"inherit",
    transition:"border-color 0.15s",
  };
}

function ghostBtn() {
  return { padding:"5px 12px", borderRadius:50, fontSize:11, fontWeight:600,
    cursor:"pointer", border:`1.5px solid ${T.border}`,
    background:"transparent", color:T.textDim };
}
