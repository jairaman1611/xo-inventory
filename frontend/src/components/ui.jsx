import { T, STATUS, STATUS_SOFT } from "../theme";

/* ── Pulsing status dot ───────────────────────────────────────────────────── */
export function Dot({ color, pulse }) {
  return (
    <span style={{ position:"relative", display:"inline-flex", width:9, height:9,
      alignItems:"center", justifyContent:"center", flexShrink:0 }}>
      {pulse && <span style={{ position:"absolute", width:9, height:9, borderRadius:"50%",
        background:color, opacity:0.35, animation:"ping 1.5s ease infinite" }} />}
      <span style={{ width:7, height:7, borderRadius:"50%", background:color, display:"block" }} />
    </span>
  );
}

/* ── iOS-style status badge ───────────────────────────────────────────────── */
export function StatusBadge({ state }) {
  const color = STATUS[state] ?? T.textDim;
  const soft  = STATUS_SOFT[state] ?? "#f5f5f5";
  return (
    <span style={{ padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700,
      background:soft, color, display:"inline-flex", alignItems:"center", gap:5,
      letterSpacing:"0.01em" }}>
      <span style={{ width:5, height:5, borderRadius:"50%", background:color,
        display:"inline-block", flexShrink:0 }} />
      {state}
    </span>
  );
}

/* ── Gradient gauge bar ───────────────────────────────────────────────────── */
export function GaugeBar({ pct, color, height = 6 }) {
  const c   = color || (pct > 85 ? T.red : pct > 65 ? T.amber : T.green);
  const end = pct > 85 ? "#FF3B30" : pct > 65 ? "#FFD60A" : "#34C759";
  return (
    <div style={{ background:"rgba(0,0,0,0.06)", borderRadius:99, height, overflow:"hidden" }}>
      <div style={{ width:`${Math.min(pct || 0, 100)}%`, height:"100%",
        background:`linear-gradient(90deg, ${c}, ${end})`,
        borderRadius:99, transition:"width 0.6s cubic-bezier(.34,1.3,.64,1)" }} />
    </div>
  );
}

/* ── Key-value row ────────────────────────────────────────────────────────── */
export function KV({ label, value, mono, accent }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline",
      gap:8, marginBottom:6 }}>
      <span style={{ fontSize:11, color:T.textDim, whiteSpace:"nowrap", flexShrink:0 }}>{label}</span>
      <span style={{ fontSize:12, color:accent || T.textMid, textAlign:"right",
        fontFamily:mono?"'SF Mono','JetBrains Mono',monospace":undefined,
        wordBreak:"break-all" }}>{value}</span>
    </div>
  );
}

/* ── Section heading ──────────────────────────────────────────────────────── */
export function SectionHead({ title, color }) {
  return (
    <div style={{ fontSize:9, fontWeight:800, letterSpacing:"0.12em",
      color:color || T.primary, fontFamily:"inherit",
      marginBottom:10, paddingBottom:5,
      borderBottom:`1.5px solid ${(color || T.primary)}25` }}>
      {title}
    </div>
  );
}

/* ── Tag chip ─────────────────────────────────────────────────────────────── */
export function Tag({ label }) {
  return (
    <span style={{ fontSize:10, padding:"2px 8px", borderRadius:20,
      background:T.accentSoft, color:T.accent,
      fontWeight:600, letterSpacing:"0.02em" }}>
      {label}
    </span>
  );
}

/* ── Text input ───────────────────────────────────────────────────────────── */
export function Input({ label, type = "text", value, onChange, placeholder }) {
  return (
    <label style={{ display:"block", marginBottom:14 }}>
      <div style={{ fontSize:11, fontWeight:600, color:T.textMid,
        letterSpacing:"0.06em", marginBottom:5 }}>{label}</div>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width:"100%", background:"rgba(255,255,255,0.9)",
          border:`1.5px solid ${T.border}`, borderRadius:12,
          padding:"10px 14px", color:T.text, fontSize:13, outline:"none",
          boxSizing:"border-box", fontFamily:"inherit",
          boxShadow:"0 1px 4px rgba(255,55,95,0.06)",
          transition:"border-color 0.15s, box-shadow 0.15s" }}
        onFocus={e => {
          e.target.style.borderColor = T.primary;
          e.target.style.boxShadow   = `0 0 0 3px ${T.primarySoft}`;
        }}
        onBlur={e => {
          e.target.style.borderColor = T.border;
          e.target.style.boxShadow   = "0 1px 4px rgba(255,55,95,0.06)";
        }}
      />
    </label>
  );
}

