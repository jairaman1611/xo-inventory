import { T } from "../theme";
import { GaugeBar, SectionHead, Card } from "../components/ui";
import {
  ResponsiveContainer, RadialBarChart, RadialBar, PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";

export function OverviewPage({ data }) {
  if (!data) return null;
  const { summary, hosts, storage } = data;

  const vmStates = [
    { name:"Running",  value:summary.running_vms, fill:T.green  },
    { name:"Halted",   value:summary.halted_vms,  fill:T.red    },
    { name:"Paused",   value:summary.paused_vms,  fill:T.amber  },
  ].filter(d => d.value > 0);

  const radials = [
    { name:"CPU",     value:summary.avg_cpu_pct  ?? 0, fill:T.primary },
    { name:"Memory",  value:summary.mem_pct      ?? 0, fill:T.accent  },
    { name:"Storage", value:summary.stor_pct     ?? 0, fill:T.amber   },
  ];

  const hostBars = hosts.slice(0,8).map(h => ({
    name:   h.name.split(".")[0],
    CPU:    h.cpu_usage_pct ?? 0,
    Memory: h.mem_pct ?? 0,
  }));

  const storBars = storage.slice(0,6).map(s => ({
    name:  s.name.length > 14 ? s.name.slice(0,14)+"…" : s.name,
    Used:  s.used_gb ?? 0,
    Free:  s.free_gb ?? 0,
  }));

  const kpis = [
    { icon:"🖥",  label:"Total VMs",    val:summary.total_vms,      grad:T.gradPrimary },
    { icon:"▶",   label:"Running",       val:summary.running_vms,    grad:T.gradGreen   },
    { icon:"🖧",  label:"Hosts",         val:summary.total_hosts,    grad:T.gradAccent  },
    { icon:"🌐",  label:"Networks",      val:summary.total_networks, grad:`linear-gradient(135deg,${T.teal},#32ADE6)` },
    { icon:"💾",  label:"Storage Repos", val:summary.total_srs,      grad:T.gradAmber   },
    { icon:"⚙",  label:"vCPUs (live)",  val:summary.total_vcpus,    grad:`linear-gradient(135deg,${T.purple},#9F7AEA)` },
  ];

  return (
    <div>
      {/* KPI pills */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))",
        gap:12, marginBottom:24 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ borderRadius:20, padding:"18px 16px",
            background:k.grad, textAlign:"center", position:"relative", overflow:"hidden",
            boxShadow:"0 4px 20px rgba(0,0,0,0.12)" }}>
            <div style={{ fontSize:26, marginBottom:4 }}>{k.icon}</div>
            <div style={{ fontSize:26, fontWeight:800, color:"#fff",
              fontFamily:"'SF Mono','JetBrains Mono',monospace" }}>{k.val ?? "—"}</div>
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.8)",
              fontWeight:600, letterSpacing:"0.07em", marginTop:2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Row 1 */}
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

      {/* Host bars */}
      {hostBars.length > 0 && (
        <ChartCard title="HOST CPU & MEMORY (%)" accent={T.teal} style={{ marginBottom:16 }}>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={hostBars} barCategoryGap="35%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
              <XAxis dataKey="name" tick={{ fill:T.textDim, fontSize:10 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0,100]} tick={{ fill:T.textDim, fontSize:10 }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip content={<CustomTip unit="%" />} cursor={{ fill:"rgba(255,55,95,0.04)" }} />
              <Legend iconSize={10} wrapperStyle={{ fontSize:11, color:T.textMid }} />
              <Bar dataKey="CPU"    fill={T.primary} radius={[6,6,0,0]} />
              <Bar dataKey="Memory" fill={T.accent}  radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Storage bars */}
      {storBars.length > 0 && (
        <ChartCard title="STORAGE: USED vs FREE (GB)" accent={T.amber} style={{ marginBottom:16 }}>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={storBars} layout="vertical" barCategoryGap="35%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" horizontal={false} />
              <XAxis type="number" tick={{ fill:T.textDim, fontSize:10 }} axisLine={false} tickLine={false} unit=" GB" />
              <YAxis dataKey="name" type="category" tick={{ fill:T.textDim, fontSize:10 }}
                axisLine={false} tickLine={false} width={80} />
              <Tooltip content={<CustomTip unit=" GB" />} cursor={{ fill:"rgba(255,159,10,0.06)" }} />
              <Legend iconSize={10} wrapperStyle={{ fontSize:11, color:T.textMid }} />
              <Bar dataKey="Used" fill={T.amber} radius={[0,6,6,0]} stackId="a" />
              <Bar dataKey="Free" fill={T.green} radius={[0,6,6,0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Summary gauges */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:12 }}>
        {[
          { label:"Memory Utilisation",  pct:summary.mem_pct,      used:summary.mem_used_gb,   total:summary.mem_total_gb,   unit:"GB",  color:T.accent  },
          { label:"Storage Utilisation", pct:summary.stor_pct,     used:summary.stor_used_gb,  total:summary.stor_total_gb,  unit:"GB",  color:T.amber   },
          { label:"Avg CPU Load",        pct:summary.avg_cpu_pct,  used:summary.avg_cpu_pct,   total:100,                    unit:"%",   color:T.primary },
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
      boxShadow:"0 4px 24px rgba(255,55,95,0.08)", padding:"18px 18px 14px", ...style }}>
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
