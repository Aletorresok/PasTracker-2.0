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
const fmtDate = iso => { if (!iso) return "—"; const [y,m,d] = iso.slice(0,10).split("-"); return `${d}/${m}/${String(y).slice(-2)}`; };
const fmtMoney = n => { if (n === null || n === undefined || n === "") return "—"; return "$" + Number(n).toLocaleString("es-AR"); };

// ── THEME ─────────────────────────────────────────────────────────────────────
const theme = (dark) => ({
  bg:      dark ? "#111827" : "#f8fafc",
  card:    dark ? "#1a2535" : "#ffffff",
  card2:   dark ? "#222f42" : "#f1f5f9",
  border:  dark ? "#2d3f55" : "#e2e8f0",
  border2: dark ? "#374f6b" : "#cbd5e1",
  text:    dark ? "#f1f5f9" : "#0f172a",
  sub:     dark ? "#94a3b8" : "#475569",
  muted:   dark ? "#64748b" : "#94a3b8",
  input:   dark
    ? { background: "#222f42", border: "1px solid #2d3f55", borderRadius: 10, color: "#f1f5f9", padding: "11px 14px", fontSize: 14, width: "100%", boxSizing: "border-box", outline: "none" }
    : { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, color: "#0f172a", padding: "11px 14px", fontSize: 14, width: "100%", boxSizing: "border-box", outline: "none" },
});

// ── PIPELINE BAR ──────────────────────────────────────────────────────────────
function PipelineBar({ estado, dark }) {
  const T = theme(dark);
  const idx = ESTADOS_CASO.findIndex(e => e.key === estado);
  const ei = ESTADOS_CASO[idx];
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", gap: 3, marginBottom: 6 }}>
        {ESTADOS_CASO.map((e, i) => (
          <div key={e.key} title={e.label} style={{ flex: 1, height: 5, borderRadius: 3, background: i <= idx ? e.color : T.border, transition: "background .3s" }} />
        ))}
      </div>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: (ei?.color || "#64748b") + (dark ? "22" : "18"), border: `1px solid ${(ei?.color || "#64748b")}44`, borderRadius: 20, padding: "3px 10px" }}>
        <span style={{ fontSize: 12 }}>{ei?.emoji}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: ei?.color || T.sub }}>{ei?.label}</span>
      </div>
    </div>
  );
}

