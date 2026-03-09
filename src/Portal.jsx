import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";

const ESTADOS_CASO = [
  { key: "doc_pendiente",    label: "Doc. pendiente",   emoji: "📎", color: "#a855f7" },
  { key: "iniciado",         label: "Iniciado",         emoji: "📋", color: "#64748b" },
  { key: "reclamado",        label: "Reclamado",        emoji: "📨", color: "#3b82f6" },
  { key: "con_ofrecimiento", label: "Ofrecimiento",     emoji: "💬", color: "#f97316" },
  { key: "en_mediacion",     label: "Mediación",        emoji: "🤝", color: "#eab308" },
  { key: "en_juicio",        label: "En juicio",        emoji: "⚖️",  color: "#8b5cf6" },
  { key: "esperando_pago",   label: "Esperando pago",   emoji: "💳", color: "#06b6d4" },
  { key: "cobrado",          label: "Cobrado",          emoji: "✅", color: "#22c55e" },
];
const estadoInfo = k => ESTADOS_CASO.find(e => e.key === k) || ESTADOS_CASO[0];
const fmtDate = iso => { if (!iso) return "—"; return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" }); };
const fmtMoney = n => { if (n === null || n === undefined || n === "") return "—"; return "$" + Number(n).toLocaleString("es-AR"); };

const BG    = "#060d1a";
const CARD  = "#0a1628";
const CARD2 = "#0f1e35";
const BOR   = "#1a2f4a";
const BOR2  = "#243650";
const TEXT  = "#f1f5f9";
const SUB   = "#94a3b8";
const MUT   = "#475569";
const INPS  = { background: CARD2, border: `1px solid #1e3a5f`, borderRadius: 10, color: TEXT, padding: "10px 14px", fontSize: 14, width: "100%", boxSizing: "border-box", outline: "none" };

function PipelineBar({ estado }) {
  const idx = ESTADOS_CASO.findIndex(e => e.key === estado);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, marginBottom: 8 }}>
      {ESTADOS_CASO.map((e, i) => <div key={e.key} title={e.label} style={{ flex: 1, height: 4, borderRadius: 3, background: i <= idx ? e.color : "#1e293b", transition: "background .3s" }} />)}
      <div style={{ marginLeft: 8, fontSize: 11, color: ESTADOS_CASO[idx]?.color || SUB, fontWeight: 700, whiteSpace: "nowrap" }}>{ESTADOS_CASO[idx]?.emoji} {ESTADOS_CASO[idx]?.label}</div>
    </div>
  );
}

