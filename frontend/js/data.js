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

  // Trae los 4 tipos de documento del donante con sus datos completos ya
  // resueltos (join), agrupados por pestaña. `documentos` es solo un índice
  // (tipo + referencia_id) — acá se resuelve contra la tabla real que
  // corresponda en cada caso. `formulario_consentimiento` no pasa por
  // `documentos` (el donante ya lo tiene por su propio usuario_id, desde que
  // se conectó el flujo F1/F2), así que se arma aparte.
  async function cargarMisDocumentos() {
    await HemoRed.db.init();
    const s = HemoRed.sesion.get();
    if (!s) return { resultados: [], evaluaciones: [], certificados: [], consentimientos: [], donacionesSinCertificado: [] };

    const hospitales = HemoRed.db.all('hospitales');
    const turnos = HemoRed.db.all('turnos');
    const docs = HemoRed.db.where('documentos', 'usuario_id', s.usuario_id).filter(d => d.visible);
    const donaciones = HemoRed.db.where('donaciones', 'usuario_id', s.usuario_id);

    const resultados = docs
      .filter(d => d.tipo === 'resultado_analisis')
      .map(d => ({ ...d, hospital: hospitales.find(h => h.id === d.hospital_id), analisis: HemoRed.db.find('resultado_analisis', d.referencia_id) }))
      .filter(d => d.analisis?.visible_para_donante !== false);

    const profesionales = HemoRed.db.all('profesionales');
    const evaluaciones = docs
      .filter(d => d.tipo === 'evaluacion_clinica')
      .map(d => {
        const donacion = donaciones.find(don => don.id === d.donacion_id);
        const profesional = donacion ? profesionales.find(p => p.id === donacion.profesional_id) : null;
        return { ...d, hospital: hospitales.find(h => h.id === d.hospital_id), donacion, profesional };
      });

    const certificados = docs
      .filter(d => d.tipo === 'certificado')
      .map(d => ({ ...d, hospital: hospitales.find(h => h.id === d.hospital_id), certificado: HemoRed.db.find('certificado_donacion', d.referencia_id) }));

    // Donaciones que todavía no tienen ni un documento "certificado" (ni
    // emitido ni pedido) — son las candidatas a mostrar el botón "Solicitar
    // certificado". Con los 2 datos semilla no hay ningún caso así hoy (las
    // dos ya tienen certificado emitido) — queda listo para cuando sí lo haya.
    const donacionesSinCertificado = donaciones.filter(don => !docs.some(d => d.tipo === 'certificado' && d.donacion_id === don.id))
      .map(don => ({ ...don, hospital: hospitales.find(h => h.id === don.hospital_id) }));

    // formulario_consentimiento no pasa por `documentos` — el donante ya lo
    // tiene indexado por su propio usuario_id desde que se conectó F1/F2.
    const consentimientos = HemoRed.db.where('formulario_consentimiento', 'usuario_id', s.usuario_id).map(f => {
      const turno = turnos.find(t => t.id === f.turno_id);
      return { ...f, hospital: turno ? hospitales.find(h => h.id === turno.hospital_id) : null };
    });

    return { resultados, evaluaciones, certificados, consentimientos, donacionesSinCertificado };
  }

  // El donante pide el certificado de una donación que todavía no lo tiene.
  // Crea el "documento" en estado pendiente (sin certificado_donacion
  // todavía) — el hospital es quien más adelante lo emite de verdad
  // (emitirCertificado(), ver docs/04, todavía sin conectar). No duplica el
  // pedido si ya existe uno.
  function solicitarCertificado(donacionId) {
    const donacion = HemoRed.db.find('donaciones', donacionId);
    if (!donacion) return { ok: false, error: 'Donación no encontrada.' };

    const yaExiste = HemoRed.db.where('documentos', 'donacion_id', donacionId).some(d => d.tipo === 'certificado');
    if (yaExiste) return { ok: false, error: 'Ya existe una solicitud o certificado para esta donación.' };

    const hospital = HemoRed.db.find('hospitales', donacion.hospital_id);
    const documento = HemoRed.db.crear('documentos', {
      usuario_id: donacion.usuario_id,
      hospital_id: donacion.hospital_id,
      donacion_id: donacionId,
      tipo: 'certificado',
      referencia_id: null, // se completa cuando el hospital emite el certificado real
      titulo: `Certificado de donación — ${hospital?.nombre || 'Hospital'}`,
      fecha: donacion.registrado_en?.slice(0, 10) || null,
      visible: true,
    });
    return { ok: true, documento };
  }

  // ===== SOLICITUDES DE CORRECCIÓN =====
  // Solo existe para certificados de donación (los que el donante pide para
  // presentar en una empresa) — NO para formularios de consentimiento, que
  // son otra cosa. Campos "reportables" y a qué tabla/campo real corresponde
  // cada uno, así resolverSolicitudCorreccion() sabe qué actualizar cuando
  // el hospital aprueba, sin tener que hardcodear un switch en la UI.
  //
  // Volumen donado, profesional a cargo y hospital quedan afuera a propósito:
  // son datos que carga el sistema/hospital en el momento de la donación, el
  // donante no los controla ni puede saber si están "mal" desde su lugar —
  // no son reportables acá.
  const CAMPOS_CORREGIBLES = {
    nombre:         { label: 'Nombre',           tabla: 'usuarios',            campo: 'nombre' },
    apellido:       { label: 'Apellido',          tabla: 'usuarios',            campo: 'apellido' },
    dni:            { label: 'DNI',               tabla: 'usuarios',            campo: 'numero_documento' },
    fecha_donacion: { label: 'Fecha de donación', tabla: 'certificado_donacion', campo: 'fecha_donacion' },
  };

  // El donante reporta uno o más campos incorrectos de un certificado.
  // `campos` es un array de { campo, valorActual, valorPropuesto }. No
  // duplica: si ya hay una solicitud pendiente para el mismo certificado,
  // la rechaza en vez de crear otra.
  function crearSolicitudCorreccion(usuarioId, certificadoId, campos) {
    if (!campos || campos.length === 0) return { ok: false, error: 'Marcá al menos un campo para reportar.' };

    for (const c of campos) {
      if (!CAMPOS_CORREGIBLES[c.campo]) return { ok: false, error: `Campo no reportable: ${c.campo}.` };
      if (!c.valorPropuesto || !c.valorPropuesto.trim()) return { ok: false, error: 'Completá la corrección para cada campo marcado.' };
    }

    const cert = HemoRed.db.find('certificado_donacion', certificadoId);
    if (!cert) return { ok: false, error: 'Certificado no encontrado.' };

    const yaExiste = HemoRed.db.all('solicitudes_correccion')
      .some(s => s.certificado_id === certificadoId && s.estado === 'pendiente');
    if (yaExiste) return { ok: false, error: 'Ya tenés una solicitud pendiente para este certificado.' };

    const solicitud = HemoRed.db.crear('solicitudes_correccion', {
      usuario_id: usuarioId,
      hospital_id: cert.hospital_id,
      certificado_id: certificadoId,
      campos: campos.map(c => ({ campo: c.campo, valor_actual: c.valorActual, valor_propuesto: c.valorPropuesto.trim() })),
      estado: 'pendiente',
      fecha_solicitud: new Date().toISOString(),
      resuelto_por: null,
      fecha_resolucion: null,
      motivo_rechazo: null,
    });
    return { ok: true, solicitud };
  }

  // Solicitudes del hospital logueado, con el donante ya resuelto.
  function cargarSolicitudesCorreccion() {
    const s = HemoRed.sesion.get();
    if (!s) return [];
    const usuarioHospital = HemoRed.db.find('usuarios', s.usuario_id);
    const hospitalId = usuarioHospital?.hospital_id;
    if (!hospitalId) return [];

    const usuarios = HemoRed.db.all('usuarios');
    return HemoRed.db.where('solicitudes_correccion', 'hospital_id', hospitalId)
      .map(sol => ({ ...sol, donante: usuarios.find(u => u.id === sol.usuario_id) }))
      .sort((a, b) => new Date(b.fecha_solicitud) - new Date(a.fecha_solicitud));
  }

  // El hospital aprueba o rechaza una solicitud. Al aprobar, aplica cada
  // campo corregido sobre la tabla/campo real que le corresponda (según
  // CAMPOS_CORREGIBLES) — no alcanza con marcar la solicitud como
  // aprobada, el dato tiene que cambiar de verdad.
  function resolverSolicitudCorreccion(solicitudId, { aprobar, motivoRechazo }) {
    const solicitud = HemoRed.db.find('solicitudes_correccion', solicitudId);
    if (!solicitud) return { ok: false, error: 'Solicitud no encontrada.' };
    if (solicitud.estado !== 'pendiente') return { ok: false, error: 'Esta solicitud ya fue resuelta.' };

    const s = HemoRed.sesion.get();

    if (aprobar) {
      const cambiosPorTabla = {};
      solicitud.campos.forEach(c => {
        const def = CAMPOS_CORREGIBLES[c.campo];
        if (!def) return;
        if (!cambiosPorTabla[def.tabla]) cambiosPorTabla[def.tabla] = {};
        cambiosPorTabla[def.tabla][def.campo] = c.valor_propuesto;
      });

      if (cambiosPorTabla.usuarios) HemoRed.db.actualizar('usuarios', solicitud.usuario_id, cambiosPorTabla.usuarios);
      if (cambiosPorTabla.certificado_donacion) HemoRed.db.actualizar('certificado_donacion', solicitud.certificado_id, cambiosPorTabla.certificado_donacion);
    }

    HemoRed.db.actualizar('solicitudes_correccion', solicitudId, {
      estado: aprobar ? 'aprobada' : 'rechazada',
      resuelto_por: s?.usuario_id || null,
      fecha_resolucion: new Date().toISOString(),
      motivo_rechazo: aprobar ? null : (motivoRechazo || null),
    });

    // Al rechazar, el certificado vuelve a la normalidad sin marca visible
    // en "Mis documentos" — el aviso con el motivo le llega al donante acá,
    // en Notificaciones (no se inventa un mecanismo de aviso aparte).
    if (!aprobar) {
      crearNotificacionDonante(solicitud.usuario_id, {
        tipo: 'documentos',
        icono: 'ti-certificate-off',
        tono: 'naranja',
        titulo: 'Tu solicitud de corrección fue rechazada',
        descripcion: motivoRechazo || 'El hospital revisó tu solicitud y no pudo aplicar la corrección.',
        accionTexto: 'Ver certificado',
        accionUrl: '../donante/mis_documentos.html',
      });
    }

    return { ok: true };
  }

  // ===== NOTIFICACIONES (DONANTE) =====
  // Agrupa cada notificación en 'hoy'/'ayer'/'semana'/'antes' contra la
  // misma fecha fija de demo que usa el resto del sitio (AHORA_DEMO, arriba
  // en este archivo) — así la agrupación no depende de la fecha real del
  // navegador que corre la demo.
  function cargarNotificacionesDonante() {
    const s = HemoRed.sesion.get();
    if (!s) return [];
    const hoy = AHORA_DEMO.toISOString().slice(0, 10);
    const ayer = new Date(AHORA_DEMO.getTime() - 86400000).toISOString().slice(0, 10);
    return HemoRed.db.where('notificaciones_donante', 'usuario_id', s.usuario_id)
      .map(n => {
        const dia = n.fecha.slice(0, 10);
        let grupo = 'antes';
        if (dia === hoy) grupo = 'hoy';
        else if (dia === ayer) grupo = 'ayer';
        else if ((AHORA_DEMO - new Date(dia)) <= 7 * 86400000) grupo = 'semana';
        return { ...n, grupo };
      })
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  }

  function marcarNotificacionLeida(id) {
    return HemoRed.db.actualizar('notificaciones_donante', id, { leido: true });
  }

  function marcarTodasNotificacionesLeidas(usuarioId) {
    HemoRed.db.where('notificaciones_donante', 'usuario_id', usuarioId)
      .filter(n => !n.leido)
      .forEach(n => HemoRed.db.actualizar('notificaciones_donante', n.id, { leido: true }));
    return { ok: true };
  }

  // Uso interno (ej. resolverSolicitudCorreccion() al rechazar) para avisarle
  // algo al donante sin depender de que entre a mirar un documento puntual.
  function crearNotificacionDonante(usuarioId, { tipo, icono, tono, titulo, descripcion, accionTexto, accionUrl }) {
    return HemoRed.db.crear('notificaciones_donante', {
      usuario_id: usuarioId,
      tipo, icono, tono, titulo, descripcion,
      fecha: new Date().toISOString(),
      leido: false,
      accion_texto: accionTexto || null,
      accion_url: accionUrl || null,
    });
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
    const donaciones = HemoRed.db.all('donaciones');

    return turnos.map(t => ({
      ...t,
      donante: usuarios.find(u => u.id === t.usuario_id),
      campana: campanas.find(c => c.id === t.campana_id),
      // Un turno puede estar "confirmado" con ambos formularios ya
      // completados (listo para registrar la donación) — pero si ya existe
      // un registro en `donaciones` para este turno, no hay que ofrecer
      // registrarla de nuevo (ver registrarDonacion() más abajo).
      tieneDonacionRegistrada: donaciones.some(d => d.turno_id === t.id),
    }));
  }

  // Profesionales activos vinculados al hospital logueado — para el select
  // de "Registrar donación" (antes tenía 4 nombres hardcodeados, 3 de los
  // cuales ni siquiera existían en `profesionales.json`).
  async function cargarProfesionalesHospital() {
    const db = await HemoRed.db.init();
    const s = HemoRed.sesion.get();
    const usuario = HemoRed.db.find('usuarios', s?.usuario_id);
    const hospitalId = usuario?.hospital_id;
    const vinculos = HemoRed.db.all('profesional_hospital').filter(ph => ph.hospital_id === hospitalId && ph.activo);
    const profesionales = HemoRed.db.all('profesionales');
    return vinculos.map(v => profesionales.find(p => p.id === v.profesional_id)).filter(Boolean);
  }

  // Token de 6 caracteres para el formulario post-donación (F4) — sin
  // caracteres ambiguos (0/O, 1/I). No hace falta que sea criptográfico:
  // es solo un código corto que el donante lee/escanea, la seguridad real
  // la da que es de un solo uso y expira a las 24hs.
  function generarTokenPostdonacion() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let token;
    do {
      token = '';
      for (let i = 0; i < 6; i++) token += chars[Math.floor(Math.random() * chars.length)];
    } while (HemoRed.db.all('formulario_postdonacion').some(f => f.token === token));
    return token;
  }

  // El profesional registra que la donación se completó de verdad: crea el
  // registro real en `donaciones` (hasta acá, el turno solo reflejaba una
  // intención) y genera el token de un solo uso para el formulario F4
  // (autoexclusión post-donación anónima) — ver validarTokenPostdonacion()/
  // guardarRespuestaPostdonacion() más abajo. También le avisa al donante
  // por notificación in-app (con el link directo, no un QR: ver docs/04
  // para por qué QR solo tiene sentido del lado del profesional).
  function registrarDonacion(turnoId, { profesionalId, volumenMl, resultadoApto, observaciones }) {
    const turno = HemoRed.db.find('turnos', turnoId);
    if (!turno) return { ok: false, error: 'Turno no encontrado.' };
    if (turno.estado !== 'confirmado') return { ok: false, error: 'Este turno no está en condiciones de registrar una donación.' };
    if (!turno.formulario_autoexclusion_completado || !turno.formulario_cuestionario_completado) {
      return { ok: false, error: 'El donante todavía no completó los formularios pre-donación (F1/F2).' };
    }
    if (HemoRed.db.all('donaciones').some(d => d.turno_id === turnoId)) {
      return { ok: false, error: 'Ya existe una donación registrada para este turno.' };
    }
    if (!profesionalId) return { ok: false, error: 'Seleccioná el profesional que atendió la donación.' };

    const numeroBolsa = 'BLS-2026-' + String(HemoRed.db.nextId('donaciones')).padStart(4, '0');
    const [hh, mm] = turno.hora.split(':').map(Number);
    const finMin = mm + 20;
    const horaFin = `${String(hh + Math.floor(finMin / 60)).padStart(2, '0')}:${String(finMin % 60).padStart(2, '0')}`;

    const donacion = HemoRed.db.crear('donaciones', {
      turno_id: turnoId,
      campana_id: turno.campana_id,
      usuario_id: turno.usuario_id,
      hospital_id: turno.hospital_id,
      profesional_id: profesionalId,
      numero_bolsa: numeroBolsa,
      volumen_ml: volumenMl || 450,
      hora_inicio: turno.hora,
      hora_fin: horaFin,
      tipo_bolsa: 'Fresenius Kabi 450ml',
      // Signos vitales: quedan sin cargar acá — es responsabilidad de la
      // evaluación clínica (F3), un flujo propio del Profesional de salud
      // que todavía no está conectado (ver docs/04). Este modal es el lado
      // administrativo (Hospital) de registrar que la donación ocurrió.
      presion_arterial: null,
      frecuencia_cardiaca: null,
      temperatura: null,
      glucosa: null,
      peso_kg: null,
      hemoglobina: null,
      resultado_apto: resultadoApto !== false,
      reacciones: null,
      observaciones: observaciones || null,
      registrado_en: AHORA_DEMO.toISOString(),
    });

    HemoRed.db.actualizar('turnos', turnoId, { estado: 'completado' });

    // El token y su expiración usan la hora real (no AHORA_DEMO): tienen que
    // seguir siendo válidos/inválidos de verdad cuando alguien prueba el
    // link más tarde, sin importar qué día diga la demo.
    const token = generarTokenPostdonacion();
    const formularioPostdonacion = HemoRed.db.crear('formulario_postdonacion', {
      numero_bolsa: numeroBolsa,
      token,
      token_expira_en: new Date(Date.now() + 24 * 3600000).toISOString(),
      token_usado: false,
      usar_para_transfusion: null,
      motivo_descarte: null,
      completado_en: null,
    });

    crearNotificacionDonante(turno.usuario_id, {
      tipo: 'documentos',
      icono: 'ti-heart-check',
      tono: 'rosa',
      titulo: 'Completá tu formulario post-donación',
      descripcion: 'Antes de irte, contanos de forma anónima si tu sangre puede transfundirse. Es privado — nadie en la sala va a saber tu respuesta.',
      accionTexto: 'Completar formulario',
      accionUrl: '../donante/postdonacion_anonimo.html?token=' + token,
    });

    return { ok: true, donacion, token };
  }

  // ===== FORMULARIO POST-DONACIÓN (F4, anónimo) =====
  // Ninguna de las 2 funciones de acá abajo debe depender de sesión: el
  // donante completa esto sin loguearse, identificado únicamente por el
  // token de la URL. `formulario_postdonacion` no tiene `usuario_id` — se
  // ancla a `numero_bolsa`, nunca a la identidad del donante (ver docs/01).
  function validarTokenPostdonacion(token) {
    if (!token) return { ok: false, error: 'Falta el código del formulario en el link.' };
    const formulario = HemoRed.db.all('formulario_postdonacion').find(f => f.token === token.toUpperCase());
    if (!formulario) return { ok: false, error: 'Este link no es válido.' };
    if (formulario.token_usado) return { ok: false, error: 'Este formulario ya fue completado. Gracias por tu respuesta.' };
    if (new Date(formulario.token_expira_en) < new Date()) return { ok: false, error: 'Este link venció (es válido por 24hs desde tu donación). Si todavía necesitás reportar algo, hablá con el personal del banco de sangre.' };
    return { ok: true, token: formulario.token };
  }

  function guardarRespuestaPostdonacion(token, { usarParaTransfusion, motivoDescarte }) {
    const validacion = validarTokenPostdonacion(token);
    if (!validacion.ok) return validacion;

    const formulario = HemoRed.db.all('formulario_postdonacion').find(f => f.token === token.toUpperCase());
    HemoRed.db.actualizar('formulario_postdonacion', formulario.id, {
      usar_para_transfusion: usarParaTransfusion,
      motivo_descarte: usarParaTransfusion ? null : (motivoDescarte || null),
      token_usado: true,
      completado_en: new Date().toISOString(),
    });
    return { ok: true };
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
    solicitarCertificado,
    CAMPOS_CORREGIBLES,
    crearSolicitudCorreccion,
    cargarSolicitudesCorreccion,
    resolverSolicitudCorreccion,
    cargarNotificacionesDonante,
    marcarNotificacionLeida,
    marcarTodasNotificacionesLeidas,
    actualizarPerfilDonante,
    actualizarPreferenciasNotificacion,
    agregarEmpleador,
    editarEmpleador,
    eliminarEmpleador,
    cargarDashboardHospital,
    cargarTurnosHoy,
    cargarProfesionalesHospital,
    registrarDonacion,
    validarTokenPostdonacion,
    guardarRespuestaPostdonacion,
    cargarTurnosProfesional,
    cargarDashboardAdmin,
  };
})();
