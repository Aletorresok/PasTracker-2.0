import { useState, useEffect, useCallback, useMemo } from "react";
import * as XLSX from "xlsx";
import { supabase } from './supabase.js'

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const RESULTADOS_CONTACTO = [
  { key: "respondio_positivo", label: "Respondió positivo 🟢", color: "#22c55e" },
  { key: "respondio_negativo", label: "Respondió negativo 🔴", color: "#ef4444" },
  { key: "respondio_neutro",   label: "Respondió neutro 🟡",   color: "#eab308" },
  { key: "no_respondio",       label: "No respondió ⬜",        color: "#94a3b8" },
  { key: "numero_incorrecto",  label: "Número incorrecto ❌",   color: "#f97316" },
  { key: "volver_contactar",   label: "Volver a contactar 🔁", color: "#6366f1" },
];

const ESTADOS_CASO = [
  { key: "iniciado",          label: "Iniciado",          color: "#64748b", emoji: "📋" },
  { key: "reclamado",         label: "Reclamado",         color: "#6366f1", emoji: "📨" },
  { key: "con_ofrecimiento",  label: "Con ofrecimiento",  color: "#f97316", emoji: "💬" },
  { key: "en_mediacion",      label: "En mediación",      color: "#eab308", emoji: "⚖️"  },
  { key: "en_juicio",         label: "En juicio",         color: "#ef4444", emoji: "🏛️"  },
  { key: "esperando_pago",    label: "Esperando pago",    color: "#06b6d4", emoji: "🕐" },
  { key: "cobrado",           label: "Cobrado",           color: "#22c55e", emoji: "✅" },
];

// ── HELPERS ───────────────────────────────────────────────────────────────────
const estadoInfo = k => ESTADOS_CASO.find(e => e.key === k) || ESTADOS_CASO[0];

function cleanPhones(tel) {
  const str = String(tel || "");
  const nums = [...new Set(str.match(/\d{6,}/g) || [])];
  return nums.map(n => n.replace(/^0+/, ""));
}
function parsePAS(rows) {
  return rows.map((row, i) => {
    const [nombre, mail, tel, contacto, respuesta, seguimiento] = row;
    if (seguimiento && String(seguimiento).includes("Borrado")) return null;
    const telefonos = cleanPhones(tel);
    return { id: i, nombre: nombre || "", mail: mail || "", telefonos, contacto: contacto || "", respuesta: respuesta || "", seguimiento: seguimiento || "", prioridad: telefonos.length === 1 ? "agendado" : telefonos.length > 1 ? "multi" : "sin_tel" };
  }).filter(Boolean);
}
function primerNombre(nombre) {
  if (!nombre) return "";
  const parts = nombre.trim().split(/\s+/);
  const raw = parts.length >= 2 ? parts[1] : parts[0];
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}
function waLink(phone, nombre) {
  const clean = phone.replace(/\D/g, "");
  const intl = clean.startsWith("54") ? clean : `54${clean}`;
  const n = primerNombre(nombre);
  const msg = `Hola ${n}, cómo estás? Soy Alexis, abogado.\nTrabajo con productores de seguros cuando el asegurado quiere reclamarle a la compañía del tercero.\nTe hago una consulta rápida: cuando un cliente tuyo tiene un choque y quiere reclamar, ¿cómo lo manejás hoy?`;
  return `https://wa.me/${intl}?text=${encodeURIComponent(msg)}`;
}
function fmtDate(iso) { if (!iso) return "—"; return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" }); }
function fmtMoney(n) { if (n === null || n === undefined || n === "") return "—"; return "$" + Number(n).toLocaleString("es-AR"); }
function diasDesde(iso) { if (!iso) return null; return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000); }

// ── STORAGE ───────────────────────────────────────────────────────────────────
async function loadStorage(key) {
  try {
    if (key === 'pas_historial') {
      const { data } = await supabase.from('pas_historial').select('*')
      if (!data) return null
      const result = {}
      data.forEach(row => {
        if (!result[row.pas_id]) result[row.pas_id] = []
        result[row.pas_id].push({ fecha: row.fecha, resultados: row.resultados, nota: row.nota, ts: row.ts })
      })
      return result
    }
    if (key === 'pas_casos') {
      const { data } = await supabase.from('pas_casos').select('*')
      if (!data) return null
      const result = {}
      data.forEach(row => {
        if (!result[row.pas_id]) result[row.pas_id] = []
        result[row.pas_id].push({
          id: row.caso_id, asegurado: row.asegurado, estado: row.estado, nota: row.nota,
          fecha_derivacion: row.fecha_derivacion, fecha_contacto_asegurado: row.fecha_contacto_asegurado,
          fecha_inicio_reclamo: row.fecha_inicio_reclamo, fecha_ultimo_movimiento: row.fecha_ultimo_movimiento,
          monto_ofrecimiento: row.monto_ofrecimiento, monto_cobro_asegurado: row.monto_cobro_asegurado,
          monto_cobro_yo: row.monto_cobro_yo, monto_comision_pas: row.monto_comision_pas,
          recordatorio: row.recordatorio || null, notas_log: row.notas_log || [],
        })
      })
      return result
    }
    if (key === 'pas_derivadores') {
      const { data } = await supabase.from('pas_derivadores').select('*')
      if (!data) return null
      const result = {}
      data.forEach(row => { result[row.pas_id] = row.activo })
      return result
    }
    if (key === 'pas_recordatorios') {
      const { data } = await supabase.from('pas_recordatorios').select('*')
      if (!data) return null
      const result = {}
      data.forEach(row => { result[row.pas_id] = row.fecha_recordatorio })
      return result
    }
    if (key === 'pas_lista') {
      let allData = [];
      let from = 0;
      const CHUNK = 1000;
      while (true) {
        const { data, error } = await supabase.from('pas_lista').select('*').order('pas_id').range(from, from + CHUNK - 1);
        if (error || !data || data.length === 0) break;
        allData = [...allData, ...data];
        if (data.length < CHUNK) break;
        from += CHUNK;
      }
      if (allData.length === 0) return null;
      return allData.map(row => ({
        id: row.pas_id, nombre: row.nombre, mail: row.mail,
        telefonos: row.telefonos || [], contacto: row.contacto,
        respuesta: row.respuesta, seguimiento: row.seguimiento, prioridad: row.prioridad
      }))
    }
  } catch { return null }
}

async function saveStorage(key, val) {
  try {
    if (key === 'pas_historial') {
      await supabase.from('pas_historial').delete().neq('pas_id', -1)
      const rows = []
      Object.entries(val).forEach(([pas_id, contactos]) => {
        contactos.forEach(c => rows.push({ pas_id: Number(pas_id), fecha: c.fecha, resultados: c.resultados, nota: c.nota, ts: c.ts }))
      })
      if (rows.length) await supabase.from('pas_historial').insert(rows)
    }
    if (key === 'pas_casos') {
      await supabase.from('pas_casos').delete().neq('pas_id', -1)
      const rows = []
      Object.entries(val).forEach(([pas_id, casosList]) => {
        casosList.forEach(c => rows.push({
          pas_id: Number(pas_id), caso_id: c.id, asegurado: c.asegurado, estado: c.estado, nota: c.nota,
          fecha_derivacion: c.fecha_derivacion, fecha_contacto_asegurado: c.fecha_contacto_asegurado,
          fecha_inicio_reclamo: c.fecha_inicio_reclamo, fecha_ultimo_movimiento: c.fecha_ultimo_movimiento,
          monto_ofrecimiento: c.monto_ofrecimiento || null, monto_cobro_asegurado: c.monto_cobro_asegurado || null,
          monto_cobro_yo: c.monto_cobro_yo || null, monto_comision_pas: c.monto_comision_pas || null,
          recordatorio: c.recordatorio || null, notas_log: c.notas_log || [],
        }))
      })
      if (rows.length) await supabase.from('pas_casos').insert(rows)
    }
    if (key === 'pas_derivadores') {
      await supabase.from('pas_derivadores').delete().neq('pas_id', -1)
      const rows = Object.entries(val).filter(([, v]) => v).map(([pas_id]) => ({ pas_id: Number(pas_id), activo: true }))
      if (rows.length) await supabase.from('pas_derivadores').insert(rows)
    }
    if (key === 'pas_recordatorios') {
      await supabase.from('pas_recordatorios').delete().neq('pas_id', -1)
      const rows = Object.entries(val).filter(([, v]) => v).map(([pas_id, fecha]) => ({ pas_id: Number(pas_id), fecha_recordatorio: fecha }))
      if (rows.length) await supabase.from('pas_recordatorios').insert(rows)
    }
    if (key === 'pas_lista') {
      await supabase.from('pas_lista').delete().neq('pas_id', -1)
      const rows = val.map(p => ({
        pas_id: p.id, nombre: p.nombre, mail: p.mail,
        telefonos: p.telefonos, contacto: p.contacto,
        respuesta: p.respuesta, seguimiento: p.seguimiento, prioridad: p.prioridad
      }))
      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        await supabase.from('pas_lista').insert(rows.slice(i, i + CHUNK))
      }
    }
  } catch (e) { console.error(e) }
}