function PortalCasoCard({ caso }) {
  const [open, setOpen] = useState(false);
  const ei = estadoInfo(caso.estado);
  const logOrdenado = [...(caso.notas_log || [])].sort((a, b) => b.ts - a.ts);
  const ultimaAccion = logOrdenado[0] || null;

  return (
    <div style={{ background: CARD, border: `1px solid ${open ? ei.color + "66" : BOR}`, borderRadius: 12, marginBottom: 10, overflow: "hidden", transition: "border-color .2s" }}>
      <div onClick={() => setOpen(o => !o)} style={{ padding: "14px 16px", cursor: "pointer" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: TEXT, marginBottom: 8 }}>{caso.asegurado}</div>
        <PipelineBar estado={caso.estado} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: ultimaAccion ? 8 : 0 }}>
          {caso.fecha_derivacion && <span style={{ fontSize: 11, background: "#47556922", color: SUB, borderRadius: 6, padding: "2px 8px" }}>📅 {fmtDate(caso.fecha_derivacion)}</span>}
          {caso.monto_ofrecimiento && <span style={{ fontSize: 11, background: "#f9731622", color: "#f97316", borderRadius: 6, padding: "2px 8px" }}>Ofrecim. {fmtMoney(caso.monto_ofrecimiento)}</span>}
          {caso.estado === "cobrado" && caso.monto_cobro_asegurado && <span style={{ fontSize: 11, background: "#22c55e22", color: "#22c55e", borderRadius: 6, padding: "2px 8px" }}>✅ Cobrado {fmtMoney(caso.monto_cobro_asegurado)}</span>}
        </div>
        {ultimaAccion && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 7, background: CARD2, borderRadius: 7, padding: "6px 9px" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#6366f1", marginTop: 4, flexShrink: 0 }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 10, color: MUT, marginBottom: 1 }}>{fmtDate(ultimaAccion.fecha)} · última acción{logOrdenado.length > 1 ? ` (${logOrdenado.length} total)` : ""}</div>
              <div style={{ fontSize: 12, color: SUB, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ultimaAccion.texto}</div>
            </div>
            {logOrdenado.length > 1 && <div style={{ fontSize: 10, color: "#6366f1", flexShrink: 0, marginTop: 2 }}>ver todo ↓</div>}
          </div>
        )}
      </div>
      {open && (
        <div style={{ borderTop: `1px solid ${BOR}`, padding: "14px 16px" }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: MUT, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Fechas</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[{k:"fecha_derivacion",l:"Derivación"},{k:"fecha_contacto_asegurado",l:"Contacto asegurado"},{k:"fecha_inicio_reclamo",l:"Inicio reclamo"},{k:"fecha_ultimo_movimiento",l:"Último movimiento"}]
                .filter(f => caso[f.k]).map(f => (
                  <div key={f.k} style={{ background: CARD2, borderRadius: 8, padding: "8px 10px" }}>
                    <div style={{ fontSize: 10, color: MUT, marginBottom: 2 }}>{f.l}</div>
                    <div style={{ fontSize: 13, color: TEXT, fontWeight: 600 }}>{fmtDate(caso[f.k])}</div>
                  </div>
                ))}
            </div>
          </div>
          {(caso.monto_ofrecimiento || caso.monto_cobro_asegurado || caso.monto_cobro_yo || caso.monto_comision_pas) && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: MUT, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Montos</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                {[{k:"monto_ofrecimiento",l:"Ofrecimiento",c:"#f97316"},{k:"monto_cobro_asegurado",l:"Cobró asegurado",c:"#22c55e"},{k:"monto_cobro_yo",l:"Honorarios",c:"#6366f1"},{k:"monto_comision_pas",l:"Tu comisión",c:"#eab308"}]
                  .filter(f => caso[f.k]).map(f => (
                    <div key={f.k} style={{ background: CARD2, borderRadius: 8, padding: "8px 10px", border: `1px solid ${f.c}22` }}>
                      <div style={{ fontSize: 10, color: f.c + "99", marginBottom: 2 }}>{f.l}</div>
                      <div style={{ fontSize: 14, color: f.c, fontWeight: 700 }}>{fmtMoney(caso[f.k])}</div>
                    </div>
                  ))}
              </div>
            </div>
          )}
          {caso.nota && (
            <div style={{ background: CARD2, borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: MUT, marginBottom: 4 }}>NOTA DEL CASO</div>
              <div style={{ fontSize: 13, color: SUB, fontStyle: "italic" }}>{caso.nota}</div>
            </div>
          )}
          {logOrdenado.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: MUT, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Historial de acciones</div>
              <div style={{ paddingLeft: 4 }}>
                {logOrdenado.map((n, i) => (
                  <div key={n.ts} style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: i === 0 ? "#6366f1" : BOR2, marginTop: 4, flexShrink: 0 }} />
                      {i < logOrdenado.length - 1 && <div style={{ width: 1, flex: 1, background: BOR, marginTop: 3, minHeight: 16 }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, paddingBottom: 4 }}>
                      <div style={{ fontSize: 10, color: i === 0 ? "#6366f1" : MUT, fontWeight: i === 0 ? 700 : 400, marginBottom: 2 }}>{fmtDate(n.fecha)}{i === 0 ? " · más reciente" : ""}</div>
                      <div style={{ fontSize: 13, color: SUB }}>{n.texto}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LoginScreen({ darkMode = true, onToggleDark }) {
  const [email, setEmail]     = useState("");
  const [pwd,   setPwd]       = useState("");
  const [error, setError]     = useState("");
  const [load,  setLoad]      = useState(false);
  const LBG   = darkMode ? "#060d1a" : "#f1f5f9";
  const LCARD = darkMode ? "#0a1628" : "#ffffff";
  const LBOR  = darkMode ? "#1a2f4a" : "#e2e8f0";
  const LTEXT = darkMode ? "#f1f5f9" : "#1e293b";
  const LMUT  = darkMode ? "#475569" : "#94a3b8";
  const LINPS = darkMode
    ? { background: "#0f1e35", border: "1px solid #1e3a5f", borderRadius: 10, color: "#f1f5f9", padding: "10px 14px", fontSize: 14, width: "100%", boxSizing: "border-box", outline: "none" }
    : { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, color: "#1e293b", padding: "10px 14px", fontSize: 14, width: "100%", boxSizing: "border-box", outline: "none" };

  const handleLogin = async () => {
    if (!email.trim() || !pwd.trim()) return;
    setLoad(true); setError("");
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pwd });
    setLoad(false);
    if (err) setError("Usuario o contraseña incorrectos");
  };

  return (
    <div style={{ minHeight: "100vh", background: LBG, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ position: "absolute", top: 16, right: 16 }}>
        <button onClick={onToggleDark} style={{ background: darkMode ? "#1e293b" : "#e2e8f0", border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 16 }}>{darkMode ? "☀️" : "🌙"}</button>
      </div>
      <div style={{ background: LCARD, border: `1px solid ${LBOR}`, borderRadius: 18, padding: "36px 32px", width: "100%", maxWidth: 380, boxShadow: "0 24px 60px #000a" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
          <div style={{ fontSize: 11, color: "#6366f1", textTransform: "uppercase", letterSpacing: 2, marginBottom: 6 }}>PAS Tracker</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: LTEXT }}>Portal de Derivadores</div>
          <div style={{ fontSize: 13, color: LMUT, marginTop: 6 }}>Ingresá para ver el estado de tus casos</div>
        </div>
        <label style={{ display: "block", marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: LMUT, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Email</div>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} placeholder="tu@mail.com" style={LINPS} />
        </label>
        <label style={{ display: "block", marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: LMUT, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Contraseña</div>
          <input type="password" value={pwd} onChange={e => setPwd(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} placeholder="••••••••" style={LINPS} />
        </label>
        {error && <div style={{ background: "#ef444422", border: "1px solid #ef444466", borderRadius: 8, padding: "8px 12px", color: "#ef4444", fontSize: 13, marginBottom: 16, textAlign: "center" }}>{error}</div>}
        <button onClick={handleLogin} disabled={load || !email.trim() || !pwd.trim()} style={{ width: "100%", background: load ? "#334155" : "#6366f1", border: "none", borderRadius: 10, color: "white", padding: "12px", cursor: load ? "default" : "pointer", fontSize: 15, fontWeight: 700 }}>
          {load ? "Ingresando..." : "Ingresar →"}
        </button>
      </div>
    </div>
  );
}

function CambiarPasswordModal({ onClose }) {
  const [nueva,   setNueva]   = useState("");
  const [confirm, setConfirm] = useState("");
  const [load,    setLoad]    = useState(false);
  const [msg,     setMsg]     = useState("");
  const [error,   setError]   = useState("");

  const handleCambiar = async () => {
    if (nueva !== confirm) { setError("Las contraseñas no coinciden"); return; }
    if (nueva.length < 6)  { setError("Mínimo 6 caracteres"); return; }
    setLoad(true); setError(""); setMsg("");
    const { error: err } = await supabase.auth.updateUser({ password: nueva });
    setLoad(false);
    if (err) { setError("Error al cambiar la contraseña"); return; }
    setMsg("✅ Contraseña cambiada correctamente");
    setTimeout(onClose, 1500);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: CARD, border: `1px solid ${BOR}`, borderRadius: 16, padding: "28px 24px", width: "100%", maxWidth: 360 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: TEXT, marginBottom: 20 }}>🔒 Cambiar contraseña</div>
        {[{label:"Nueva contraseña",val:nueva,set:setNueva},{label:"Confirmar contraseña",val:confirm,set:setConfirm}].map(f => (
          <label key={f.label} style={{ display: "block", marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: MUT, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{f.label}</div>
            <input type="password" value={f.val} onChange={e => f.set(e.target.value)} style={INPS} />
          </label>
        ))}
        {error && <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>{error}</div>}
        {msg   && <div style={{ color: "#22c55e", fontSize: 13, marginBottom: 12 }}>{msg}</div>}
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button onClick={onClose} style={{ flex: 1, background: CARD2, border: `1px solid ${BOR}`, borderRadius: 10, color: MUT, padding: "10px", cursor: "pointer", fontSize: 14 }}>Cancelar</button>
          <button onClick={handleCambiar} disabled={load} style={{ flex: 2, background: "#6366f1", border: "none", borderRadius: 10, color: "white", padding: "10px", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>{load ? "Guardando..." : "Guardar"}</button>
        </div>
      </div>
    </div>
  );
}

function PortalHome({ session, onLogout, darkMode = true, onToggleDark }) {
  const [pasInfo, setPasInfo]   = useState(null);
  const [casos,   setCasos]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState("");
  const [cambPwd, setCambPwd]   = useState(false);
  const [filtro,  setFiltro]    = useState("todos");

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const { data: link, error: linkErr } = await supabase
        .from("pas_portal_users").select("pas_id").eq("user_id", session.user.id).single();
      if (linkErr || !link) { setError("Tu usuario no está vinculado a ningún PAS. Contactá al administrador."); setLoading(false); return; }
      const { data: pas } = await supabase.from("pas_lista").select("nombre, mail, telefonos").eq("pas_id", link.pas_id).single();
      setPasInfo(pas);
      const { data: casosData } = await supabase.from("pas_casos").select("*").eq("pas_id", link.pas_id);
      setCasos(casosData || []);
      setLoading(false);
    };
    loadData();
  }, [session]);

  const casosFiltrados = casos.filter(c => filtro === "todos" || c.estado === filtro);
  const comisionTotal  = casos.filter(c => c.estado === "cobrado").reduce((s, c) => s + (Number(c.monto_comision_pas) || 0), 0);
  const totalCobrado   = casos.filter(c => c.estado === "cobrado").reduce((s, c) => s + (Number(c.monto_cobro_asegurado) || 0), 0);

  if (loading) return <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ color: MUT }}>Cargando tus casos...</div></div>;

  if (error) return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: CARD, border: "1px solid #ef444466", borderRadius: 14, padding: 28, maxWidth: 380, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <div style={{ color: "#ef4444", fontSize: 14 }}>{error}</div>
        <button onClick={onLogout} style={{ marginTop: 20, background: CARD2, border: `1px solid ${BOR}`, borderRadius: 8, color: MUT, padding: "8px 18px", cursor: "pointer", fontSize: 13 }}>Cerrar sesión</button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: darkMode ? BG : "#f1f5f9", color: darkMode ? TEXT : "#1e293b" }}>
      <div style={{ background: darkMode ? CARD : "#ffffff", borderBottom: `1px solid ${darkMode ? BOR : "#e2e8f0"}`, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: "#6366f1", textTransform: "uppercase", letterSpacing: 2 }}>PAS Tracker</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: TEXT }}>{pasInfo?.nombre || "Portal"}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onToggleDark} style={{ background: darkMode ? "#1e293b" : "#e2e8f0", border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 14 }}>{darkMode ? "☀️" : "🌙"}</button>
          <button onClick={() => setCambPwd(true)} style={{ background: darkMode ? "#0f1e35" : "#e2e8f0", border: `1px solid ${darkMode ? "#1a2f4a" : "#e2e8f0"}`, borderRadius: 8, color: darkMode ? "#475569" : "#64748b", padding: "6px 12px", cursor: "pointer", fontSize: 12 }}>🔒 Contraseña</button>
          <button onClick={onLogout} style={{ background: darkMode ? "#0f1e35" : "#e2e8f0", border: `1px solid ${darkMode ? "#1a2f4a" : "#e2e8f0"}`, borderRadius: 8, color: darkMode ? "#475569" : "#64748b", padding: "6px 12px", cursor: "pointer", fontSize: 12 }}>Salir</button>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Casos totales", value: casos.length, color: "#6366f1" },
            { label: "Cobrados",      value: casos.filter(c => c.estado === "cobrado").length, color: "#22c55e" },
            { label: "En proceso",    value: casos.filter(c => c.estado !== "cobrado" && c.estado !== "iniciado").length, color: "#f97316" },
          ].map(s => (
            <div key={s.label} style={{ background: CARD, border: `1px solid ${BOR}`, borderRadius: 12, padding: "14px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: MUT, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {comisionTotal > 0 && (
          <div style={{ background: CARD, border: "1px solid #eab30844", borderRadius: 12, padding: "14px 16px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 11, color: "#eab308", textTransform: "uppercase", letterSpacing: 1 }}>Tu comisión total cobrada</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#eab308", marginTop: 2 }}>{fmtMoney(comisionTotal)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: MUT }}>Asegurados cobrados</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#22c55e" }}>{fmtMoney(totalCobrado)}</div>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 16 }}>
          {[{ key: "todos", label: "Todos", emoji: "", color: "#64748b" }, ...ESTADOS_CASO].map(e => (
            <button key={e.key} onClick={() => setFiltro(e.key)} style={{ flexShrink: 0, background: filtro === e.key ? e.color + "22" : CARD, border: `1px solid ${filtro === e.key ? e.color : BOR}`, borderRadius: 20, color: filtro === e.key ? e.color : MUT, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: filtro === e.key ? 700 : 400, transition: "all .15s" }}>
              {e.emoji ? `${e.emoji} ` : ""}{e.label}
              {e.key !== "todos" && casos.filter(c => c.estado === e.key).length > 0 && (
                <span style={{ marginLeft: 4, background: e.color + "33", borderRadius: 10, padding: "1px 5px" }}>{casos.filter(c => c.estado === e.key).length}</span>
              )}
            </button>
          ))}
        </div>

        {casosFiltrados.length === 0
          ? <div style={{ textAlign: "center", padding: "40px 20px", color: MUT }}><div style={{ fontSize: 32, marginBottom: 10 }}>📭</div><div>No hay casos con ese filtro</div></div>
          : casosFiltrados.sort((a, b) => (b.fecha_derivacion || "").localeCompare(a.fecha_derivacion || "")).map(c => <PortalCasoCard key={c.id} caso={c} />)
        }
      </div>
      {cambPwd && <CambiarPasswordModal onClose={() => setCambPwd(false)} />}
    </div>
  );
}

export default function Portal() {
  const [session, setSession] = useState(undefined);
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) return <div style={{ minHeight: "100vh", background: "#060d1a", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ color: "#475569" }}>Cargando...</div></div>;
  if (!session) return <LoginScreen darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />;
  return <PortalHome session={session} darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} onLogout={() => supabase.auth.signOut()} />;
}
