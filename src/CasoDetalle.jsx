// CasoDetalle.jsx
// Sistema operativo de gestión de casos legales — Features 1-13
// Requiere: jspdf (npm i jspdf), jszip (npm i jszip)
// File System Access API — browser nativo, sin Electron

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabase.js";

// ── TIPOS DE DOCUMENTOS ───────────────────────────────────────────────────────
const TIPOS_DOC = ["DNI", "CEDULA", "DENUNCIA", "CERTIFICADO", "LICENCIA", "PRESUPUESTO", "ESCRITO", "FOTO"];
const EXTENSIONES_VALIDAS = [".jpg", ".jpeg", ".png", ".pdf"];
const ESTADOS_HONORARIOS = ["NO_FACTURADO", "FACTURADO", "COBRADO"];

// ── HELPERS ───────────────────────────────────────────────────────────────────
function sanitizarNombre(str) {
  return String(str || "").replace(/[/\\:*?"<>|]/g, "").trim();
}

function formatoFecha(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${String(y).slice(-2)}`;
}

function formatoFechaCarpeta(iso) {
  if (!iso) return "00-00-0000";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}-${m}-${y}`;
}

function fmtMoney(n) {
  if (n === null || n === undefined || n === "") return "—";
  return "$" + Number(n).toLocaleString("es-AR");
}

function diasDesde(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function sumarDias(iso, dias) {
  if (!iso || !dias) return null;
  const d = new Date(iso);
  d.setDate(d.getDate() + Number(dias));
  return d.toISOString().slice(0, 10);
}

function getExtension(nombre) {
  const parts = nombre.split(".");
  if (parts.length < 2) return "";
  return "." + parts[parts.length - 1].toLowerCase();
}

// Feature 13: verificar/solicitar permiso de filesystem
async function verificarPermiso(handle, mode = "readwrite") {
  try {
    const perm = await handle.queryPermission({ mode });
    if (perm === "granted") return true;
    const req = await handle.requestPermission({ mode });
    return req === "granted";
  } catch {
    return false;
  }
}

// ── THEME ─────────────────────────────────────────────────────────────────────
const T = (dark) => ({
  bg:     dark ? "#111827" : "#f8fafc",
  card:   dark ? "#1a2535" : "#ffffff",
  card2:  dark ? "#222f42" : "#f1f5f9",
  border: dark ? "#2d3f55" : "#e2e8f0",
  text:   dark ? "#f1f5f9" : "#0f172a",
  sub:    dark ? "#94a3b8" : "#475569",
  muted:  dark ? "#64748b" : "#94a3b8",
  input:  dark
    ? { background: "#1e293b", border: "1px solid #2d3f55", borderRadius: 8, color: "#f1f5f9", padding: "9px 12px", fontSize: 14, width: "100%", boxSizing: "border-box", outline: "none", fontFamily: "inherit" }
    : { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, color: "#0f172a", padding: "9px 12px", fontSize: 14, width: "100%", boxSizing: "border-box", outline: "none", fontFamily: "inherit" },
});

// ── TOAST ─────────────────────────────────────────────────────────────────────
function Toast({ msg, type, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [msg]);
  if (!msg) return null;
  const colors = { success: "#22c55e", error: "#ef4444", info: "#6366f1", warn: "#f97316" };
  const c = colors[type] || colors.info;
  return (
    <div style={{ position: "fixed", bottom: 24, right: 20, zIndex: 999, background: "#1a2535", border: `1px solid ${c}55`, borderRadius: 12, padding: "12px 18px", color: c, fontSize: 14, fontWeight: 600, maxWidth: 340, boxShadow: "0 8px 32px #0008", display: "flex", gap: 10, alignItems: "center" }}>
      <span style={{ flex: 1 }}>{msg}</span>
      <button onClick={onDismiss} style={{ background: "none", border: "none", color: c, cursor: "pointer", fontSize: 16, padding: 0 }}>×</button>
    </div>
  );
}

// ── PREVIEW MODAL ─────────────────────────────────────────────────────────────
function PreviewModal({ archivo, onClose }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!archivo) return;
    const objectUrl = URL.createObjectURL(archivo.blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [archivo]);

  if (!archivo || !url) return null;
  const esImagen = [".jpg", ".jpeg", ".png"].includes(getExtension(archivo.nombre));
  const esPdf = getExtension(archivo.nombre) === ".pdf";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.88)", zIndex: 500, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#1a2535", border: "1px solid #2d3f55", borderRadius: 16, width: "100%", maxWidth: 780, maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid #2d3f55" }}>
          <div style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 15 }}>{archivo.nombre}</div>
          <button onClick={onClose} style={{ background: "#222f42", border: "1px solid #2d3f55", borderRadius: 8, color: "#94a3b8", padding: "4px 12px", cursor: "pointer" }}>✕ Cerrar</button>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: 16, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
          {esImagen && <img src={url} alt={archivo.nombre} style={{ maxWidth: "100%", maxHeight: "70vh", borderRadius: 8, objectFit: "contain" }} />}
          {esPdf && <iframe src={url} title={archivo.nombre} style={{ width: "100%", height: "70vh", border: "none", borderRadius: 8 }} />}
          {!esImagen && !esPdf && <div style={{ color: "#64748b" }}>Tipo de archivo no soportado para previsualización</div>}
        </div>
      </div>
    </div>
  );
}
// Caché de handles por caso_id (persiste mientras la app esté abierta)
const _dirHandleCache = {};
// ── CASO DETALLE PRINCIPAL ────────────────────────────────────────────────────
export default function CasoDetalle({ caso, pasId, darkMode, onUpdate, onClose }) {
  const Th = T(darkMode);

  // Estado filesystem
  const [dirHandle, setDirHandle] = useState(null);
  const [carpetaPath, setCarpetaPath] = useState(caso.carpeta_path || "");
  const [archivos, setArchivos] = useState([]);
  const [loadingArchivos, setLoadingArchivos] = useState(false);

  // Estado UI
  const [toast, setToast] = useState(null);
  const [previewArchivo, setPreviewArchivo] = useState(null);
  const [modalEscrito, setModalEscrito] = useState(false);
  const [dniEscrito, setDniEscrito] = useState("");
  const [generandoEscrito, setGenerandoEscrito] = useState(false);

  // Datos del caso extendidos (Features 7-10)
  const [presupuesto, setPresupuesto] = useState(caso.presupuesto || "");
  const [primerOfrecimiento, setPrimerOfrecimiento] = useState(caso.primer_ofrecimiento || "");
  const [segundoOfrecimiento, setSegundoOfrecimiento] = useState(caso.segundo_ofrecimiento || "");
  const [montoAcordado, setMontoAcordado] = useState(caso.monto_acordado || "");
  const [plazo_pago, setPlazo_pago] = useState(caso.plazo_pago || "");
  const [porcentaje_honorarios, setPorcentaje_honorarios] = useState(caso.porcentaje_honorarios || "");
  const [estado_honorarios, setEstado_honorarios] = useState(caso.estado_honorarios || "NO_FACTURADO");
  const [fecha_factura, setFecha_factura] = useState(caso.fecha_factura || "");
  const [fecha_cobro_honorarios, setFecha_cobro_honorarios] = useState(caso.fecha_cobro_honorarios || "");

  // Fechas extendidas (Feature 8)
  const [fechas, setFechas] = useState({
    fecha_carga: caso.fecha_carga || new Date().toISOString().slice(0, 10),
    fecha_reclamo: caso.fecha_reclamo || "",
    fecha_ultimo_reclamo: caso.fecha_ultimo_reclamo || "",
    fecha_ofrecimiento: caso.fecha_ofrecimiento || "",
    fecha_reconsideracion: caso.fecha_reconsideracion || "",
    fecha_aceptacion: caso.fecha_aceptacion || "",
    fecha_firma: caso.fecha_firma || "",
    fecha_pago: caso.fecha_pago || "",
    fecha_cobro: caso.fecha_cobro || "",
    fecha_mediacion: caso.fecha_mediacion || "",
    fecha_inicio_juicio: caso.fecha_inicio_juicio || "",
  });

  // Timeline / acciones (Feature 11)
  const [acciones, setAcciones] = useState([]);
  const [loadingAcciones, setLoadingAcciones] = useState(false);

  // ── Feature 2: Leer archivos de la carpeta ──
  const leerArchivos = useCallback(async (handle) => {
    if (!handle) return;
    const permiso = await verificarPermiso(handle, "read");
    if (!permiso) {
      setToast({ msg: "Sin permiso de lectura en la carpeta", type: "error" });
      return;
    }
    setLoadingArchivos(true);
    try {
      const lista = [];
      for await (const entry of handle.values()) {
        if (entry.kind !== "file") continue;
        const ext = getExtension(entry.name);
        if (!EXTENSIONES_VALIDAS.includes(ext)) continue;
        const file = await entry.getFile();
        lista.push({ nombre: entry.name, tipo: file.type, tamaño: file.size, ext, blob: file, handle: entry });
      }
      setArchivos(lista);
    } catch (e) {
      setToast({ msg: `Error al leer archivos: ${e.message}`, type: "error" });
    } finally {
      setLoadingArchivos(false);
    }
  }, []);

  // ── Restaurar handle desde cache en memoria al montar ──
  // El File System Access API no permite serializar handles a disco,
  // pero _dirHandleCache los mantiene en memoria mientras la app esté abierta.
  // Si el usuario recarga la página deberá re-vincular manualmente.
  useEffect(() => {
    const cached = _dirHandleCache[caso.id];
    if (cached) {
      setDirHandle(cached);
      leerArchivos(cached);
    }
  }, [caso.id, leerArchivos]);

  // ── Feature 11: Cargar acciones desde Supabase ──
  useEffect(() => {
    const cargarAcciones = async () => {
      setLoadingAcciones(true);
      const { data } = await supabase
        .from("acciones")
        .select("*")
        .eq("caso_id", caso.id)
        .order("fecha", { ascending: false });
      setAcciones(data || []);
      setLoadingAcciones(false);
    };
    cargarAcciones();
  }, [caso.id]);

  // ── Feature 1: Crear carpeta local ──
  const crearCarpeta = async () => {
    try {
      const dirBase = await window.showDirectoryPicker({ mode: "readwrite" });
      const permiso = await verificarPermiso(dirBase, "readwrite");
      if (!permiso) {
        setToast({ msg: "Permiso denegado para el directorio seleccionado", type: "error" });
        return;
      }

      // Extraer partes del nombre de carpeta
      const partes = (caso.asegurado || "").trim().split(/\s+/);
      const apellido = sanitizarNombre(partes[0] || "SIN_APELLIDO");
      const nombre = sanitizarNombre(partes.slice(1).join(" ") || "SIN_NOMBRE");
      const compania = sanitizarNombre(caso.compania || caso.nota?.match(/compañía[:\s]+([^\n,]+)/i)?.[1] || "COMPANIA");
      const fechaSiniestro = formatoFechaCarpeta(caso.fecha_siniestro || caso.fecha_derivacion);

      let nombreCarpeta = `${apellido} ${nombre} - ${compania} - ${fechaSiniestro}`;

      // Verificar duplicados y agregar sufijo
      let sufijo = 1;
      let carpetaFinal = nombreCarpeta;
      while (true) {
        try {
          await dirBase.getDirectoryHandle(carpetaFinal, { create: false });
          sufijo++;
          carpetaFinal = `${nombreCarpeta}_${sufijo}`;
        } catch {
          break; // No existe, podemos crear
        }
      }

      const nuevaCarpeta = await dirBase.getDirectoryHandle(carpetaFinal, { create: true });
      setDirHandle(nuevaCarpeta);
      _dirHandleCache[caso.id] = nuevaCarpeta;
      const path = carpetaFinal;
      setCarpetaPath(path);

      // Guardar path en Supabase
      await supabase.from("pas_casos").update({ carpeta_path: path }).eq("caso_id", caso.id);
      await registrarAccion("carpeta_creada", `Carpeta creada: ${carpetaFinal}`);
      await leerArchivos(nuevaCarpeta);
      onUpdate?.({ ...caso, carpeta_path: path });
      setToast({ msg: `✅ Carpeta creada: ${carpetaFinal}`, type: "success" });
    } catch (e) {
      if (e.name === "AbortError") return; // usuario canceló
      setToast({ msg: `Error al crear carpeta: ${e.message}`, type: "error" });
    }
  };

  // ── Feature 1: Abrir carpeta (re-seleccionar handle) ──
  const abrirCarpeta = async () => {
    try {
      const dir = await window.showDirectoryPicker({ mode: "readwrite" });
      const permiso = await verificarPermiso(dir, "readwrite");
      if (!permiso) {
        setToast({ msg: "Permiso denegado", type: "error" });
        return;
      }
      setDirHandle(dir);
      _dirHandleCache[caso.id] = dir;
      // Guardar el nombre de la carpeta vinculada en Supabase
      const path = dir.name;
      setCarpetaPath(path);
      await supabase.from("pas_casos").update({ carpeta_path: path }).eq("caso_id", caso.id);
      onUpdate?.({ ...caso, carpeta_path: path });
      await leerArchivos(dir);
      setToast({ msg: "Carpeta vinculada. Archivos cargados.", type: "success" });
    } catch (e) {
      if (e.name === "AbortError") return;
      setToast({ msg: `Error: ${e.message}`, type: "error" });
    }
  };

  // ── Feature 4: Categorizar y renombrar archivo ──
  const categorizarArchivo = async (archivoEntry, tipo) => {
    if (!dirHandle) {
      setToast({ msg: "Primero vinculá la carpeta del caso", type: "error" });
      return;
    }
    const permiso = await verificarPermiso(dirHandle, "readwrite");
    if (!permiso) {
      setToast({ msg: "Sin permiso de escritura en la carpeta", type: "error" });
      return;
    }

    try {
      let nuevoNombre;
      if (tipo === "FOTO") {
        // Buscar próximo número disponible
        const fotos = archivos.filter(a => /^FOTO_\d+\.(jpg|jpeg|png)$/i.test(a.nombre));
        const nums = fotos.map(a => parseInt(a.nombre.match(/\d+/)[0])).filter(n => !isNaN(n));
        const nextN = nums.length > 0 ? Math.max(...nums) + 1 : 1;
        const extOrig = getExtension(archivoEntry.nombre) || ".jpg";
        nuevoNombre = `FOTO_${nextN}${extOrig}`;
      } else {
        // Preservar la extensión original del archivo
        const extOrig = getExtension(archivoEntry.nombre) || ".pdf";
        nuevoNombre = `${tipo}${extOrig}`;
      }

      // Leer contenido original
      const fileData = await archivoEntry.handle.getFile();
      const buffer = await fileData.arrayBuffer();

      // Si ya existe el archivo destino, eliminarlo primero (reemplazar)
      try {
        const existente = await dirHandle.getFileHandle(nuevoNombre, { create: false });
        await dirHandle.removeEntry(nuevoNombre);
      } catch { /* no existía */ }

      // Crear nuevo archivo con el nombre correcto
      const nuevoHandle = await dirHandle.getFileHandle(nuevoNombre, { create: true });
      const writable = await nuevoHandle.createWritable();
      await writable.write(buffer);
      await writable.close();

      // Eliminar original (solo si el nombre cambió)
      if (archivoEntry.nombre !== nuevoNombre) {
        try {
          await dirHandle.removeEntry(archivoEntry.nombre);
        } catch { /* ignorar */ }
      }

      await leerArchivos(dirHandle);
      await registrarAccion("archivo_categorizado", `${archivoEntry.nombre} → ${nuevoNombre} (${tipo})`);
      setToast({ msg: `✅ Renombrado como ${nuevoNombre}`, type: "success" });
    } catch (e) {
      setToast({ msg: `Error al renombrar: ${e.message}`, type: "error" });
    }
  };

  // ── Feature 12: Descargar ZIP ──
  const descargarZip = async () => {
    if (!dirHandle) {
      setToast({ msg: "Primero vinculá la carpeta del caso", type: "error" });
      return;
    }
    if (archivos.length === 0) {
      setToast({ msg: "No hay archivos para comprimir", type: "warn" });
      return;
    }
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      for (const arch of archivos) {
        const buffer = await arch.blob.arrayBuffer();
        zip.file(arch.nombre, buffer);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${caso.asegurado || "caso"}_documentos.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setToast({ msg: "✅ ZIP descargado", type: "success" });
    } catch (e) {
      setToast({ msg: `Error al comprimir: ${e.message}`, type: "error" });
    }
  };

  // ── Feature 11: Registrar acción en Supabase ──
  const registrarAccion = async (tipo, descripcion) => {
    const nueva = {
      caso_id: caso.id,
      tipo,
      descripcion,
      fecha: new Date().toISOString(),
    };
    // Guardar en PAS Tracker
    const { data } = await supabase.from("acciones").insert(nueva).select().single();
    if (data) setAcciones(prev => [data, ...prev]);

    // Sincronizar a Agenda Legal (misma base de datos, caso_id con prefijo pas_)
    try {
      await supabase.from("acciones").insert({
        ...nueva,
        caso_id: `pas_${caso.id}`,
      });
    } catch (e) {
      console.error("[sync→AgendaLegal] accion error:", e);
    }
  };

  // ── Feature 7: Guardar negociación en Supabase ──
  const guardarNegociacion = async () => {
    const updates = {
      presupuesto: presupuesto || null,
      primer_ofrecimiento: primerOfrecimiento || null,
      segundo_ofrecimiento: segundoOfrecimiento || null,
    };
    // Auto-fecha ofrecimiento al cargar primer ofrecimiento
    if (primerOfrecimiento && !fechas.fecha_ofrecimiento) {
      const hoy = new Date().toISOString().slice(0, 10);
      updates.fecha_ofrecimiento = hoy;
      setFechas(f => ({ ...f, fecha_ofrecimiento: hoy }));
    }
    await supabase.from("pas_casos").update(updates).eq("caso_id", caso.id);
    if (primerOfrecimiento && !caso.primer_ofrecimiento) {
      await registrarAccion("ofrecimiento_cargado", `Primer ofrecimiento: ${fmtMoney(primerOfrecimiento)}`);
    }
    onUpdate?.({ ...caso, ...updates });
    setToast({ msg: "Negociación guardada", type: "success" });
  };

  // ── Feature 8: Guardar fechas ──
  const guardarFechas = async () => {
    await supabase.from("pas_casos").update(fechas).eq("caso_id", caso.id);
    onUpdate?.({ ...caso, ...fechas });
    setToast({ msg: "Fechas guardadas", type: "success" });
  };

  // ── Feature 9: Guardar acuerdo ──
  const guardarAcuerdo = async () => {
    const updates = {
      monto_acordado: montoAcordado || null,
      plazo_pago: plazo_pago || null,
      fecha_firma: fechas.fecha_firma || null,
    };
    await supabase.from("pas_casos").update(updates).eq("caso_id", caso.id);
    onUpdate?.({ ...caso, ...updates });
    setToast({ msg: "Acuerdo guardado", type: "success" });
  };

  // ── Feature 10: Guardar honorarios ──
  const guardarHonorarios = async () => {
    const monto_honorarios = montoAcordado && porcentaje_honorarios
      ? Math.round((Number(montoAcordado) * Number(porcentaje_honorarios)) / 100)
      : null;
    const updates = {
      porcentaje_honorarios: porcentaje_honorarios || null,
      monto_honorarios,
      estado_honorarios,
      fecha_factura: fecha_factura || null,
      fecha_cobro_honorarios: fecha_cobro_honorarios || null,
    };
    await supabase.from("pas_casos").update(updates).eq("caso_id", caso.id);
    onUpdate?.({ ...caso, ...updates });
    setToast({ msg: "Honorarios guardados", type: "success" });
  };
// ── Feature 6: Generar escrito con jsPDF (Formato Original Word) ──
  const generarEscrito = async () => {
    if (!dniEscrito.trim()) {
      setToast({ msg: "Ingresá el DNI del asegurado", type: "error" });
      return;
    }
    if (!dirHandle) {
      setToast({ msg: "Primero vinculá la carpeta del caso", type: "error" });
      return;
    }

    setGenerandoEscrito(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      
      const margin = 20;
      const contentWidth = 170; // A4 ancho útil con márgenes de 20mm
      let y = 25;

      // 1. TÍTULO — "RECLAMO EXTRAJUDICIAL" bold subrayado (igual al Word)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      const titulo = "RECLAMO EXTRAJUDICIAL";
      doc.text(titulo, margin, y);
      const tituloAncho = doc.getTextWidth(titulo);
      doc.setLineWidth(0.4);
      doc.line(margin, y + 1, margin + tituloAncho, y + 1);

      // 2. COMPAÑÍA
      y += 12;
      const compania = (caso.compania || "RAZON SOCIAL ASEGURADORA").toUpperCase();
      doc.setFont("helvetica", "normal");
      doc.text(compania, margin, y);

      // 3. "Reclamo de Terceros:"
      y += 8;
      doc.text("Reclamo de Terceros:", margin, y);

      // 4. CUERPO
      y += 12;
      doc.setFontSize(11);

      const fechaSiniestro = formatoFecha(caso.fecha_siniestro || caso.fecha_derivacion);
      const nombreCompleto = (caso.asegurado || "NOMBRE NO DISPONIBLE").toUpperCase();

      const cuerpo = `Alexis Torres Gaveglio, abogado, inscripto al T°142 F°636 C.P.A.C.F y al L° IV F° 20 del C.A.M.G.R, en representación de ${nombreCompleto}, DNI ${dniEscrito.trim()} vengo a iniciar formal reclamo por el siniestro ocurrido el día ${fechaSiniestro}.`;

      const lineasCuerpo = doc.splitTextToSize(cuerpo, contentWidth);
      doc.text(lineasCuerpo, margin, y);

      // 5. "I. Acompaña:" — numeración romana bold
      y += (lineasCuerpo.length * 6.5) + 12;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("I.", margin, y);
      doc.text("Acompaña:", margin + 8, y);

      // 6. Lista numerada con sangría
      y += 9;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      const numMargin = margin + 6;
      const itemMargin = margin + 14;
      const adjuntos = [
        "Denuncia administrativa",
        "Certificado de cobertura",
        "Fotos de los daños",
        "DNI (Frente y dorso)",
        "Cedula /Titulo",
        "Licencia de Conducir",
        "Presupuesto"
      ];

      adjuntos.forEach((item, i) => {
        doc.text(`${i + 1}.`, numMargin, y);
        doc.text(item, itemMargin, y);
        y += 7;
      });

      // --- PROCESO DE GUARDADO SEGURO EN CARPETA ---
      const pdfBytes = doc.output("arraybuffer");
      const nombreArchivo = `Reclamo_${nombreCompleto.replace(/\s+/g, '_')}.pdf`;

      try {
        const options = { mode: 'readwrite' };
        if ((await dirHandle.queryPermission(options)) !== 'granted') {
          await dirHandle.requestPermission(options);
        }

        const fileHandle = await dirHandle.getFileHandle(nombreArchivo, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(pdfBytes);
        await writable.close();

        setToast({ msg: "✅ PDF generado con tu formato original", type: "success" });
        await registrarAccion("escrito_generado", `PDF generado: ${nombreArchivo}`);
      } catch (fileError) {
        doc.save(nombreArchivo);
        setToast({ msg: "Guardado en Descargas", type: "warning" });
      }

    } catch (error) {
      console.error(error);
      setToast({ msg: "Error al generar el PDF", type: "error" });
    } finally {
      setGenerandoEscrito(false);
    }
  };
  // ── Feature 5: Checklist documental (estado derivado) ──
  const checklistEstado = TIPOS_DOC.reduce((acc, tipo) => {
    if (tipo === "FOTO") {
      acc[tipo] = archivos.some(a => /^FOTO_\d+\.(jpg|jpeg|png)$/i.test(a.nombre));
    } else {
      acc[tipo] = archivos.some(a => a.nombre.toLowerCase() === `${tipo.toLowerCase()}.pdf`);
    }
    return acc;
  }, {});

  // ── Cálculos ──
  const calcPorcentaje = (ofrecimiento, presup) => {
    const o = Number(ofrecimiento), p = Number(presup);
    if (!p || p === 0 || isNaN(p) || isNaN(o)) return null;
    return ((o / p) * 100).toFixed(1);
  };

  const fechaCobro = sumarDias(fechas.fecha_firma, plazo_pago);
  const diasRestantes = fechaCobro ? -diasDesde(fechaCobro) : null;

  const monto_honorarios = montoAcordado && porcentaje_honorarios
    ? Math.round((Number(montoAcordado) * Number(porcentaje_honorarios)) / 100)
    : null;
  const diasDesdeFactura = fecha_factura ? diasDesde(fecha_factura) : null;
  const honorariosVencidos = fecha_cobro_honorarios && diasDesde(fecha_cobro_honorarios) > 0 && estado_honorarios !== "COBRADO";

  // ── Última fecha registrada (para indicador de sin movimiento) ──
  const todasFechas = Object.values(fechas).filter(Boolean);
  const ultimaFecha = todasFechas.length > 0 ? todasFechas.sort().reverse()[0] : null;
  const diasSinMovimiento = ultimaFecha ? diasDesde(ultimaFecha) : null;

  // ── Render ────────────────────────────────────────────────────────────────
  const sectionStyle = {
    background: Th.card,
    border: `1px solid ${Th.border}`,
    borderRadius: 14,
    padding: "18px 20px",
    marginBottom: 16,
  };
  const labelStyle = { fontSize: 10, color: Th.muted, textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700, marginBottom: 6, display: "block" };
  const inputStyle = { ...Th.input };

  return (
    <div style={{ minHeight: "100vh", background: Th.bg, color: Th.text, padding: "0 0 60px" }}>

      {/* ── HEADER ── */}
      <div style={{ background: Th.card, borderBottom: `1px solid ${Th.border}`, padding: "14px 20px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <button onClick={onClose} style={{ background: Th.card2, border: `1px solid ${Th.border}`, borderRadius: 8, color: Th.sub, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>← Volver</button>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: Th.text }}>{caso.asegurado}</div>
            {carpetaPath && <div style={{ fontSize: 11, color: Th.muted, marginTop: 1 }}>📁 {carpetaPath}</div>}
          </div>
        </div>

        {/* Feature 12: Botones principales */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {!dirHandle ? (
            <>
              <button onClick={crearCarpeta} style={{ background: "#22c55e22", border: "1px solid #22c55e44", borderRadius: 8, color: "#22c55e", padding: "7px 14px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>📁 Crear carpeta</button>
              {carpetaPath && (
                <button onClick={abrirCarpeta} style={{ background: "#6366f122", border: "1px solid #6366f144", borderRadius: 8, color: "#818cf8", padding: "7px 14px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>🔗 Vincular carpeta</button>
              )}
            </>
          ) : (
            <button onClick={() => leerArchivos(dirHandle)} style={{ background: "#6366f122", border: "1px solid #6366f144", borderRadius: 8, color: "#818cf8", padding: "7px 14px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>🔄 Actualizar archivos</button>
          )}
          <button onClick={() => setModalEscrito(true)} style={{ background: "#f9731622", border: "1px solid #f9731644", borderRadius: 8, color: "#f97316", padding: "7px 14px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>📝 Generar escrito</button>
          <button onClick={descargarZip} style={{ background: "#06b6d422", border: "1px solid #06b6d444", borderRadius: 8, color: "#06b6d4", padding: "7px 14px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>📦 Descargar ZIP</button>
          <button onClick={() => setToast({ msg: "🚧 Subir a Drive — Próximamente", type: "info" })} style={{ background: Th.card2, border: `1px solid ${Th.border}`, borderRadius: 8, color: Th.muted, padding: "7px 14px", cursor: "pointer", fontSize: 13 }}>☁️ Subir a Drive</button>
        </div>

        {/* Indicador sin movimiento */}
        {diasSinMovimiento !== null && (
          <div style={{ marginTop: 8, fontSize: 12, color: diasSinMovimiento > 30 ? "#ef4444" : Th.muted, background: diasSinMovimiento > 30 ? "#ef444412" : Th.card2, borderRadius: 6, padding: "4px 10px", display: "inline-block" }}>
            ⏱ Sin movimiento hace {diasSinMovimiento} día{diasSinMovimiento !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 16px" }}>

        {/* ── Feature 2 & 3 & 4 & 5: ARCHIVOS + CHECKLIST ── */}
        <div style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: Th.text }}>📂 Documentos del caso</div>
            {dirHandle && (
              <span style={{ fontSize: 11, color: "#22c55e", background: "#22c55e18", borderRadius: 6, padding: "3px 9px" }}>Carpeta vinculada ✓</span>
            )}
          </div>

          {/* Feature 5: Checklist */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 16 }}>
            {TIPOS_DOC.map(tipo => (
              <div key={tipo} style={{
                background: checklistEstado[tipo] ? "#22c55e14" : "#ef444410",
                border: `1px solid ${checklistEstado[tipo] ? "#22c55e44" : "#ef444430"}`,
                borderRadius: 8, padding: "7px 6px", textAlign: "center"
              }}>
                <div style={{ fontSize: 16 }}>{checklistEstado[tipo] ? "✅" : "❌"}</div>
                <div style={{ fontSize: 9, color: checklistEstado[tipo] ? "#22c55e" : "#ef4444", fontWeight: 700, marginTop: 2 }}>{tipo}</div>
              </div>
            ))}
          </div>

          {/* Feature 2 & 3 & 4: Lista de archivos */}
          {!dirHandle && (
            <div style={{ textAlign: "center", padding: "20px 0", color: Th.muted, fontSize: 13 }}>
              Creá o vinculá la carpeta del caso para ver los archivos
            </div>
          )}
          {dirHandle && loadingArchivos && (
            <div style={{ textAlign: "center", padding: "16px 0", color: Th.muted, fontSize: 13 }}>Cargando archivos...</div>
          )}
          {dirHandle && !loadingArchivos && archivos.length === 0 && (
            <div style={{ textAlign: "center", padding: "16px 0", color: Th.muted, fontSize: 13 }}>Carpeta vacía — no se encontraron archivos válidos</div>
          )}
          {archivos.map(arch => (
            <ArchivoRow
              key={arch.nombre}
              archivo={arch}
              onPreview={() => setPreviewArchivo(arch)}
              onCategorizar={tipo => categorizarArchivo(arch, tipo)}
              dark={darkMode}
              Th={Th}
            />
          ))}
        </div>

        {/* ── Feature 7: NEGOCIACIÓN ── */}
        <div style={sectionStyle}>
          <div style={{ fontSize: 13, fontWeight: 800, color: Th.text, marginBottom: 14 }}>💬 Negociación</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
            {[
              { label: "Presupuesto ($)", val: presupuesto, set: setPresupuesto },
              { label: "1° Ofrecimiento ($)", val: primerOfrecimiento, set: setPrimerOfrecimiento },
              { label: "2° Ofrecimiento ($)", val: segundoOfrecimiento, set: setSegundoOfrecimiento },
            ].map(f => (
              <label key={f.label}>
                <span style={labelStyle}>{f.label}</span>
                <input type="number" value={f.val} onChange={e => f.set(e.target.value)} style={inputStyle} placeholder="0" />
              </label>
            ))}
          </div>

          {/* Cálculo de porcentajes */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            {[
              { label: "1° Ofrecimiento vs Presupuesto", pct: calcPorcentaje(primerOfrecimiento, presupuesto), val: primerOfrecimiento, color: "#f97316" },
              { label: "2° Ofrecimiento vs Presupuesto", pct: calcPorcentaje(segundoOfrecimiento, presupuesto), val: segundoOfrecimiento, color: "#eab308" },
            ].map(c => (
              <div key={c.label} style={{ background: Th.card2, borderRadius: 10, padding: "10px 14px", border: `1px solid ${c.color}33` }}>
                <div style={{ fontSize: 10, color: c.color, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>{c.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: c.color }}>{c.pct !== null ? `${c.pct}%` : "—"}</div>
                <div style={{ fontSize: 12, color: Th.sub }}>{c.val ? fmtMoney(c.val) : "—"}</div>
              </div>
            ))}
          </div>

          <button onClick={guardarNegociacion} style={{ background: "#f97316", border: "none", borderRadius: 8, color: "white", padding: "9px 20px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Guardar negociación</button>
        </div>

        {/* ── Feature 9: ACUERDO Y COBRO ── */}
        <div style={sectionStyle}>
          <div style={{ fontSize: 13, fontWeight: 800, color: Th.text, marginBottom: 14 }}>🤝 Acuerdo y cobro</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
            <label>
              <span style={labelStyle}>Monto acordado ($)</span>
              <input type="number" value={montoAcordado} onChange={e => setMontoAcordado(e.target.value)} style={{ ...inputStyle, borderColor: "#22c55e44" }} placeholder="0" />
            </label>
            <label>
              <span style={labelStyle}>Fecha de firma</span>
              <input type="date" value={fechas.fecha_firma} onChange={e => setFechas(f => ({ ...f, fecha_firma: e.target.value }))} style={{ ...inputStyle, borderColor: "#22c55e44" }} />
            </label>
            <label>
              <span style={labelStyle}>Plazo de pago (días)</span>
              <input type="number" value={plazo_pago} onChange={e => setPlazo_pago(e.target.value)} style={inputStyle} placeholder="30" />
            </label>
          </div>

          {/* Fecha cobro estimada */}
          {fechaCobro && (
            <div style={{ background: Th.card2, borderRadius: 10, padding: "10px 14px", marginBottom: 12, border: `1px solid ${diasRestantes !== null && diasRestantes < 0 ? "#ef444444" : "#06b6d444"}` }}>
              <div style={{ fontSize: 10, color: Th.muted, marginBottom: 4, textTransform: "uppercase" }}>Fecha cobro estimada</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: diasRestantes !== null && diasRestantes < 0 ? "#ef4444" : "#06b6d4" }}>
                {formatoFecha(fechaCobro)}
                {diasRestantes !== null && diasRestantes < 0
                  ? ` · Vencido hace ${Math.abs(diasRestantes)} días`
                  : diasRestantes !== null
                    ? ` · ${diasRestantes} días restantes`
                    : ""}
              </div>
            </div>
          )}
          <button onClick={guardarAcuerdo} style={{ background: "#22c55e", border: "none", borderRadius: 8, color: "white", padding: "9px 20px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Guardar acuerdo</button>
        </div>

        {/* ── Feature 10: HONORARIOS ── */}
        <div style={sectionStyle}>
          <div style={{ fontSize: 13, fontWeight: 800, color: Th.text, marginBottom: 14 }}>💰 Honorarios</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <label>
              <span style={labelStyle}>Porcentaje honorarios (%)</span>
              <input type="number" value={porcentaje_honorarios} onChange={e => setPorcentaje_honorarios(e.target.value)} style={inputStyle} placeholder="20" />
            </label>
            <div>
              <span style={labelStyle}>Monto honorarios (auto)</span>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#6366f1", marginTop: 4 }}>{monto_honorarios ? fmtMoney(monto_honorarios) : "—"}</div>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <span style={labelStyle}>Estado</span>
            <div style={{ display: "flex", gap: 6 }}>
              {ESTADOS_HONORARIOS.map(e => (
                <button key={e} onClick={() => setEstado_honorarios(e)} style={{
                  padding: "7px 14px", borderRadius: 8, border: "1px solid",
                  borderColor: estado_honorarios === e ? "#6366f1" : Th.border,
                  background: estado_honorarios === e ? "#6366f122" : Th.card2,
                  color: estado_honorarios === e ? "#818cf8" : Th.sub,
                  cursor: "pointer", fontSize: 12, fontWeight: estado_honorarios === e ? 700 : 400
                }}>{e}</button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <label>
              <span style={labelStyle}>Fecha de factura</span>
              <input type="date" value={fecha_factura} onChange={e => setFecha_factura(e.target.value)} style={inputStyle} />
            </label>
            <label>
              <span style={labelStyle}>Fecha cobro honorarios</span>
              <input type="date" value={fecha_cobro_honorarios} onChange={e => setFecha_cobro_honorarios(e.target.value)} style={inputStyle} />
            </label>
          </div>

          {estado_honorarios === "FACTURADO" && diasDesdeFactura !== null && (
            <div style={{ fontSize: 12, color: "#f97316", background: "#f9731612", borderRadius: 6, padding: "6px 10px", marginBottom: 10 }}>
              ⏱ Facturado hace {diasDesdeFactura} días
            </div>
          )}
          {honorariosVencidos && (
            <div style={{ fontSize: 12, color: "#ef4444", background: "#ef444412", borderRadius: 6, padding: "6px 10px", marginBottom: 10 }}>
              ⚠️ Cobro de honorarios vencido — aún no marcado como COBRADO
            </div>
          )}
          <button onClick={guardarHonorarios} style={{ background: "#6366f1", border: "none", borderRadius: 8, color: "white", padding: "9px 20px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Guardar honorarios</button>
        </div>

        {/* ── Feature 8: FECHAS ── */}
        <div style={sectionStyle}>
          <div style={{ fontSize: 13, fontWeight: 800, color: Th.text, marginBottom: 14 }}>📅 Fechas del expediente</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            {[
              { k: "fecha_carga", l: "Carga del caso" },
              { k: "fecha_reclamo", l: "Reclamo" },
              { k: "fecha_ultimo_reclamo", l: "Último reclamo" },
              { k: "fecha_ofrecimiento", l: "Ofrecimiento (auto)" },
              { k: "fecha_reconsideracion", l: "Reconsideración" },
              { k: "fecha_aceptacion", l: "Aceptación" },
              { k: "fecha_firma", l: "Firma acuerdo" },
              { k: "fecha_pago", l: "Pago" },
              { k: "fecha_cobro", l: "Cobro" },
              { k: "fecha_mediacion", l: "Mediación" },
              { k: "fecha_inicio_juicio", l: "Inicio de juicio" },
            ].map(f => (
              <label key={f.k}>
                <span style={labelStyle}>{f.l}</span>
                <input type="date" value={fechas[f.k] || ""} onChange={e => setFechas(prev => ({ ...prev, [f.k]: e.target.value }))} style={inputStyle} />
              </label>
            ))}
          </div>
          <button onClick={guardarFechas} style={{ background: "#3b82f6", border: "none", borderRadius: 8, color: "white", padding: "9px 20px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Guardar fechas</button>
        </div>

        {/* ── Feature 11: TIMELINE ── */}
        <div style={sectionStyle}>
          <div style={{ fontSize: 13, fontWeight: 800, color: Th.text, marginBottom: 14 }}>⏳ Timeline de acciones</div>
          {loadingAcciones && <div style={{ color: Th.muted, fontSize: 13 }}>Cargando...</div>}
          {!loadingAcciones && acciones.length === 0 && (
            <div style={{ color: Th.muted, fontSize: 13, textAlign: "center", padding: "12px 0" }}>Sin acciones registradas aún</div>
          )}
          <div style={{ paddingLeft: 4 }}>
            {acciones.map((a, i) => (
              <div key={a.id || i} style={{ display: "flex", gap: 12, marginBottom: 10 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                  <div style={{ width: 9, height: 9, borderRadius: "50%", background: i === 0 ? "#6366f1" : Th.border, marginTop: 3, flexShrink: 0, border: i === 0 ? "2px solid #6366f144" : "none" }} />
                  {i < acciones.length - 1 && <div style={{ width: 1, flex: 1, background: Th.border, marginTop: 4, minHeight: 18 }} />}
                </div>
                <div style={{ flex: 1, paddingBottom: 6 }}>
                  <div style={{ fontSize: 11, color: i === 0 ? "#6366f1" : Th.muted, fontWeight: i === 0 ? 700 : 500, marginBottom: 2 }}>
                    {formatoFecha(a.fecha?.slice(0, 10))}{i === 0 ? " · más reciente" : ""}
                    <span style={{ marginLeft: 6, background: Th.card2, borderRadius: 4, padding: "1px 6px", fontSize: 10, color: Th.muted }}>{a.tipo}</span>
                  </div>
                  <div style={{ fontSize: 13, color: Th.sub, lineHeight: 1.5 }}>{a.descripcion}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── MODALES ── */}
      {previewArchivo && <PreviewModal archivo={previewArchivo} onClose={() => setPreviewArchivo(null)} />}

      {modalEscrito && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: Th.card, border: `1px solid ${Th.border}`, borderRadius: 16, padding: "28px 24px", maxWidth: 380, width: "100%" }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: Th.text, marginBottom: 18 }}>📝 Generar escrito de representación</div>
            <label style={{ display: "block", marginBottom: 16 }}>
              <span style={labelStyle}>DNI del asegurado *</span>
              <input value={dniEscrito} onChange={e => setDniEscrito(e.target.value)} placeholder="Ej: 25123456" style={inputStyle} />
            </label>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setModalEscrito(false); setDniEscrito(""); }} style={{ flex: 1, background: Th.card2, border: `1px solid ${Th.border}`, borderRadius: 8, color: Th.sub, padding: "10px", cursor: "pointer", fontSize: 14 }}>Cancelar</button>
              <button onClick={generarEscrito} disabled={generandoEscrito || !dniEscrito.trim()} style={{ flex: 2, background: generandoEscrito || !dniEscrito.trim() ? Th.card2 : "#f97316", border: "none", borderRadius: 8, color: "white", padding: "10px", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>
                {generandoEscrito ? "Generando..." : "Generar PDF"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}

// ── ARCHIVO ROW ────────────────────────────────────────────────────────────────
function ArchivoRow({ archivo, onPreview, onCategorizar, dark, Th }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const esImagen = [".jpg", ".jpeg", ".png"].includes(archivo.ext);
  const kb = (archivo.tamaño / 1024).toFixed(1);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: Th.card2, borderRadius: 8, padding: "9px 12px", marginBottom: 6, border: `1px solid ${Th.border}` }}>
      <div style={{ fontSize: 20 }}>{esImagen ? "🖼" : "📄"}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: Th.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{archivo.nombre}</div>
        <div style={{ fontSize: 11, color: Th.muted }}>{kb} KB · {archivo.tipo || archivo.ext}</div>
      </div>
      <button onClick={onPreview} style={{ background: "#6366f122", border: "1px solid #6366f144", borderRadius: 6, color: "#818cf8", padding: "5px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Ver</button>
      <div style={{ position: "relative" }}>
        <button onClick={() => setMenuOpen(m => !m)} style={{ background: "#f9731622", border: "1px solid #f9731644", borderRadius: 6, color: "#f97316", padding: "5px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Categorizar ▾</button>
        {menuOpen && (
          <div style={{ position: "absolute", right: 0, top: "110%", background: Th.card, border: `1px solid ${Th.border}`, borderRadius: 10, zIndex: 50, minWidth: 160, boxShadow: "0 8px 24px #0006", overflow: "hidden" }}>
            {TIPOS_DOC.map(tipo => (
              <button key={tipo} onClick={() => { onCategorizar(tipo); setMenuOpen(false); }} style={{ display: "block", width: "100%", background: "none", border: "none", padding: "9px 14px", color: Th.text, fontSize: 13, cursor: "pointer", textAlign: "left" }}
                onMouseEnter={e => e.target.style.background = Th.card2}
                onMouseLeave={e => e.target.style.background = "none"}
              >{tipo}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}