// ── SHARED STYLES ─────────────────────────────────────────────────────────────
const IS = { width: "100%", background: "#1e293b", border: "1px solid #2d3f55", borderRadius: 8, color: "#f1f5f9", padding: "8px 12px", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
const IS_LIGHT = { width: "100%", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 8, color: "#1e293b", padding: "8px 12px", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
const LS = { fontSize: 11, color: "#64748b", marginBottom: 5, textTransform: "uppercase", letterSpacing: 1, display: "block" };
const LS_LIGHT = { fontSize: 11, color: "#94a3b8", marginBottom: 5, textTransform: "uppercase", letterSpacing: 1, display: "block" };

// ── BADGE ─────────────────────────────────────────────────────────────────────
function Badge({ color, children, small }) {
  return <span style={{ background: color + "22", color, border: `1px solid ${color}44`, borderRadius: 6, padding: small ? "1px 6px" : "2px 9px", fontSize: small ? 10 : 11, fontWeight: 600, fontFamily: "monospace", whiteSpace: "nowrap" }}>{children}</span>;
}

// ── STAT CARD ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, sub, dark = true }) {
  return (
    <div style={{ background: dark ? "#0f172a" : "#f8fafc", border: `1px solid ${dark ? "#1e293b" : "#e2e8f0"}`, borderRadius: 12, padding: "12px 14px", flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 10, color: dark ? "#475569" : "#94a3b8", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: color || (dark ? "#f1f5f9" : "#1e293b"), lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: dark ? "#64748b" : "#94a3b8", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ── CONTACT MODAL ─────────────────────────────────────────────────────────────
function ContactModal({ pas, onClose, onSave, darkMode }) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [resultados, setResultados] = useState([]);
  const [nota, setNota] = useState("");
  const [recordatorio, setRecordatorio] = useState("");
  const toggle = (key) => setResultados(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  const iStyle = darkMode ? IS : IS_LIGHT;
  const lStyle = darkMode ? LS : LS_LIGHT;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.78)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: darkMode ? "#0f172a" : "#fff", border: `1px solid ${darkMode ? "#334155" : "#e2e8f0"}`, borderRadius: 16, width: "100%", maxWidth: 480, padding: 28, boxShadow: "0 24px 60px #000b" }}>
        <div style={{ marginBottom: 20 }}>
          <span style={lStyle}>Registrar contacto</span>
          <div style={{ fontSize: 20, fontWeight: 700, color: darkMode ? "#f1f5f9" : "#1e293b", marginTop: 4 }}>{pas.nombre || "Sin nombre"}</div>
        </div>

        <label style={{ display: "block", marginBottom: 16 }}>
          <span style={lStyle}>Fecha</span>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={iStyle} />
        </label>

        <div style={{ marginBottom: 16 }}>
          <span style={lStyle}>Resultado — podés seleccionar más de uno</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
            {RESULTADOS_CONTACTO.map(r => {
              const sel = resultados.includes(r.key);
              return (
                <button key={r.key} onClick={() => toggle(r.key)} style={{
                  background: sel ? r.color + "2a" : darkMode ? "#1e293b" : "#f8fafc",
                  border: `2px solid ${sel ? r.color : darkMode ? "#2d3f55" : "#e2e8f0"}`,
                  borderRadius: 9, color: sel ? r.color : darkMode ? "#64748b" : "#94a3b8",
                  padding: "9px 10px", fontSize: 12, cursor: "pointer", textAlign: "left",
                  transition: "all .15s", display: "flex", alignItems: "center", gap: 7,
                }}>
                  <div style={{ width: 14, height: 14, borderRadius: 4, border: `2px solid ${sel ? r.color : "#475569"}`, background: sel ? r.color : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {sel && <div style={{ width: 6, height: 6, borderRadius: 1, background: "#fff" }} />}
                  </div>
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>

        <label style={{ display: "block", marginBottom: 16 }}>
          <span style={lStyle}>Nota (opcional)</span>
          <textarea value={nota} onChange={e => setNota(e.target.value)} rows={2} placeholder="Ej: dijo que me llama la semana que viene..." style={{ ...iStyle, resize: "vertical" }} />
        </label>

        {resultados.includes("volver_contactar") && (
          <label style={{ display: "block", marginBottom: 16 }}>
            <span style={{ ...lStyle, color: "#6366f1" }}>🔁 Recordatorio — ¿cuándo volver a contactar?</span>
            <input type="date" value={recordatorio} onChange={e => setRecordatorio(e.target.value)} style={{ ...iStyle, borderColor: "#6366f188" }} />
          </label>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: darkMode ? "#1e293b" : "#f1f5f9", border: `1px solid ${darkMode ? "#334155" : "#e2e8f0"}`, borderRadius: 10, color: darkMode ? "#94a3b8" : "#64748b", padding: "10px", cursor: "pointer", fontSize: 14 }}>Cancelar</button>
          <button onClick={() => onSave({ fecha, resultados, nota, recordatorio })} style={{ flex: 2, background: "#6366f1", border: "none", borderRadius: 10, color: "white", padding: "10px", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>Guardar ✓</button>
        </div>
      </div>
    </div>
  );
}

// ── CASO MODAL ────────────────────────────────────────────────────────────────
function CasoModal({ pasNombre, casoEdit, onClose, onSave, darkMode }) {
  const blank = { asegurado: "", estado: "iniciado", nota: "", fecha_derivacion: "", fecha_contacto_asegurado: "", fecha_inicio_reclamo: "", fecha_ultimo_movimiento: new Date().toISOString().slice(0, 10), monto_ofrecimiento: "", monto_cobro_asegurado: "", monto_cobro_yo: "", monto_comision_pas: "", recordatorio: "", notas_log: [] };
  const [d, setD] = useState(casoEdit ? { ...blank, ...casoEdit } : blank);
  const [nuevaNota, setNuevaNota] = useState("");
  const set = k => e => setD(p => ({ ...p, [k]: e.target.value }));
  const ei = estadoInfo(d.estado);
  const ok = d.asegurado.trim().length > 0;
  const sugerirComision = () => { if (d.monto_cobro_yo && !d.monto_comision_pas) setD(p => ({ ...p, monto_comision_pas: Math.round(Number(d.monto_cobro_yo) * 0.1) })); };
  const iStyle = darkMode ? IS : IS_LIGHT;
  const lStyle = darkMode ? LS : LS_LIGHT;

  const agregarNota = () => {
    if (!nuevaNota.trim()) return;
    const entry = { texto: nuevaNota.trim(), fecha: new Date().toISOString().slice(0, 10), ts: Date.now() };
    setD(p => ({ ...p, notas_log: [...(p.notas_log || []), entry] }));
    setNuevaNota("");
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 12, overflowY: "auto" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: darkMode ? "#0c1424" : "#fff", border: `1px solid ${darkMode ? "#1e3a5f" : "#e2e8f0"}`, borderRadius: 18, width: "100%", maxWidth: 560, padding: "24px 24px 28px", boxShadow: "0 32px 80px #000d", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, color: "#22c55e", textTransform: "uppercase", letterSpacing: 2, marginBottom: 4 }}>{casoEdit ? "Editar caso" : "Nuevo caso"}</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: darkMode ? "#f1f5f9" : "#1e293b" }}>📁 {pasNombre}</div>
        </div>

        <label style={{ display: "block", marginBottom: 14 }}>
          <span style={lStyle}>Nombre del asegurado *</span>
          <input value={d.asegurado} onChange={set("asegurado")} placeholder="Ej: García Juan" style={iStyle} />
        </label>

        <div style={{ marginBottom: 18 }}>
          <span style={lStyle}>Estado del caso</span>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
            {ESTADOS_CASO.map(e => (
              <button key={e.key} onClick={() => setD(p => ({ ...p, estado: e.key }))} style={{ flexShrink: 0, background: d.estado === e.key ? e.color + "33" : darkMode ? "#1e293b" : "#f8fafc", border: `2px solid ${d.estado === e.key ? e.color : darkMode ? "#2d3f55" : "#e2e8f0"}`, borderRadius: 10, color: d.estado === e.key ? e.color : darkMode ? "#475569" : "#94a3b8", padding: "8px 12px", fontSize: 12, cursor: "pointer", transition: "all .15s", fontWeight: d.estado === e.key ? 700 : 400, textAlign: "center", minWidth: 80 }}>
                <div style={{ fontSize: 18, marginBottom: 3 }}>{e.emoji}</div>
                <div>{e.label}</div>
              </button>
            ))}
          </div>
        </div>

        {["con_ofrecimiento","en_mediacion","en_juicio","esperando_pago","cobrado"].includes(d.estado) && (
          <label style={{ display: "block", marginBottom: 14 }}>
            <span style={lStyle}>Monto ofrecido por la compañía ($)</span>
            <input type="number" value={d.monto_ofrecimiento} onChange={set("monto_ofrecimiento")} placeholder="0" style={{ ...iStyle, borderColor: "#f9741688" }} />
          </label>
        )}

        <div style={{ marginBottom: 6 }}>
          <span style={lStyle}>Fechas del caso</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { k: "fecha_derivacion",          l: "Derivación del PAS" },
              { k: "fecha_contacto_asegurado",  l: "Contacto con asegurado" },
              { k: "fecha_inicio_reclamo",       l: "Inicio del reclamo" },
              { k: "fecha_ultimo_movimiento",    l: "Último movimiento" },
            ].map(f => (
              <label key={f.k}>
                <div style={{ fontSize: 10, color: darkMode ? "#475569" : "#94a3b8", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>{f.l}</div>
                <input type="date" value={d[f.k]} onChange={set(f.k)} style={{ ...iStyle, fontSize: 13, padding: "7px 10px" }} />
              </label>
            ))}
          </div>
        </div>

        <label style={{ display: "block", marginTop: 14, marginBottom: 14 }}>
          <span style={{ ...lStyle, color: "#f97316" }}>⏰ Recordatorio</span>
          <input type="date" value={d.recordatorio || ""} onChange={set("recordatorio")} style={{ ...iStyle, borderColor: "#f9741666" }} />
        </label>

        <div style={{ marginTop: 18, marginBottom: 6 }}>
          <span style={lStyle}>Montos finales</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {[
              { k: "monto_cobro_asegurado", l: "Cobró el asegurado", c: "#22c55e" },
              { k: "monto_cobro_yo",        l: "Cobré yo",           c: "#6366f1" },
              { k: "monto_comision_pas",    l: "Comisión al PAS",    c: "#eab308" },
            ].map(f => (
              <label key={f.k}>
                <div style={{ fontSize: 10, color: f.c + "cc", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>{f.l}</div>
                <input type="number" value={d[f.k]} onChange={set(f.k)} onBlur={f.k === "monto_cobro_yo" ? sugerirComision : undefined} placeholder="$0" style={{ ...iStyle, fontSize: 13, padding: "7px 10px", borderColor: f.c + "44" }} />
              </label>
            ))}
          </div>
          <div style={{ fontSize: 11, color: darkMode ? "#334155" : "#94a3b8", marginTop: 6 }}>💡 Al salir del campo "Cobré yo" se sugiere comisión PAS (10%)</div>
        </div>

        <label style={{ display: "block", marginTop: 16, marginBottom: 14 }}>
          <span style={lStyle}>Nota del caso</span>
          <textarea value={d.nota} onChange={set("nota")} rows={2} placeholder="Compañía, número de siniestro, observaciones..." style={{ ...iStyle, resize: "vertical" }} />
        </label>

        {/* HISTORIAL DE NOTAS */}
        <div style={{ marginBottom: 20 }}>
          <span style={lStyle}>Historial de notas</span>
          {(d.notas_log || []).length > 0 && (
            <div style={{ marginBottom: 10, maxHeight: 140, overflowY: "auto" }}>
              {[...(d.notas_log || [])].reverse().map((n, i) => (
                <div key={i} style={{ background: darkMode ? "#0f172a" : "#f8fafc", border: `1px solid ${darkMode ? "#1e293b" : "#e2e8f0"}`, borderRadius: 8, padding: "8px 10px", marginBottom: 6 }}>
                  <div style={{ fontSize: 10, color: "#64748b", marginBottom: 3 }}>{fmtDate(n.fecha)}</div>
                  <div style={{ fontSize: 13, color: darkMode ? "#cbd5e1" : "#334155" }}>{n.texto}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <input value={nuevaNota} onChange={e => setNuevaNota(e.target.value)} onKeyDown={e => e.key === "Enter" && agregarNota()} placeholder="Agregar nota al historial..." style={{ ...iStyle, flex: 1 }} />
            <button onClick={agregarNota} style={{ background: "#6366f1", border: "none", borderRadius: 8, color: "white", padding: "8px 14px", cursor: "pointer", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>+ Agregar</button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: darkMode ? "#1e293b" : "#f1f5f9", border: `1px solid ${darkMode ? "#334155" : "#e2e8f0"}`, borderRadius: 10, color: darkMode ? "#94a3b8" : "#64748b", padding: "11px", cursor: "pointer", fontSize: 14 }}>Cancelar</button>
          <button onClick={() => { if (ok) onSave({ ...d, id: casoEdit?.id || Date.now() }); }} style={{ flex: 2, background: ok ? ei.color : darkMode ? "#1e293b" : "#f1f5f9", border: "none", borderRadius: 10, color: ok ? "white" : darkMode ? "#475569" : "#94a3b8", padding: "11px", cursor: ok ? "pointer" : "default", fontSize: 14, fontWeight: 700, transition: "all .2s" }}>Guardar caso ✓</button>
        </div>
      </div>
    </div>
  );
}

// ── PIPELINE BAR ──────────────────────────────────────────────────────────────
function PipelineBar({ estado }) {
  const idx = ESTADOS_CASO.findIndex(e => e.key === estado);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, marginBottom: 10 }}>
      {ESTADOS_CASO.map((e, i) => <div key={e.key} title={e.label} style={{ flex: 1, height: 4, borderRadius: 3, background: i <= idx ? e.color : "#1e293b", transition: "background .3s" }} />)}
      <div style={{ marginLeft: 8, fontSize: 11, color: ESTADOS_CASO[idx]?.color || "#94a3b8", fontWeight: 700, whiteSpace: "nowrap" }}>{ESTADOS_CASO[idx]?.emoji} {ESTADOS_CASO[idx]?.label}</div>
    </div>
  );
}

// ── CASO CARD ─────────────────────────────────────────────────────────────────
function CasoCard({ caso, onEdit, onDelete, darkMode }) {
  const [open, setOpen] = useState(false);
  const ei = estadoInfo(caso.estado);
  const diasUlt = diasDesde(caso.fecha_ultimo_movimiento);
  const hoyStr = new Date().toISOString().slice(0, 10);
  const tieneRecordatorio = caso.recordatorio && caso.recordatorio >= hoyStr;
  const recordatorioVencido = caso.recordatorio && caso.recordatorio < hoyStr;

  return (
    <div style={{ background: darkMode ? "#0a0f1e" : "#f8fafc", border: `1px solid ${open ? ei.color + "88" : recordatorioVencido ? "#ef444488" : tieneRecordatorio ? "#f9741688" : darkMode ? "#1a2540" : "#e2e8f0"}`, borderRadius: 10, marginBottom: 8, overflow: "hidden", transition: "border-color .2s" }}>
      <div onClick={() => setOpen(o => !o)} style={{ padding: "12px 14px", cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: darkMode ? "#f1f5f9" : "#1e293b", marginBottom: 8 }}>{caso.asegurado}</div>
            <PipelineBar estado={caso.estado} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {caso.fecha_derivacion && <Badge color="#475569" small>📅 {fmtDate(caso.fecha_derivacion)}</Badge>}
              {diasUlt !== null && <Badge color={diasUlt > 30 ? "#ef4444" : "#64748b"} small>⏱ {diasUlt}d sin mover</Badge>}
              {caso.monto_ofrecimiento && <Badge color="#f97316">Ofrecim.: {fmtMoney(caso.monto_ofrecimiento)}</Badge>}
              {tieneRecordatorio && <Badge color="#f97316">⏰ {fmtDate(caso.recordatorio)}</Badge>}
              {recordatorioVencido && <Badge color="#ef4444">⚠️ Recordatorio vencido</Badge>}
            </div>
            {caso.estado === "cobrado" && (caso.monto_cobro_yo || caso.monto_cobro_asegurado) && (
              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                {caso.monto_cobro_asegurado && <Badge color="#22c55e">Aseg: {fmtMoney(caso.monto_cobro_asegurado)}</Badge>}
                {caso.monto_cobro_yo        && <Badge color="#6366f1">Yo: {fmtMoney(caso.monto_cobro_yo)}</Badge>}
                {caso.monto_comision_pas    && <Badge color="#eab308">PAS: {fmtMoney(caso.monto_comision_pas)}</Badge>}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            <button onClick={e => { e.stopPropagation(); onEdit(caso); }} style={{ background: darkMode ? "#1e293b" : "#e2e8f0", border: `1px solid ${darkMode ? "#2d3f55" : "#cbd5e1"}`, borderRadius: 6, color: "#94a3b8", padding: "4px 8px", cursor: "pointer", fontSize: 12 }}>✏️</button>
            <button onClick={e => { e.stopPropagation(); onDelete(caso.id); }} style={{ background: darkMode ? "#1e293b" : "#e2e8f0", border: `1px solid ${darkMode ? "#2d3f55" : "#cbd5e1"}`, borderRadius: 6, color: "#64748b", padding: "4px 8px", cursor: "pointer", fontSize: 12 }}>🗑</button>
          </div>
        </div>
      </div>
      {open && (
        <div style={{ borderTop: `1px solid ${darkMode ? "#1a2540" : "#e2e8f0"}`, padding: "12px 14px" }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ ...LS, marginBottom: 8 }}>Fechas</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[{ k: "fecha_derivacion", l: "Derivación" }, { k: "fecha_contacto_asegurado", l: "Contacto asegurado" }, { k: "fecha_inicio_reclamo", l: "Inicio reclamo" }, { k: "fecha_ultimo_movimiento", l: "Último movimiento" }]
                .filter(f => caso[f.k])
                .map(f => (
                  <div key={f.k} style={{ background: darkMode ? "#0f172a" : "#f1f5f9", borderRadius: 8, padding: "8px 10px" }}>
                    <div style={{ fontSize: 10, color: "#475569", marginBottom: 2 }}>{f.l}</div>
                    <div style={{ fontSize: 13, color: darkMode ? "#cbd5e1" : "#334155", fontWeight: 600 }}>{fmtDate(caso[f.k])}</div>
                  </div>
                ))}
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ ...LS, marginBottom: 8 }}>Montos</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {[
                { k: "monto_ofrecimiento",     l: "Ofrecimiento",   c: "#f97316" },
                { k: "monto_cobro_asegurado",  l: "Cobró asegurado",c: "#22c55e" },
                { k: "monto_cobro_yo",         l: "Cobré yo",       c: "#6366f1" },
                { k: "monto_comision_pas",     l: "Comisión PAS",   c: "#eab308" },
              ].map(f => (
                <div key={f.k} style={{ background: darkMode ? "#0f172a" : "#f1f5f9", borderRadius: 8, padding: "8px 10px", border: `1px solid ${f.c}22` }}>
                  <div style={{ fontSize: 9, color: f.c + "99", marginBottom: 2 }}>{f.l}</div>
                  <div style={{ fontSize: 13, color: caso[f.k] ? f.c : "#334155", fontWeight: 700 }}>{fmtMoney(caso[f.k] || null)}</div>
                </div>
              ))}
            </div>
          </div>
          {caso.nota && (
            <div style={{ background: darkMode ? "#0f172a" : "#f1f5f9", borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: "#475569", marginBottom: 4 }}>NOTA DEL CASO</div>
              <div style={{ fontSize: 13, color: darkMode ? "#94a3b8" : "#334155", fontStyle: "italic" }}>{caso.nota}</div>
            </div>
          )}
          {(caso.notas_log || []).length > 0 && (
            <div>
              <div style={{ ...LS, marginBottom: 8 }}>Historial de notas</div>
              {[...(caso.notas_log || [])].reverse().map((n, i) => (
                <div key={i} style={{ background: darkMode ? "#0f172a" : "#f1f5f9", border: `1px solid ${darkMode ? "#1e293b" : "#e2e8f0"}`, borderRadius: 8, padding: "8px 10px", marginBottom: 6 }}>
                  <div style={{ fontSize: 10, color: "#64748b", marginBottom: 2 }}>{fmtDate(n.fecha)}</div>
                  <div style={{ fontSize: 13, color: darkMode ? "#cbd5e1" : "#334155" }}>{n.texto}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── PAS CARD ──────────────────────────────────────────────────────────────────
function PASCard({ pas, historial, derivadores, recordatorios, onContactar, onToggleDerivador, expanded, onToggle, darkMode }) {
  const contactos = historial[pas.id] || [];
  const ultimo = contactos[contactos.length - 1];
  const esDerivador = derivadores[pas.id] || false;
  const ultimosResultados = ultimo?.resultados || (ultimo?.resultado ? [ultimo.resultado] : []);
  const hoyStr = new Date().toISOString().slice(0, 10);
  const rec = recordatorios?.[pas.id];
  const recVencido = rec && rec < hoyStr;
  const recHoy = rec && rec === hoyStr;
  const recFuturo = rec && rec > hoyStr;

  return (
    <div style={{ background: esDerivador ? (darkMode ? "#0d1f14" : "#f0fdf4") : (darkMode ? "#0f172a" : "#fff"), border: `1px solid ${expanded ? "#6366f1" : recVencido ? "#ef444488" : recHoy ? "#f9741688" : esDerivador ? "#22c55e44" : darkMode ? "#1e293b" : "#e2e8f0"}`, borderRadius: 12, marginBottom: 8, overflow: "hidden", transition: "all .2s" }}>
      <div style={{ padding: "13px 15px", display: "flex", alignItems: "center", gap: 11 }}>
        <div onClick={() => onToggleDerivador(pas.id)} title="Va a derivar casos" style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${esDerivador ? "#22c55e" : "#334155"}`, background: esDerivador ? "#22c55e" : "transparent", flexShrink: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .15s" }}>
          {esDerivador && <span style={{ color: "white", fontSize: 12, fontWeight: 900, lineHeight: 1 }}>✓</span>}
        </div>
        <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: !contactos.length ? "#334155" : ultimosResultados.length ? (RESULTADOS_CONTACTO.find(r => r.key === ultimosResultados[0])?.color || "#94a3b8") : "#94a3b8" }} />
        <div onClick={onToggle} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: darkMode ? "#f1f5f9" : "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {pas.nombre || <span style={{ color: "#475569" }}>Sin nombre</span>}
            {esDerivador && <span style={{ marginLeft: 7, fontSize: 11, color: "#22c55e", fontWeight: 700 }}>🤝 derivador</span>}
            {recHoy && <span style={{ marginLeft: 7, fontSize: 11, color: "#f97316", fontWeight: 700 }}>⏰ hoy!</span>}
            {recVencido && <span style={{ marginLeft: 7, fontSize: 11, color: "#ef4444", fontWeight: 700 }}>⚠️ pendiente</span>}
          </div>
          <div style={{ fontSize: 12, color: "#475569", marginTop: 1 }}>
            {pas.prioridad === "agendado" ? `📱 ${pas.telefonos[0]}` : pas.prioridad === "multi" ? `📱 ${pas.telefonos.length} números` : "Sin teléfono"}
            {contactos.length > 0 && <span style={{ marginLeft: 8, color: "#334155" }}>· {contactos.length} contacto{contactos.length > 1 ? "s" : ""}</span>}
            {recFuturo && <span style={{ marginLeft: 8, color: "#f97316" }}>· rec. {fmtDate(rec)}</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 5, alignItems: "center", flexShrink: 0 }}>
          {ultimosResultados.slice(0, 2).map(k => {
            const ri = RESULTADOS_CONTACTO.find(r => r.key === k);
            return ri ? <Badge key={k} color={ri.color} small>{fmtDate(ultimo.fecha)}</Badge> : null;
          })}
          {pas.prioridad === "agendado" && (
            <a href={waLink(pas.telefonos[0], pas.nombre)} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
              style={{ background: "#25d366", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", fontSize: 16 }}>💬</a>
          )}
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: `1px solid ${darkMode ? "#1e293b" : "#e2e8f0"}`, padding: "13px 15px" }}>
          <div onClick={() => onToggleDerivador(pas.id)} style={{ display: "flex", alignItems: "center", gap: 10, background: esDerivador ? "#22c55e18" : darkMode ? "#1e293b" : "#f8fafc", border: `1px solid ${esDerivador ? "#22c55e44" : darkMode ? "#2d3f55" : "#e2e8f0"}`, borderRadius: 10, padding: "10px 14px", marginBottom: 13, cursor: "pointer", transition: "all .2s" }}>
            <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${esDerivador ? "#22c55e" : "#475569"}`, background: esDerivador ? "#22c55e" : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {esDerivador && <span style={{ color: "white", fontSize: 12, fontWeight: 900 }}>✓</span>}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: esDerivador ? "#22c55e" : "#94a3b8" }}>Va a derivar casos</div>
              <div style={{ fontSize: 11, color: "#475569", marginTop: 1 }}>Aparece en la pestaña Clientes</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 13 }}>
            {pas.mail && <div><span style={LS}>Mail</span><div style={{ fontSize: 12, color: darkMode ? "#94a3b8" : "#475569", wordBreak: "break-all" }}>{pas.mail}</div></div>}
            {pas.telefonos.length > 0 && (
              <div>
                <span style={LS}>Teléfonos</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
                  {pas.telefonos.map(t => <a key={t} href={waLink(t, pas.nombre)} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#25d366", textDecoration: "none", background: "#25d36622", borderRadius: 6, padding: "2px 8px" }}>{t}</a>)}
                </div>
              </div>
            )}
            {pas.respuesta && <div style={{ gridColumn: "1/-1" }}><span style={LS}>Respuesta anterior</span><div style={{ fontSize: 12, color: darkMode ? "#cbd5e1" : "#334155" }}>{pas.respuesta}</div></div>}
          </div>

          {contactos.length > 0 && (
            <div style={{ marginBottom: 13 }}>
              <span style={LS}>Historial de contactos</span>
              {contactos.map((c, i) => {
                const keys = c.resultados || (c.resultado ? [c.resultado] : []);
                return (
                  <div key={i} style={{ display: "flex", gap: 10, paddingBottom: 8, borderBottom: i < contactos.length - 1 ? `1px solid ${darkMode ? "#1e293b" : "#e2e8f0"}` : "none", marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: "#64748b", whiteSpace: "nowrap", marginTop: 2 }}>{fmtDate(c.fecha)}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: c.nota ? 4 : 0 }}>
                        {keys.map(k => { const ri = RESULTADOS_CONTACTO.find(r => r.key === k); return ri ? <Badge key={k} color={ri.color}>{ri.label}</Badge> : null; })}
                        {!keys.length && <Badge color="#94a3b8">Sin resultado</Badge>}
                      </div>
                      {c.nota && <div style={{ fontSize: 12, color: darkMode ? "#94a3b8" : "#475569" }}>{c.nota}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <button onClick={() => onContactar(pas)} style={{ width: "100%", background: "#6366f1", border: "none", borderRadius: 10, color: "white", padding: "10px", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>+ Registrar contacto</button>
        </div>
      )}
    </div>
  );
}

// ── CLIENTE CARD ──────────────────────────────────────────────────────────────
function ClienteCard({ pas, casos, onAddCaso, onEditCaso, onDeleteCaso, expanded, onToggle, darkMode, filtroEstado }) {
  const casosFiltrados = filtroEstado && filtroEstado !== "todos" ? casos.filter(c => c.estado === filtroEstado) : casos;
  const cobradoYo  = casos.reduce((s, c) => s + (Number(c.monto_cobro_yo) || 0), 0);
  const pendiente  = casos.filter(c => c.estado === "esperando_pago").reduce((s, c) => s + (Number(c.monto_cobro_yo) || 0), 0);
  const activos    = casos.filter(c => c.estado !== "cobrado").length;
  return (
    <div style={{ background: darkMode ? "#0f172a" : "#fff", border: `1px solid ${expanded ? "#22c55e77" : darkMode ? "#1e293b" : "#e2e8f0"}`, borderRadius: 13, marginBottom: 10, overflow: "hidden", transition: "border-color .2s" }}>
      <div onClick={onToggle} style={{ padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: "#22c55e18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🤝</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: darkMode ? "#f1f5f9" : "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pas.nombre || "Sin nombre"}</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
            {casos.length} caso{casos.length !== 1 ? "s" : ""}
            {activos > 0 && <span style={{ color: "#818cf8", marginLeft: 8 }}>· {activos} activo{activos > 1 ? "s" : ""}</span>}
            {casos.length === 0 && <span style={{ color: "#334155" }}> · sin casos aún</span>}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          {cobradoYo > 0 && <div style={{ fontSize: 15, fontWeight: 800, color: "#6366f1" }}>{fmtMoney(cobradoYo)}</div>}
          {pendiente > 0 && <div style={{ fontSize: 11, color: "#06b6d4", marginTop: 1 }}>{fmtMoney(pendiente)} pend.</div>}
        </div>
      </div>
      {expanded && (
        <div style={{ borderTop: `1px solid ${darkMode ? "#1e293b" : "#e2e8f0"}`, padding: "14px 16px" }}>
          {casos.length > 0 && (
            <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
              {ESTADOS_CASO.map(e => { const cnt = casos.filter(c => c.estado === e.key).length; if (!cnt) return null; return <div key={e.key} style={{ background: e.color + "18", border: `1px solid ${e.color}44`, borderRadius: 8, padding: "5px 12px", textAlign: "center" }}><div style={{ fontSize: 15, fontWeight: 800, color: e.color }}>{cnt}</div><div style={{ fontSize: 10, color: e.color + "aa" }}>{e.label}</div></div>; })}
            </div>
          )}
          {casos.length === 0 && <div style={{ textAlign: "center", padding: "10px 0 14px", color: "#334155", fontSize: 13 }}>Sin casos registrados aún</div>}
          {casosFiltrados.map(c => <CasoCard key={c.id} caso={c} onEdit={onEditCaso} onDelete={onDeleteCaso} darkMode={darkMode} />)}
          {filtroEstado && filtroEstado !== "todos" && casosFiltrados.length === 0 && casos.length > 0 && (
            <div style={{ textAlign: "center", padding: "10px 0 14px", color: "#475569", fontSize: 13 }}>Sin casos en este estado</div>
          )}
          <button onClick={onAddCaso} style={{ width: "100%", background: "#22c55e14", border: "1px dashed #22c55e44", borderRadius: 10, color: "#22c55e", padding: "10px", cursor: "pointer", fontSize: 14, fontWeight: 700, marginTop: 4 }}>+ Agregar caso</button>
        </div>
      )}
    </div>
  );
}

// ── TAB CLIENTES ──────────────────────────────────────────────────────────────
function TabClientes({ pas, casos, derivadores, onSaveCasos, darkMode }) {
  const [modalPas, setModalPas] = useState(null);
  const [casoEdit, setCasoEdit]  = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [busqueda, setBusqueda]  = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");

  const clientes = useMemo(() => pas.filter(p => derivadores[p.id]), [pas, derivadores]);

  const filtered = useMemo(() => {
    if (!busqueda.trim()) return clientes;
    const q = busqueda.toLowerCase();
    return clientes.filter(p => p.nombre.toLowerCase().includes(q) || p.mail.toLowerCase().includes(q));
  }, [clientes, busqueda]);

  const allCasos = useMemo(() => Object.values(casos).flat(), [casos]);
  const totalCobradoYo     = allCasos.reduce((s, c) => s + (Number(c.monto_cobro_yo) || 0), 0);
  const totalComisionesPAS = allCasos.reduce((s, c) => s + (Number(c.monto_comision_pas) || 0), 0);
  const totalPendiente     = allCasos.filter(c => c.estado === "esperando_pago").reduce((s, c) => s + (Number(c.monto_cobro_yo) || 0), 0);
  const enGestion          = allCasos.filter(c => c.estado !== "cobrado").length;
  const cobradosCasos      = allCasos.filter(c => c.estado === "cobrado" && c.fecha_derivacion);
  const promCierre         = cobradosCasos.length ? Math.round(cobradosCasos.reduce((s, c) => s + diasDesde(c.fecha_derivacion), 0) / cobradosCasos.length) : null;

  const handleSave = (pasId, casoData) => {
    const cur = casos[pasId] || [];
    const idx = cur.findIndex(c => c.id === casoData.id);
    onSaveCasos(pasId, idx >= 0 ? cur.map(c => c.id === casoData.id ? casoData : c) : [...cur, casoData]);
    setModalPas(null); setCasoEdit(null);
  };

  const exportarExcel = () => {
    const rows = [];
    clientes.forEach(p => {
      const casosPas = casos[p.id] || [];
      if (casosPas.length === 0) {
        rows.push({ PAS: p.nombre, Mail: p.mail, Asegurado: "", Estado: "", "Fecha derivación": "", "Monto ofrecimiento": "", "Cobré yo": "", "Cobró asegurado": "", "Comisión PAS": "", Nota: "" });
      } else {
        casosPas.forEach(c => {
          rows.push({ PAS: p.nombre, Mail: p.mail, Asegurado: c.asegurado, Estado: estadoInfo(c.estado).label, "Fecha derivación": c.fecha_derivacion || "", "Monto ofrecimiento": c.monto_ofrecimiento || "", "Cobré yo": c.monto_cobro_yo || "", "Cobró asegurado": c.monto_cobro_asegurado || "", "Comisión PAS": c.monto_comision_pas || "", Nota: c.nota || "" });
        });
      }
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Casos");
    XLSX.writeFile(wb, `pastracker_casos_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const iStyle = darkMode ? { ...IS, background: "#0f172a", border: "1px solid #1e293b" } : { ...IS_LIGHT };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        <StatCard label="Cobré yo (total)" value={fmtMoney(totalCobradoYo)} color="#6366f1" dark={darkMode} />
        <StatCard label="Esperando cobro"  value={fmtMoney(totalPendiente)}  color="#06b6d4" dark={darkMode} />
        <StatCard label="Comisiones PAS"   value={fmtMoney(totalComisionesPAS)} color="#eab308" dark={darkMode} />
        <StatCard label="Casos activos"    value={enGestion} color="#f97316" sub={promCierre ? `Prom. cierre: ${promCierre}d` : "Sin cobros aún"} dark={darkMode} />
      </div>

      <div style={{ background: darkMode ? "#0f172a" : "#f8fafc", border: `1px solid ${darkMode ? "#1e293b" : "#e2e8f0"}`, borderRadius: 12, padding: "12px 14px", marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>Pipeline total</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {ESTADOS_CASO.map(e => { const cnt = allCasos.filter(c => c.estado === e.key).length; return <div key={e.key} style={{ flex: 1, minWidth: 58, background: cnt > 0 ? e.color + "18" : darkMode ? "#0a0f1e" : "#fff", border: `1px solid ${cnt > 0 ? e.color + "44" : darkMode ? "#1e293b" : "#e2e8f0"}`, borderRadius: 8, padding: "8px 6px", textAlign: "center" }}><div style={{ fontSize: 16 }}>{e.emoji}</div><div style={{ fontSize: 16, fontWeight: 800, color: cnt > 0 ? e.color : "#334155" }}>{cnt}</div><div style={{ fontSize: 9, color: cnt > 0 ? e.color + "99" : "#334155", marginTop: 1, lineHeight: 1.2 }}>{e.label}</div></div>; })}
        </div>
      </div>

      {/* Filtro por estado + buscador + exportar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="🔍  Buscar entre tus clientes PAS..."
          style={{ ...iStyle, flex: 1, minWidth: 180 }} />
        <button onClick={exportarExcel} style={{ background: "#22c55e22", border: "1px solid #22c55e44", borderRadius: 8, color: "#22c55e", padding: "8px 14px", cursor: "pointer", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>⬇ Exportar Excel</button>
      </div>

      {/* Filtro pipeline */}
      <div style={{ display: "flex", gap: 5, overflowX: "auto", paddingBottom: 4, marginBottom: 14 }}>
        {[{ key: "todos", label: "Todos", color: "#64748b" }, ...ESTADOS_CASO].map(e => (
          <button key={e.key} onClick={() => setFiltroEstado(e.key)} style={{ flexShrink: 0, padding: "5px 11px", borderRadius: 20, border: "1px solid", borderColor: filtroEstado === e.key ? e.color : darkMode ? "#1e293b" : "#e2e8f0", background: filtroEstado === e.key ? e.color + "22" : darkMode ? "#0a0f1e" : "#f8fafc", color: filtroEstado === e.key ? e.color : "#475569", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
            {e.emoji ? `${e.emoji} ` : ""}{e.label}
          </button>
        ))}
      </div>

      {clientes.length === 0 && (
        <div style={{ textAlign: "center", padding: "44px 16px", background: darkMode ? "#0f172a" : "#f8fafc", borderRadius: 12, border: `1px dashed ${darkMode ? "#1e293b" : "#e2e8f0"}` }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>☑️</div>
          <div style={{ fontSize: 15, color: "#475569", fontWeight: 600 }}>Todavía no tenés PAS marcados como derivadores</div>
          <div style={{ fontSize: 13, color: "#334155", marginTop: 8, lineHeight: 1.6 }}>
            Andá a la pestaña <strong style={{ color: "#818cf8" }}>Contactos</strong>, buscá el PAS que te dijo que sí,<br />
            y tildá la casilla <strong style={{ color: "#22c55e" }}>☑ Va a derivar casos</strong> que aparece a la izquierda del nombre.
          </div>
        </div>
      )}

      {filtered.map(p => (
        <ClienteCard key={p.id} pas={p} casos={casos[p.id] || []}
          onAddCaso={() => { setModalPas(p); setCasoEdit(null); }}
          onEditCaso={c => { setModalPas(p); setCasoEdit(c); }}
          onDeleteCaso={cid => onSaveCasos(p.id, (casos[p.id] || []).filter(c => c.id !== cid))}
          expanded={expandedId === p.id}
          onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
          darkMode={darkMode}
          filtroEstado={filtroEstado} />
      ))}

      {modalPas && (
        <CasoModal pasNombre={modalPas.nombre} casoEdit={casoEdit} darkMode={darkMode}
          onClose={() => { setModalPas(null); setCasoEdit(null); }}
          onSave={data => handleSave(modalPas.id, data)} />
      )}
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function TabDashboard({ pas, historial, casos, derivadores, recordatorios, darkMode }) {
  const allCasos = useMemo(() => Object.values(casos).flat(), [casos]);
  const totalCobradoYo     = allCasos.reduce((s, c) => s + (Number(c.monto_cobro_yo) || 0), 0);
  const totalComisionesPAS = allCasos.reduce((s, c) => s + (Number(c.monto_comision_pas) || 0), 0);
  const totalPendiente     = allCasos.filter(c => c.estado === "esperando_pago").reduce((s, c) => s + (Number(c.monto_cobro_yo) || 0), 0);
  const enGestion          = allCasos.filter(c => c.estado !== "cobrado").length;
  const cobrados           = allCasos.filter(c => c.estado === "cobrado").length;
  const nDerivadores       = Object.values(derivadores).filter(Boolean).length;
  const contactados        = pas.filter(p => (historial[p.id] || []).length > 0).length;
  const positivos          = pas.filter(p => (historial[p.id] || []).some(c => (c.resultados || [c.resultado]).includes("respondio_positivo"))).length;

  const hoyStr = new Date().toISOString().slice(0, 10);

  // Recordatorios de contactos PAS vencidos o para hoy
  const recsPAS = pas.filter(p => {
    const r = recordatorios?.[p.id];
    return r && r <= hoyStr;
  });

  // Recordatorios de casos vencidos o para hoy
  const recsCasos = [];
  Object.entries(casos).forEach(([pasId, casosList]) => {
    const pasObj = pas.find(p => p.id === Number(pasId));
    casosList.forEach(c => {
      if (c.recordatorio && c.recordatorio <= hoyStr) {
        recsCasos.push({ ...c, pasNombre: pasObj?.nombre || "PAS desconocido" });
      }
    });
  });

  const cardBg = darkMode ? "#0f172a" : "#f8fafc";
  const cardBorder = darkMode ? "#1e293b" : "#e2e8f0";
  const textColor = darkMode ? "#f1f5f9" : "#1e293b";
  const subColor = darkMode ? "#64748b" : "#94a3b8";

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: subColor, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>Resumen general</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
        <StatCard label="Total cobrado" value={fmtMoney(totalCobradoYo)} color="#6366f1" dark={darkMode} />
        <StatCard label="En pipeline" value={fmtMoney(totalPendiente)} color="#06b6d4" sub="esperando cobro" dark={darkMode} />
        <StatCard label="Comisiones PAS" value={fmtMoney(totalComisionesPAS)} color="#eab308" dark={darkMode} />
        <StatCard label="Casos cobrados" value={cobrados} color="#22c55e" sub={`${enGestion} en gestión`} dark={darkMode} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
        <StatCard label="PAS contactados" value={contactados} color="#6366f1" sub={`de ${pas.length} totales`} dark={darkMode} />
        <StatCard label="PAS positivos" value={positivos} color="#22c55e" dark={darkMode} />
        <StatCard label="Derivadores" value={nDerivadores} color="#eab308" dark={darkMode} />
      </div>

      {/* Pipeline visual */}
      <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 12, padding: "14px", marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: subColor, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>Estado del pipeline</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {ESTADOS_CASO.map(e => { const cnt = allCasos.filter(c => c.estado === e.key).length; return <div key={e.key} style={{ flex: 1, minWidth: 70, background: cnt > 0 ? e.color + "18" : darkMode ? "#0a0f1e" : "#fff", border: `1px solid ${cnt > 0 ? e.color + "44" : cardBorder}`, borderRadius: 10, padding: "10px 6px", textAlign: "center" }}><div style={{ fontSize: 20, marginBottom: 4 }}>{e.emoji}</div><div style={{ fontSize: 22, fontWeight: 800, color: cnt > 0 ? e.color : "#334155" }}>{cnt}</div><div style={{ fontSize: 10, color: cnt > 0 ? e.color + "99" : "#334155", marginTop: 2, lineHeight: 1.2 }}>{e.label}</div></div>; })}
        </div>
      </div>

      {/* Recordatorios */}
      {(recsPAS.length > 0 || recsCasos.length > 0) && (
        <div style={{ background: "#f9741611", border: "1px solid #f9741644", borderRadius: 12, padding: "14px", marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "#f97316", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12, fontWeight: 700 }}>⏰ Recordatorios pendientes</div>
          {recsPAS.map(p => (
            <div key={p.id} style={{ background: darkMode ? "#0f172a" : "#fff", border: "1px solid #f9741633", borderRadius: 8, padding: "10px 12px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: textColor }}>{p.nombre}</div>
                <div style={{ fontSize: 11, color: subColor, marginTop: 2 }}>Contacto PAS · {fmtDate(recordatorios[p.id])}</div>
              </div>
              <Badge color="#f97316">{recordatorios[p.id] === hoyStr ? "Hoy" : "Vencido"}</Badge>
            </div>
          ))}
          {recsCasos.map(c => (
            <div key={c.id} style={{ background: darkMode ? "#0f172a" : "#fff", border: "1px solid #f9741633", borderRadius: 8, padding: "10px 12px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: textColor }}>{c.asegurado}</div>
                <div style={{ fontSize: 11, color: subColor, marginTop: 2 }}>Caso de {c.pasNombre} · {fmtDate(c.recordatorio)}</div>
              </div>
              <Badge color="#f97316">{c.recordatorio === hoyStr ? "Hoy" : "Vencido"}</Badge>
            </div>
          ))}
        </div>
      )}

      {recsPAS.length === 0 && recsCasos.length === 0 && (
        <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 12, padding: "16px 14px", textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
          <div style={{ fontSize: 14, color: subColor }}>Sin recordatorios pendientes por hoy</div>
        </div>
      )}
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [pas, setPas]               = useState([]);
  const [historial, setHistorial]   = useState({});
  const [casos, setCasos]           = useState({});
  const [derivadores, setDerivadores] = useState({});
  const [recordatorios, setRecordatorios] = useState({});
  const [loading, setLoading]       = useState(false);
  const [mainTab, setMainTab]       = useState("dashboard");
  const [vista, setVista]           = useState("agendado");
  const [busqueda, setBusqueda]     = useState("");
  const [filtroResp, setFiltroResp] = useState("todos");
  const [modalPas, setModalPas]     = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [page, setPage]             = useState(0);
  const [darkMode, setDarkMode]     = useState(true);
  const PER_PAGE = 40;

  useEffect(() => {
    loadStorage("pas_lista").then(l => l && setPas(l));
    loadStorage("pas_historial").then(h => h && setHistorial(h));
    loadStorage("pas_casos").then(c => c && setCasos(c));
    loadStorage("pas_derivadores").then(d => d && setDerivadores(d));
    loadStorage("pas_recordatorios").then(r => r && setRecordatorios(r));
  }, []);

  const handleFile = useCallback(e => {
    const file = e.target.files[0]; if (!file) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async ev => {
      const wb = XLSX.read(ev.target.result, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }).slice(1);
      const lista = parsePAS(rows);
      setPas(lista);
      await saveStorage("pas_lista", lista);
      setLoading(false);
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleSaveContacto = useCallback(async ({ fecha, resultados, nota, recordatorio }) => {
    const entry = { fecha, resultados, nota, ts: Date.now() };
    const updated = { ...historial, [modalPas.id]: [...(historial[modalPas.id] || []), entry] };
    setHistorial(updated); await saveStorage("pas_historial", updated);

    if (recordatorio && resultados.includes("volver_contactar")) {
      const updatedRec = { ...recordatorios, [modalPas.id]: recordatorio };
      setRecordatorios(updatedRec); await saveStorage("pas_recordatorios", updatedRec);
    }
    setModalPas(null);
  }, [historial, modalPas, recordatorios]);

  const handleSaveCasos = useCallback(async (pasId, list) => {
    const updated = { ...casos, [pasId]: list };
    setCasos(updated); await saveStorage("pas_casos", updated);
  }, [casos]);

  const handleToggleDerivador = useCallback(async (pasId) => {
    const updated = { ...derivadores, [pasId]: !derivadores[pasId] };
    setDerivadores(updated); await saveStorage("pas_derivadores", updated);
  }, [derivadores]);

  const handleBackup = useCallback(() => {
    const backup = {
      version: 1,
      fecha: new Date().toISOString(),
      historial,
      casos,
      derivadores,
      recordatorios,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pastracker_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [historial, casos, derivadores, recordatorios]);

  const handleRestore = useCallback(async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const text = await file.text();
    try {
      const backup = JSON.parse(text);
      if (!backup.version) throw new Error("Archivo inválido");
      if (!window.confirm(`¿Restaurar backup del ${new Date(backup.fecha).toLocaleDateString("es-AR")}? Se sobreescribirán los datos actuales.`)) return;
      if (backup.historial)    { setHistorial(backup.historial);       await saveStorage("pas_historial", backup.historial); }
      if (backup.casos)        { setCasos(backup.casos);               await saveStorage("pas_casos", backup.casos); }
      if (backup.derivadores)  { setDerivadores(backup.derivadores);   await saveStorage("pas_derivadores", backup.derivadores); }
      if (backup.recordatorios){ setRecordatorios(backup.recordatorios); await saveStorage("pas_recordatorios", backup.recordatorios); }
      alert("✅ Backup restaurado correctamente");
    } catch {
      alert("❌ El archivo no es un backup válido de PAS Tracker");
    }
    e.target.value = "";
  }, []);

  const filtered = useMemo(() => {
    let list = pas.filter(p => p.prioridad === vista || vista === "todos");
    if (busqueda.trim()) { const q = busqueda.toLowerCase(); list = list.filter(p => p.nombre.toLowerCase().includes(q) || p.mail.toLowerCase().includes(q) || p.telefonos.join(" ").includes(q)); }
    if (filtroResp === "sin_contactar") list = list.filter(p => !(historial[p.id] || []).length);
    else if (filtroResp === "positivo") list = list.filter(p => (historial[p.id] || []).some(c => (c.resultados || [c.resultado]).includes("respondio_positivo")));
    else if (filtroResp === "volver")   list = list.filter(p => (historial[p.id] || []).some(c => (c.resultados || [c.resultado]).includes("volver_contactar")));
    else if (filtroResp === "negativo") list = list.filter(p => (historial[p.id] || []).some(c => (c.resultados || [c.resultado]).includes("respondio_negativo")));
    else if (filtroResp === "derivadores") list = list.filter(p => derivadores[p.id]);
    return list;
  }, [pas, vista, busqueda, filtroResp, historial, derivadores]);

  const paginated  = useMemo(() => filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE), [filtered, page]);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const nDerivadores = useMemo(() => Object.values(derivadores).filter(Boolean).length, [derivadores]);
  const stats = useMemo(() => ({
    contactados: pas.filter(p => (historial[p.id] || []).length > 0).length,
    positivos:   pas.filter(p => (historial[p.id] || []).some(c => (c.resultados || [c.resultado]).includes("respondio_positivo"))).length,
    derivadores: nDerivadores,
  }), [pas, historial, nDerivadores]);

  const VISTAS_C = [
    { key: "agendado", label: "Agendados",  color: "#6366f1" },
    { key: "multi",    label: "Múltiples #", color: "#f97316" },
    { key: "sin_tel",  label: "Sin tel",     color: "#64748b" },
    { key: "todos",    label: "Todos",        color: "#22c55e" },
  ];

  // Recordatorios urgentes para badge en dashboard
  const hoyStr = new Date().toISOString().slice(0, 10);
  const recUrgentes = pas.filter(p => recordatorios?.[p.id] && recordatorios[p.id] <= hoyStr).length
    + Object.values(casos).flat().filter(c => c.recordatorio && c.recordatorio <= hoyStr).length;

  const bg = darkMode ? "#020617" : "#f1f5f9";
  const headerBg = darkMode ? "#060d1a" : "#fff";
  const headerBorder = darkMode ? "#0f1f36" : "#e2e8f0";
  const textColor = darkMode ? "#f1f5f9" : "#1e293b";
  const subColor = darkMode ? "#475569" : "#94a3b8";
  const iStyle = darkMode ? IS : IS_LIGHT;

  const TABS = [
    { k: "dashboard", l: `📊 Dashboard${recUrgentes > 0 ? ` (${recUrgentes})` : ""}` },
    { k: "contactos", l: "📋 Contactos" },
    { k: "clientes",  l: `🤝 Clientes${nDerivadores > 0 ? ` (${nDerivadores})` : ""}` },
  ];

  return (
    <div style={{ minHeight: "100vh", background: bg, color: textColor, fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>

      <div style={{ background: headerBg, borderBottom: `1px solid ${headerBorder}`, padding: "13px 18px", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: "#6366f1", letterSpacing: 3, textTransform: "uppercase", fontWeight: 700 }}>PAS Tracker</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: textColor, letterSpacing: -0.5 }}>Seguimiento de Contactos</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              {pas.length > 0 && (
                <div style={{ display: "flex", gap: 14, textAlign: "right" }}>
                  {[{ v: stats.contactados, l: "contactados", c: "#6366f1" }, { v: stats.positivos, l: "positivos", c: "#22c55e" }, { v: stats.derivadores, l: "derivadores", c: "#eab308" }].map(s => (
                    <div key={s.l}><div style={{ fontSize: 18, fontWeight: 800, color: s.c }}>{s.v}</div><div style={{ fontSize: 10, color: subColor }}>{s.l}</div></div>
                  ))}
                </div>
              )}
              {/* Dark/Light toggle */}
              <button onClick={() => setDarkMode(d => !d)} title={darkMode ? "Modo claro" : "Modo oscuro"} style={{ background: darkMode ? "#1e293b" : "#e2e8f0", border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 16 }}>
                {darkMode ? "☀️" : "🌙"}
              </button>
              {/* Backup */}
              <button onClick={handleBackup} title="Descargar backup" style={{ background: darkMode ? "#1e293b" : "#e2e8f0", border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 16 }}>💾</button>
              {/* Restore */}
              <label title="Restaurar backup" style={{ background: darkMode ? "#1e293b" : "#e2e8f0", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 16 }}>
                📂
                <input type="file" accept=".json" onChange={handleRestore} style={{ display: "none" }} />
              </label>
            </div>
          </div>

          <div style={{ display: "flex", gap: 4, marginBottom: pas.length > 0 ? 12 : 0 }}>
            {TABS.map(t => (
              <button key={t.k} onClick={() => setMainTab(t.k)} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1px solid", borderColor: mainTab === t.k ? "#6366f1" : darkMode ? "#1e293b" : "#e2e8f0", background: mainTab === t.k ? "#6366f133" : darkMode ? "#0a0f1e" : "#f8fafc", color: mainTab === t.k ? "#818cf8" : subColor, fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all .15s" }}>{t.l}</button>
            ))}
          </div>

          {pas.length === 0 && (
            <label style={{ display: "flex", flexDirection: "column", alignItems: "center", border: `2px dashed ${darkMode ? "#1e3a5f" : "#cbd5e1"}`, borderRadius: 12, padding: "22px 16px", cursor: "pointer", gap: 8, marginTop: 12 }}>
              <div style={{ fontSize: 28 }}>📂</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#94a3b8" }}>Cargar listado_productores.xlsx</div>
              <div style={{ fontSize: 12, color: "#475569" }}>Hacé clic o arrastrá el archivo</div>
              <input type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display: "none" }} />
            </label>
          )}

          {pas.length > 0 && mainTab === "contactos" && (
            <>
              <div style={{ display: "flex", gap: 5, marginBottom: 10 }}>
                {VISTAS_C.map(v => (
                  <button key={v.key} onClick={() => { setVista(v.key); setPage(0); setBusqueda(""); }} style={{ flex: 1, padding: "6px 4px", borderRadius: 8, border: "1px solid", borderColor: vista === v.key ? v.color : darkMode ? "#1e293b" : "#e2e8f0", background: vista === v.key ? v.color + "22" : darkMode ? "#0a0f1e" : "#f8fafc", color: vista === v.key ? v.color : subColor, fontSize: 10, fontWeight: 700, cursor: "pointer", transition: "all .15s" }}>
                    {v.label}<br /><span style={{ fontSize: 13, fontWeight: 800 }}>{pas.filter(p => v.key === "todos" || p.prioridad === v.key).length.toLocaleString("es-AR")}</span>
                  </button>
                ))}
              </div>
              <input value={busqueda} onChange={e => { setBusqueda(e.target.value); setPage(0); }} placeholder="🔍  Buscar por nombre, mail o teléfono..."
                style={{ ...iStyle, marginBottom: 8 }} />
              <div style={{ display: "flex", gap: 5, overflowX: "auto", paddingBottom: 2 }}>
                {[{ k: "todos", l: "Todos" }, { k: "sin_contactar", l: "Sin contactar" }, { k: "positivo", l: "🟢 Positivos" }, { k: "volver", l: "🔁 Volver" }, { k: "negativo", l: "🔴 Negativos" }, { k: "derivadores", l: `☑️ Derivadores` }].map(f => (
                  <button key={f.k} onClick={() => { setFiltroResp(f.k); setPage(0); }} style={{ padding: "5px 11px", borderRadius: 20, border: "1px solid", borderColor: filtroResp === f.k ? "#6366f1" : darkMode ? "#1e293b" : "#e2e8f0", background: filtroResp === f.k ? "#6366f122" : darkMode ? "#0a0f1e" : "#f8fafc", color: filtroResp === f.k ? "#818cf8" : subColor, fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>{f.l}</button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px 14px 48px" }}>
        {loading && <div style={{ textAlign: "center", padding: 48, color: "#64748b" }}><div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div><div>Procesando el archivo...</div></div>}

        {!loading && pas.length === 0 && (
          <div style={{ textAlign: "center", padding: 64 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 16, color: "#475569" }}>Cargá el archivo Excel para comenzar</div>
            <div style={{ fontSize: 12, marginTop: 6, color: "#334155" }}>Tu seguimiento se guarda automáticamente</div>
          </div>
        )}

        {!loading && pas.length > 0 && mainTab === "dashboard" && (
          <TabDashboard pas={pas} historial={historial} casos={casos} derivadores={derivadores} recordatorios={recordatorios} darkMode={darkMode} />
        )}

        {!loading && pas.length > 0 && mainTab === "contactos" && (
          <>
            <div style={{ fontSize: 12, color: subColor, marginBottom: 12, display: "flex", justifyContent: "space-between" }}>
              <span>{filtered.length.toLocaleString("es-AR")} resultados</span>
              {totalPages > 1 && <span>Pág {page + 1} / {totalPages}</span>}
            </div>
            {paginated.map(p => (
              <PASCard key={p.id} pas={p} historial={historial} derivadores={derivadores} recordatorios={recordatorios}
                onContactar={setModalPas} onToggleDerivador={handleToggleDerivador}
                expanded={expandedId === p.id} onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
                darkMode={darkMode} />
            ))}
            {totalPages > 1 && (
              <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 20 }}>
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${darkMode ? "#1e293b" : "#e2e8f0"}`, background: darkMode ? "#0a0f1e" : "#f8fafc", color: page === 0 ? "#1e293b" : "#94a3b8", cursor: page === 0 ? "default" : "pointer" }}>← Anterior</button>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${darkMode ? "#1e293b" : "#e2e8f0"}`, background: darkMode ? "#0a0f1e" : "#f8fafc", color: page >= totalPages - 1 ? "#1e293b" : "#94a3b8", cursor: page >= totalPages - 1 ? "default" : "pointer" }}>Siguiente →</button>
              </div>
            )}
          </>
        )}

        {!loading && pas.length > 0 && mainTab === "clientes" && (
          <TabClientes pas={pas} casos={casos} derivadores={derivadores} onSaveCasos={handleSaveCasos} darkMode={darkMode} />
        )}
      </div>

      {modalPas && <ContactModal pas={modalPas} onClose={() => setModalPas(null)} onSave={handleSaveContacto} darkMode={darkMode} />}
    </div>
  );
}