/* ── Pill button ──────────────────────────────────────────────────────────── */
export function Button({ children, onClick, disabled, variant = "primary", small }) {
  const styles = {
    primary: { background:T.gradPrimary, color:"#fff",     border:"none",
               boxShadow:`0 4px 14px rgba(255,55,95,0.35)` },
    accent:  { background:T.gradAccent,  color:"#fff",     border:"none",
               boxShadow:`0 4px 14px rgba(99,110,250,0.35)` },
    ghost:   { background:"rgba(255,255,255,0.8)", color:T.textMid,
               border:`1.5px solid ${T.border}`, boxShadow:"none" },
    danger:  { background:T.redSoft,     color:T.red,
               border:`1.5px solid ${T.red}40`, boxShadow:"none" },
  };
  const s = styles[variant] || styles.primary;
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: small ? undefined : "100%",
      padding: small ? "7px 16px" : "13px 20px",
      borderRadius:50, fontSize: small ? 12 : 14, fontWeight:700,
      cursor:disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      letterSpacing:"0.01em", transition:"transform 0.12s, opacity 0.12s",
      ...s
    }}
    onMouseEnter={e => !disabled && (e.currentTarget.style.transform = "scale(1.02)")}
    onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
    onMouseDown={e  => !disabled && (e.currentTarget.style.transform = "scale(0.97)")}
    onMouseUp={e    => !disabled && (e.currentTarget.style.transform = "scale(1.02)")}
    >
      {children}
    </button>
  );
}

/* ── Spinner ──────────────────────────────────────────────────────────────── */
export function Spinner({ size = 40 }) {
  return (
    <div style={{ width:size, height:size, margin:"0 auto",
      borderRadius:"50%", padding:3,
      background:`conic-gradient(${T.primary}, ${T.accent}, ${T.primary})`,
      animation:"spin 0.9s linear infinite" }}>
      <div style={{ width:"100%", height:"100%", borderRadius:"50%",
        background:T.surface }} />
    </div>
  );
}

/* ── Search bar ───────────────────────────────────────────────────────────── */
export function SearchBar({ value, onChange, placeholder }) {
  return (
    <div style={{ position:"relative", flex:"1 1 220px" }}>
      <span style={{ position:"absolute", left:12, top:"50%",
        transform:"translateY(-50%)", fontSize:14, pointerEvents:"none",
        color:T.textDim }}>🔍</span>
      <input value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder || "Search…"}
        style={{ width:"100%", background:"rgba(255,255,255,0.9)",
          border:`1.5px solid ${T.border}`, borderRadius:50,
          padding:"8px 14px 8px 34px", color:T.text, fontSize:12,
          outline:"none", boxSizing:"border-box",
          boxShadow:"0 1px 4px rgba(255,55,95,0.06)",
          transition:"border-color 0.15s, box-shadow 0.15s" }}
        onFocus={e => {
          e.target.style.borderColor = T.primary;
          e.target.style.boxShadow   = `0 0 0 3px ${T.primarySoft}`;
        }}
        onBlur={e => {
          e.target.style.borderColor = T.border;
          e.target.style.boxShadow   = "0 1px 4px rgba(255,55,95,0.06)";
        }}
      />
    </div>
  );
}

/* ── Card wrapper ─────────────────────────────────────────────────────────── */
export function Card({ children, style, accent }) {
  return (
    <div style={{
      background:T.gradCard,
      border:`1.5px solid ${accent ? accent + "30" : T.border}`,
      borderRadius:16,
      boxShadow:"0 2px 16px rgba(255,55,95,0.07)",
      padding:"18px 20px",
      ...(accent ? { borderTop:`3px solid ${accent}` } : {}),
      ...style
    }}>
      {children}
    </div>
  );
}
