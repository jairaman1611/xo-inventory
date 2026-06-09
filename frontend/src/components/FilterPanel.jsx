import { useState, useMemo } from "react";
import { T, STATUS, STATUS_SOFT } from "../theme";

/* ─────────────────────────────────────────────────────────────────────────────
   FilterPanel — structured VM filtering with AND / OR logic per section
   and between sections.

   Filter state shape:
   {
     logic:      "AND" | "OR"        ← top-level between-section operator
     name:       { mode, value }
     os:         { mode, value, group }
     ip:         { mode, value }
     vlan:       { logic: "AND"|"OR", values: string[] }
     powerState: { logic: "AND"|"OR", values: string[] }
     tags:       { logic: "AND"|"OR", values: string[] }
   }
───────────────────────────────────────────────────────────────────────────── */

const MATCH_MODES = [
  { value:"contains",   label:"contains"    },
  { value:"starts",     label:"starts with" },
  { value:"ends",       label:"ends with"   },
  { value:"exact",      label:"exact match" },
];

const OS_GROUPS = [
  { label:"Windows",  match: v => /windows/i.test(v) },
  { label:"Linux",    match: v => /linux|ubuntu|debian|centos|rhel|oracle|fedora|suse|arch/i.test(v) },
  { label:"FreeBSD",  match: v => /freebsd/i.test(v) },
  { label:"Other",    match: v => v && !/windows|linux|ubuntu|debian|centos|rhel|oracle|fedora|suse|arch|freebsd/i.test(v) },
];

export const EMPTY_FILTERS = {
  logic:      "AND",
  name:       { mode:"contains", value:"" },
  os:         { mode:"contains", value:"", group:"" },
  ip:         { mode:"contains", value:"" },
  vlan:       { logic:"OR",  values:[] },
  powerState: { logic:"OR",  values:[] },
  tags:       { logic:"AND", values:[] },
};

