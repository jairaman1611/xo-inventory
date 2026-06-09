import { useState, useRef, useEffect } from "react";
import { T } from "../theme";
import { Input, Button } from "./ui";

const HOST_SUGGESTIONS = [
  "https://10.92.48.204",
];

export function ConnectFlow({ auth, onConnected }) {
  const [mode, setMode]     = useState("password");
  const [host, setHost]     = useState("https://");
  const [user, setUser]     = useState("");
  const [pass, setPass]     = useState("");
  const [token, setToken]   = useState("");
  const [otp, setOtp]       = useState("");
  const [ssl, setSsl]       = useState(false);

  const step = auth.status === "needs_otp" ? "otp" : "creds";

  async function submitCreds() {
    if (mode === "token") {
      const r = await auth.connectToken(host, token, ssl);
      if (r === "connected") onConnected();
    } else {
      await auth.connectPassword(host, user, pass, ssl);
    }
  }

  async function submitOtp() {
    const r = await auth.submitOtp(otp);
    if (r === "connected") onConnected();
  }

  return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex",
      alignItems:"center", justifyContent:"center", padding:24,
      backgroundImage:`radial-gradient(circle at 20% 20%, ${T.primarySoft} 0%, transparent 50%),
                       radial-gradient(circle at 80% 80%, ${T.accentSoft} 0%, transparent 50%)` }}>

      <div style={{ width:"100%", maxWidth:420 }}>
        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <img src="/logo.png" alt="Planview AdaptiveWork"
            style={{ height:52, width:"auto", objectFit:"contain", marginBottom:14 }} />
          <div style={{ fontSize:13, fontWeight:700, color:T.textMid,
            letterSpacing:"0.1em" }}>INVENTORY</div>
          <div style={{ fontSize:12, color:T.textDim, marginTop:6, fontWeight:500 }}>
            Global infrastructure dashboard
          </div>
        </div>

        {/* Card */}
        <div style={{ background:"rgba(255,255,255,0.85)", backdropFilter:"blur(20px)",
          borderRadius:28, border:`1.5px solid ${T.border}`,
          boxShadow:"0 8px 40px rgba(255,55,95,0.12)", padding:"32px 28px" }}>

          {step === "otp" ? (
            <OtpStep otp={otp} setOtp={setOtp} auth={auth}
              onSubmit={submitOtp} onBack={() => auth.disconnect()} />
          ) : (
            <CredsStep mode={mode} setMode={setMode}
              host={host} setHost={setHost}
              user={user} setUser={setUser}
              pass={pass} setPass={setPass}
              token={token} setToken={setToken}
              ssl={ssl} setSsl={setSsl}
              auth={auth} onSubmit={submitCreds} />
          )}
        </div>
      </div>
    </div>
  );
}

