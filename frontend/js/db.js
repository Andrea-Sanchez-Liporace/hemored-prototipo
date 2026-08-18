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

  return { init, find, where, all, data };
})();

window.HemoRed = HemoRed;
