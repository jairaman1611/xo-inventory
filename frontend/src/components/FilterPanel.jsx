import { useState, useMemo } from "react";
import { T, STATUS, STATUS_SOFT } from "../theme";

/* ─────────────────────────────────────────────────────────────────────────────
   FilterPanel — structured VM filtering
   Props:
     vms        – full VM list (for deriving available options)
     filters    – current filter state object
     onChange   – callback(newFilters)
     onClose    – close panel
───────────────────────────────────────────────────────────────────────────── */

const MATCH_MODES = [
  { value:"contains",   label:"contains"    },
  { value:"starts",     label:"starts with" },
  { value:"ends",       label:"ends with"   },
  { value:"exact",      label:"exact match" },
];

const OS_GROUPS = [
  { label:"Windows",  match: v => /windows/i.test(v) },
  { label:"Linux",    match: v => /linux|ubuntu|debian|centos|rhel|fedora|suse|arch/i.test(v) },
  { label:"FreeBSD",  match: v => /freebsd/i.test(v) },
  { label:"Other",    match: v => v && !/windows|linux|ubuntu|debian|centos|rhel|fedora|suse|arch|freebsd/i.test(v) },
];

export const EMPTY_FILTERS = {
  name:       { mode:"contains", value:"" },
  os:         { mode:"contains", value:"", group:"" },
  ip:         { mode:"contains", value:"" },
  vlan:       [],          // array of selected vlan names
  powerState: [],          // array of selected states
};

