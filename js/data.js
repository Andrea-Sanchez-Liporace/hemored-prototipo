/* ============================================================
   HEMORED — data.js
   Carga datos de la BD e inyecta en cada vista según el rol
   Importar DESPUÉS de db.js y sesion.js
   ============================================================ */

HemoRed.data = (function() {

  // ===== DONANTE =====
  async function cargarDashboardDonante() {
    const db = await HemoRed.db.init();
    const s = HemoRed.sesion.get();
    if (!s) return;

    const donante = HemoRed.db.find('usuarios', s.usuario_id);
    const turnos = HemoRed.db.where('turnos', 'usuario_id', s.usuario_id);
    const donaciones = HemoRed.db.where('donaciones', 'usuario_id', s.usuario_id);
    const campanas = HemoRed.db.all('campanas').filter(c => c.estado === 'activa');

    // Inyectar nombre
    _set('donante-nombre', donante?.nombre || '');
    _set('donante-tipo-sangre', donante?.tipo_sangre || '—');
    _set('total-donaciones', donaciones.length);
    _set('proximos-turnos', turnos.filter(t => t.estado === 'confirmado').length);
    _set('campanas-activas', campanas.length);

    return { donante, turnos, donaciones, campanas };
  }

  async function cargarMisTurnos() {
    const db = await HemoRed.db.init();
    const s = HemoRed.sesion.get();
    if (!s) return;

    const turnos = HemoRed.db.where('turnos', 'usuario_id', s.usuario_id);
    const hospitales = HemoRed.db.all('hospitales');
    const campanas = HemoRed.db.all('campanas');

    return turnos.map(t => ({
      ...t,
      hospital: hospitales.find(h => h.id === t.hospital_id),
      campana: campanas.find(c => c.id === t.campana_id),
    }));
  }

  async function cargarMisDocumentos() {
    const db = await HemoRed.db.init();
    const s = HemoRed.sesion.get();
    if (!s) return;

    const docs = HemoRed.db.where('documentos', 'usuario_id', s.usuario_id);
    return docs;
  }

  // ===== HOSPITAL =====
  async function cargarDashboardHospital() {
    const db = await HemoRed.db.init();
    const s = HemoRed.sesion.get();
    if (!s) return;

    const usuario = HemoRed.db.find('usuarios', s.usuario_id);
    const hospital = HemoRed.db.find('hospitales', usuario?.hospital_id);
    const campanas = HemoRed.db.where('campanas', 'hospital_id', hospital?.id);
    const turnos = HemoRed.db.where('turnos', 'hospital_id', hospital?.id);
    const donaciones = HemoRed.db.where('donaciones', 'hospital_id', hospital?.id);

    _set('hospital-nombre', hospital?.nombre || '');
    _set('campanas-activas', campanas.filter(c => c.estado === 'activa').length);
    _set('turnos-hoy', turnos.filter(t => t.fecha === '2026-05-17').length);
    _set('donaciones-mes', donaciones.length);

    return { hospital, campanas, turnos, donaciones };
  }

  async function cargarTurnosHoy() {
    const db = await HemoRed.db.init();
    const s = HemoRed.sesion.get();
    const usuario = HemoRed.db.find('usuarios', s?.usuario_id);
    const hospital = HemoRed.db.find('hospitales', usuario?.hospital_id);

    const hoy = '2026-05-17';
    const turnos = HemoRed.db.all('turnos').filter(t => t.hospital_id === hospital?.id && t.fecha === hoy);
    const usuarios = HemoRed.db.all('usuarios');
    const campanas = HemoRed.db.all('campanas');

    return turnos.map(t => ({
      ...t,
      donante: usuarios.find(u => u.id === t.usuario_id),
      campana: campanas.find(c => c.id === t.campana_id),
    }));
  }

  // ===== PROFESIONAL =====
  async function cargarTurnosProfesional() {
    const db = await HemoRed.db.init();
    const s = HemoRed.sesion.get();
    const prof = HemoRed.db.where('profesionales', 'usuario_id', s?.usuario_id)[0];
    const ph = HemoRed.db.where('profesional_hospital', 'profesional_id', prof?.id);
    const hospital_ids = ph.map(p => p.hospital_id);

    const hoy = '2026-05-17';
    const turnos = HemoRed.db.all('turnos').filter(t => hospital_ids.includes(t.hospital_id) && t.fecha === hoy);
    const usuarios = HemoRed.db.all('usuarios');
    const campanas = HemoRed.db.all('campanas');

    _set('stat-turnos-hoy', turnos.length);
    _set('stat-completados', turnos.filter(t => t.estado === 'completado').length);
    _set('stat-pendientes', turnos.filter(t => ['confirmado','en_curso'].includes(t.estado)).length);
    _set('stat-no-aptos', turnos.filter(t => t.estado === 'no_apto').length);

    return turnos.map(t => ({
      ...t,
      donante: usuarios.find(u => u.id === t.usuario_id),
      campana: campanas.find(c => c.id === t.campana_id),
    }));
  }

  // ===== ADMIN =====
  async function cargarDashboardAdmin() {
    const db = await HemoRed.db.init();

    const hospitales = HemoRed.db.all('hospitales');
    const donantes = HemoRed.db.all('usuarios').filter(u => u.rol === 'donante');
    const donaciones = HemoRed.db.all('donaciones');
    const facturas = HemoRed.db.all('facturas');

    _set('stat-hospitales', hospitales.filter(h => h.estado === 'activo').length);
    _set('stat-donantes', donantes.length);
    _set('stat-donaciones-mes', donaciones.length);
    _set('stat-facturacion', '$' + facturas.filter(f => f.estado === 'pagada').reduce((s, f) => s + f.monto, 0).toLocaleString('es-AR'));

    return { hospitales, donantes, donaciones, facturas };
  }

  // ===== HELPER =====
  function _set(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  return {
    cargarDashboardDonante,
    cargarMisTurnos,
    cargarMisDocumentos,
    cargarDashboardHospital,
    cargarTurnosHoy,
    cargarTurnosProfesional,
    cargarDashboardAdmin,
  };
})();
