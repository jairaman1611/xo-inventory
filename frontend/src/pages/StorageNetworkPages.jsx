import { useState, useMemo } from "react";
import { T } from "../theme";
import { GaugeBar, KV, SectionHead, SearchBar } from "../components/ui";

/* ── Storage ─────────────────────────────────────────────────────────────── */
export function StoragePage({ storage }) {
  const [search, setSearch] = useState("");
  const [exp, setExp]       = useState(null);
  const filtered = useMemo(() =>
    storage.filter(s => {
      const q = search.toLowerCase();
      return !q || [s.name, s.sr_type].some(f => f?.toLowerCase().includes(q));
    }), [storage, search]);

  return (
    <div>
      <div style={{ display:"flex", gap:8, marginBottom:14, alignItems:"center" }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Search storage repo…" />
        <span style={{ fontSize:11, color:T.textDim, fontWeight:500 }}>
          {filtered.length}/{storage.length}
        </span>
      </div>
      {filtered.map((s,i) => (
        <SRCard key={s.id} sr={s} index={i}
          expanded={exp===s.id} onToggle={() => setExp(exp===s.id?null:s.id)} />
      ))}
    </div>
  );
}

function SRCard({ sr, index, expanded, onToggle }) {
  const pct   = sr.used_pct ?? 0;
  const color = pct > 85 ? T.red : pct > 65 ? T.amber : T.green;

  return (
    <div onClick={onToggle} style={{
      background:"rgba(255,255,255,0.8)",
      border:`1.5px solid ${expanded ? color+"50" : T.border}`,
      borderLeft:`4px solid ${color}`,
      borderRadius:16, marginBottom:8, cursor:"pointer", overflow:"hidden",
      boxShadow: expanded ? `0 4px 20px ${color}20` : "0 2px 8px rgba(255,55,95,0.04)",
      transition:"all 0.2s", animation:`slideIn 0.3s ease ${index*0.04}s both` }}>

      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 16px",
        flexWrap:"wrap" }}>
        <span style={{ fontSize:22 }}>💾</span>
        <div style={{ flex:1, minWidth:160 }}>
          <div style={{ fontSize:13, fontWeight:700, color:T.text }}>{sr.name}</div>
          <div style={{ fontSize:11, color:T.textDim, marginTop:1,
            fontFamily:"'SF Mono','JetBrains Mono',monospace" }}>
            {sr.sr_type}{sr.shared?" · shared":" · local"}
          </div>
        </div>
        <span style={{ fontSize:12, fontWeight:800, color, padding:"3px 10px",
          borderRadius:50, background:`${color}15`, border:`1.5px solid ${color}30`,
          fontFamily:"'SF Mono','JetBrains Mono',monospace" }}>{pct}% used</span>
        <span style={{ fontSize:12, color:T.textMid,
          fontFamily:"'SF Mono','JetBrains Mono',monospace" }}>
          {sr.used_gb??"-"} / {sr.total_gb??"-"} GB
        </span>
        <span style={{ color:T.textDim, fontSize:11, display:"inline-block",
          transform:expanded?"rotate(180deg)":"none", transition:"transform 0.2s" }}>▼</span>
      </div>

      <div style={{ padding:"0 16px 10px" }}>
        <GaugeBar pct={pct} color={color} height={5} />
      </div>

      {expanded && (
        <div style={{ borderTop:`1px solid ${T.border}`, padding:"16px",
          display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))", gap:12,
          animation:"fadeIn 0.2s ease" }}>
          {[
            { title:"CAPACITY", color, items:[
              {l:"Total",     v:`${sr.total_gb??"-"} GB`, mono:true},
              {l:"Used",      v:`${sr.used_gb??"-"} GB`,  mono:true, accent:color},
              {l:"Free",      v:`${sr.free_gb??"-"} GB`,  mono:true, accent:T.green},
              {l:"Allocated", v:`${sr.alloc_gb??"-"} GB`, mono:true},
            ]},
            { title:"PROPERTIES", color:T.accent, items:[
              {l:"Type",      v:sr.sr_type||"—"},
              {l:"Shared",    v:sr.shared?"Yes":"No"},
              {l:"VDIs",      v:sr.vdi_count??0, mono:true},
              {l:"Content",   v:sr.content_type||"—"},
            ]},
          ].map(sec => (
            <div key={sec.title} style={{ background:"rgba(255,255,255,0.7)",
              borderRadius:14, padding:"14px 16px",
              border:`1.5px solid ${sec.color}20`,
              borderTop:`3px solid ${sec.color}` }}>
              <SectionHead title={sec.title} color={sec.color} />
              {sec.items.map((it,j) => <KV key={j} label={it.l} value={it.v} mono={it.mono} accent={it.accent} />)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Networks ────────────────────────────────────────────────────────────── */
export function NetworksPage({ networks }) {
  const [search, setSearch] = useState("");
  const [exp, setExp]       = useState(null);
  const filtered = useMemo(() =>
    networks.filter(n => {
      const q = search.toLowerCase();
      return !q || [n.name, n.bridge, n.vlan?.toString()].some(f => f?.toLowerCase().includes(q));
    }), [networks, search]);

  return (
    <div>
      <div style={{ display:"flex", gap:8, marginBottom:14, alignItems:"center" }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Search network or VLAN…" />
        <span style={{ fontSize:11, color:T.textDim, fontWeight:500 }}>
          {filtered.length}/{networks.length}
        </span>
      </div>
      {filtered.map((n,i) => (
        <NetCard key={n.id} net={n} index={i}
          expanded={exp===n.id} onToggle={() => setExp(exp===n.id?null:n.id)} />
      ))}
    </div>
  );
}

function NetCard({ net:n, index, expanded, onToggle }) {
  return (
    <div onClick={onToggle} style={{
      background:"rgba(255,255,255,0.8)",
      border:`1.5px solid ${expanded ? T.teal+"50" : T.border}`,
      borderLeft:`4px solid ${T.teal}`,
      borderRadius:16, marginBottom:8, cursor:"pointer", overflow:"hidden",
      boxShadow: expanded ? `0 4px 20px rgba(90,200,250,0.15)` : "0 2px 8px rgba(255,55,95,0.04)",
      transition:"all 0.2s", animation:`slideIn 0.3s ease ${index*0.04}s both` }}>

      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 16px",
        flexWrap:"wrap" }}>
        <span style={{ fontSize:22 }}>🌐</span>
        <div style={{ flex:1, minWidth:160 }}>
          <div style={{ fontSize:13, fontWeight:700, color:T.text }}>{n.name}</div>
          <div style={{ fontSize:11, color:T.textDim, marginTop:1,
            fontFamily:"'SF Mono','JetBrains Mono',monospace" }}>
            bridge: {n.bridge||"—"}
          </div>
        </div>
        {[
          n.vlan != null && { val:`VLAN ${n.vlan}`, color:T.amber },
          { val:`MTU ${n.mtu}`, color:T.teal },
          { val:`${n.vif_count} VIFs`, color:T.accent },
        ].filter(Boolean).map((chip,i) => (
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
            { title:"NETWORK", color:T.teal, items:[
              {l:"Name",   v:n.name},
              {l:"Bridge", v:n.bridge||"—", mono:true},
              {l:"MTU",    v:n.mtu,         mono:true},
              {l:"VLAN",   v:n.vlan!=null?`VLAN ${n.vlan}`:"Untagged", mono:true, accent:T.amber},
            ]},
            { title:"ATTACHMENTS", color:T.accent, items:[
              {l:"VIFs (VMs)",   v:n.vif_count, mono:true},
              {l:"PIFs (Hosts)", v:n.pif_count, mono:true},
              {l:"Managed",      v:n.managed?"Yes":"No"},
            ]},
          ].map(sec => (
            <div key={sec.title} style={{ background:"rgba(255,255,255,0.7)",
              borderRadius:14, padding:"14px 16px",
              border:`1.5px solid ${sec.color}20`,
              borderTop:`3px solid ${sec.color}` }}>
              <SectionHead title={sec.title} color={sec.color} />
              {sec.items.map((it,j) => <KV key={j} label={it.l} value={it.v} mono={it.mono} accent={it.accent} />)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