export function FilterPanel({ vms, filters, onChange, onClose }) {
  const f = filters;

  /* derive available VLANs from VM list */
  const allVlans = useMemo(() => {
    const s = new Set();
    vms.forEach(v => (v.vlans || []).forEach(vl => vl && s.add(vl)));
    return [...s].sort();
  }, [vms]);

  /* derive available OS strings */
  const allOS = useMemo(() => {
    const s = new Set();
    vms.forEach(v => v.os && s.add(v.os));
    return [...s].sort();
  }, [vms]);

  const set = (key, val) => onChange({ ...f, [key]: val });
  const setField = (key, field, val) => onChange({ ...f, [key]: { ...f[key], [field]: val } });

  const activeCount = countActive(f);

  return (
    <div style={{
      background:"rgba(255,255,255,0.97)", backdropFilter:"blur(20px)",
      border:`1.5px solid ${T.border}`, borderRadius:20,
      boxShadow:`0 8px 40px rgba(255,55,95,0.14)`,
      padding:"20px 22px", marginBottom:14,
      animation:"slideIn 0.2s cubic-bezier(.34,1.2,.64,1)",
    }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
        marginBottom:18 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:16 }}>🎛</span>
          <span style={{ fontWeight:800, fontSize:14, color:T.text }}>Advanced Filters</span>
          {activeCount > 0 && (
            <span style={{ padding:"2px 8px", borderRadius:20, fontSize:11, fontWeight:700,
              background:T.gradPrimary, color:"#fff" }}>{activeCount} active</span>
          )}
        </div>
        <div style={{ display:"flex", gap:8 }}>
          {activeCount > 0 && (
            <button onClick={() => onChange(EMPTY_FILTERS)} style={ghostBtn()}>
              Clear all
            </button>
          )}
          <button onClick={onClose} style={ghostBtn()}>✕ Close</button>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",
        gap:18 }}>

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
          {/* quick OS group pills */}
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
            modes={["contains","starts","ends","exact"]}
          />
        </Section>

        {/* ── Power State ── */}
        <Section title="Power State" icon="⚡" color={T.green}>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {["Running","Halted","Paused","Suspended"].map(s => {
              const active = f.powerState.includes(s);
              const color  = STATUS[s] ?? T.textDim;
              const soft   = STATUS_SOFT[s] ?? "#f5f5f5";
              return (
                <button key={s} onClick={() =>
                  set("powerState", active
                    ? f.powerState.filter(x => x !== s)
                    : [...f.powerState, s])} style={{
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

        {/* ── VLAN / Network ── */}
        <Section title="Network / VLAN" icon="🔗" color={T.amber}
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
                  const active = f.vlan.includes(vl);
                  return (
                    <button key={vl} onClick={() =>
                      set("vlan", active
                        ? f.vlan.filter(x => x !== vl)
                        : [...f.vlan, vl])} style={{
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
              {f.vlan.length > 0 && (
                <button onClick={() => set("vlan",[])} style={{
                  marginTop:6, fontSize:11, color:T.textDim, background:"transparent",
                  border:"none", cursor:"pointer", textDecoration:"underline" }}>
                  Clear selection
                </button>
              )}
            </>
          )}
        </Section>
      </div>

      {/* Active filter summary */}
      {activeCount > 0 && (
        <div style={{ marginTop:16, paddingTop:14, borderTop:`1px solid ${T.border}`,
          display:"flex", flexWrap:"wrap", gap:6, alignItems:"center" }}>
          <span style={{ fontSize:11, color:T.textDim, fontWeight:600 }}>Active:</span>
          {f.name.value && <ActiveChip label={`Name ${f.name.mode} "${f.name.value}"`}
            color={T.primary} onRemove={() => setField("name","value","")} />}
          {f.os.group   && <ActiveChip label={`OS: ${f.os.group}`}
            color={T.accent} onRemove={() => setField("os","group","")} />}
          {f.os.value   && <ActiveChip label={`OS ${f.os.mode} "${f.os.value}"`}
            color={T.accent} onRemove={() => setField("os","value","")} />}
          {f.ip.value   && <ActiveChip label={`IP ${f.ip.mode} "${f.ip.value}"`}
            color={T.teal} onRemove={() => setField("ip","value","")} />}
          {f.powerState.map(s => <ActiveChip key={s} label={s}
            color={STATUS[s]} onRemove={() => set("powerState", f.powerState.filter(x=>x!==s))} />)}
          {f.vlan.map(v => <ActiveChip key={v} label={v}
            color={T.amber} onRemove={() => set("vlan", f.vlan.filter(x=>x!==v))} />)}
        </div>
      )}
    </div>
  );
}

/* ── apply filters to a VM list ──────────────────────────────────────────── */
export function applyFilters(vms, filters, search, hostMap) {
  const { name, os, ip, vlan, powerState } = filters;
  const q = search.toLowerCase().trim();

  return vms.filter(vm => {

    /* global search */
    if (q) {
      const host = hostMap?.[vm.host_ref]?.name ?? "";
      const hit  = [vm.name, vm.os, host,
                    ...(vm.ips||[]), ...(vm.vlans||[]), ...(vm.tags||[])]
                   .some(f => f?.toLowerCase().includes(q));
      if (!hit) return false;
    }

    /* name filter */
    if (name.value) {
      if (!matchStr(vm.name ?? "", name.mode, name.value)) return false;
    }

    /* OS group */
    if (os.group) {
      const grp = OS_GROUPS.find(g => g.label === os.group);
      if (grp && !grp.match(vm.os ?? "")) return false;
    }
    /* OS text */
    if (os.value) {
      if (!matchStr(vm.os ?? "", os.mode, os.value)) return false;
    }

    /* IP filter */
    if (ip.value) {
      const ipv4s = (vm.ips || []).filter(a => !a.includes(":"));
      const hit   = ipv4s.some(addr => matchStr(addr, ip.mode, ip.value));
      if (!hit) return false;
    }

    /* power state */
    if (powerState.length > 0 && !powerState.includes(vm.power_state)) return false;

    /* VLAN — match if any selected VLAN appears in vm.vlans */
    if (vlan.length > 0) {
      const hit = (vm.vlans || []).some(v => vlan.includes(v));
      if (!hit) return false;
    }

    return true;
  });
}

export function countActive(f) {
  return [
    f.name.value   ? 1 : 0,
    f.os.group     ? 1 : 0,
    f.os.value     ? 1 : 0,
    f.ip.value     ? 1 : 0,
    f.powerState.length,
    f.vlan.length,
  ].reduce((a, b) => a + b, 0);
}

/* ── helpers ─────────────────────────────────────────────────────────────── */
function matchStr(str, mode, val) {
  const s = str.toLowerCase();
  const v = val.toLowerCase();
  switch (mode) {
    case "starts":   return s.startsWith(v);
    case "ends":     return s.endsWith(v);
    case "exact":    return s === v;
    case "contains":
    default:         return s.includes(v);
  }
}

function Section({ title, icon, color, children, style }) {
  return (
    <div style={{ background:`${color}08`, borderRadius:14, padding:"14px 16px",
      border:`1.5px solid ${color}20`, ...style }}>
      <div style={{ fontSize:10, fontWeight:800, letterSpacing:"0.1em",
        color, marginBottom:10, display:"flex", alignItems:"center", gap:5 }}>
        <span>{icon}</span> {title}
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
        color, cursor:"pointer", fontSize:12, padding:0, lineHeight:1,
        opacity:0.7 }}>✕</button>
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
