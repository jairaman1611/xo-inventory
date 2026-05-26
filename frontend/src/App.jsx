import { useState, useEffect } from "react";
import { T } from "./theme";
import { useAuth, useInventory } from "./hooks/useInventory";
import { ConnectFlow }   from "./components/ConnectFlow";
import { OverviewPage }  from "./pages/OverviewPage";
import { VMsPage }       from "./pages/VMsPage";
import { HostsPage }     from "./pages/HostsPage";
import { StoragePage, NetworksPage } from "./pages/StorageNetworkPages";
import { Spinner }       from "./components/ui";

const TABS = [
  { id:"overview", label:"Overview",  icon:"📊" },
  { id:"vms",      label:"VMs",       icon:"🖥"  },
  { id:"hosts",    label:"Hosts",     icon:"🖧"  },
  { id:"storage",  label:"Storage",   icon:"💾" },
  { id:"networks", label:"Networks",  icon:"🌐" },
];

export default function App() {
  const auth = useAuth();
  const inv  = useInventory();
  const [tab, setTab] = useState("overview");

  useEffect(() => { auth.checkStatus(); }, []);
  useEffect(() => {
    if (auth.status === "connected" && !inv.data && !inv.loading) inv.load();
  }, [auth.status]);

  const gs = `
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
    html, body { background:${T.bg}; color:${T.text}; font-family:'Plus Jakarta Sans',sans-serif; min-height:100vh; }
    @keyframes ping      { 75%,100%{transform:scale(2);opacity:0} }
    @keyframes slideIn   { from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none} }
    @keyframes fadeIn    { from{opacity:0}to{opacity:1} }
    @keyframes spin      { to{transform:rotate(360deg)} }
    ::-webkit-scrollbar { width:5px; height:5px; }
    ::-webkit-scrollbar-track { background:transparent; }
    ::-webkit-scrollbar-thumb { background:${T.primarySoft}; border-radius:99px; }
    input, button { font-family:'Plus Jakarta Sans',sans-serif; }
    input::placeholder { color:${T.textDim}; }
  `;

  if (["disconnected","needs_otp","connecting","error"].includes(auth.status)) {
    return <><style>{gs}</style><ConnectFlow auth={auth} onConnected={() => inv.load()} /></>;
  }

  const tabCount = (id) => {
    if (!inv.data) return null;
    return { vms:inv.data.vms?.length, hosts:inv.data.hosts?.length,
             storage:inv.data.storage?.length, networks:inv.data.networks?.length }[id] ?? null;
  };

  return (
    <>
      <style>{gs}</style>
      <div style={{ display:"flex", flexDirection:"column", minHeight:"100vh",
        background:`radial-gradient(circle at 0% 0%, ${T.primarySoft}60 0%, transparent 40%),
                    radial-gradient(circle at 100% 100%, ${T.accentSoft}60 0%, transparent 40%),
                    ${T.bg}` }}>

        {/* ── Nav bar ── */}
        <nav style={{ background:"rgba(255,255,255,0.82)", backdropFilter:"blur(20px)",
          borderBottom:`1.5px solid ${T.border}`,
          position:"sticky", top:0, zIndex:100,
          boxShadow:`0 2px 20px rgba(255,55,95,0.08)` }}>
          <div style={{ maxWidth:1200, margin:"0 auto", padding:"0 24px",
            display:"flex", alignItems:"center", gap:0 }}>

            {/* Logo */}
            <div style={{ display:"flex", alignItems:"center", gap:10,
              padding:"10px 0", marginRight:24 }}>
              <img src="/logo.png" alt="Planview"
                style={{ height:32, width:"auto", objectFit:"contain" }} />
              <div style={{ borderLeft:`1.5px solid ${T.border}`, paddingLeft:10 }}>
                <div style={{ fontSize:13, fontWeight:800, color:T.text,
                  letterSpacing:"-0.02em", lineHeight:1.2 }}>AdaptiveWork</div>
                <div style={{ fontSize:10, color:T.textDim, fontWeight:600,
                  letterSpacing:"0.04em" }}>INVENTORY</div>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display:"flex", flex:1, gap:2 }}>
              {TABS.map(t => {
                const active = tab === t.id;
                const cnt    = tabCount(t.id);
                return (
                  <button key={t.id} onClick={() => setTab(t.id)} style={{
                    padding:"16px 14px", background:"transparent", border:"none",
                    borderBottom:`2.5px solid ${active ? T.primary : "transparent"}`,
                    color: active ? T.primary : T.textDim,
                    cursor:"pointer", fontSize:12, fontWeight: active ? 800 : 500,
                    display:"flex", alignItems:"center", gap:6, transition:"all 0.15s",
                    whiteSpace:"nowrap",
                  }}>
                    <span>{t.icon}</span> {t.label}
                    {cnt != null && inv.data && (
                      <span style={{ fontSize:10, padding:"1px 7px", borderRadius:20,
                        fontWeight:700,
                        background: active ? T.primarySoft : "rgba(0,0,0,0.06)",
                        color: active ? T.primary : T.textDim }}>
                        {cnt.toLocaleString()}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Right controls */}
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              {inv.fetchedAt && (
                <span style={{ fontSize:10, color:T.textDim, fontWeight:500,
                  fontFamily:"'SF Mono','JetBrains Mono',monospace" }}>
                  {inv.fetchedAt.toLocaleTimeString()}
                </span>
              )}
              <button onClick={() => inv.load()} disabled={inv.loading} style={{
                padding:"7px 16px", borderRadius:50, fontSize:12, fontWeight:700,
                cursor:inv.loading?"wait":"pointer",
                border:"none", background:T.gradPrimary, color:"#fff",
                boxShadow:`0 3px 10px rgba(255,55,95,0.35)`,
                opacity:inv.loading?0.6:1, transition:"transform 0.12s",
              }}
              onMouseEnter={e => !inv.loading && (e.currentTarget.style.transform="scale(1.05)")}
              onMouseLeave={e => (e.currentTarget.style.transform="scale(1)")}>
                {inv.loading ? "…" : "↻ Refresh"}
              </button>
              <button onClick={() => auth.disconnect()} style={{
                padding:"7px 14px", borderRadius:50, fontSize:12, fontWeight:600,
                cursor:"pointer", border:`1.5px solid ${T.border}`,
                background:"rgba(255,255,255,0.7)", color:T.textDim }}>
                Disconnect
              </button>
            </div>
          </div>
        </nav>

        {/* ── Content ── */}
        <main style={{ flex:1, padding:"24px", maxWidth:1200, margin:"0 auto", width:"100%" }}>
          {inv.loading && !inv.data && (
            <div style={{ textAlign:"center", paddingTop:100 }}>
              <Spinner />
              <div style={{ color:T.textMid, marginTop:20, fontSize:14, fontWeight:600 }}>
                Loading inventory…
              </div>
            </div>
          )}
          {inv.error && (
            <div style={{ padding:"16px 20px", borderRadius:16,
              background:"#FFD6D4", border:`1.5px solid #FF3B3040`,
              color:"#CC1A14", fontSize:13, fontWeight:500, marginBottom:16 }}>
              ✗ {inv.error}
            </div>
          )}
          {inv.data && (
            <>
              {tab==="overview" && <OverviewPage data={inv.data} />}
              {tab==="vms"      && <VMsPage vms={inv.data.vms} hosts={inv.data.hosts} />}
              {tab==="hosts"    && <HostsPage hosts={inv.data.hosts} />}
              {tab==="storage"  && <StoragePage storage={inv.data.storage} />}
              {tab==="networks" && <NetworksPage networks={inv.data.networks} />}
            </>
          )}
        </main>
      </div>
    </>
  );
}
