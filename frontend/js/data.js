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

  // Pinta las tarjetas de campaña reales en el grid de búsqueda del donante.
  // Mantiene los mismos data-attributes (sangre/provincia/urgencia) que
  // usa filtrarCampanas() en donante/dashboard.html para que el filtro
  // client-side siga funcionando sobre contenido real.
  function renderCampanas(campanas, hospitales, gridSelector = '.campaigns-grid') {
    const grid = document.querySelector(gridSelector);
    if (!grid) return;

    grid.innerHTML = campanas.map(c => {
      const hospital = hospitales.find(h => h.id === c.hospital_id);
      const pct = c.unidades_requeridas ? Math.round((c.unidades_obtenidas / c.unidades_requeridas) * 100) : 0;
      const tipos = c.tipo_sangre_requerida ? [c.tipo_sangre_requerida] : ['Cualquier tipo'];
      const fechaCierre = new Date(c.fecha_cierre + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });

      return `
        <div class="campaign-card" data-sangre="${c.tipo_sangre_requerida || ''}" data-provincia="${hospital?.provincia || ''}" data-urgencia="${c.urgente ? 'urgente' : 'activa'}">
          <div class="campaign-header">
            <div class="campaign-hospital">${hospital?.nombre || 'Hospital'}</div>
            <span class="campaign-badge ${c.urgente ? 'urgente' : 'activa'}">${c.urgente ? 'Urgente' : 'Activa'}</span>
          </div>
          <div class="campaign-tipo">
            ${tipos.map(t => `<span class="tipo-badge"><i class="ti ti-droplet" aria-hidden="true"></i>${t}</span>`).join('')}
          </div>
          <div class="campaign-info">
            <div class="campaign-info-item"><i class="ti ti-map-pin" style="color:#a9435d;" aria-hidden="true"></i>${hospital?.ciudad || '—'}</div>
            <div class="campaign-info-item"><i class="ti ti-calendar" style="color:#a9435d;" aria-hidden="true"></i>Vence ${fechaCierre}</div>
          </div>
          <div class="campaign-desc">${c.descripcion || ''}</div>
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;"></div></div>
          <div class="campaign-footer">
            <div class="campaign-spots">${c.unidades_obtenidas} de ${c.unidades_requeridas} turnos cubiertos</div>
            <button class="campaign-btn" onclick="window.location='../donante/campana_detalle.html?id=${c.id}'">Reservar turno</button>
          </div>
        </div>`;
    }).join('');

    const countEl = document.querySelector('.campaigns-count');
    if (countEl) countEl.textContent = `${campanas.length} campaña${campanas.length !== 1 ? 's' : ''} encontrada${campanas.length !== 1 ? 's' : ''}`;
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

  // Reserva un turno real. Valida: no duplicar turno para la misma campaña,
  // que el horario no esté ya tomado en ese hospital, y la regla de 90 días
  // desde la última donación (citada en docs/03-documentacion-tecnica-consolidada.md).
  function crearTurno({ usuario_id, campana_id, hospital_id, fecha, hora }) {
    const yaTiene = HemoRed.db.where('turnos', 'usuario_id', usuario_id)
      .some(t => t.campana_id === campana_id && ['confirmado', 'en_curso', 'completado'].includes(t.estado));
    if (yaTiene) return { ok: false, error: 'Ya tenés un turno para esta campaña.' };

    const ocupado = HemoRed.db.all('turnos')
      .some(t => t.hospital_id === hospital_id && t.fecha === fecha && t.hora === hora && t.estado !== 'cancelado');
    if (ocupado) return { ok: false, error: 'Ese horario ya no está disponible. Elegí otro.' };

    const fechasDonaciones = HemoRed.db.where('donaciones', 'usuario_id', usuario_id)
      .map(d => d.registrado_en).filter(Boolean).sort();
    const ultimaDonacion = fechasDonaciones[fechasDonaciones.length - 1];
    if (ultimaDonacion) {
      const dias = Math.floor((new Date(fecha) - new Date(ultimaDonacion)) / 86400000);
      if (dias < 90) {
        const habilitado = new Date(new Date(ultimaDonacion).getTime() + 90 * 86400000)
          .toLocaleDateString('es-AR');
        return { ok: false, error: `Todavía no podés donar: tu última donación fue hace menos de 90 días. Vas a poder reservar turno a partir del ${habilitado}.` };
      }
    }

    const turno = HemoRed.db.crear('turnos', {
      campana_id, usuario_id, hospital_id, fecha, hora,
      // Arranca pendiente: el hospital lo confirma o rechaza (RF3).
      estado: 'pendiente',
      formulario_autoexclusion_completado: false,
      formulario_autoexclusion_completado_en: null,
      autoexclusion_completado_por: null,
      formulario_cuestionario_completado: false,
      formulario_cuestionario_completado_en: null,
      cuestionario_completado_por: null,
      creado_en: new Date().toISOString(),
    });
    return { ok: true, turno };
  }

  // Referencia fija de "ahora" para las ventanas de 2h/24h de abajo — el
  // dataset de demo vive fijo en mayo 2026 (mismo criterio que HOY en
  // cargarTurnosHoy()/campana_detalle.html), así que no podemos comparar
  // contra la hora real del sistema (siempre sería "ya pasó hace meses").
  const AHORA_DEMO = new Date('2026-05-17T09:00:00');

  function horasHastaElTurno(turno) {
    const fechaTurno = new Date(`${turno.fecha}T${turno.hora}:00`);
    return (fechaTurno - AHORA_DEMO) / 3600000;
  }

  function datosContactoHospital(hospitalId) {
    const h = HemoRed.db.find('hospitales', hospitalId);
    if (!h) return '';
    return ` Contactá al hospital directamente: ${h.telefono || h.contacto_telefono || h.email}.`;
  }

  // El donante reprograma su turno (mismo turno_id, nueva fecha/hora).
  // Aplica la misma ventana de 24hs sin importar si el turno está
  // pendiente o confirmado (ver nota en docs/03-documentacion-tecnica-consolidada.md,
  // sección "Mis turnos": el motivo es darle margen de reacción al hospital,
  // y ese motivo aplica igual en ambos estados).
  function actualizarTurno(turnoId, { fecha, hora }) {
    const turno = HemoRed.db.find('turnos', turnoId);
    if (!turno) return { ok: false, error: 'Turno no encontrado.' };

    if (horasHastaElTurno(turno) < 24) {
      return { ok: false, error: 'No podés modificar el turno a menos de 24hs de la fecha pactada.' + datosContactoHospital(turno.hospital_id) };
    }

    const ocupado = HemoRed.db.all('turnos')
      .some(t => t.id !== turnoId && t.hospital_id === turno.hospital_id && t.fecha === fecha && t.hora === hora && t.estado !== 'cancelado');
    if (ocupado) return { ok: false, error: 'Ese horario ya no está disponible. Elegí otro.' };

    return { ok: true, turno: HemoRed.db.actualizar('turnos', turnoId, { fecha, hora }) };
  }

  // El donante cancela su turno. Ventana de 2hs, misma lógica que arriba
  // respecto de aplicar igual sobre pendiente o confirmado.
  function cancelarTurno(turnoId) {
    const turno = HemoRed.db.find('turnos', turnoId);
    if (!turno) return { ok: false, error: 'Turno no encontrado.' };

    if (horasHastaElTurno(turno) < 2) {
      return { ok: false, error: 'No podés cancelar el turno a menos de 2hs de la fecha pactada.' + datosContactoHospital(turno.hospital_id) };
    }

    return { ok: true, turno: HemoRed.db.actualizar('turnos', turnoId, { estado: 'cancelado' }) };
  }

  // El hospital acepta la solicitud de turno (RF3).
  function confirmarTurno(turnoId) {
    return HemoRed.db.actualizar('turnos', turnoId, { estado: 'confirmado' });
  }

  // El hospital rechaza la solicitud de turno (RF3).
  function rechazarTurno(turnoId, motivo) {
    return HemoRed.db.actualizar('turnos', turnoId, { estado: 'cancelado', motivo_rechazo: motivo || null });
  }

  // Guarda F1 (autoexclusión) + F2 (cuestionario médico) para un turno puntual.
  // F1/F2 es el formulario estándar que usan todos los hemocentros del país —
  // acá NO se agrega ningún campo propio de HemoRed (ver nota en docs/01):
  // "última donación" es un dato del perfil, no de este formulario.
  //
  // Se ancla a turno_id (no a donacion_id): al completar F1/F2 la donación
  // todavía no existe como registro — la crea el profesional más adelante,
  // en registrarDonacion(). Si ya había un registro para este turno (ej. el
  // profesional lo completó o corrigió primero), lo actualiza en vez de
  // duplicarlo, preservando lo que el profesional ya haya cargado.
  function guardarFormularioConsentimiento(turnoId, { firmaAutoexclusionUrl, firmaCuestionarioUrl, respuestas, observaciones }) {
    const turno = HemoRed.db.find('turnos', turnoId);
    if (!turno) return { ok: false, error: 'Turno no encontrado.' };
    if (!firmaAutoexclusionUrl || !firmaCuestionarioUrl) {
      return { ok: false, error: 'Faltan una o ambas firmas.' };
    }

    const ahora = new Date().toISOString();
    const existente = HemoRed.db.where('formulario_consentimiento', 'turno_id', turnoId)[0];

    const datos = {
      turno_id: turnoId,
      donacion_id: existente?.donacion_id ?? null,
      usuario_id: turno.usuario_id,
      autoexclusion_completado_por: 'donante',
      autoexclusion_fecha: ahora,
      autoexclusion_modificado_por_profesional: existente?.autoexclusion_modificado_por_profesional ?? false,
      autoexclusion_modificacion_fecha: existente?.autoexclusion_modificacion_fecha ?? null,
      cuestionario_completado_por: 'donante',
      cuestionario_fecha: ahora,
      cuestionario_modificado_por_profesional: existente?.cuestionario_modificado_por_profesional ?? false,
      cuestionario_modificacion_fecha: existente?.cuestionario_modificacion_fecha ?? null,
      firma_donante_autoexclusion_url: firmaAutoexclusionUrl,
      firma_donante_cuestionario_url: firmaCuestionarioUrl,
      firma_profesional_perfil_url: existente?.firma_profesional_perfil_url ?? null,
      firma_profesional_manual_url: existente?.firma_profesional_manual_url ?? null,
      profesional_asistio_f1: existente?.profesional_asistio_f1 ?? false,
      profesional_asistio_f2: existente?.profesional_asistio_f2 ?? false,
      // Campos agregados 2026-09-08 (no estaban en el fixture original): sin
      // esto no hay dónde guardar las ~34 respuestas Sí/No del cuestionario.
      respuestas_cuestionario: respuestas,
      observaciones: observaciones || null,
      creado_en: existente?.creado_en ?? ahora,
    };

    const formulario = existente
      ? HemoRed.db.actualizar('formulario_consentimiento', existente.id, datos)
      : HemoRed.db.crear('formulario_consentimiento', datos);

    HemoRed.db.actualizar('turnos', turnoId, {
      formulario_autoexclusion_completado: true,
      formulario_autoexclusion_completado_en: ahora,
      autoexclusion_completado_por: 'donante',
      formulario_cuestionario_completado: true,
      formulario_cuestionario_completado_en: ahora,
      cuestionario_completado_por: 'donante',
    });

    return { ok: true, formulario };
  }

  // Solo lectura: historial de donaciones reales del donante, con el
  // hospital ya resuelto (mismo patrón de join que cargarMisTurnos()).
  async function cargarMisDonaciones() {
    await HemoRed.db.init();
    const s = HemoRed.sesion.get();
    if (!s) return { donante: null, donaciones: [], proximaFechaHabilitada: null, diasHastaHabilitado: 0 };

    const donante = HemoRed.db.find('usuarios', s.usuario_id);
    const hospitales = HemoRed.db.all('hospitales');
    const donaciones = HemoRed.db.where('donaciones', 'usuario_id', s.usuario_id)
      .map(d => ({ ...d, hospital: hospitales.find(h => h.id === d.hospital_id) }))
      .sort((a, b) => new Date(b.registrado_en) - new Date(a.registrado_en));

    // Misma ventana de 90 días que usa crearTurno() para habilitar la
    // próxima reserva (AHORA_DEMO está declarado más arriba en este mismo
    // archivo) — se calcula acá para no duplicar el número mágico en dos
    // lugares. Si ya pasaron los 90 días, no hay nada que esperar.
    let proximaFechaHabilitada = null;
    let diasHastaHabilitado = 0;
    if (donaciones[0]) {
      const candidata = new Date(new Date(donaciones[0].registrado_en).getTime() + 90 * 86400000);
      const dias = Math.ceil((candidata - AHORA_DEMO) / 86400000);
      if (dias > 0) {
        proximaFechaHabilitada = candidata;
        diasHastaHabilitado = dias;
      }
    }

    return { donante, donaciones, proximaFechaHabilitada, diasHastaHabilitado };
  }

  async function cargarMisDocumentos() {
    const db = await HemoRed.db.init();
    const s = HemoRed.sesion.get();
    if (!s) return;

    const docs = HemoRed.db.where('documentos', 'usuario_id', s.usuario_id);
    return docs;
  }

  // Actualiza cualquier subconjunto de campos del perfil del donante
  // (Datos personales y Datos médicos son la misma tabla `usuarios`,
  // así que una sola función genérica cubre los dos "Guardar cambios").
  function actualizarPerfilDonante(usuarioId, cambios) {
    const usuario = HemoRed.db.find('usuarios', usuarioId);
    if (!usuario) return { ok: false, error: 'Usuario no encontrado.' };
    return { ok: true, usuario: HemoRed.db.actualizar('usuarios', usuarioId, cambios) };
  }

  // Wrapper semántico sobre actualizarPerfilDonante() para el botón
  // "Guardar preferencias" — mismos campos (notif_*), misma tabla.
  function actualizarPreferenciasNotificacion(usuarioId, prefs) {
    return actualizarPerfilDonante(usuarioId, prefs);
  }

  function agregarEmpleador(usuarioId, nombre) {
    const usuario = HemoRed.db.find('usuarios', usuarioId);
    if (!usuario) return { ok: false, error: 'Usuario no encontrado.' };
    const lista = [...(usuario.empleadores_frecuentes || []), nombre];
    return { ok: true, usuario: HemoRed.db.actualizar('usuarios', usuarioId, { empleadores_frecuentes: lista }) };
  }

  function eliminarEmpleador(usuarioId, nombre) {
    const usuario = HemoRed.db.find('usuarios', usuarioId);
    if (!usuario) return { ok: false, error: 'Usuario no encontrado.' };
    const lista = (usuario.empleadores_frecuentes || []).filter(e => e !== nombre);
    return { ok: true, usuario: HemoRed.db.actualizar('usuarios', usuarioId, { empleadores_frecuentes: lista }) };
  }

  function editarEmpleador(usuarioId, nombreViejo, nombreNuevo) {
    const usuario = HemoRed.db.find('usuarios', usuarioId);
    if (!usuario) return { ok: false, error: 'Usuario no encontrado.' };
    const lista = usuario.empleadores_frecuentes || [];
    if (!lista.includes(nombreViejo)) return { ok: false, error: 'Ese empleador ya no está en tu lista.' };
    if (!nombreNuevo) return { ok: false, error: 'El nombre no puede quedar vacío.' };
    if (nombreNuevo !== nombreViejo && lista.includes(nombreNuevo)) {
      return { ok: false, error: 'Ya tenés un empleador guardado con ese nombre.' };
    }
    const listaNueva = lista.map(e => (e === nombreViejo ? nombreNuevo : e));
    return { ok: true, usuario: HemoRed.db.actualizar('usuarios', usuarioId, { empleadores_frecuentes: listaNueva }) };
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
    renderCampanas,
    crearTurno,
    actualizarTurno,
    cancelarTurno,
    confirmarTurno,
    rechazarTurno,
    guardarFormularioConsentimiento,
    cargarMisTurnos,
    cargarMisDonaciones,
    cargarMisDocumentos,
    actualizarPerfilDonante,
    actualizarPreferenciasNotificacion,
    agregarEmpleador,
    editarEmpleador,
    eliminarEmpleador,
    cargarDashboardHospital,
    cargarTurnosHoy,
    cargarTurnosProfesional,
    cargarDashboardAdmin,
  };
})();