function HostInput({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={wrapRef} style={{ marginBottom:16, position:"relative" }}>
      <div style={{ fontSize:10, fontWeight:800, letterSpacing:"0.1em",
        color:T.textDim, marginBottom:6 }}>XO HOST URL</div>
      <div style={{ position:"relative", display:"flex", alignItems:"center" }}>
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="https://xoa.yourdomain.com"
          style={{
            width:"100%", padding:"11px 40px 11px 14px", borderRadius:14,
            border:`1.5px solid ${T.border}`, fontSize:13, color:T.text,
            background:"rgba(255,255,255,0.9)", outline:"none", boxSizing:"border-box",
            fontFamily:"'SF Mono','JetBrains Mono',monospace",
            transition:"border-color 0.15s",
          }}
          onMouseEnter={e => e.target.style.borderColor = T.primary}
          onMouseLeave={e => e.target.style.borderColor = T.border}
        />
        {/* chevron */}
        <span
          onClick={() => setOpen(o => !o)}
          style={{ position:"absolute", right:12, cursor:"pointer",
            color:T.textDim, fontSize:11, userSelect:"none",
            transform: open ? "rotate(180deg)" : "none",
            transition:"transform 0.15s" }}>▼</span>
      </div>

      {open && HOST_SUGGESTIONS.length > 0 && (
        <div style={{
          position:"absolute", top:"calc(100% + 4px)", left:0, right:0, zIndex:100,
          background:"rgba(255,255,255,0.97)", backdropFilter:"blur(16px)",
          border:`1.5px solid ${T.border}`, borderRadius:14, overflow:"hidden",
          boxShadow:"0 8px 32px rgba(255,55,95,0.15)",
        }}>
          <div style={{ padding:"8px 14px 4px", fontSize:10, fontWeight:800,
            letterSpacing:"0.08em", color:T.textDim }}>SUGGESTED HOSTS</div>
          {HOST_SUGGESTIONS.map(s => (
            <button key={s}
              onMouseDown={() => { onChange(s); setOpen(false); }}
              style={{
                display:"block", width:"100%", padding:"10px 14px",
                textAlign:"left", background:"transparent", border:"none",
                color:T.text, fontSize:13, fontWeight:500, cursor:"pointer",
                fontFamily:"'SF Mono','JetBrains Mono',monospace",
              }}
              onMouseEnter={e => e.currentTarget.style.background = T.primarySoft}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CredsStep({ mode, setMode, host, setHost, user, setUser,
  pass, setPass, token, setToken, ssl, setSsl, auth, onSubmit }) {

  const tabStyle = active => ({
    flex:1, padding:"9px", borderRadius:10, fontSize:12, fontWeight:700,
    cursor:"pointer", border:"none", transition:"all 0.15s",
    background: active ? T.gradPrimary : "transparent",
    color: active ? "#fff" : T.textDim,
    boxShadow: active ? `0 4px 12px rgba(255,55,95,0.3)` : "none",
  });

  return (
    <>
      <div style={{ display:"flex", gap:4, marginBottom:22, padding:4,
        background:"rgba(255,55,95,0.06)", borderRadius:14 }}>
        {[["password","🔐  Password"],["token","🔑  API Token"]].map(([m,l]) => (
          <button key={m} style={tabStyle(mode===m)} onClick={() => setMode(m)}>{l}</button>
        ))}
      </div>

      <HostInput value={host} onChange={setHost} />

      {mode === "password" ? (
        <>
          <Input label="USERNAME" value={user} onChange={setUser}
            placeholder="username or email" />
          <Input label="PASSWORD" type="password" value={pass} onChange={setPass}
            placeholder="••••••••" />
          <div style={{ padding:"10px 14px", marginBottom:16, borderRadius:12,
            background:T.accentSoft, fontSize:12, color:T.accent, fontWeight:500,
            lineHeight:1.5 }}>
            💡 TOTP code will be requested on the next screen.
          </div>
        </>
      ) : (
        <Input label="API TOKEN" type="password" value={token} onChange={setToken}
          placeholder="Paste XO API token (no MFA needed)" />
      )}

      <label style={{ display:"flex", alignItems:"center", gap:8,
        marginBottom:20, cursor:"pointer", userSelect:"none" }}>
        <input type="checkbox" checked={ssl} onChange={e => setSsl(e.target.checked)}
          style={{ accentColor:T.primary, width:15, height:15 }} />
        <span style={{ fontSize:12, color:T.textMid, fontWeight:500 }}>
          Skip SSL verification (self-signed certs)
        </span>
      </label>

      {auth.error && <ErrorBox msg={auth.error} />}

      <Button onClick={onSubmit} disabled={auth.loading}>
        {auth.loading ? "Connecting…" : mode === "token" ? "Connect" : "Next  →"}
      </Button>
    </>
  );
}

function OtpStep({ otp, setOtp, auth, onSubmit, onBack }) {
  return (
    <>
      <div style={{ textAlign:"center", marginBottom:24 }}>
        <div style={{ fontSize:40, marginBottom:10 }}>🔐</div>
        <div style={{ fontSize:17, fontWeight:800, color:T.text, marginBottom:6 }}>
          Two-Factor Auth
        </div>
        <div style={{ fontSize:13, color:T.textDim, lineHeight:1.6 }}>
          Open your authenticator app and enter the 6-digit code.
        </div>
      </div>

      <div style={{ marginBottom:20 }}>
        <input
          type="text" inputMode="numeric" maxLength={6}
          value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g,""))}
          placeholder="000000"
          style={{ width:"100%", textAlign:"center", fontSize:32, fontWeight:800,
            letterSpacing:"0.25em", padding:"14px",
            background:"rgba(255,255,255,0.9)", border:`2px solid ${otp.length===6 ? T.primary : T.border}`,
            borderRadius:16, color:T.text, outline:"none", boxSizing:"border-box",
            fontFamily:"'SF Mono','JetBrains Mono',monospace",
            boxShadow: otp.length===6 ? `0 0 0 4px ${T.primarySoft}` : "none",
            transition:"border-color 0.15s, box-shadow 0.15s" }}
        />
      </div>

      {auth.error && <ErrorBox msg={auth.error} />}

      <Button onClick={onSubmit} disabled={auth.loading || otp.length < 6}>
        {auth.loading ? "Verifying…" : "Verify & Connect"}
      </Button>
      <button onClick={onBack} style={{ width:"100%", marginTop:10, padding:"10px",
        background:"transparent", border:"none", color:T.textDim,
        fontSize:13, cursor:"pointer", fontWeight:500 }}>
        ← Back
      </button>
    </>
  );
}

function ErrorBox({ msg }) {
  return (
    <div style={{ marginBottom:14, padding:"11px 14px", borderRadius:12,
      background:"#FFD6D4", color:"#CC1A14", fontSize:12, fontWeight:500,
      border:"1.5px solid #FF3B3040" }}>
      ✗  {msg}
    </div>
  );
}
