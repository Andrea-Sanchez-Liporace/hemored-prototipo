/* ============================================================
   HEMORED — db.js
   Carga los 20 JSONs de la BD simulada y los expone globalmente
   Uso: await HemoRed.db.init() → HemoRed.db.tabla.nombre
   ============================================================ */

const HemoRed = window.HemoRed || {};
HemoRed.db = (function() {
  // Detecta la profundidad del archivo que llama para armar el path correcto a db/
  function detectBase() {
    const path = window.location.pathname;
    const parts = path.split('/').filter(p => p && p !== 'index.html');
    // Folders dentro de hemored/ tienen profundidad 1 (donante/, hospital/, etc)
    // index.html está en la raíz → profundidad 0
    const folders = ['donante','hospital','profesional','admin','publico'];
    const inSubfolder = folders.some(f => path.includes('/' + f + '/'));
    return inSubfolder ? '../db/' : 'db/';
  }
  const BASE = detectBase();
  const tablas = [
    'planes','tipo_documento','medios_pago','hospitales','usuarios',
    'profesionales','profesional_hospital','pacientes','paciente_hospital',
    'campanas','turnos','donaciones','formulario_consentimiento',
    'formulario_postdonacion','resultado_analisis','certificado_donacion',
    'documentos','facturas','mensajes','hospital_plan_historial'
  ];

  let data = {};
  let _initialized = false;

  const STORAGE_KEY = 'hemored_overrides';

  // Persiste el estado completo (BD base + escrituras) en localStorage.
  // Sin esto, cualquier crear()/actualizar() se pierde al cambiar de página.
  function _persistir() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('No se pudo persistir en localStorage', e);
    }
  }

  // Sobrescribe las tablas cargadas desde JSON con lo que haya guardado
  // el usuario en esta sesión del navegador (si existe).
  function _restaurar() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const overrides = JSON.parse(raw);
      Object.keys(overrides).forEach(t => { data[t] = overrides[t]; });
    } catch (e) {
      console.warn('No se pudo restaurar localStorage', e);
    }
  }

  async function init(basePath) {
    if (_initialized) return data;
    const base = basePath || BASE;
    const promises = tablas.map(t =>
      fetch(`${base}${t}.json`)
        .then(r => r.json())
        .then(d => { data[t] = d; })
        .catch(() => { data[t] = []; console.warn(`No se pudo cargar ${t}.json`); })
    );
    await Promise.all(promises);
    _restaurar();
    _initialized = true;
    console.log('✓ HemoRed DB cargada —', Object.keys(data).length, 'tablas');
    return data;
  }

  // Helpers tipo ORM mínimo
  function find(tabla, id) {
    return (data[tabla] || []).find(r => r.id === id) || null;
  }
  function where(tabla, campo, valor) {
    return (data[tabla] || []).filter(r => r[campo] === valor);
  }
  function all(tabla) {
    return data[tabla] || [];
  }

  function nextId(tabla) {
    const rows = data[tabla] || [];
    return rows.reduce((max, r) => Math.max(max, r.id || 0), 0) + 1;
  }

  // Crea un registro nuevo en `tabla`, le asigna id autoincremental
  // y persiste. No hay backend: esto vive en memoria + localStorage.
  function crear(tabla, objeto) {
    if (!data[tabla]) data[tabla] = [];
    const nuevo = { id: nextId(tabla), ...objeto };
    data[tabla].push(nuevo);
    _persistir();
    return nuevo;
  }

  // Actualiza (merge) un registro existente por id y persiste.
  function actualizar(tabla, id, cambios) {
    const row = find(tabla, id);
    if (!row) return null;
    Object.assign(row, cambios);
    _persistir();
    return row;
  }

  // Borra todas las escrituras de esta sesión y vuelve a los JSON originales
  // (recargar la página después de llamar esto).
  function reset() {
    localStorage.removeItem(STORAGE_KEY);
  }

  return { init, find, where, all, crear, actualizar, reset, data };
})();

window.HemoRed = HemoRed;
