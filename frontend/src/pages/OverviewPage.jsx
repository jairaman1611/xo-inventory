import { useState, useMemo } from "react";
import { T } from "../theme";
import { GaugeBar, SectionHead, Card } from "../components/ui";
import {
  ResponsiveContainer, RadialBarChart, RadialBar, PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";

/* ── DC / Environment definitions ───────────────────────────────────────── */
const DCS = [
  { id:"ALL", label:"All DCs",      flag:"🌍", color:T.primary  },
  { id:"SV",  label:"Sunnyvale",    flag:"🇺🇸", color:"#3B9EFF",
    envs:["US PRD","US STG"], prefix:"sv" },
  { id:"NL",  label:"Netherlands",  flag:"🇳🇱", color:"#FF9F0A",
    envs:["EU PRD","EU STG"], prefix:"nl" },
  { id:"UK",  label:"UK",           flag:"🇬🇧", color:"#30D158",
    envs:["UK TB","UK DR"],   prefix:"uk" },
  { id:"NJ",  label:"New Jersey",   flag:"🗽", color:"#BF5AF2",
    envs:["NJ TB","NJ DR"],   prefix:"nj" },
];

const ENVS = [
  { id:"US PRD", dc:"SV", label:"US PRD", color:"#3B9EFF" },
  { id:"US STG", dc:"SV", label:"US STG", color:"#5AC8FA" },
  { id:"EU PRD", dc:"NL", label:"EU PRD", color:"#FF9F0A" },
  { id:"EU STG", dc:"NL", label:"EU STG", color:"#FFD60A" },
  { id:"UK TB",  dc:"UK", label:"UK TB",  color:"#30D158" },
  { id:"UK DR",  dc:"UK", label:"UK DR",  color:"#34C759" },
  { id:"NJ TB",  dc:"NJ", label:"NJ TB",  color:"#BF5AF2" },
  { id:"NJ DR",  dc:"NJ", label:"NJ DR",  color:"#9F7AEA" },
];

function matchesDC(name, dc) {
  if (!name) return false;
  return name.toLowerCase().startsWith(dc.toLowerCase());
}

function getEnv(name) {
  const n = (name||"").toLowerCase();
  if (n.startsWith("sv")) return n.includes("stgjob") || n.includes("stg") ? "US STG" : "US PRD";
  if (n.startsWith("nl")) return n.includes("stgjob") || n.includes("stg") ? "EU STG" : "EU PRD";
  if (n.startsWith("uk")) return n.includes("drjob")  || n.includes("dr")  ? "UK DR"  : "UK TB";
  if (n.startsWith("nj")) return n.includes("drjob")  || n.includes("dr")  ? "NJ DR"  : "NJ TB";
  return "Unknown";
}

export function OverviewPage({ data }) {
  if (!data) return null;
  const { vms, hosts, storage, summary } = data;

  const [selDC,  setSelDC]  = useState("ALL");
  const [selEnv, setSelEnv] = useState(null);

  /* ── filtered slices ── */
  const filteredVMs = useMemo(() => {
    return vms.filter(v => {
      const n = v.name || "";
      if (selEnv) return getEnv(n) === selEnv;
      if (selDC !== "ALL") return matchesDC(n, selDC);
      return true;
    });
  }, [vms, selDC, selEnv]);

  const filteredHosts = useMemo(() => {
    return hosts.filter(h => {
      const n = h.name || "";
      if (selDC !== "ALL") return matchesDC(n, selDC);
      return true;
    });
  }, [hosts, selDC]);

  const filteredStorage = useMemo(() => {
    if (selDC === "ALL") return storage;
    return storage.filter(s => matchesDC(s.name, selDC) || matchesDC(s.pool_ref, selDC));
  }, [storage, selDC]);

  /* ── derived summary for current filter ── */
  const S = useMemo(() => {
    const running = filteredVMs.filter(v => v.power_state === "Running");
    const halted  = filteredVMs.filter(v => v.power_state === "Halted");
    const paused  = filteredVMs.filter(v => v.power_state === "Paused");
    const totMem  = filteredHosts.reduce((a,h) => a + (h.mem_total_gb||0), 0);
    const usedMem = filteredHosts.reduce((a,h) => a + (h.mem_used_gb||0), 0);
    const totStor = filteredStorage.reduce((a,s) => a + (s.total_gb||0), 0);
    const usedStor= filteredStorage.reduce((a,s) => a + (s.used_gb||0),  0);
    return {
      total_vms:      filteredVMs.length,
      running_vms:    running.length,
      halted_vms:     halted.length,
      paused_vms:     paused.length,
      total_hosts:    filteredHosts.length,
      total_vcpus:    running.reduce((a,v) => a + (v.vcpus||0), 0),
      mem_total_gb:   Math.round(totMem*10)/10,
      mem_used_gb:    Math.round(usedMem*10)/10,
      mem_pct:        totMem ? Math.round(usedMem/totMem*1000)/10 : 0,
      stor_total_gb:  Math.round(totStor*10)/10,
      stor_used_gb:   Math.round(usedStor*10)/10,
      stor_pct:       totStor ? Math.round(usedStor/totStor*1000)/10 : 0,
      avg_cpu_pct:    filteredHosts.length
        ? Math.round(filteredHosts.reduce((a,h) => a+(h.cpu_usage_pct||0),0) / filteredHosts.length * 10)/10
        : 0,
    };
  }, [filteredVMs, filteredHosts, filteredStorage]);

  /* ── env breakdown (for current DC) ── */
  const envBreakdown = useMemo(() => {
    const envList = selDC === "ALL"
      ? ENVS
      : ENVS.filter(e => e.dc === selDC);
    return envList.map(e => {
      const evms = vms.filter(v => getEnv(v.name) === e.id);
      return { ...e, total: evms.length, running: evms.filter(v=>v.power_state==="Running").length };
    }).filter(e => e.total > 0);
  }, [vms, selDC]);

  /* ── chart data ── */
  const vmStates = [
    { name:"Running", value:S.running_vms, fill:T.green },
    { name:"Halted",  value:S.halted_vms,  fill:T.red   },
    { name:"Paused",  value:S.paused_vms,  fill:T.amber },
  ].filter(d => d.value > 0);

  const radials = [
    { name:"CPU",     value:S.avg_cpu_pct ?? 0, fill:T.primary },
    { name:"Memory",  value:S.mem_pct     ?? 0, fill:T.accent  },
    { name:"Storage", value:S.stor_pct    ?? 0, fill:T.amber   },
  ];

  const hostBars = filteredHosts.slice(0,10).map(h => ({
    name:   h.name.split(".")[0],
    CPU:    h.cpu_usage_pct ?? 0,
    Memory: h.mem_pct ?? 0,
  }));

  const storBars = filteredStorage.slice(0,6).map(s => ({
    name: s.name.length > 14 ? s.name.slice(0,14)+"…" : s.name,
    Used: s.used_gb ?? 0,
    Free: s.free_gb ?? 0,
  }));

  const activeDC = DCS.find(d => d.id === selDC) || DCS[0];

  return (
    <div>
      {/* ── DC Region Selector ── */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:10, fontWeight:800, letterSpacing:"0.12em",
          color:T.textDim, marginBottom:10 }}>DATACENTER / REGION</div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {DCS.map(dc => {
            const active = selDC === dc.id;
            return (
              <button key={dc.id} onClick={() => { setSelDC(dc.id); setSelEnv(null); }}
                style={{ padding:"10px 18px", borderRadius:50, fontSize:12, fontWeight:700,
                  cursor:"pointer", transition:"all 0.15s",
                  border:`1.5px solid ${active ? dc.color : T.border}`,
                  background: active ? `${dc.color}22` : "rgba(255,255,255,0.7)",
                  color: active ? dc.color : T.textDim,
                  boxShadow: active ? `0 4px 14px ${dc.color}30` : "none",
                  display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ fontSize:16 }}>{dc.flag}</span>
                {dc.label}
                {dc.id !== "ALL" && (
                  <span style={{ fontSize:10, padding:"1px 7px", borderRadius:20,
                    fontWeight:800, background: active ? `${dc.color}30` : "rgba(0,0,0,0.06)",
                    color: active ? dc.color : T.textDim }}>
                    {vms.filter(v => matchesDC(v.name, dc.prefix||dc.id)).length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Environment sub-filter */}
        {selDC !== "ALL" && envBreakdown.length > 0 && (
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:10,
            padding:"12px 16px", borderRadius:14,
            background:"rgba(255,255,255,0.6)", border:`1px solid ${T.border}` }}>
            <span style={{ fontSize:10, fontWeight:700, color:T.textDim,
              alignSelf:"center", marginRight:4 }}>ENV:</span>
            <button onClick={() => setSelEnv(null)} style={{
              padding:"4px 12px", borderRadius:50, fontSize:11, fontWeight:700,
              cursor:"pointer", border:`1.5px solid ${!selEnv ? activeDC.color : T.border}`,
              background: !selEnv ? `${activeDC.color}20` : "transparent",
              color: !selEnv ? activeDC.color : T.textDim }}>All</button>
            {envBreakdown.map(e => (
              <button key={e.id} onClick={() => setSelEnv(selEnv===e.id ? null : e.id)}
                style={{ padding:"4px 12px", borderRadius:50, fontSize:11, fontWeight:700,
                  cursor:"pointer", transition:"all 0.12s",
                  border:`1.5px solid ${selEnv===e.id ? e.color : T.border}`,
                  background: selEnv===e.id ? `${e.color}20` : "transparent",
                  color: selEnv===e.id ? e.color : T.textMid,
                  display:"flex", alignItems:"center", gap:5 }}>
                {e.label}
                <span style={{ fontSize:10, fontWeight:800,
                  color: selEnv===e.id ? e.color : T.textDim }}>
                  {e.running}/{e.total}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Env breakdown cards (ALL view) ── */}
      {selDC === "ALL" && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",
          gap:10, marginBottom:20 }}>
          {ENVS.map(e => {
            const evms    = vms.filter(v => getEnv(v.name) === e.id);
            const running = evms.filter(v => v.power_state === "Running").length;
            const dc      = DCS.find(d => d.id === e.dc);
            return (
              <div key={e.id} onClick={() => { setSelDC(e.dc); setSelEnv(e.id); }}
                style={{ borderRadius:16, padding:"14px 16px", cursor:"pointer",
                  background:`linear-gradient(135deg,${e.color}22,${e.color}10)`,
                  border:`1.5px solid ${e.color}40`, transition:"all 0.15s",
                  boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}
                onMouseEnter={e2 => e2.currentTarget.style.transform="translateY(-2px)"}
                onMouseLeave={e2 => e2.currentTarget.style.transform="none"}>
                <div style={{ display:"flex", justifyContent:"space-between",
                  alignItems:"flex-start", marginBottom:8 }}>
                  <span style={{ fontSize:18 }}>{dc?.flag}</span>
                  <span style={{ fontSize:9, fontWeight:800, padding:"2px 7px",
                    borderRadius:20, background:`${e.color}25`, color:e.color,
                    letterSpacing:"0.06em" }}>{e.label}</span>
                </div>
                <div style={{ fontSize:22, fontWeight:800, color:e.color,
                  fontFamily:"'SF Mono','JetBrains Mono',monospace" }}>{evms.length}</div>
                <div style={{ fontSize:10, color:T.textMid, marginTop:2 }}>
                  <span style={{ color:T.green, fontWeight:700 }}>{running}</span> running
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── KPI cards ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(145px,1fr))",
        gap:12, marginBottom:20 }}>
        {[
          { icon:"🖥",  label:"Total VMs",   val:S.total_vms,    grad:T.gradPrimary },
          { icon:"▶",   label:"Running",      val:S.running_vms,  grad:T.gradGreen   },
          { icon:"🖧",  label:"Hosts",        val:S.total_hosts,  grad:T.gradAccent  },
          { icon:"⚙",  label:"vCPUs (live)", val:S.total_vcpus,  grad:`linear-gradient(135deg,${T.purple},#9F7AEA)` },
          { icon:"💾",  label:"Mem Used",    val:`${S.mem_used_gb}GB`, grad:`linear-gradient(135deg,${T.teal},#32ADE6)` },
          { icon:"📦",  label:"Stor Used",   val:`${S.stor_used_gb}GB`, grad:T.gradAmber },
        ].map(k => (
          <div key={k.label} style={{ borderRadius:18, padding:"16px 14px",
            background:k.grad, textAlign:"center",
            boxShadow:"0 4px 20px rgba(0,0,0,0.12)" }}>
            <div style={{ fontSize:22, marginBottom:4 }}>{k.icon}</div>
            <div style={{ fontSize:20, fontWeight:800, color:"#fff",
              fontFamily:"'SF Mono','JetBrains Mono',monospace",
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {k.val ?? "—"}
            </div>
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.8)",
              fontWeight:600, letterSpacing:"0.06em", marginTop:2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* ── Charts row 1 ── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
        <ChartCard title="RESOURCE UTILISATION" accent={T.primary}>
          <ResponsiveContainer width="100%" height={200}>
            <RadialBarChart cx="50%" cy="55%" innerRadius="28%" outerRadius="95%"
              data={radials} startAngle={180} endAngle={0}>
              <RadialBar minAngle={5} background={{ fill:"rgba(0,0,0,0.04)" }}
                dataKey="value" cornerRadius={8} />
              <Tooltip content={<CustomTip unit="%" />} />
              <Legend iconSize={10} wrapperStyle={{ fontSize:11, color:T.textMid }} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div style={{ display:"flex", justifyContent:"center", gap:20, marginTop:4 }}>
            {radials.map(r => (
              <div key={r.name} style={{ textAlign:"center" }}>
                <div style={{ fontSize:20, fontWeight:800, color:r.fill,
                  fontFamily:"'SF Mono','JetBrains Mono',monospace" }}>{r.value}%</div>
                <div style={{ fontSize:9, color:T.textDim, fontWeight:600,
                  letterSpacing:"0.07em" }}>{r.name}</div>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="VM STATE BREAKDOWN" accent={T.accent}>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={vmStates} cx="50%" cy="50%" innerRadius={50} outerRadius={85}
                paddingAngle={4} dataKey="value">
                {vmStates.map((e,i) => <Cell key={i} fill={e.fill} />)}
              </Pie>
              <Tooltip content={<CustomTip />} />
              <Legend iconSize={10} wrapperStyle={{ fontSize:11, color:T.textMid }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display:"flex", justifyContent:"center", gap:20, marginTop:4 }}>
            {vmStates.map(s => (
              <div key={s.name} style={{ textAlign:"center" }}>
                <div style={{ fontSize:20, fontWeight:800, color:s.fill,
                  fontFamily:"'SF Mono','JetBrains Mono',monospace" }}>{s.value}</div>
                <div style={{ fontSize:9, color:T.textDim, fontWeight:600,
                  letterSpacing:"0.07em" }}>{s.name}</div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* ── Host CPU/Mem bars ── */}
      {hostBars.length > 0 && (
        <ChartCard title={`HOST CPU & MEMORY — ${activeDC.label.toUpperCase()}`}
          accent={T.teal} style={{ marginBottom:16 }}>
          <ResponsiveContainer width="100%" height={Math.max(180, hostBars.length * 22)}>
            <BarChart data={hostBars} barCategoryGap="35%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
              <XAxis dataKey="name" tick={{ fill:T.textDim, fontSize:10 }}
                axisLine={false} tickLine={false} />
              <YAxis domain={[0,100]} tick={{ fill:T.textDim, fontSize:10 }}
                axisLine={false} tickLine={false} unit="%" />
              <Tooltip content={<CustomTip unit="%" />}
                cursor={{ fill:"rgba(255,55,95,0.04)" }} />
              <Legend iconSize={10} wrapperStyle={{ fontSize:11, color:T.textMid }} />
              <Bar dataKey="CPU"    fill={T.primary} radius={[6,6,0,0]} />
              <Bar dataKey="Memory" fill={T.accent}  radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* ── Storage bars ── */}
      {storBars.length > 0 && (
        <ChartCard title="STORAGE: USED vs FREE (GB)" accent={T.amber} style={{ marginBottom:16 }}>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={storBars} layout="vertical" barCategoryGap="35%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" horizontal={false} />
              <XAxis type="number" tick={{ fill:T.textDim, fontSize:10 }}
                axisLine={false} tickLine={false} unit=" GB" />
              <YAxis dataKey="name" type="category" tick={{ fill:T.textDim, fontSize:10 }}
                axisLine={false} tickLine={false} width={80} />
              <Tooltip content={<CustomTip unit=" GB" />}
                cursor={{ fill:"rgba(255,159,10,0.06)" }} />
              <Legend iconSize={10} wrapperStyle={{ fontSize:11, color:T.textMid }} />
              <Bar dataKey="Used" fill={T.amber} radius={[0,6,6,0]} stackId="a" />
              <Bar dataKey="Free" fill={T.green} radius={[0,6,6,0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* ── Summary gauges ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",
        gap:12 }}>
        {[
          { label:"Memory Utilisation",  pct:S.mem_pct,     used:S.mem_used_gb,
            total:S.mem_total_gb,  unit:"GB", color:T.accent  },
          { label:"Storage Utilisation", pct:S.stor_pct,    used:S.stor_used_gb,
            total:S.stor_total_gb, unit:"GB", color:T.amber   },
          { label:"Avg CPU Load",        pct:S.avg_cpu_pct, used:S.avg_cpu_pct,
            total:100,             unit:"%",  color:T.primary },
        ].map(g => (
          <Card key={g.label} accent={g.color}>
            <SectionHead title={g.label} color={g.color} />
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
              <span style={{ fontSize:12, color:T.textMid }}>{g.used ?? "—"} {g.unit} used</span>
              <span style={{ fontSize:16, fontWeight:800, color:g.color,
                fontFamily:"'SF Mono','JetBrains Mono',monospace" }}>{g.pct ?? "—"}%</span>
            </div>
            <GaugeBar pct={g.pct ?? 0} color={g.color} height={8} />
          </Card>
        ))}
      </div>
    </div>
  );
}

function ChartCard({ title, accent, children, style }) {
  return (
    <div style={{ background:"rgba(255,255,255,0.85)", backdropFilter:"blur(12px)",
      border:`1.5px solid ${T.border}`, borderRadius:20,
      borderTop:`3px solid ${accent}`,
      boxShadow:"0 4px 24px rgba(255,55,95,0.08)",
      padding:"18px 18px 14px", ...style }}>
      <div style={{ fontSize:9, fontWeight:800, letterSpacing:"0.12em",
        color:accent, marginBottom:14, paddingBottom:6,
        borderBottom:`1.5px solid ${accent}20` }}>{title}</div>
      {children}
    </div>
  );
}

function CustomTip({ active, payload, label, unit="" }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"rgba(255,255,255,0.95)", backdropFilter:"blur(10px)",
      border:`1.5px solid ${T.border}`, borderRadius:12,
      padding:"10px 14px", fontSize:12, color:T.text,
      boxShadow:"0 4px 20px rgba(255,55,95,0.15)" }}>
      {label && <div style={{ color:T.textDim, marginBottom:4, fontSize:11 }}>{label}</div>}
      {payload.map((p,i) => (
        <div key={i} style={{ color:p.fill||p.color||T.primary, fontWeight:600 }}>
          {p.name}: {p.value}{unit}
        </div>
      ))}
    </div>
  );
}
