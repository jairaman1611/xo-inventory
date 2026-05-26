import { useState, useMemo } from "react";
import { T, STATUS } from "../theme";
import { Dot, StatusBadge, GaugeBar, KV, SectionHead, Tag, SearchBar } from "../components/ui";

export function HostsPage({ hosts }) {
  const [search,   setSearch]   = useState("");
  const [expanded, setExpanded] = useState(null);

  const filtered = useMemo(() =>
    hosts.filter(h => {
      const q = search.toLowerCase();
      return !q || [h.name, h.address, ...(h.tags||[])].some(f => f?.toLowerCase().includes(q));
    }), [hosts, search]);

  return (
    <div>
      <div style={{ display:"flex", gap:8, marginBottom:14, alignItems:"center" }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Search host name or IP…" />
        <span style={{ fontSize:11, color:T.textDim, fontWeight:500 }}>
          {filtered.length}/{hosts.length}
        </span>
      </div>
      {filtered.map((h, i) => (
        <HostCard key={h.id} host={h} index={i}
          expanded={expanded===h.id}
          onToggle={() => setExpanded(expanded===h.id ? null : h.id)} />
      ))}
    </div>
  );
}

function HostCard({ host:h, index, expanded, onToggle }) {
  const sc = STATUS[h.power_state] ?? T.textDim;
  return (
    <div onClick={onToggle} style={{
      background: expanded
        ? "rgba(255,255,255,0.95)"
        : "rgba(255,255,255,0.75)",
      border:`1.5px solid ${expanded ? T.primary+"40" : T.border}`,
      borderLeft:`4px solid ${expanded ? T.primary : T.primarySoft}`,
      borderRadius:16, marginBottom:8, cursor:"pointer", overflow:"hidden",
      boxShadow: expanded ? `0 4px 24px rgba(255,55,95,0.12)` : "0 2px 8px rgba(255,55,95,0.04)",
      transition:"all 0.2s", animation:`slideIn 0.3s ease ${index*0.04}s both` }}>

      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 16px",
        flexWrap:"wrap" }}>
        <Dot color={sc} pulse={h.power_state==="Online"} />
        <div style={{ flex:1, minWidth:180 }}>
          <div style={{ fontSize:13, fontWeight:700, color:T.text,
            fontFamily:"'SF Mono','JetBrains Mono',monospace" }}>{h.name}</div>
          <div style={{ fontSize:11, color:T.textDim, marginTop:1 }}>{h.address}</div>
        </div>
        <StatusBadge state={h.power_state} />
        {[
          { val:`🖥 ${h.resident_vms ?? 0} VMs`, color:T.accent },
          h.cpu_usage_pct != null && { val:`CPU ${h.cpu_usage_pct}%`, color:T.primary },
          h.mem_pct != null       && { val:`MEM ${h.mem_pct}%`,       color:T.purple },
        ].filter(Boolean).map((chip, i) => (
          <span key={i} style={{ fontSize:11, padding:"3px 10px", borderRadius:50,
            fontFamily:"'SF Mono','JetBrains Mono',monospace", fontWeight:600,
            background:`${chip.color}15`, color:chip.color,
            border:`1.5px solid ${chip.color}30` }}>{chip.val}</span>
        ))}
        <span style={{ color:T.textDim, fontSize:11, display:"inline-block",
          transform:expanded?"rotate(180deg)":"none", transition:"transform 0.2s" }}>▼</span>
      </div>

      {expanded && (
        <div style={{ borderTop:`1px solid ${T.border}`, padding:"16px",
          display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))", gap:12,
          animation:"fadeIn 0.2s ease" }}>
          {[
            { title:"IDENTITY", color:T.primary, items:[
              { l:"Name",       v:h.name,       mono:true  },
              { l:"Address",    v:h.address,    mono:true, accent:T.accent },
              { l:"Xen",        v:h.xen_version||"—" },
              { l:"XS Version", v:h.xs_version||"—"  },
              { l:"Uptime",     v:h.uptime_str||"—", mono:true, accent:T.teal },
            ]},
            { title:"COMPUTE", color:T.accent, items:[
              { l:"vCPUs",    v:h.cpu_count||"—",                    mono:true  },
              { l:"CPU used", v:h.cpu_usage_pct!=null?`${h.cpu_usage_pct}%`:"—", mono:true, accent:T.primary, gauge:h.cpu_usage_pct, gc:T.primary },
              { l:"Total RAM",v:h.mem_total_gb?`${h.mem_total_gb} GB`:"—",       mono:true  },
              { l:"Used RAM", v:h.mem_used_gb ?`${h.mem_used_gb} GB` :"—",       mono:true, accent:T.purple  },
              { l:"Free RAM", v:h.mem_free_gb ?`${h.mem_free_gb} GB` :"—",       mono:true, accent:T.green   },
              { gauge:h.mem_pct, gc:T.purple },
            ]},
            { title:"WORKLOAD", color:T.green, items:[
              { l:"Resident VMs", v:h.resident_vms??0,                mono:true, accent:T.accent },
              { l:"HA",           v:h.ha_enabled?"Enabled":"Disabled", accent:h.ha_enabled?T.green:T.textDim },
              { l:"Pool",         v:h.pool_ref||"—",                  mono:true  },
            ]},
          ].map(sec => (
            <div key={sec.title} style={{ background:"rgba(255,255,255,0.7)",
              borderRadius:14, padding:"14px 16px",
              border:`1.5px solid ${sec.color}20`,
              borderTop:`3px solid ${sec.color}` }}>
              <SectionHead title={sec.title} color={sec.color} />
              {sec.items.map((it, j) =>
                it.gauge != null
                  ? <GaugeBar key={j} pct={it.gauge} color={it.gc} height={6} />
                  : <KV key={j} label={it.l} value={it.v} mono={it.mono} accent={it.accent} />
              )}
              {sec.title==="IDENTITY" && h.tags?.length>0 && (
                <div style={{ marginTop:8, display:"flex", flexWrap:"wrap", gap:4 }}>
                  {h.tags.map(t => <Tag key={t} label={t} />)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