// ── CASO CARD ─────────────────────────────────────────────────────────────────
function PortalCasoCard({ caso, dark }) {
  const [open, setOpen] = useState(false);
  const T = theme(dark);
  const ei = estadoInfo(caso.estado);
  const logOrdenado = [...(caso.notas_log || [])].sort((a, b) => b.ts - a.ts);
  const ultimaAccion = logOrdenado[0] || null;

  return (
    <div style={{
      background: T.card,
      border: `1px solid ${open ? ei.color + "88" : T.border}`,
      borderRadius: 14,
      marginBottom: 12,
      overflow: "hidden",
      transition: "all .2s",
      boxShadow: dark ? "none" : "0 1px 4px #0000000a",
    }}>
      {/* Card header — always visible */}
      <div onClick={() => setOpen(o => !o)} style={{ padding: "16px 18px", cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.text, lineHeight: 1.3 }}>{caso.asegurado}</div>
          <div style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{open ? "▲" : "▼"}</div>
        </div>

        <PipelineBar estado={caso.estado} dark={dark} />

        {/* Badges */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
          {caso.fecha_derivacion && (
            <span style={{ fontSize: 11, background: T.card2, color: T.sub, borderRadius: 6, padding: "3px 8px", border: `1px solid ${T.border}` }}>📅 {fmtDate(caso.fecha_derivacion)}</span>
          )}
          {caso.monto_ofrecimiento && (
            <span style={{ fontSize: 11, background: "#f9731618", color: "#f97316", borderRadius: 6, padding: "3px 8px", border: "1px solid #f9731633", fontWeight: 600 }}>💬 Ofrecim. {fmtMoney(caso.monto_ofrecimiento)}</span>
          )}
          {caso.estado === "cobrado" && caso.monto_cobro_asegurado && (
            <span style={{ fontSize: 11, background: "#22c55e18", color: "#22c55e", borderRadius: 6, padding: "3px 8px", border: "1px solid #22c55e33", fontWeight: 600 }}>✅ {fmtMoney(caso.monto_cobro_asegurado)}</span>
          )}
        </div>

        {/* Última acción */}
        {ultimaAccion && (
          <div style={{ marginTop: 10, display: "flex", alignItems: "flex-start", gap: 8, background: T.card2, borderRadius: 8, padding: "8px 11px", border: `1px solid ${T.border}` }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#6366f1", marginTop: 4, flexShrink: 0 }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11, color: "#6366f1", fontWeight: 600, marginBottom: 2 }}>{fmtDate(ultimaAccion.fecha)} · última acción{logOrdenado.length > 1 ? ` (${logOrdenado.length})` : ""}</div>
              <div style={{ fontSize: 13, color: T.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ultimaAccion.texto}</div>
            </div>
          </div>
        )}
      </div>

      {/* Expandido */}
      {open && (
        <div style={{ borderTop: `1px solid ${T.border}`, padding: "16px 18px", background: dark ? T.card2 : "#fafbfc" }}>

          {/* Fechas */}
          {[{k:"fecha_derivacion",l:"Derivación"},{k:"fecha_contacto_asegurado",l:"Contacto asegurado"},{k:"fecha_inicio_reclamo",l:"Inicio reclamo"},{k:"fecha_ultimo_movimiento",l:"Último movimiento"}].filter(f => caso[f.k]).length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700, marginBottom: 8 }}>Fechas</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[{k:"fecha_derivacion",l:"Derivación"},{k:"fecha_contacto_asegurado",l:"Contacto asegurado"},{k:"fecha_inicio_reclamo",l:"Inicio reclamo"},{k:"fecha_ultimo_movimiento",l:"Último movimiento"}]
                  .filter(f => caso[f.k]).map(f => (
                    <div key={f.k} style={{ background: T.card, borderRadius: 8, padding: "10px 12px", border: `1px solid ${T.border}` }}>
                      <div style={{ fontSize: 10, color: T.muted, marginBottom: 3 }}>{f.l}</div>
                      <div style={{ fontSize: 14, color: T.text, fontWeight: 700 }}>{fmtDate(caso[f.k])}</div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Montos */}
          {(caso.monto_ofrecimiento || caso.monto_cobro_asegurado || caso.monto_cobro_yo || caso.monto_comision_pas) && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700, marginBottom: 8 }}>Montos</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[{k:"monto_ofrecimiento",l:"Ofrecimiento",c:"#f97316"},{k:"monto_cobro_asegurado",l:"Cobró asegurado",c:"#22c55e"},{k:"monto_cobro_yo",l:"Honorarios",c:"#6366f1"},{k:"monto_comision_pas",l:"Tu comisión",c:"#eab308"}]
                  .filter(f => caso[f.k]).map(f => (
                    <div key={f.k} style={{ background: T.card, borderRadius: 8, padding: "10px 12px", border: `1px solid ${f.c}33` }}>
                      <div style={{ fontSize: 10, color: f.c + "aa", marginBottom: 3 }}>{f.l}</div>
                      <div style={{ fontSize: 15, color: f.c, fontWeight: 800 }}>{fmtMoney(caso[f.k])}</div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Nota */}
          {caso.nota && (
            <div style={{ background: T.card, borderRadius: 8, padding: "10px 12px", marginBottom: 16, border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 10, color: T.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Nota del caso</div>
              <div style={{ fontSize: 13, color: T.sub, fontStyle: "italic", lineHeight: 1.5 }}>{caso.nota}</div>
            </div>
          )}

          {/* Timeline */}
          {logOrdenado.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700, marginBottom: 12 }}>Historial de acciones</div>
              <div style={{ paddingLeft: 6 }}>
                {logOrdenado.map((n, i) => (
                  <div key={n.ts} style={{ display: "flex", gap: 12, marginBottom: 10 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                      <div style={{ width: 9, height: 9, borderRadius: "50%", background: i === 0 ? "#6366f1" : T.border2, marginTop: 3, flexShrink: 0, border: i === 0 ? "2px solid #6366f144" : "none" }} />
                      {i < logOrdenado.length - 1 && <div style={{ width: 1, flex: 1, background: T.border, marginTop: 4, minHeight: 18 }} />}
                    </div>
                    <div style={{ flex: 1, paddingBottom: 6 }}>
                      <div style={{ fontSize: 11, color: i === 0 ? "#6366f1" : T.muted, fontWeight: i === 0 ? 700 : 500, marginBottom: 3 }}>
                        {fmtDate(n.fecha)}{i === 0 ? " · más reciente" : ""}
                      </div>
                      <div style={{ fontSize: 13, color: T.sub, lineHeight: 1.5 }}>{n.texto}</div>
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

// ── CAMBIAR PASSWORD ──────────────────────────────────────────────────────────
function CambiarPasswordModal({ onClose, dark }) {
  const T = theme(dark);
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
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "28px 24px", width: "100%", maxWidth: 360, boxShadow: "0 20px 60px #0004" }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: T.text, marginBottom: 20 }}>🔒 Cambiar contraseña</div>
        {[{label:"Nueva contraseña",val:nueva,set:setNueva},{label:"Confirmar contraseña",val:confirm,set:setConfirm}].map(f => (
          <label key={f.label} style={{ display: "block", marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: T.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{f.label}</div>
            <input type="password" value={f.val} onChange={e => f.set(e.target.value)} style={T.input} />
          </label>
        ))}
        {error && <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 12, background: "#ef444412", borderRadius: 8, padding: "8px 12px" }}>{error}</div>}
        {msg   && <div style={{ color: "#22c55e", fontSize: 13, marginBottom: 12, background: "#22c55e12", borderRadius: 8, padding: "8px 12px" }}>{msg}</div>}
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button onClick={onClose} style={{ flex: 1, background: T.card2, border: `1px solid ${T.border}`, borderRadius: 10, color: T.sub, padding: "10px", cursor: "pointer", fontSize: 14 }}>Cancelar</button>
          <button onClick={handleCambiar} disabled={load} style={{ flex: 2, background: "#6366f1", border: "none", borderRadius: 10, color: "white", padding: "10px", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>{load ? "Guardando..." : "Guardar"}</button>
        </div>
      </div>
    </div>
  );
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
function LoginScreen({ dark, onToggleDark }) {
  const T = theme(dark);
  const [email, setEmail] = useState("");
  const [pwd,   setPwd]   = useState("");
  const [error, setError] = useState("");
  const [load,  setLoad]  = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !pwd.trim()) return;
    setLoad(true); setError("");
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pwd });
    setLoad(false);
    if (err) setError("Usuario o contraseña incorrectos");
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, transition: "background .3s" }}>
      <button onClick={onToggleDark} style={{ position: "absolute", top: 16, right: 16, background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 16, color: T.sub }}>
        {dark ? "☀️" : "🌙"}
      </button>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 20, padding: "40px 36px", width: "100%", maxWidth: 400, boxShadow: dark ? "0 24px 60px #0008" : "0 8px 40px #0000001a" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 11, color: "#6366f1", textTransform: "uppercase", letterSpacing: 3, marginBottom: 8, fontWeight: 700 }}>PAS Tracker</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: T.text, letterSpacing: -0.5 }}>Portal de Derivadores</div>
          <div style={{ fontSize: 14, color: T.muted, marginTop: 8 }}>Ingresá para ver el estado de tus casos</div>
        </div>
        <label style={{ display: "block", marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: T.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 7, fontWeight: 600 }}>Email</div>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} placeholder="tu@mail.com" style={T.input} />
        </label>
        <label style={{ display: "block", marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: T.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 7, fontWeight: 600 }}>Contraseña</div>
          <input type="password" value={pwd} onChange={e => setPwd(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} placeholder="••••••••" style={T.input} />
        </label>
        {error && <div style={{ background: "#ef444415", border: "1px solid #ef444433", borderRadius: 10, padding: "10px 14px", color: "#ef4444", fontSize: 13, marginBottom: 18, textAlign: "center" }}>{error}</div>}
        <button onClick={handleLogin} disabled={load || !email.trim() || !pwd.trim()} style={{ width: "100%", background: (load || !email.trim() || !pwd.trim()) ? (dark ? "#334155" : "#e2e8f0") : "#6366f1", border: "none", borderRadius: 12, color: (load || !email.trim() || !pwd.trim()) ? T.muted : "white", padding: "13px", cursor: (load || !email.trim() || !pwd.trim()) ? "default" : "pointer", fontSize: 15, fontWeight: 800, transition: "all .2s", letterSpacing: 0.3 }}>
          {load ? "Ingresando..." : "Ingresar →"}
        </button>
      </div>
    </div>
  );
}

// ── PORTAL HOME ───────────────────────────────────────────────────────────────
function PortalHome({ session, onLogout, dark, onToggleDark }) {
  const T = theme(dark);
  const [pasInfo, setPasInfo] = useState(null);
  const [casos,   setCasos]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [cambPwd, setCambPwd] = useState(false);
  const [filtro,  setFiltro]  = useState("todos");

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const { data: link, error: linkErr } = await supabase.from("pas_portal_users").select("pas_id").eq("user_id", session.user.id).single();
      if (linkErr || !link) { setError("Tu usuario no está vinculado a ningún PAS. Contactá al administrador."); setLoading(false); return; }
      const { data: pas } = await supabase.from("pas_lista").select("nombre, mail, telefonos").eq("pas_id", link.pas_id).single();
      setPasInfo(pas);
      const { data: casosData } = await supabase.from("pas_casos").select("*").eq("pas_id", link.pas_id);
      const realCasos = casosData || [];
      if (realCasos.length === 0) {
        setCasos([{
          id: "demo",
          asegurado: "Ejemplo: García Juan (caso de demostración)",
          estado: "reclamado",
          fecha_derivacion: new Date().toISOString().slice(0,10),
          fecha_contacto_asegurado: new Date(Date.now() - 3*86400000).toISOString().slice(0,10),
          fecha_inicio_reclamo: new Date(Date.now() - 2*86400000).toISOString().slice(0,10),
          fecha_ultimo_movimiento: new Date().toISOString().slice(0,10),
          monto_ofrecimiento: "",
          monto_cobro_asegurado: "",
          monto_cobro_yo: "",
          monto_comision_pas: "",
          nota: "Este es un caso de ejemplo para que puedas ver cómo se verán tus casos reales.",
          notas_log: [
            { texto: "Se inició el reclamo ante la aseguradora del tercero.", fecha: new Date(Date.now() - 2*86400000).toISOString().slice(0,10), ts: Date.now() - 200000 },
            { texto: "Tomé contacto con el asegurado. Nos envió la documentación.", fecha: new Date(Date.now() - 3*86400000).toISOString().slice(0,10), ts: Date.now() - 300000 },
          ],
          _demo: true,
        }]);
      } else {
        setCasos(realCasos);
      }
      setLoading(false);
    };
    loadData();
  }, [session]);

  const casosFiltrados = casos.filter(c => filtro === "todos" || c.estado === filtro);
  const comisionTotal  = casos.filter(c => c.estado === "cobrado").reduce((s, c) => s + (Number(c.monto_comision_pas) || 0), 0);
  const totalCobrado   = casos.filter(c => c.estado === "cobrado").reduce((s, c) => s + (Number(c.monto_cobro_asegurado) || 0), 0);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: T.muted, fontSize: 14 }}>Cargando tus casos...</div>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: T.card, border: "1px solid #ef444444", borderRadius: 16, padding: 32, maxWidth: 380, textAlign: "center" }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
        <div style={{ color: "#ef4444", fontSize: 14, marginBottom: 20 }}>{error}</div>
        <button onClick={onLogout} style={{ background: T.card2, border: `1px solid ${T.border}`, borderRadius: 8, color: T.sub, padding: "8px 18px", cursor: "pointer", fontSize: 13 }}>Cerrar sesión</button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, transition: "background .3s" }}>
      {/* Header */}
      <div style={{ background: T.card, borderBottom: `1px solid ${T.border}`, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10, boxShadow: dark ? "none" : "0 1px 8px #00000010" }}>
        <div>
          <div style={{ fontSize: 10, color: "#6366f1", textTransform: "uppercase", letterSpacing: 2.5, fontWeight: 700 }}>PAS Tracker</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.text, marginTop: 1 }}>{pasInfo?.nombre || "Portal"}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={onToggleDark} title={dark ? "Modo claro" : "Modo oscuro"} style={{ background: T.card2, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 15 }}>
            {dark ? "☀️" : "🌙"}
          </button>
          <button onClick={() => setCambPwd(true)} style={{ background: T.card2, border: `1px solid ${T.border}`, borderRadius: 8, color: T.sub, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>🔒 Contraseña</button>
          <button onClick={onLogout} style={{ background: T.card2, border: `1px solid ${T.border}`, borderRadius: 8, color: T.sub, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Salir</button>
        </div>
      </div>

      <div style={{ maxWidth: 660, margin: "0 auto", padding: "24px 16px" }}>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Casos totales",  value: casos.length, color: "#6366f1" },
            { label: "Cobrados",       value: casos.filter(c => c.estado === "cobrado").length, color: "#22c55e" },
            { label: "En proceso",     value: casos.filter(c => !["cobrado","iniciado","doc_pendiente"].includes(c.estado)).length, color: "#f97316" },
          ].map(s => (
            <div key={s.label} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "18px 12px", textAlign: "center", boxShadow: dark ? "none" : "0 1px 4px #00000008" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 5, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Comisión */}
        {comisionTotal > 0 && (
          <div style={{ background: T.card, border: "1px solid #eab30844", borderRadius: 14, padding: "16px 18px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: dark ? "none" : "0 1px 4px #00000008" }}>
            <div>
              <div style={{ fontSize: 11, color: "#eab308", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Tu comisión total cobrada</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: "#eab308", marginTop: 4 }}>{fmtMoney(comisionTotal)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: T.muted, fontWeight: 500 }}>Asegurados cobrados</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#22c55e", marginTop: 2 }}>{fmtMoney(totalCobrado)}</div>
            </div>
          </div>
        )}

        {/* Filtros — compactos */}
        <div style={{ display: "flex", gap: 5, overflowX: "auto", paddingBottom: 6, marginBottom: 18, scrollbarWidth: "none" }}>
          {[{ key: "todos", label: "Todos", emoji: "📂", color: "#64748b" }, ...ESTADOS_CASO].map(e => {
            const cnt = e.key === "todos" ? casos.length : casos.filter(c => c.estado === e.key).length;
            const active = filtro === e.key;
            return (
              <button key={e.key} onClick={() => setFiltro(e.key)} style={{
                flexShrink: 0,
                display: "flex", alignItems: "center", gap: 4,
                background: active ? e.color + "20" : T.card,
                border: `1px solid ${active ? e.color : T.border}`,
                borderRadius: 8,
                color: active ? e.color : T.muted,
                padding: "5px 10px",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: active ? 700 : 500,
                transition: "all .15s",
                boxShadow: dark ? "none" : "0 1px 3px #00000008",
              }}>
                <span>{e.emoji}</span>
                <span>{e.label}</span>
                {cnt > 0 && <span style={{ background: active ? e.color + "30" : T.card2, color: active ? e.color : T.muted, borderRadius: 10, padding: "0 5px", fontSize: 10, fontWeight: 700 }}>{cnt}</span>}
              </button>
            );
          })}
        </div>

        {/* Casos */}
        {casos.length > 0 && casos[0]?._demo && (
          <div style={{ background: "#6366f118", border: "1px solid #6366f144", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#818cf8" }}>
            👋 Todavía no tenés casos asignados. Este es un ejemplo de cómo se verán.
          </div>
        )}
        {casosFiltrados.length === 0 ? (
          <div style={{ textAlign: "center", padding: "50px 20px" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <div style={{ color: T.muted, fontSize: 15 }}>No hay casos con ese filtro</div>
          </div>
        ) : (
          casosFiltrados
            .sort((a, b) => (b.fecha_derivacion || "").localeCompare(a.fecha_derivacion || ""))
            .map(c => <PortalCasoCard key={c.id} caso={c} dark={dark} />)
        )}
      </div>

      {cambPwd && <CambiarPasswordModal onClose={() => setCambPwd(false)} dark={dark} />}
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────────────────────────
export default function Portal() {
  const [session, setSession] = useState(undefined);
  const [dark, setDark] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) return (
    <div style={{ minHeight: "100vh", background: "#111827", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#64748b", fontSize: 14 }}>Cargando...</div>
    </div>
  );

  if (!session) return <LoginScreen dark={dark} onToggleDark={() => setDark(d => !d)} />;
  return <PortalHome session={session} dark={dark} onToggleDark={() => setDark(d => !d)} onLogout={() => supabase.auth.signOut()} />;
}