/* ── Main panel ─────────────────────────────────────────────────────────── */
export function FilterPanel({ vms, filters, onChange, onClose }) {
  const f = filters;

  const allVlans = useMemo(() => {
    const s = new Set();
    vms.forEach(v => (v.vlans || []).forEach(vl => vl && s.add(vl)));
    return [...s].sort();
  }, [vms]);

  const allTags = useMemo(() => {
    const s = new Set();
    vms.forEach(v => (v.tags || []).forEach(t => t && s.add(t)));
    return [...s].sort();
  }, [vms]);

  const set       = (key, val)        => onChange({ ...f, [key]: val });
  const setField  = (key, fld, val)   => onChange({ ...f, [key]: { ...f[key], [fld]: val } });
  const setMulti  = (key, fld, val)   => onChange({ ...f, [key]: { ...f[key], [fld]: val } });

  const activeCount = countActive(f);

  return (
    <div style={{
      background:"rgba(255,255,255,0.97)", backdropFilter:"blur(20px)",
      border:`1.5px solid ${T.border}`, borderRadius:20,
      boxShadow:`0 8px 40px rgba(255,55,95,0.14)`,
      padding:"20px 22px", marginBottom:14,
      animation:"slideIn 0.2s cubic-bezier(.34,1.2,.64,1)",
    }}>

      {/* Header row */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
        marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:16 }}>🎛</span>
          <span style={{ fontWeight:800, fontSize:14, color:T.text }}>Advanced Filters</span>
          {activeCount > 0 && (
            <span style={{ padding:"2px 8px", borderRadius:20, fontSize:11, fontWeight:700,
              background:T.gradPrimary, color:"#fff" }}>{activeCount} active</span>
          )}
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {/* Global AND / OR toggle */}
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ fontSize:11, color:T.textDim, fontWeight:600 }}>Sections:</span>
            <LogicToggle value={f.logic} onChange={v => set("logic", v)} />
          </div>
          {activeCount > 0 && (
            <button onClick={() => onChange(EMPTY_FILTERS)} style={ghostBtn()}>Clear all</button>
          )}
          <button onClick={onClose} style={ghostBtn()}>✕ Close</button>
        </div>
      </div>

      {/* Helper text */}
      <div style={{ marginBottom:14, fontSize:11, color:T.textDim, lineHeight:1.6 }}>
        <strong style={{ color:T.primary }}>AND</strong> = VM must match <em>all</em> active sections &nbsp;·&nbsp;
        <strong style={{ color:T.accent }}>OR</strong> = VM must match <em>any</em> active section
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:18 }}>

        {/* ── VM Name ── */}
        <Section title="VM Name" icon="🖥" color={T.primary}>
          <ModeValueField
            mode={f.name.mode} value={f.name.value}
            onMode={v => setField("name","mode",v)}
            onValue={v => setField("name","value",v)}
            placeholder="e.g. sv1-job"
          />
        </Section>

        {/* ── OS ── */}
        <Section title="Operating System" icon="💿" color={T.accent}>
          <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:10 }}>
            {OS_GROUPS.map(g => {
              const active = f.os.group === g.label;
              return (
                <button key={g.label} onClick={() =>
                  setField("os","group", active ? "" : g.label)} style={{
                  padding:"4px 11px", borderRadius:50, fontSize:11, fontWeight:700,
                  cursor:"pointer", border:`1.5px solid ${active ? T.accent : T.border}`,
                  background: active ? T.accentSoft : "transparent",
                  color: active ? T.accent : T.textDim, transition:"all 0.15s",
                }}>
                  {g.label}
                </button>
              );
            })}
          </div>
          <ModeValueField
            mode={f.os.mode} value={f.os.value}
            onMode={v => setField("os","mode",v)}
            onValue={v => setField("os","value",v)}
            placeholder="e.g. Windows Server 2022"
          />
        </Section>

        {/* ── IP Address ── */}
        <Section title="IP Address" icon="🌐" color={T.teal}>
          <ModeValueField
            mode={f.ip.mode} value={f.ip.value}
            onMode={v => setField("ip","mode",v)}
            onValue={v => setField("ip","value",v)}
            placeholder="e.g. 10.10.50"
          />
        </Section>

        {/* ── Power State (with AND/OR) ── */}
        <Section title="Power State" icon="⚡" color={T.green}
          logic={f.powerState.logic}
          onLogic={v => setMulti("powerState","logic",v)}>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {["Running","Halted","Paused","Suspended"].map(s => {
              const active = f.powerState.values.includes(s);
              const color  = STATUS[s] ?? T.textDim;
              const soft   = STATUS_SOFT[s] ?? "#f5f5f5";
              return (
                <button key={s} onClick={() =>
                  setMulti("powerState","values", active
                    ? f.powerState.values.filter(x => x !== s)
                    : [...f.powerState.values, s])} style={{
                  padding:"5px 12px", borderRadius:50, fontSize:11, fontWeight:700,
                  cursor:"pointer", transition:"all 0.15s",
                  border:`1.5px solid ${active ? color : T.border}`,
                  background: active ? soft : "transparent",
                  color: active ? color : T.textDim,
                  boxShadow: active ? `0 2px 6px ${color}30` : "none",
                  display:"flex", alignItems:"center", gap:5,
                }}>
                  {active && <span style={{ width:5, height:5, borderRadius:"50%",
                    background:color, display:"inline-block" }} />}
                  {s}
                </button>
              );
            })}
          </div>
        </Section>

        {/* ── VLAN / Network (with AND/OR) ── */}
        <Section title="Network / VLAN" icon="🔗" color={T.amber}
          logic={f.vlan.logic}
          onLogic={v => setMulti("vlan","logic",v)}
          style={{ gridColumn: allVlans.length > 6 ? "span 2" : undefined }}>
          {allVlans.length === 0 ? (
            <div style={{ fontSize:12, color:T.textDim, fontStyle:"italic" }}>
              No VLANs detected (VMs may be offline)
            </div>
          ) : (
            <>
              <div style={{ display:"flex", flexWrap:"wrap", gap:5, maxHeight:120,
                overflowY:"auto", paddingRight:4 }}>
                {allVlans.map(vl => {
                  const active = f.vlan.values.includes(vl);
                  return (
                    <button key={vl} onClick={() =>
                      setMulti("vlan","values", active
                        ? f.vlan.values.filter(x => x !== vl)
                        : [...f.vlan.values, vl])} style={{
                      padding:"4px 10px", borderRadius:50, fontSize:11, fontWeight:600,
                      cursor:"pointer", transition:"all 0.15s",
                      border:`1.5px solid ${active ? T.amber : T.border}`,
                      background: active ? T.amberSoft : "transparent",
                      color: active ? T.amber : T.textDim,
                      boxShadow: active ? `0 2px 6px ${T.amber}30` : "none",
                      whiteSpace:"nowrap",
                    }}>
                      {active && "✓ "}{vl}
                    </button>
                  );
                })}
              </div>
              {f.vlan.values.length > 0 && (
                <button onClick={() => setMulti("vlan","values",[])} style={{
                  marginTop:6, fontSize:11, color:T.textDim, background:"transparent",
                  border:"none", cursor:"pointer", textDecoration:"underline" }}>
                  Clear selection
                </button>
              )}
            </>
          )}
        </Section>

        {/* ── Tags (with AND/OR) ── */}
        {allTags.length > 0 && (
          <Section title="Tags" icon="🏷" color={T.purple}
            logic={f.tags.logic}
            onLogic={v => setMulti("tags","logic",v)}>
            <div style={{ display:"flex", flexWrap:"wrap", gap:5, maxHeight:100, overflowY:"auto" }}>
              {allTags.map(tag => {
                const active = f.tags.values.includes(tag);
                return (
                  <button key={tag} onClick={() =>
                    setMulti("tags","values", active
                      ? f.tags.values.filter(x => x !== tag)
                      : [...f.tags.values, tag])} style={{
                    padding:"4px 10px", borderRadius:50, fontSize:11, fontWeight:600,
                    cursor:"pointer", transition:"all 0.15s",
                    border:`1.5px solid ${active ? T.purple : T.border}`,
                    background: active ? `${T.purple}15` : "transparent",
                    color: active ? T.purple : T.textDim,
                    whiteSpace:"nowrap",
                  }}>
                    {active && "✓ "}{tag}
                  </button>
                );
              })}
            </div>
            {f.tags.values.length > 0 && (
              <button onClick={() => setMulti("tags","values",[])} style={{
                marginTop:6, fontSize:11, color:T.textDim, background:"transparent",
                border:"none", cursor:"pointer", textDecoration:"underline" }}>
                Clear selection
              </button>
            )}
          </Section>
        )}

      </div>

      {/* Active filter summary chips */}
      {activeCount > 0 && (
        <div style={{ marginTop:16, paddingTop:14, borderTop:`1px solid ${T.border}`,
          display:"flex", flexWrap:"wrap", gap:6, alignItems:"center" }}>
          <span style={{ fontSize:11, color:T.textDim, fontWeight:600 }}>Active:</span>

          {/* Show global logic badge if more than 1 section active */}
          {countActiveSections(f) > 1 && (
            <span style={{ padding:"2px 8px", borderRadius:20, fontSize:10, fontWeight:800,
              background: f.logic === "AND" ? `${T.primary}18` : `${T.accent}18`,
              color: f.logic === "AND" ? T.primary : T.accent,
              border:`1.5px solid ${f.logic === "AND" ? T.primary : T.accent}35` }}>
              {f.logic}
            </span>
          )}

          {f.name.value && <ActiveChip label={`Name ${f.name.mode} "${f.name.value}"`}
            color={T.primary} onRemove={() => setField("name","value","")} />}
          {f.os.group   && <ActiveChip label={`OS: ${f.os.group}`}
            color={T.accent} onRemove={() => setField("os","group","")} />}
          {f.os.value   && <ActiveChip label={`OS ${f.os.mode} "${f.os.value}"`}
            color={T.accent} onRemove={() => setField("os","value","")} />}
          {f.ip.value   && <ActiveChip label={`IP ${f.ip.mode} "${f.ip.value}"`}
            color={T.teal} onRemove={() => setField("ip","value","")} />}

          {f.powerState.values.length > 0 && (
            <>
              {f.powerState.values.length > 1 && (
                <span style={{ fontSize:10, fontWeight:700, color:T.textDim }}>
                  State ({f.powerState.logic}):
                </span>
              )}
              {f.powerState.values.map(s => (
                <ActiveChip key={s} label={s} color={STATUS[s]}
                  onRemove={() => setMulti("powerState","values", f.powerState.values.filter(x=>x!==s))} />
              ))}
            </>
          )}

          {f.vlan.values.length > 0 && (
            <>
              {f.vlan.values.length > 1 && (
                <span style={{ fontSize:10, fontWeight:700, color:T.textDim }}>
                  VLAN ({f.vlan.logic}):
                </span>
              )}
              {f.vlan.values.map(v => (
                <ActiveChip key={v} label={v} color={T.amber}
                  onRemove={() => setMulti("vlan","values", f.vlan.values.filter(x=>x!==v))} />
              ))}
            </>
          )}

          {f.tags.values.length > 0 && (
            <>
              {f.tags.values.length > 1 && (
                <span style={{ fontSize:10, fontWeight:700, color:T.textDim }}>
                  Tags ({f.tags.logic}):
                </span>
              )}
              {f.tags.values.map(t => (
                <ActiveChip key={t} label={t} color={T.purple}
                  onRemove={() => setMulti("tags","values", f.tags.values.filter(x=>x!==t))} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ── applyFilters ─────────────────────────────────────────────────────────── */
export function applyFilters(vms, filters, search, hostMap) {
  const { logic, name, os, ip, vlan, powerState, tags } = filters;
  const q = search.toLowerCase().trim();

  return vms.filter(vm => {

    /* global quick-search (always AND with structured filters) */
    if (q) {
      const host = hostMap?.[vm.host_ref]?.name ?? "";
      const hit  = [vm.name, vm.os, host,
                    ...(vm.ips||[]), ...(vm.vlans||[]), ...(vm.tags||[])]
                   .some(f => f?.toLowerCase().includes(q));
      if (!hit) return false;
    }

    /* build list of active section results */
    const results = [];

    /* name */
    if (name.value) {
      results.push(matchStr(vm.name ?? "", name.mode, name.value));
    }

    /* OS group */
    if (os.group) {
      const grp = OS_GROUPS.find(g => g.label === os.group);
      results.push(!grp || grp.match(vm.os ?? ""));
    }
    /* OS text */
    if (os.value) {
      results.push(matchStr(vm.os ?? "", os.mode, os.value));
    }

    /* IP */
    if (ip.value) {
      const ipv4s = (vm.ips || []).filter(a => !a.includes(":"));
      results.push(ipv4s.some(addr => matchStr(addr, ip.mode, ip.value)));
    }

    /* power state — internal logic among selected states */
    if (powerState.values.length > 0) {
      if (powerState.logic === "AND") {
        // AND between states is only meaningful if you want "all these states" which
        // can't be true simultaneously — so treat as OR for power state
        results.push(powerState.values.includes(vm.power_state));
      } else {
        results.push(powerState.values.includes(vm.power_state));
      }
    }

    /* VLAN — internal logic among selected VLANs */
    if (vlan.values.length > 0) {
      const vmVlans = vm.vlans || [];
      if (vlan.logic === "AND") {
        // VM must be on ALL selected VLANs
        results.push(vlan.values.every(v => vmVlans.includes(v)));
      } else {
        // VM must be on ANY selected VLAN
        results.push(vlan.values.some(v => vmVlans.includes(v)));
      }
    }

    /* Tags — internal logic among selected tags */
    if (tags.values.length > 0) {
      const vmTags = vm.tags || [];
      if (tags.logic === "AND") {
        results.push(tags.values.every(t => vmTags.includes(t)));
      } else {
        results.push(tags.values.some(t => vmTags.includes(t)));
      }
    }

    /* Apply top-level AND / OR across all section results */
    if (results.length === 0) return true;
    return logic === "OR"
      ? results.some(Boolean)
      : results.every(Boolean);
  });
}

export function countActive(f) {
  return [
    f.name.value        ? 1 : 0,
    f.os.group          ? 1 : 0,
    f.os.value          ? 1 : 0,
    f.ip.value          ? 1 : 0,
    f.powerState.values.length,
    f.vlan.values.length,
    f.tags.values.length,
  ].reduce((a, b) => a + b, 0);
}

function countActiveSections(f) {
  return [
    (f.name.value)                  ? 1 : 0,
    (f.os.group || f.os.value)      ? 1 : 0,
    (f.ip.value)                    ? 1 : 0,
    (f.powerState.values.length)    ? 1 : 0,
    (f.vlan.values.length)          ? 1 : 0,
    (f.tags.values.length)          ? 1 : 0,
  ].reduce((a, b) => a + b, 0);
}

/* ── helpers ─────────────────────────────────────────────────────────────── */
function matchStr(str, mode, val) {
  const s = str.toLowerCase();
  const v = val.toLowerCase();
  switch (mode) {
    case "starts":  return s.startsWith(v);
    case "ends":    return s.endsWith(v);
    case "exact":   return s === v;
    default:        return s.includes(v);
  }
}

/* ── AND / OR toggle pill ─────────────────────────────────────────────────── */
function LogicToggle({ value, onChange }) {
  return (
    <div style={{ display:"flex", borderRadius:8, overflow:"hidden",
      border:`1.5px solid ${T.border}`, fontSize:11, fontWeight:800 }}>
      {["AND","OR"].map(opt => {
        const active = value === opt;
        const color  = opt === "AND" ? T.primary : T.accent;
        return (
          <button key={opt} onClick={() => onChange(opt)} style={{
            padding:"3px 10px", border:"none", cursor:"pointer",
            background: active ? color : "transparent",
            color: active ? "#fff" : T.textDim,
            transition:"all 0.15s",
          }}>{opt}</button>
        );
      })}
    </div>
  );
}

/* ── Section wrapper ─────────────────────────────────────────────────────── */
function Section({ title, icon, color, children, style, logic, onLogic }) {
  return (
    <div style={{ background:`${color}08`, borderRadius:14, padding:"14px 16px",
      border:`1.5px solid ${color}20`, ...style }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
        marginBottom:10 }}>
        <div style={{ fontSize:10, fontWeight:800, letterSpacing:"0.1em",
          color, display:"flex", alignItems:"center", gap:5 }}>
          <span>{icon}</span> {title}
        </div>
        {onLogic && (
          <LogicToggle value={logic} onChange={onLogic} />
        )}
      </div>
      {children}
    </div>
  );
}

function ModeValueField({ mode, value, onMode, onValue, placeholder, modes }) {
  const list = modes
    ? MATCH_MODES.filter(m => modes.includes(m.value))
    : MATCH_MODES;
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      <select value={mode} onChange={e => onMode(e.target.value)} style={{
        background:"rgba(255,255,255,0.9)", border:`1.5px solid ${T.border}`,
        borderRadius:10, padding:"6px 10px", fontSize:12, color:T.textMid,
        outline:"none", fontFamily:"inherit", cursor:"pointer" }}>
        {list.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
      </select>
      <input value={value} onChange={e => onValue(e.target.value)}
        placeholder={placeholder}
        style={{ background:"rgba(255,255,255,0.9)", border:`1.5px solid ${T.border}`,
          borderRadius:10, padding:"7px 11px", fontSize:12, color:T.text,
          outline:"none", boxSizing:"border-box", width:"100%",
          transition:"border-color 0.15s", fontFamily:"inherit" }}
        onFocus={e => e.target.style.borderColor = T.primary}
        onBlur={e  => e.target.style.borderColor = T.border}
      />
    </div>
  );
}

function ActiveChip({ label, color, onRemove }) {
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5,
      padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:600,
      background:`${color}18`, color, border:`1.5px solid ${color}35` }}>
      {label}
      <button onClick={onRemove} style={{ background:"none", border:"none",
        color, cursor:"pointer", fontSize:12, padding:0, lineHeight:1, opacity:0.7 }}>✕</button>
    </span>
  );
}

function ghostBtn() {
  return {
    padding:"5px 12px", borderRadius:50, fontSize:11, fontWeight:600,
    cursor:"pointer", border:`1.5px solid ${T.border}`,
    background:"transparent", color:T.textDim, transition:"all 0.12s",
  };
}
