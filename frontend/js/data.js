/* ============================================================
   HEMORED — data.js
   Carga datos de la BD e inyecta en cada vista según el rol
   Importar DESPUÉS de db.js y sesion.js
   ============================================================ */

HemoRed.data = (function() {

  // ===== PÚBLICO =====

  // Formulario de contacto / lead institucional (publico/contacto.html) —
  // antes `enviarFormulario()` solo cambiaba de vista, sin guardar nada. No
  // usa la tabla `mensajes` (esa es mensajería hospital↔admin, con
  // `hospital_id` obligatorio) porque acá quien escribe todavía no es un
  // hospital dado de alta en el sistema, es un lead. Queda pendiente una
  // vista de admin que liste estos mensajes — hoy solo se persisten.
  function crearMensajeContacto(datos) {
    const { nombre, apellido, email, telefono, institucion, provincia,
            tipoConsulta, campanasPromedio, campanasSimultaneas,
            alcanceGeografico, gestionActual, horarioContacto, mensaje } = datos;
    if (!nombre || !apellido || !email) {
      return { ok: false, error: 'Completá nombre, apellido y email.' };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, error: 'Ingresá un email válido.' };
    }
    const lead = HemoRed.db.crear('mensajes_contacto', {
      nombre, apellido,
      email: email.toLowerCase().trim(),
      telefono: telefono || null,
      institucion: institucion || null,
      provincia: provincia || null,
      tipo_consulta: tipoConsulta || [],
      campanas_promedio_mes: campanasPromedio || null,
      campanas_simultaneas_maximas: campanasSimultaneas || null,
      alcance_geografico: alcanceGeografico || [],
      gestion_actual: gestionActual || [],
      horario_contacto: horarioContacto || null,
      mensaje: mensaje || null,
      estado: 'pendiente',
      fecha: new Date().toISOString(),
    });
    return { ok: true, lead };
  }

  // Recuperar contraseña (publico/recuperar.html) — mismo criterio que
  // cambiarPasswordDonante() (ver sección Donante más abajo) pero busca por
  // email en vez de por usuarioId, porque quien la usa todavía no tiene
  // sesión (es justamente el problema que resuelve). No manda ningún código
  // real por email: el paso "Revisá tu email" del wizard sigue siendo solo
  // de interfaz, mismo criterio ya documentado para no simular canales que
  // el prototipo nunca puede cumplir de verdad (ver docs/04, "Validación de
  // email del donante"). No está atado a un rol — cualquier `usuarios.email`
  // real puede resetear su contraseña acá, no solo donantes.
  function restablecerPasswordPorEmail(email, nuevaPassword) {
    const emailNorm = (email || '').toLowerCase().trim();
    const usuario = HemoRed.db.where('usuarios', 'email', emailNorm)[0];
    if (!usuario) {
      return { ok: false, error: 'No encontramos ninguna cuenta con ese email.' };
    }
    if (!nuevaPassword || nuevaPassword.length < 8) {
      return { ok: false, error: 'La nueva contraseña debe tener al menos 8 caracteres.' };
    }
    const cambios = { password_hash: nuevaPassword, password_actualizada_en: new Date().toISOString() };
    return { ok: true, usuario: HemoRed.db.actualizar('usuarios', usuario.id, cambios) };
  }

  // ===== DONANTE =====

  // Campos "recomendados" del perfil, agrupados por la sección de
  // perfil.html a la que pertenecen — fuente única de verdad para el %
  // de completitud, el badge Completo/Pendiente de cada acordeón, y el
  // aviso "Perfil incompleto" del sidebar (2026-09-22: antes cada uno
  // tenía su propio criterio, o ninguno — el aviso del sidebar era texto
  // fijo, siempre visible, sin mirar el dato real).
  const CAMPOS_PERFIL_PERSONAL = ['telefono', 'fecha_nacimiento', 'numero_documento', 'provincia', 'ciudad'];
  const CAMPOS_PERFIL_MEDICOS = ['tipo_sangre', 'peso_kg'];

  function _camposCompletos(usuario, campos) {
    return campos.every(c => usuario[c] !== null && usuario[c] !== undefined && usuario[c] !== '');
  }

  // Muestra/oculta el aviso "Perfil incompleto" del sidebar (si existe en
  // la pantalla — no todas lo tienen todavía) contra el dato real del
  // donante logueado, en vez del texto fijo que había antes.
  async function verificarPerfilIncompleto() {
    await HemoRed.db.init();
    const s = HemoRed.sesion.get();
    if (!s) return;
    const usuario = HemoRed.db.find('usuarios', s.usuario_id);
    if (!usuario) return;
    const alerta = document.getElementById('sidebar-alerta-perfil');
    if (!alerta) return;
    const completo = _camposCompletos(usuario, [...CAMPOS_PERFIL_PERSONAL, ...CAMPOS_PERFIL_MEDICOS]);
    alerta.classList.toggle('hidden', completo);
  }

  async function cargarDashboardDonante() {
    const db = await HemoRed.db.init();
    _procesarVencimientosTurnos();
    const s = HemoRed.sesion.get();
    if (!s) return;

    const donante = HemoRed.db.find('usuarios', s.usuario_id);
    const turnos = HemoRed.db.where('turnos', 'usuario_id', s.usuario_id);
    const donaciones = HemoRed.db.where('donaciones', 'usuario_id', s.usuario_id);
    const campanas = HemoRed.db.all('campanas').filter(c => esCampanaActiva(c));

    // Inyectar nombre
    _set('donante-nombre', donante?.nombre || '');
    _set('donante-tipo-sangre', donante?.tipo_sangre || '—');
    _set('total-donaciones', donaciones.length);
    // Mismo criterio que "Próximos" en mis_turnos.html y el banner de
    // dashboard.html: un turno pendiente (nace así en campañas sin
    // confirmación automática) sigue siendo un turno activo del donante,
    // no solo los ya confirmados (corregido 2026-09-22).
    _set('proximos-turnos', turnos.filter(t => ['pendiente', 'confirmado', 'en_curso'].includes(t.estado)).length);
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

      // "Una campaña, varios hospitales" (2026-10-27): la tarjeta sigue
      // mostrando el hospital CREADOR como principal, pero si hay otros
      // participantes se avisa con un "+N hospitales" — y se suman sus
      // nombres/ciudades al texto de búsqueda, para que el donante
      // encuentre la campaña buscando por cualquiera de los hospitales
      // donde de verdad se puede donar, no solo por el creador.
      const participantes = HemoRed.db.where('campana_hospital', 'campana_id', c.id);
      const otrosHospitales = participantes
        .filter(p => p.hospital_id !== c.hospital_id)
        .map(p => hospitales.find(h => h.id === p.hospital_id))
        .filter(Boolean);
      const masHospitalesTag = otrosHospitales.length
        ? `<span class="tipo-badge" title="${otrosHospitales.map(h => h.nombre).join(', ')}"><i class="ti ti-building-hospital" aria-hidden="true"></i>+${otrosHospitales.length} hospital${otrosHospitales.length !== 1 ? 'es' : ''}</span>`
        : '';

      // Texto libre para el buscador del dashboard (hospital, ciudad, título):
      // todo en minúscula y sin acentos para que "ramos mejia" encuentre
      // "Hospital Ramos Mejía" sin que el donante tenga que tipear igual.
      const sinAcentos = s => (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      const todosLosHospitales = [hospital, ...otrosHospitales];
      const busqueda = sinAcentos([...todosLosHospitales.map(h => h?.nombre), ...todosLosHospitales.map(h => h?.ciudad), c.titulo].filter(Boolean).join(' '));

      return `
        <div class="campaign-card" data-sangre="${c.tipo_sangre_requerida || ''}" data-provincia="${hospital?.provincia || ''}" data-urgencia="${c.urgente ? 'urgente' : 'activa'}" data-busqueda="${busqueda}">
          <div class="campaign-header">
            <div class="campaign-hospital">${hospital?.nombre || 'Hospital'}</div>
            <span class="campaign-badge ${c.urgente ? 'urgente' : 'activa'}">${c.urgente ? 'Urgente' : 'Activa'}</span>
          </div>
          ${masHospitalesTag ? `<div class="campaign-tipo">${masHospitalesTag}</div>` : ''}
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
    _procesarVencimientosTurnos();
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

  // Única fuente de verdad para la ventana de 90 días desde la última
  // donación real del donante — la usan tanto _validarElegibilidadDonante()
  // (para bloquear una reserva) como cargarMisDonaciones() (para el banner
  // "próxima fecha habilitada"). Antes cada una calculaba esto por su
  // cuenta con el mismo "90 * 86400000" repetido en dos lugares —
  // refactorizado 2026-09-10 a pedido de la usuaria para no tener que
  // acordarse de tocar los dos si el número cambia algún día.
  // Devuelve la fecha (Date) en la que el donante vuelve a estar habilitado,
  // o null si nunca donó (no hay ninguna ventana corriendo).
  function _proximaFechaHabilitada(usuarioId) {
    const fechasDonaciones = HemoRed.db.where('donaciones', 'usuario_id', usuarioId)
      .map(d => d.registrado_en).filter(Boolean).sort();
    const ultimaDonacion = fechasDonaciones[fechasDonaciones.length - 1];
    if (!ultimaDonacion) return null;
    return new Date(new Date(ultimaDonacion).getTime() + 90 * 86400000);
  }

  // Restricciones de elegibilidad para donar (anotadas como pendiente de
  // diseño 2026-09-01, resueltas y conectadas 2026-09-10). Compartida entre
  // crearTurno() (valida contra la fecha elegida del turno), actualizarTurno()
  // (valida contra la fecha NUEVA al reprogramar — ver nota abajo) y
  // verificarElegibilidadReserva() (valida contra "hoy", para poder
  // deshabilitar el botón "Reservar turno" ANTES de que el donante elija
  // fecha/hora — con el motivo puntual visible, mismo patrón que ya usan
  // actualizarTurno()/cancelarTurno() con la ventana de tiempo).
  //
  // Por qué se evalúa siempre contra la fecha DEL TURNO (no contra "hoy"),
  // salvo en verificarElegibilidadReserva() donde todavía no hay fecha
  // elegida: la usuaria pidió explícitamente que la edad se cumpla "en el
  // momento de la donación", no solo en el momento de tomar el turno — si
  // alguien tiene 17 hoy pero ya cumplió 18 para la fecha del turno, tiene
  // que poder reservar; si tiene 65 hoy pero para la fecha del turno ya
  // cumplió 66, no. Evaluar contra la fecha del turno cubre los dos casos
  // con un solo chequeo — no hace falta un chequeo aparte contra "hoy".
  //
  // Decisiones tomadas con la usuaria 2026-09-10:
  // - 90 días (no 85, que era un número aproximado al anotar el pendiente).
  // - "Ya tener un turno" se amplió de "por campaña" a un turno activo
  //   (pendiente/confirmado/en_curso) en TODA la plataforma — de paso se
  //   corrigió que la versión anterior de este chequeo no incluía
  //   'pendiente' entre los estados bloqueantes, lo cual permitía reservar
  //   más de un turno pendiente para la misma campaña a la vez.
  // - Condición médica inhabilitante (detectada en un análisis anterior)
  //   queda AFUERA a propósito: no hay campos estructurados para eso en
  //   resultado_analisis todavía (ver docs/01, queda anotado como v2).
  // - Al reprogramar (actualizarTurno()), se re-chequea TODO de nuevo, no
  //   solo la ventana de 24hs — si en el medio cambió el peso, por ejemplo,
  //   hay que volver a evaluarlo. `excluirTurnoId` existe para que el propio
  //   turno que se está reprogramando no se cuente a sí mismo como "ya
  //   tenés un turno activo".
  function _validarElegibilidadDonante(usuarioId, fechaEvaluacion, { excluirTurnoId } = {}) {
    const usuario = HemoRed.db.find('usuarios', usuarioId);
    if (!usuario) return { ok: false, error: 'Usuario no encontrado.' };

    if (usuario.fecha_nacimiento) {
      const edad = Math.floor((new Date(fechaEvaluacion) - new Date(usuario.fecha_nacimiento)) / (365.25 * 86400000));
      // Tope general 65 años, salvo donantes habituales (experiencia_donante,
      // ver perfil): hasta 70 — regla real de donación de sangre en Argentina,
      // agregada 2026-09-10 a pedido de la usuaria.
      const edadMaxima = usuario.experiencia_donante === 'habitual' ? 70 : 65;
      if (edad < 18) return { ok: false, error: 'Para donar sangre tenés que tener al menos 18 años.' };
      if (edad > edadMaxima) return { ok: false, error: `La edad máxima para donar sangre es ${edadMaxima} años${usuario.experiencia_donante === 'habitual' ? ' (para donantes habituales)' : ''}.` };
    }

    if (usuario.peso_kg != null && usuario.peso_kg < 50) {
      return { ok: false, error: 'Para donar sangre tenés que pesar al menos 50kg.' };
    }

    const turnoActivo = HemoRed.db.where('turnos', 'usuario_id', usuarioId)
      .some(t => t.id !== excluirTurnoId && ['pendiente', 'confirmado', 'en_curso'].includes(t.estado));
    if (turnoActivo) return { ok: false, error: 'Ya tenés un turno activo — solo podés tener uno a la vez en toda la plataforma. Cancelalo primero si querés reservar en otra campaña.' };

    const habilitado = _proximaFechaHabilitada(usuarioId);
    if (habilitado && new Date(fechaEvaluacion) < habilitado) {
      return { ok: false, error: `Todavía no podés donar: tu última donación fue hace menos de 90 días. Vas a poder reservar turno a partir del ${habilitado.toLocaleDateString('es-AR')}.` };
    }

    return { ok: true };
  }

  // Chequeo proactivo (contra "hoy", sin fecha de turno todavía elegida) —
  // usado por dashboard.html (banner global, antes de listar campañas) y
  // campana_detalle.html (deshabilita "Reservar turno" de entrada, antes de
  // que el donante llegue a elegir fecha/hora).
  function verificarElegibilidadReserva(usuarioId) {
    const hoy = hoyISO();
    return _validarElegibilidadDonante(usuarioId, hoy);
  }

  // Cuántos turnos activos (no cancelados) ya hay en ese hospital+fecha+hora,
  // sin contar `excluirTurnoId` (el propio turno, al reprogramar).
  function _turnosActivosEnHorario(hospitalId, fecha, hora, excluirTurnoId) {
    return HemoRed.db.all('turnos')
      .filter(t => t.id !== excluirTurnoId && t.hospital_id === hospitalId && t.fecha === fecha && t.hora === hora && t.estado !== 'cancelado')
      .length;
  }

  // La config real (días/horarios/duración/cupo) de UN hospital participante
  // de una campaña — "una campaña, varios hospitales" (2026-10-27, pedido
  // explícito de la usuaria): antes esto vivía directo en `campanas`, pero
  // cada hospital participante puede atender días/horarios distintos (y
  // tener su propio cupo por turno), así que pasó a `campana_hospital`, una
  // fila por (campaña, hospital). `generarSlotsDisponibles()`/
  // `fechasAtencionCampana()`/`calcularStatsTurnos()` ya leían esos 3 campos
  // de un objeto genérico, así que siguen sirviendo tal cual pasándoles esta
  // fila en vez de la campaña entera.
  function _campanaHospital(campanaId, hospitalId) {
    return HemoRed.db.all('campana_hospital').find(ch => ch.campana_id === campanaId && ch.hospital_id === hospitalId) || null;
  }

  // Reserva un turno real. Valida elegibilidad (edad, peso, turno activo,
  // 90 días desde la última donación) y que el horario no haya llegado al
  // cupo de la campaña (RF configurable al crear la campaña — "Donantes por
  // turno", 2026-09-17).
  function crearTurno({ usuario_id, campana_id, hospital_id, fecha, hora }) {
    const elegibilidad = _validarElegibilidadDonante(usuario_id, fecha);
    if (!elegibilidad.ok) return elegibilidad;

    const campana = HemoRed.db.find('campanas', campana_id);
    const cupo = _campanaHospital(campana_id, hospital_id)?.cupo_por_turno ?? 1;
    if (_turnosActivosEnHorario(hospital_id, fecha, hora) >= cupo) {
      return { ok: false, error: 'Ese horario ya no está disponible. Elegí otro.' };
    }

    const turno = HemoRed.db.crear('turnos', {
      campana_id, usuario_id, hospital_id, fecha, hora,
      // Si la campaña tiene confirmación automática, nace confirmado
      // directo; si no, nace pendiente y el hospital lo confirma o
      // rechaza a mano (RF3) — "¿Requiere confirmación manual?" al crear
      // la campaña (2026-09-17).
      estado: campana?.confirmacion_automatica ? 'confirmado' : 'pendiente',
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

  // "Ahora" para las ventanas de 2h/24h, la regla de 90 días, edad, y la
  // agrupación de notificaciones — la fecha/hora real del sistema, no una
  // fija (corregido 2026-09-16: antes esto era `AHORA_DEMO`, una constante
  // fija en mayo 2026, atada a que el dataset semilla estaba fechado ese
  // mes. Quedaba desactualizada apenas pasaba el tiempo real, generando
  // que "hoy" en el prototipo dejara de tener sentido para quien lo
  // probara meses después. Los datos semilla que representan hechos ya
  // ocurridos (ej. la donación exitosa de la cuenta demo) se dejan con su
  // fecha original de mayo 2026 a propósito — son un hecho histórico, no
  // necesitan "seguir" a la fecha real).
  function ahora() {
    return new Date();
  }

  // `d.toISOString().slice(0, 10)` (el patrón usado en todo el proyecto
  // hasta 2026-10-16 para convertir una fecha a "YYYY-MM-DD") convierte a
  // UTC antes de cortar la fecha — en Argentina (UTC-3) eso adelanta el
  // calendario hasta 3hs cada noche: entre ~21:00 y medianoche hora local,
  // "hoy" ya se calculaba como si fuera mañana. Esta versión arma el
  // string con los getters LOCALES (getFullYear/getMonth/getDate), que sí
  // respetan la zona horaria del navegador.
  function fechaISO(d) {
    const anio = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }

  function hoyISO() {
    return fechaISO(ahora());
  }

  function horasHastaElTurno(turno) {
    const fechaTurno = new Date(`${turno.fecha}T${turno.hora}:00`);
    return (fechaTurno - ahora()) / 3600000;
  }

  // Un turno "pendiente" (esperando que el hospital lo confirme a mano —
  // campanas.confirmacion_automatica:false) cuya fecha/hora ya pasó nunca
  // va a poder confirmarse de verdad: nadie puede confirmar asistencia
  // para un horario que ya ocurrió. Se resuelve solo como 'cancelado' (el
  // mismo estado que ya usa rechazarTurno(), no uno nuevo), con un
  // motivo_rechazo propio para distinguirlo de un rechazo manual. Esto NO
  // toca turnos pendientes que todavía están en el futuro — esos siguen
  // esperando confirmación/rechazo manual como siempre (pedido explícito
  // de la usuaria, 2026-10-16). Se llama al principio de cualquier función
  // que cargue turnos para mostrarlos (hospital o profesional), así queda
  // resuelto para todos sin importar quién mire primero.
  function _expirarTurnosPendientesVencidos() {
    const ahoraMs = ahora().getTime();
    HemoRed.db.all('turnos').forEach(t => {
      if (t.estado !== 'pendiente') return;
      if (new Date(`${t.fecha}T${t.hora}:00`).getTime() >= ahoraMs) return;
      HemoRed.db.actualizar('turnos', t.id, {
        estado: 'cancelado',
        motivo_rechazo: 'Vencido: el hospital no lo confirmó antes de la fecha del turno.',
      });
    });
  }

  // Red de contención si el médico se olvidó de marcar "Ausente" a mano
  // (marcarAusente()) — pedido explícito de la usuaria, 2026-10-16: el
  // médico tiene todo el día de margen (puede atender a un donante que
  // llega tarde), así que esto NO compara hora, solo fecha: recién actúa
  // cuando el día del turno ya pasó del todo ("al cambiar el día"), nunca
  // el mismo día aunque ya sea tarde. Solo toca 'confirmado' — un turno que
  // llegó a 'en_curso' significa que el médico sí lo atendió, y queda como
  // está para que lo resuelva él (no se le pisa la decisión).
  function _marcarAusentesVencidos() {
    const hoy = hoyISO();
    HemoRed.db.all('turnos').forEach(t => {
      if (t.estado !== 'confirmado') return;
      if (t.fecha >= hoy) return;
      HemoRed.db.actualizar('turnos', t.id, { estado: 'ausente' });
    });
  }

  // Punto único que llaman todas las funciones que cargan turnos para
  // mostrarlos — agrupa los dos vencimientos automáticos (pendiente
  // vencido → cancelado, confirmado nunca atendido → ausente al otro día)
  // para no tener que acordarse de enganchar las dos por separado en cada
  // lugar nuevo.
  function _procesarVencimientosTurnos() {
    _expirarTurnosPendientesVencidos();
    _marcarAusentesVencidos();
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
  //
  // Re-valida elegibilidad completa contra la NUEVA fecha (2026-09-10, a
  // pedido de la usuaria) — no alcanza con la ventana de 24hs: si en el
  // medio entre reservar y reprogramar cambió algo (ej. el peso cargado en
  // el perfil), hay que volver a evaluarlo, no asumir que sigue valiendo lo
  // que se chequeó en la reserva original. `excluirTurnoId` evita que el
  // propio turno que se está moviendo se cuente como "ya tenés un turno
  // activo" contra sí mismo.
  function actualizarTurno(turnoId, { fecha, hora }) {
    const turno = HemoRed.db.find('turnos', turnoId);
    if (!turno) return { ok: false, error: 'Turno no encontrado.' };

    if (horasHastaElTurno(turno) < 24) {
      return { ok: false, error: 'No podés modificar el turno a menos de 24hs de la fecha pactada.' + datosContactoHospital(turno.hospital_id) };
    }

    const elegibilidad = _validarElegibilidadDonante(turno.usuario_id, fecha, { excluirTurnoId: turnoId });
    if (!elegibilidad.ok) return elegibilidad;

    const cupo = _campanaHospital(turno.campana_id, turno.hospital_id)?.cupo_por_turno ?? 1;
    if (_turnosActivosEnHorario(turno.hospital_id, fecha, hora, turnoId) >= cupo) {
      return { ok: false, error: 'Ese horario ya no está disponible. Elegí otro.' };
    }

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

  // El médico clínico marca que el donante no se presentó (pedido explícito
  // de la usuaria, 2026-10-16): es él quien puede constatarlo de verdad y
  // quien maneja el período de gracia dentro del día (ej. el donante llega
  // tarde y igual lo atiende) — por eso esto es una acción manual, no algo
  // que el sistema decida apenas pasa la hora del turno. Si el médico se
  // olvida de marcarlo, `_marcarAusentesVencidos()` lo hace solo, pero
  // recién al otro día (ver nota ahí).
  function marcarAusente(turnoId) {
    const turno = HemoRed.db.find('turnos', turnoId);
    if (!turno) return { ok: false, error: 'Turno no encontrado.' };
    if (turno.estado !== 'confirmado') return { ok: false, error: 'Este turno no está en condiciones de marcarse como ausente.' };
    return { ok: true, turno: HemoRed.db.actualizar('turnos', turnoId, { estado: 'ausente' }) };
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

  // ===== EVALUACIÓN CLÍNICA (F3, médico clínico) =====
  // El médico revisa F1/F2 — con posibilidad de corregir una respuesta si
  // hace falta repreguntar algo — y deja registrada acá la decisión de
  // aptitud. Es el gate real del camino feliz: si da "no apto", el turno
  // se corta y el extraccionista no lo ve como disponible para
  // registrar la donación (ver registrarEvaluacionClinica() más abajo).

  // Todo lo que necesita la pantalla de revisión del médico: el turno, el
  // donante, lo que respondió en F1/F2 de verdad (no un resumen), y si ya
  // hay una evaluación cargada para este turno (reingreso).
  function cargarRevisionClinica(turnoId) {
    const turno = HemoRed.db.find('turnos', turnoId);
    if (!turno) return null;
    const donante = HemoRed.db.find('usuarios', turno.usuario_id);
    const campana = HemoRed.db.find('campanas', turno.campana_id);
    const formulario = HemoRed.db.where('formulario_consentimiento', 'turno_id', turnoId)[0] || null;
    const evaluacion = HemoRed.db.where('evaluacion_clinica', 'turno_id', turnoId)[0] || null;
    return { turno, donante, campana, formulario, evaluacion };
  }

  // El médico corrige una respuesta del cuestionario durante la entrevista
  // (el donante entendió mal algo y quiere cambiarla) — a diferencia de
  // guardarFormularioConsentimiento() (que usa el donante para completar
  // F1/F2 por primera vez), esto siempre marca "modificado por el
  // profesional", con fecha, para que quede auditado qué cambió y cuándo
  // (campo ya reservado en el esquema desde el diseño original, sin usar
  // hasta ahora).
  function corregirRespuestasCuestionario(turnoId, respuestas) {
    const existente = HemoRed.db.where('formulario_consentimiento', 'turno_id', turnoId)[0];
    if (!existente) return { ok: false, error: 'Todavía no existe el formulario F1/F2 de este turno.' };
    const formulario = HemoRed.db.actualizar('formulario_consentimiento', existente.id, {
      respuestas_cuestionario: respuestas,
      cuestionario_modificado_por_profesional: true,
      cuestionario_modificacion_fecha: ahora().toISOString(),
    });
    return { ok: true, formulario };
  }

  // El médico clickeó "Iniciar entrevista" sobre un turno listo para
  // evaluar — pasa a 'en_curso' (estado ya reservado en el modelo desde
  // el diseño original, nunca usado hasta ahora: se contaba como "activo"
  // en _validarElegibilidadDonante() pero nada lo escribía). Sirve para
  // que "En proceso" en el dashboard signifique "el médico está AHORA en
  // la entrevista", no "está listo para empezar" — eso último es
  // "Pendiente" (pedido explícito de la usuaria, 2026-10-16).
  function iniciarEntrevistaClinica(turnoId) {
    const turno = HemoRed.db.find('turnos', turnoId);
    if (!turno) return { ok: false, error: 'Turno no encontrado.' };
    if (turno.estado !== 'confirmado') return { ok: false, error: 'Este turno no está listo para iniciar la entrevista.' };
    return { ok: true, turno: HemoRed.db.actualizar('turnos', turnoId, { estado: 'en_curso' }) };
  }

  // El médico cerró/canceló el modal sin llegar a una decisión (apto/no
  // apto) — vuelve a 'confirmado', como si nunca hubiera abierto la
  // entrevista. No falla si el turno ya no está en_curso (ej. se llama
  // también, sin efecto, después de un cierre exitoso — ver cerrarModal()
  // en profesional/dashboard.html).
  function cancelarEntrevistaClinica(turnoId) {
    const turno = HemoRed.db.find('turnos', turnoId);
    if (!turno || turno.estado !== 'en_curso') return { ok: false };
    return { ok: true, turno: HemoRed.db.actualizar('turnos', turnoId, { estado: 'confirmado' }) };
  }

  function registrarEvaluacionClinica(turnoId, { profesionalId, resultado, motivoNoApto, signosVitales, observaciones }) {
    const turno = HemoRed.db.find('turnos', turnoId);
    if (!turno) return { ok: false, error: 'Turno no encontrado.' };
    if (!['confirmado', 'en_curso'].includes(turno.estado)) return { ok: false, error: 'Este turno no está en condiciones de evaluar.' };
    if (!turno.formulario_autoexclusion_completado || !turno.formulario_cuestionario_completado) {
      return { ok: false, error: 'El donante todavía no completó los formularios pre-donación (F1/F2).' };
    }
    if (HemoRed.db.where('evaluacion_clinica', 'turno_id', turnoId).length > 0) {
      return { ok: false, error: 'Ya existe una evaluación clínica registrada para este turno.' };
    }
    if (!profesionalId) return { ok: false, error: 'Falta identificar al profesional que evalúa.' };
    if (resultado !== 'apto' && resultado !== 'no_apto') return { ok: false, error: 'Resultado inválido.' };

    const evaluacion = HemoRed.db.crear('evaluacion_clinica', {
      turno_id: turnoId,
      usuario_id: turno.usuario_id,
      profesional_id: profesionalId,
      presion_arterial: signosVitales?.presionArterial || null,
      frecuencia_cardiaca: signosVitales?.frecuenciaCardiaca || null,
      temperatura: signosVitales?.temperatura || null,
      glucosa: signosVitales?.glucosa || null,
      peso_kg: signosVitales?.pesoKg || null,
      hemoglobina: signosVitales?.hemoglobina || null,
      resultado,
      motivo_no_apto: resultado === 'no_apto' ? (motivoNoApto || null) : null,
      observaciones: observaciones || null,
      registrado_en: ahora().toISOString(),
    });

    // Gate real: "no apto" corta el camino acá — el turno no vuelve a
    // aparecer como disponible para registrar la donación. "Apto" vuelve
    // a 'confirmado' (puede haber quedado en 'en_curso' si se abrió desde
    // "Iniciar entrevista") — así queda disponible para el extraccionista.
    HemoRed.db.actualizar('turnos', turnoId, { estado: resultado === 'no_apto' ? 'no_apto' : 'confirmado' });

    return { ok: true, evaluacion };
  }

  // Historial completo de UN donante puntual, para que el médico clínico
  // lo vea al atenderlo (turnos y donaciones en TODO el sistema, no solo
  // de este hospital) — pedido explícito de la usuaria: "tiene que poder
  // ver la historia de donación del donante si existe en el sistema".
  // Mismo patrón de solo-lectura que cargarMisDonaciones(), pero por
  // usuario_id en vez de la sesión activa (acá el que mira es el
  // profesional, no el propio donante).
  function cargarHistorialDonante(usuarioId) {
    const hospitales = HemoRed.db.all('hospitales');
    const campanas = HemoRed.db.all('campanas');
    const turnos = HemoRed.db.where('turnos', 'usuario_id', usuarioId)
      .map(t => ({ ...t, campana: campanas.find(c => c.id === t.campana_id), hospital: hospitales.find(h => h.id === t.hospital_id) }))
      .sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora));
    const donaciones = HemoRed.db.where('donaciones', 'usuario_id', usuarioId)
      .map(d => ({ ...d, hospital: hospitales.find(h => h.id === d.hospital_id) }))
      .sort((a, b) => new Date(b.registrado_en) - new Date(a.registrado_en));
    return { turnos, donaciones };
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

    // Misma ventana de 90 días que usa _validarElegibilidadDonante() para
    // bloquear una reserva — reusa _proximaFechaHabilitada() (refactorizado
    // 2026-09-10, antes este cálculo estaba duplicado acá con el mismo
    // "90 * 86400000" repetido). Si ya pasaron los 90 días, no hay nada que
    // esperar.
    let proximaFechaHabilitada = null;
    let diasHastaHabilitado = 0;
    const candidata = _proximaFechaHabilitada(s.usuario_id);
    if (candidata) {
      const dias = Math.ceil((candidata - ahora()) / 86400000);
      if (dias > 0) {
        proximaFechaHabilitada = candidata;
        diasHastaHabilitado = dias;
      }
    }

    return { donante, donaciones, proximaFechaHabilitada, diasHastaHabilitado };
  }

  // Trae los 3 tipos de documento del donante con sus datos completos ya
  // resueltos (join), agrupados por pestaña. `documentos` es solo un índice
  // (tipo + referencia_id) — acá se resuelve contra la tabla real que
  // corresponda en cada caso. (El formulario de consentimiento F1/F2 tenía
  // antes una pestaña propia acá, "Consentimientos" — se sacó 2026-09-15 a
  // pedido de la usuaria: por cada donación ya se declara estado de salud y
  // voluntad de donar en F1/F2 mismo, no tenía sentido archivarlo también
  // como un documento aparte para consultar después. El formulario en sí
  // sigue existiendo igual, solo dejó de mostrarse acá — ver
  // `guardarFormularioConsentimiento()` y `formularios_predonacion.html`.)
  async function cargarMisDocumentos() {
    await HemoRed.db.init();
    const s = HemoRed.sesion.get();
    if (!s) return { resultados: [], evaluaciones: [], certificados: [], donacionesSinCertificado: [] };

    const hospitales = HemoRed.db.all('hospitales');
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

    return { resultados, evaluaciones, certificados, donacionesSinCertificado };
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
  // fecha real del sistema.
  function cargarNotificacionesDonante() {
    const s = HemoRed.sesion.get();
    if (!s) return [];
    const hoy = hoyISO();
    const ayer = fechaISO(new Date(ahora().getTime() - 86400000));
    return HemoRed.db.where('notificaciones_donante', 'usuario_id', s.usuario_id)
      .map(n => {
        const dia = n.fecha.slice(0, 10);
        let grupo = 'antes';
        if (dia === hoy) grupo = 'hoy';
        else if (dia === ayer) grupo = 'ayer';
        else if ((ahora() - new Date(dia)) <= 7 * 86400000) grupo = 'semana';
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

  // ===== SECCIÓN "SEGURIDAD DE LA CUENTA" (perfil.html) =====
  // Nota sobre las 4 cuentas demo hardcodeadas en sesion.js (login):
  // cambiar la contraseña o el email acá actualiza `usuarios` de verdad,
  // pero el login de esas 4 cuentas puntuales (donante@hemored.com y las
  // otras 3) nunca consulta esta tabla — usa el objeto USUARIOS fijo. Así
  // que para esas cuentas el cambio no altera con qué credenciales hay que
  // loguearse la próxima vez. Para cualquier donante registrado por
  // publico/registro.html (el camino real de la demo) funciona de punta a
  // punta, incluyendo el login.

  function cambiarPasswordDonante(usuarioId, { actual, nueva }) {
    const usuario = HemoRed.db.find('usuarios', usuarioId);
    if (!usuario) return { ok: false, error: 'Usuario no encontrado.' };
    if (usuario.password_hash !== actual) {
      return { ok: false, error: 'La contraseña actual no es correcta.' };
    }
    if (!nueva || nueva.length < 8) {
      return { ok: false, error: 'La nueva contraseña debe tener al menos 8 caracteres.' };
    }
    const cambios = { password_hash: nueva, password_actualizada_en: new Date().toISOString() };
    return { ok: true, usuario: HemoRed.db.actualizar('usuarios', usuarioId, cambios) };
  }

  // El nuevo email queda marcado como no verificado — la verificación real
  // por link de correo es parte del backend (ver docs/04, "Validación de
  // email del donante"), acá no hay forma de mandar ni confirmar ese mail.
  function cambiarEmailDonante(usuarioId, { actual, nuevoEmail }) {
    const usuario = HemoRed.db.find('usuarios', usuarioId);
    if (!usuario) return { ok: false, error: 'Usuario no encontrado.' };
    if (usuario.password_hash !== actual) {
      return { ok: false, error: 'La contraseña no es correcta.' };
    }
    const emailNorm = (nuevoEmail || '').toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      return { ok: false, error: 'Ingresá un email válido.' };
    }
    if (emailNorm === usuario.email) {
      return { ok: false, error: 'Ese ya es tu email actual.' };
    }
    const enUso = HemoRed.db.where('usuarios', 'email', emailNorm).some(u => u.id !== usuarioId);
    if (enUso) {
      return { ok: false, error: 'Ya existe una cuenta con ese email.' };
    }
    const cambios = { email: emailNorm, email_verificado: false };
    return { ok: true, usuario: HemoRed.db.actualizar('usuarios', usuarioId, cambios) };
  }

  // "Eliminar cuenta" es una baja lógica (activo:false), no un borrado real:
  // turnos, donaciones, certificados y formularios ya generados desde otros
  // roles (Hospital, Profesional de salud) siguen referenciando este
  // usuario_id — borrar el registro de verdad los dejaría huérfanos. Bloquea
  // el login (ver sesion.js) y el llamador debe cerrar la sesión actual.
  function eliminarCuentaDonante(usuarioId, { actual }) {
    const usuario = HemoRed.db.find('usuarios', usuarioId);
    if (!usuario) return { ok: false, error: 'Usuario no encontrado.' };
    if (usuario.password_hash !== actual) {
      return { ok: false, error: 'La contraseña no es correcta.' };
    }
    return { ok: true, usuario: HemoRed.db.actualizar('usuarios', usuarioId, { activo: false }) };
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
    _procesarVencimientosTurnos();
    const s = HemoRed.sesion.get();
    if (!s) return;

    const usuario = HemoRed.db.find('usuarios', s.usuario_id);
    const hospital = HemoRed.db.find('hospitales', usuario?.hospital_id);
    // "Una campaña, varios hospitales" (2026-10-27): cuenta también las que
    // este hospital solo participa (no creó) — mismo alcance que ya usa el
    // listado de campanas.html, para que el KPI no lo deje afuera de algo
    // donde de verdad puede recibir donantes.
    const campanas = cargarCampanasHospital(hospital?.id);
    const turnos = HemoRed.db.where('turnos', 'hospital_id', hospital?.id);
    const donaciones = HemoRed.db.where('donaciones', 'hospital_id', hospital?.id);
    const hoy = ahora();
    const donacionesMes = donaciones.filter(d => {
      const f = new Date(d.registrado_en);
      return f.getMonth() === hoy.getMonth() && f.getFullYear() === hoy.getFullYear();
    });

    _set('hospital-nombre', hospital?.nombre || '');
    _set('hospital-nombre-sidebar', hospital?.nombre || '');
    _set('campanas-activas', campanas.filter(c => esCampanaActiva(c)).length);
    _set('turnos-hoy', turnos.filter(t => t.fecha === fechaISO(hoy)).length);
    _set('donaciones-mes', donacionesMes.length);

    // Texto de bienvenida (antes fijo: "Hoy es jueves 15 de mayo de 2026...",
    // corregido 2026-09-22 junto con las otras fechas de ejemplo vencidas).
    _set('bienvenida-fecha', hoy.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
    _set('bienvenida-campanas', campanas.filter(c => esCampanaActiva(c)).length);
    _set('bienvenida-turnos-pendientes', turnos.filter(t => t.estado === 'pendiente').length);

    return { hospital, campanas, turnos, donaciones };
  }

  // Tercera vuelta del modelo el mismo día (2026-10-20), corrección final
  // pedida explícitamente por la usuaria: "relación" y "evento" son dos
  // cosas conceptualmente distintas, no la misma fila.
  // - `pacientes` = la persona (nombre/DNI/fecha de nacimiento/tipo de
  //   sangre, permanente, sin `hospital_id` propio).
  // - `paciente_hospital` = la RELACIÓN paciente↔hospital. Una vez que
  //   existe, no se borra ni se desactiva nunca (decisión explícita: un
  //   soft-delete se habría llevado puesto el historial de campañas, no es
  //   viable) — es solo el ancla de la que cuelgan los eventos.
  // - `eventos_paciente` (tabla nueva) = lo que tiene principio y fin: la
  //   causa puntual (cirugía, enfermedad, accidente — "pueden ser muchas")
  //   que origina la necesidad de una campaña. Diagnóstico/servicio/
  //   contacto/observaciones/médico tratante son del EVENTO, no de la
  //   relación ni de la persona — una misma relación paciente-hospital
  //   puede tener muchos eventos a lo largo del tiempo, uno activo por vez
  //   (ver crearPaciente()). `medico_tratante` es texto libre a propósito:
  //   no es un profesional del sistema (no hace entrevista clínica ni
  //   extracción), no hace falta que esté dado de alta como tal.
  function _buscarRelacion(pacienteId, hospitalId) {
    return HemoRed.db.all('paciente_hospital').find(v => v.paciente_id === pacienteId && v.hospital_id === hospitalId);
  }
  function _eventoDeRelacion(relacionId) {
    return HemoRed.db.where('eventos_paciente', 'paciente_hospital_id', relacionId);
  }

  // Pacientes del hospital logueado + si tienen o no una campaña activa
  // asociada (campanas.paciente_id) — usado para la fila de métricas de
  // hospital/pacientes.html, agregada 2026-10-14 junto con el resto del
  // rediseño de tarjetas (antes esa página era 100% maqueta fija). Lista
  // TODA relación de este hospital, tenga o no un evento abierto ahora
  // mismo (es el roster del hospital, no solo "quién tiene algo activo") —
  // para el diagnóstico/servicio de la fila se usa el evento más reciente.
  function cargarPacientesHospital() {
    const s = HemoRed.sesion.get();
    if (!s) return { pacientes: [], total: 0, conCampana: 0, sinCampana: 0 };
    const usuario = HemoRed.db.find('usuarios', s.usuario_id);
    const hospitalId = usuario?.hospital_id;
    const campanas = HemoRed.db.where('campanas', 'hospital_id', hospitalId);
    const pacientes = HemoRed.db.where('paciente_hospital', 'hospital_id', hospitalId)
      .map(relacion => {
        const paciente = HemoRed.db.find('pacientes', relacion.paciente_id);
        if (!paciente || !paciente.activo) return null;
        const eventos = _eventoDeRelacion(relacion.id).sort((a, b) => b.evento_desde.localeCompare(a.evento_desde));
        const eventoReciente = eventos.find(e => e.activo) || eventos[0] || {};
        return {
          ...paciente,
          diagnostico: eventoReciente.diagnostico,
          servicio: eventoReciente.servicio,
          contacto_referencia: eventoReciente.contacto_referencia,
          observaciones: eventoReciente.observaciones,
          medico_tratante: eventoReciente.medico_tratante,
          evento_desde: eventoReciente.evento_desde,
          campanaActiva: campanas.find(c => c.paciente_id === paciente.id && esCampanaActiva(c)) || null,
        };
      })
      .filter(Boolean);
    return {
      pacientes,
      total: pacientes.length,
      conCampana: pacientes.filter(p => p.campanaActiva).length,
      sinCampana: pacientes.filter(p => !p.campanaActiva).length,
    };
  }

  // El hospital da de alta un paciente — gate para poder crear una campaña
  // a su nombre. Busca primero por DNI, en TODOS los hospitales:
  // - Si la persona ya existe: no se toca su ficha (nombre/fecha de
  //   nacimiento/tipo de sangre quedan como estaban). Se busca (o se crea,
  //   si nunca existió) la RELACIÓN con ESTE hospital, y se le crea un
  //   evento nuevo colgando de ella — la relación en sí nunca se duplica
  //   ni se borra, puede terminar con varios eventos a lo largo del tiempo.
  // - Si no existe: se crea la persona + la relación + el primer evento.
  // Gate: solo puede haber un evento activo a la vez por paciente, en
  // cualquier hospital — si ya tiene uno, hay que esperar a que la campaña
  // que lo originó se cierre (`cerrarCampana()`, más abajo) antes de
  // registrar uno nuevo. Todos los campos del formulario son obligatorios
  // salvo el tipo de sangre (pedido explícito de la usuaria).
  function crearPaciente({ nombre, apellido, numero_documento, fecha_nacimiento, tipo_sangre, diagnostico, servicio, contacto_referencia, observaciones }) {
    const s = HemoRed.sesion.get();
    const usuario = HemoRed.db.find('usuarios', s?.usuario_id);
    const hospitalId = usuario?.hospital_id;
    if (!hospitalId) return { ok: false, error: 'No se pudo identificar el hospital.' };
    if (!nombre || !apellido) return { ok: false, error: 'Ingresá nombre y apellido.' };
    if (!numero_documento) return { ok: false, error: 'Ingresá el DNI del paciente.' };
    if (!fecha_nacimiento) return { ok: false, error: 'Ingresá la fecha de nacimiento.' };
    if (!diagnostico) return { ok: false, error: 'Ingresá el diagnóstico.' };
    if (!servicio) return { ok: false, error: 'Seleccioná el servicio/área.' };
    if (!contacto_referencia) return { ok: false, error: 'Ingresá un contacto de referencia.' };
    if (!observaciones) return { ok: false, error: 'Ingresá las observaciones.' };

    let paciente = HemoRed.db.where('pacientes', 'numero_documento', numero_documento)[0];
    let yaExistia = !!paciente;

    if (paciente) {
      const relacionConEvento = HemoRed.db.all('paciente_hospital')
        .find(r => r.paciente_id === paciente.id && _eventoDeRelacion(r.id).some(e => e.activo));
      if (relacionConEvento) {
        const hospitalActivo = HemoRed.db.find('hospitales', relacionConEvento.hospital_id);
        const mismoHospital = relacionConEvento.hospital_id === hospitalId;
        return {
          ok: false,
          error: mismoHospital
            ? 'Este paciente ya tiene un evento abierto en tu hospital — tiene que cerrarse la campaña asociada antes de registrar uno nuevo.'
            : `Este paciente ya tiene un evento abierto en ${hospitalActivo?.nombre || 'otro hospital'} — tiene que cerrarse la campaña asociada ahí antes de poder registrar uno nuevo en otro lado.`,
        };
      }
    } else {
      paciente = HemoRed.db.crear('pacientes', {
        nombre,
        apellido,
        fecha_nacimiento,
        tipo_documento_id: 1,
        numero_documento,
        tipo_sangre: tipo_sangre || null,
        activo: true,
        creado_en: hoyISO(),
      });
    }

    let relacion = _buscarRelacion(paciente.id, hospitalId);
    if (!relacion) {
      relacion = HemoRed.db.crear('paciente_hospital', {
        paciente_id: paciente.id,
        hospital_id: hospitalId,
        creado_en: hoyISO(),
      });
    }
    HemoRed.db.crear('eventos_paciente', {
      paciente_hospital_id: relacion.id,
      medico_tratante: null,
      diagnostico,
      servicio,
      contacto_referencia,
      observaciones,
      evento_desde: hoyISO(),
      fecha_cierre: null,
      activo: true,
    });
    return { ok: true, paciente, yaExistia };
  }

  // Detalle real de un paciente para hospital/paciente_detalle.html — la
  // relación con ESTE hospital (si existe) + su evento activo o, si no
  // tiene, el más reciente. Un paciente puede tener relaciones con otros
  // hospitales (con sus propios eventos) — esta función solo devuelve la
  // de quien está mirando, nunca datos de otro hospital.
  function cargarDetallePaciente(pacienteId) {
    const s = HemoRed.sesion.get();
    const usuario = HemoRed.db.find('usuarios', s?.usuario_id);
    const hospitalId = usuario?.hospital_id;
    const paciente = HemoRed.db.find('pacientes', pacienteId);
    if (!paciente) return null;
    const relacion = _buscarRelacion(pacienteId, hospitalId);
    if (!relacion) return null; // este hospital nunca tuvo relación con esta persona
    const eventos = _eventoDeRelacion(relacion.id).sort((a, b) => b.evento_desde.localeCompare(a.evento_desde));
    const vinculo = eventos.find(e => e.activo) || eventos[0];
    if (!vinculo) return null; // relación sin ningún evento todavía (no debería pasar vía la UI)
    const historial = eventos.filter(e => e.id !== vinculo.id);
    return { paciente, vinculo, historial };
  }

  // Cierra el evento activo de una relación — función interna, sin botón
  // propio en la UI: se cierra SOLO/automáticamente cuando se cierra la
  // campaña que lo originó, nunca a mano por separado. La llama
  // `cerrarCampana()` más abajo.
  function _cerrarEvento(eventoId) {
    const evento = HemoRed.db.find('eventos_paciente', eventoId);
    if (!evento || !evento.activo) return null;
    return HemoRed.db.actualizar('eventos_paciente', eventoId, { activo: false, fecha_cierre: hoyISO() });
  }

  // Profesionales vinculados al hospital logueado (vía profesional_hospital,
  // ya que un mismo profesional puede trabajar en más de un hospital A LA
  // VEZ — a diferencia de un paciente, acá sí puede haber varios vínculos
  // simultáneos activos). El email que se muestra es el INSTITUCIONAL de
  // ESTE hospital (`v.email_institucional`), no el de login de la cuenta
  // (`usuario.email`) — cada hospital le puede dar un email distinto a la
  // misma persona (2026-10-20, ver nota en crearProfesional()).
  function cargarProfesionalesHospital() {
    const s = HemoRed.sesion.get();
    if (!s) return { profesionales: [], total: 0, activos: 0, inactivos: 0 };
    const usuario = HemoRed.db.find('usuarios', s.usuario_id);
    const hospitalId = usuario?.hospital_id;
    const profesionales = HemoRed.db.where('profesional_hospital', 'hospital_id', hospitalId)
      .filter(v => v.activo)
      .map(v => {
        const profesional = HemoRed.db.find('profesionales', v.profesional_id);
        if (!profesional || !profesional.activo) return null;
        return {
          ...profesional,
          usuario: HemoRed.db.find('usuarios', profesional.usuario_id),
          email_institucional: v.email_institucional,
        };
      })
      .filter(Boolean);
    return {
      profesionales,
      total: profesionales.length,
      activos: profesionales.filter(p => p.activo).length,
      inactivos: profesionales.filter(p => !p.activo).length,
    };
  }

  // El hospital da de alta un profesional — médico clínico o extraccionista,
  // ambos perfiles (2026-10-20, reescrita el mismo día: la primera versión
  // creaba SIEMPRE una cuenta nueva, lo que duplicaba a la persona si ya
  // trabajaba en otro hospital del sistema — un profesional SÍ puede
  // trabajar en varios a la vez, pedido explícito de la usuaria).
  // Busca primero por DNI, en TODOS los hospitales:
  // - Si ya existe: no se toca su cuenta ni su ficha profesional (tipo/
  //   matrícula/especialidad no cambian de hospital a hospital — es la
  //   misma matrícula en todos lados) ni se le pide contraseña de nuevo
  //   (ya tiene cuenta con la que entra). Solo se crea el vínculo nuevo
  //   con ESTE hospital, con SU PROPIO email institucional.
  // - Si no existe: se crea la cuenta (`usuarios`, mismo patrón sin hash
  //   de `registrarDonante()` en sesion.js) + la ficha (`profesionales`,
  //   sin `hospital_id` propio a propósito, nunca lo tuvo) + el primer
  //   vínculo. El email de login de la cuenta nueva es, por default, el
  //   mismo que el institucional de este primer hospital — son el mismo
  //   valor solo porque es su primera alta, no porque tengan que coincidir
  //   siempre (si después lo vincula otro hospital, ESE vínculo tiene su
  //   propio email institucional, el de login de la cuenta no cambia).
  function crearProfesional({ nombre, apellido, numero_documento, tipo, matricula, especialidad, email, telefono, password, password2 }) {
    const s = HemoRed.sesion.get();
    const usuarioHospital = HemoRed.db.find('usuarios', s?.usuario_id);
    const hospitalId = usuarioHospital?.hospital_id;
    if (!hospitalId) return { ok: false, error: 'No se pudo identificar el hospital.' };
    if (!nombre || !apellido) return { ok: false, error: 'Ingresá nombre y apellido.' };
    if (!numero_documento) return { ok: false, error: 'Ingresá el DNI.' };
    if (!tipo) return { ok: false, error: 'Seleccioná el perfil (médico clínico o extraccionista).' };
    if (!matricula) return { ok: false, error: 'Ingresá la matrícula.' };
    if (!especialidad) return { ok: false, error: 'Seleccioná la especialidad.' };
    const emailNorm = (email || '').toLowerCase().trim();
    if (!emailNorm) return { ok: false, error: 'Ingresá el email institucional.' };

    let usuarioProf = HemoRed.db.where('usuarios', 'numero_documento', numero_documento)
      .find(u => u.rol === 'profesional');
    let profesional = usuarioProf ? HemoRed.db.where('profesionales', 'usuario_id', usuarioProf.id)[0] : null;
    const yaExistia = !!profesional;

    if (profesional) {
      const yaVinculado = HemoRed.db.all('profesional_hospital')
        .some(v => v.profesional_id === profesional.id && v.hospital_id === hospitalId && v.activo);
      if (yaVinculado) return { ok: false, error: 'Este profesional ya está vinculado a tu hospital.' };
    } else {
      if (HemoRed.db.where('usuarios', 'email', emailNorm).length > 0) {
        return { ok: false, error: 'Ya existe una cuenta con ese email.' };
      }
      if (!password || password.length < 8) return { ok: false, error: 'La contraseña debe tener al menos 8 caracteres.' };
      if (password !== password2) return { ok: false, error: 'Las contraseñas no coinciden.' };

      const iniciales = (nombre[0] || '').toUpperCase() + (apellido[0] || '').toUpperCase();
      usuarioProf = HemoRed.db.crear('usuarios', {
        nombre,
        apellido,
        email: emailNorm,
        password_hash: password, // demo: sin hash real, no hay backend
        rol: 'profesional',
        tipo_documento_id: 1,
        numero_documento,
        fecha_nacimiento: null,
        telefono: telefono || null,
        activo: true,
        fecha_registro: hoyISO(),
        avatar_iniciales: iniciales,
      });
      profesional = HemoRed.db.crear('profesionales', {
        usuario_id: usuarioProf.id,
        tipo,
        matricula,
        especialidad,
        titulo: null,
        nombre_completo: `${nombre} ${apellido}`,
        universidad: null,
        anio_graduacion: null,
        firma_digital_url: null,
        firma_registrada_en: null,
        activo: true,
      });
    }

    HemoRed.db.crear('profesional_hospital', {
      profesional_id: profesional.id,
      hospital_id: hospitalId,
      activo: true,
      desde: hoyISO(),
      email_institucional: emailNorm,
    });
    return { ok: true, profesional, yaExistia };
  }

  // Agrega los datos del hospital logueado para hospital/metricas.html —
  // esa página estaba 100% hardcodeada (KPIs, los 3 gráficos y las 2
  // tablas) hasta 2026-10-14. "Efectividad por campaña" reusa el mismo
  // unidades_obtenidas/unidades_requeridas que ya muestran campanas.html y
  // campana_detalle.html (no se recalcula de otra forma, para no mostrar un
  // número distinto al del resto del rol).
  function cargarMetricasHospital() {
    _procesarVencimientosTurnos();
    const s = HemoRed.sesion.get();
    if (!s) return null;
    const usuario = HemoRed.db.find('usuarios', s.usuario_id);
    const hospitalId = usuario?.hospital_id;
    const hospital = HemoRed.db.find('hospitales', hospitalId);

    const todasCampanas = HemoRed.db.where('campanas', 'hospital_id', hospitalId);
    const todosTurnos = HemoRed.db.where('turnos', 'hospital_id', hospitalId);
    const todasDonaciones = HemoRed.db.where('donaciones', 'hospital_id', hospitalId);
    const todosUsuarios = HemoRed.db.all('usuarios');

    const hoy = ahora();
    const mesActual = hoy.getMonth();
    const anioActual = hoy.getFullYear();

    function esMismoMes(fechaStr, mes, anio) {
      const f = new Date(fechaStr);
      return f.getMonth() === mes && f.getFullYear() === anio;
    }

    const donacionesMes = todasDonaciones.filter(d => esMismoMes(d.registrado_en, mesActual, anioActual));
    const mesAnteriorRef = new Date(anioActual, mesActual - 1, 1);
    const donacionesMesAnterior = todasDonaciones.filter(d =>
      esMismoMes(d.registrado_en, mesAnteriorRef.getMonth(), mesAnteriorRef.getFullYear()));
    const trendDonaciones = donacionesMesAnterior.length
      ? Math.round(((donacionesMes.length - donacionesMesAnterior.length) / donacionesMesAnterior.length) * 100)
      : (donacionesMes.length > 0 ? 100 : 0);

    const campanasActivas = todasCampanas.filter(c => esCampanaActiva(c));
    const campanasEsteMes = todasCampanas.filter(c => esMismoMes(c.creado_en, mesActual, anioActual)).length;
    const campanasMesAnterior = todasCampanas.filter(c =>
      esMismoMes(c.creado_en, mesAnteriorRef.getMonth(), mesAnteriorRef.getFullYear())).length;

    const turnosNoCancelados = todosTurnos.filter(t => t.estado !== 'cancelado');
    const turnosConfirmadosOCompletados = todosTurnos.filter(t => ['confirmado', 'completado'].includes(t.estado));
    const efectividadPromedio = turnosNoCancelados.length
      ? Math.round((turnosConfirmadosOCompletados.length / turnosNoCancelados.length) * 100)
      : 0;

    function efectividadEnMes(mes, anio) {
      const turnosDelMes = todosTurnos.filter(t => esMismoMes(t.creado_en, mes, anio) && t.estado !== 'cancelado');
      if (!turnosDelMes.length) return null;
      const confirmadosDelMes = turnosDelMes.filter(t => ['confirmado', 'completado'].includes(t.estado));
      return Math.round((confirmadosDelMes.length / turnosDelMes.length) * 100);
    }
    const efectividadMesAnterior = efectividadEnMes(mesAnteriorRef.getMonth(), mesAnteriorRef.getFullYear());

    const donantesIds = [...new Set(todosTurnos.map(t => t.usuario_id))];
    const corteDelMes = new Date(anioActual, mesActual, 1);
    const donantesIdsAntesDeEsteMes = [...new Set(
      todosTurnos.filter(t => new Date(t.creado_en) < corteDelMes).map(t => t.usuario_id)
    )];
    const deltaDonantes = donantesIds.length - donantesIdsAntesDeEsteMes.length;

    const nombresMes = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const donacionesPorMes = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(anioActual, mesActual - i, 1);
      const mes = d.getMonth(), anio = d.getFullYear();
      donacionesPorMes.push({
        label: nombresMes[mes],
        donaciones: todasDonaciones.filter(x => esMismoMes(x.registrado_en, mes, anio)).length,
        turnosSolicitados: todosTurnos.filter(x => esMismoMes(x.creado_en, mes, anio)).length,
      });
    }

    // Filtrado por creado_en de este mes para que coincida con el rótulo
    // "Este mes" del gráfico de hospital/metricas.html.
    const turnosEsteMes = todosTurnos.filter(t => esMismoMes(t.creado_en, mesActual, anioActual));
    const estadoTurnos = {
      confirmados: turnosEsteMes.filter(t => ['confirmado', 'completado'].includes(t.estado)).length,
      pendientes: turnosEsteMes.filter(t => t.estado === 'pendiente').length,
      cancelados: turnosEsteMes.filter(t => ['cancelado', 'no_apto', 'ausente'].includes(t.estado)).length,
    };

    const efectividadPorCampana = todasCampanas
      .map(c => ({
        id: c.id,
        titulo: c.titulo,
        urgente: c.urgente,
        estado: c.estado,
        obtenidas: c.unidades_obtenidas,
        requeridas: c.unidades_requeridas,
        pct: c.unidades_requeridas ? Math.round((c.unidades_obtenidas / c.unidades_requeridas) * 100) : 0,
      }))
      .sort((a, b) => b.pct - a.pct);

    const conteoTipoSangre = {};
    todasDonaciones.forEach(d => {
      const donante = todosUsuarios.find(u => u.id === d.usuario_id);
      const tipo = donante?.tipo_sangre || '?';
      conteoTipoSangre[tipo] = (conteoTipoSangre[tipo] || 0) + 1;
    });
    const donacionesPorTipoSangre = Object.entries(conteoTipoSangre)
      .map(([tipo, count]) => ({ tipo, count }))
      .sort((a, b) => b.count - a.count);

    const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const conteoDias = [0, 0, 0, 0, 0, 0, 0];
    todasDonaciones.forEach(d => { conteoDias[new Date(d.registrado_en).getDay()]++; });
    const donacionesPorDia = [1, 2, 3, 4, 5, 6, 0].map(i => ({ label: diasSemana[i], count: conteoDias[i] }));

    return {
      hospital,
      kpis: {
        donacionesMes: donacionesMes.length,
        donacionesMesAnterior: donacionesMesAnterior.length,
        trendDonaciones,
        campanasActivas: campanasActivas.length,
        campanasTotal: todasCampanas.length,
        campanasEsteMes,
        campanasMesAnterior,
        efectividadPromedio,
        efectividadMesAnterior,
        donantesRegistrados: donantesIds.length,
        deltaDonantes,
      },
      donacionesPorMes,
      estadoTurnos,
      efectividadPorCampana,
      donacionesPorTipoSangre,
      donacionesPorDia,
    };
  }

  // Las tabs "Resultados de análisis" y "Certificados" de
  // hospital/documentacion.html estaban 100% hardcodeadas (donantes de
  // ejemplo que no existían) — conectadas acá 2026-10-14, mismo día que el
  // resto de las tarjetas. Usa la misma tabla `documentos` que ya usa
  // donante/mis_documentos.html del lado del donante: un resultado/
  // certificado está "pendiente" mientras no tenga `referencia_id`
  // asignado (resultado_analisis.id / certificado_donacion.id).
  function cargarDocumentacionHospital() {
    const s = HemoRed.sesion.get();
    if (!s) return { resultadosPendientes: [], resultadosCargados: [], certificadosSolicitados: [], certificadosEmitidos: [] };
    const usuario = HemoRed.db.find('usuarios', s.usuario_id);
    const hospitalId = usuario?.hospital_id;
    const usuarios = HemoRed.db.all('usuarios');
    const campanas = HemoRed.db.all('campanas');

    function donanteYCampana(donacionId, usuarioId) {
      const donacion = HemoRed.db.find('donaciones', donacionId);
      return {
        donante: usuarios.find(u => u.id === usuarioId),
        campana: donacion ? campanas.find(c => c.id === donacion.campana_id) : null,
        fechaDonacion: donacion?.registrado_en,
      };
    }

    const docsResultado = HemoRed.db.where('documentos', 'hospital_id', hospitalId).filter(d => d.tipo === 'resultado_analisis');
    const resultadosPendientes = docsResultado.filter(d => !d.referencia_id)
      .map(d => ({ ...d, ...donanteYCampana(d.donacion_id, d.usuario_id) }));
    const resultadosCargados = docsResultado.filter(d => d.referencia_id)
      .map(d => ({ ...d, ...donanteYCampana(d.donacion_id, d.usuario_id), analisis: HemoRed.db.find('resultado_analisis', d.referencia_id) }))
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    const docsCertificado = HemoRed.db.where('documentos', 'hospital_id', hospitalId).filter(d => d.tipo === 'certificado');
    const certificadosSolicitados = docsCertificado.filter(d => !d.referencia_id)
      .map(d => ({ ...d, ...donanteYCampana(d.donacion_id, d.usuario_id) }));
    const certificadosEmitidos = docsCertificado.filter(d => d.referencia_id)
      .map(d => ({ ...d, ...donanteYCampana(d.donacion_id, d.usuario_id), certificado: HemoRed.db.find('certificado_donacion', d.referencia_id) }))
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    return { resultadosPendientes, resultadosCargados, certificadosSolicitados, certificadosEmitidos };
  }

  // ===== CAMPAÑAS (rol Hospital) =====

  // "Activa" de verdad: el estado guardado ya es 'activa', o es 'programada'
  // y la fecha de publicación elegida ya llegó (no hay cron que la pase a
  // mano — se calcula al leer, mismo criterio que el resto de las fechas
  // "hoy" del prototipo, ver HemoRed.data.ahora()). Única fuente de verdad:
  // antes el dashboard de Hospital, el de Donante y el buscador de campañas
  // filtraban `estado === 'activa'` cada uno por su cuenta y ninguno sabía
  // nada de campañas programadas (agregado 2026-09-25 junto con el wizard
  // "Crear campaña").
  function esCampanaActiva(c, fechaRef) {
    fechaRef = fechaRef || ahora();
    if (c.estado === 'activa') return true;
    if (c.estado === 'programada' && c.fecha_publicacion && new Date(c.fecha_publicacion) <= fechaRef) return true;
    return false;
  }

  function obtenerPlanHospital(hospitalId) {
    const hospital = HemoRed.db.find('hospitales', hospitalId);
    if (!hospital) return null;
    return HemoRed.db.find('planes', hospital.plan_id);
  }

  // Cuenta "activas ahora" para mostrar en pantalla (ej. checklist del
  // wizard) — mismo criterio que esCampanaActiva(), sin proyectar a futuro.
  // Para el bloqueo real al publicar/programar, ver cupoOcupadoEn.
  function contarCampanasActivas(hospitalId) {
    return HemoRed.db.where('campanas', 'hospital_id', hospitalId).filter(c => esCampanaActiva(c)).length;
  }

  // Cuántas campañas de este hospital van a seguir "ocupando cupo" del plan
  // en `fechaRef` — a diferencia de esCampanaActiva(), acá SÍ importa
  // `fecha_cierre`: una campaña `activa` cuyo cierre ya pasó para esa fecha
  // deja de contar, aunque nadie la haya cerrado a mano todavía (no hay
  // cron que la pase a `cerrada` sola). Es lo que permite programar una
  // campaña nueva para dentro de 2 meses aunque HOY el plan esté al límite,
  // si algo de lo activo hoy va a estar cerrado para esa fecha (pedido
  // explícito de la usuaria, 2026-09-25: "si tiene 5 activas y programa una
  // para cuando una de esas termine, debería poder"). Exportada (no
  // interna) porque el wizard la reusa para mostrar en vivo, en el paso 3,
  // si la fecha elegida libera o no el bloqueo — sin duplicar el criterio.
  function cupoOcupadoEn(hospitalId, fechaRef, excluirCampanaId) {
    return HemoRed.db.where('campanas', 'hospital_id', hospitalId).filter(c => {
      if (c.id === excluirCampanaId) return false;
      const cierre = c.fecha_cierre ? new Date(c.fecha_cierre) : null;
      if (cierre && cierre < fechaRef) return false; // ya va a estar cerrada para esa fecha
      return esCampanaActiva(c, fechaRef);
    }).length;
  }

  // Arma los horarios candidatos (array de "HH:MM") de un día puntual a
  // partir de la config real de la campaña (`horarios_atencion` +
  // `duracion_turno_min`). Devuelve `null` si la campaña no tiene esa
  // config (campañas viejas, de antes de este cambio) para que quien llama
  // sepa que tiene que caer al comportamiento genérico de siempre — ver
  // `campana_detalle.html`, que sigue funcionando igual que antes para esas.
  function generarSlotsDisponibles(campana, fechaISO) {
    if (!campana.horarios_atencion || !campana.duracion_turno_min) return null;
    const dow = new Date(fechaISO + 'T00:00:00').getDay();
    if (campana.dias_atencion && !campana.dias_atencion.includes(dow)) return [];
    const slots = [];
    const dur = campana.duracion_turno_min;
    campana.horarios_atencion.forEach(({ desde, hasta }) => {
      const [h, m] = desde.split(':').map(Number);
      const [hf, mf] = hasta.split(':').map(Number);
      let actual = h * 60 + m;
      const fin = hf * 60 + mf;
      while (actual + dur <= fin) {
        const hh = String(Math.floor(actual / 60)).padStart(2, '0');
        const mm = String(actual % 60).padStart(2, '0');
        slots.push(`${hh}:${mm}`);
        actual += dur;
      }
    });
    return slots;
  }

  // Próximas `cantidad` fechas (ISO) en que la campaña atiende según
  // `dias_atencion`, arrancando hoy, sin pasarse de `fecha_cierre`. Ventana
  // de búsqueda acotada a 60 días para no colgarse si `dias_atencion`
  // quedara vacío por algún error de carga. `null` = campaña sin esa
  // config (cae al comportamiento genérico de siempre).
  function fechasAtencionCampana(campana, cantidad) {
    if (!campana.dias_atencion || !campana.dias_atencion.length) return null;
    const base = ahora();
    base.setHours(0, 0, 0, 0);
    const cierre = campana.fecha_cierre ? new Date(campana.fecha_cierre + 'T00:00:00') : null;
    const fechas = [];
    for (let i = 0; i < 60 && fechas.length < cantidad; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      if (cierre && d > cierre) break;
      if (campana.dias_atencion.includes(d.getDay())) fechas.push(fechaISO(d));
    }
    return fechas;
  }

  // Estadísticas de turnos que va a generar una campaña con esta config
  // (mismo motor que generarSlotsDisponibles) — un solo lugar, usado tanto
  // en el preview del paso 2 del wizard como en el resumen antes de
  // publicar (paso 3), para no repetir el mismo cálculo en 2 pantallas.
  function calcularStatsTurnos(campana) {
    const hoy = ahora();
    hoy.setHours(0, 0, 0, 0);
    const cierre = campana.fecha_cierre ? new Date(campana.fecha_cierre + 'T00:00:00') : null;
    const dias = [];
    for (let i = 0; i < 60 && dias.length < 90; i++) {
      const d = new Date(hoy);
      d.setDate(d.getDate() + i);
      if (cierre && d > cierre) break;
      const fechaStr = fechaISO(d);
      const slots = generarSlotsDisponibles(campana, fechaStr) || [];
      if (slots.length) dias.push({ fechaISO: fechaStr, slots });
    }
    const cupo = campana.cupo_por_turno || 1;
    const totalTurnos = dias.reduce((acc, d) => acc + d.slots.length, 0);
    return { dias, totalTurnos, totalCupos: totalTurnos * cupo };
  }

  // Suma `calcularStatsTurnos()` de varios hospitales participantes de la
  // misma campaña ("una campaña, varios hospitales", 2026-10-27) — cada uno
  // con su propia config de días/horarios/cupo, así que no alcanza con
  // calcularlo una sola vez. Usada en el wizard (paso 2/3) para mostrar el
  // total combinado, además del desglose por hospital que ya da
  // `calcularStatsTurnos()` llamado una vez por cada uno.
  function calcularStatsTurnosTotal(configsConFechaCierre) {
    let totalTurnos = 0;
    let totalCupos = 0;
    const porHospital = configsConFechaCierre.map(cfg => {
      const stats = calcularStatsTurnos(cfg);
      totalTurnos += stats.totalTurnos;
      totalCupos += stats.totalCupos;
      return { hospital_id: cfg.hospital_id, ...stats };
    });
    return { totalTurnos, totalCupos, porHospital };
  }

  // Crea (o publica) una campaña real. `datos.estado` es 'activa' (publicar
  // ahora), 'programada' (con `fecha_publicacion` futura) o 'borrador'
  // (guardar y seguir después). El límite de campañas del plan se valida
  // acá, proyectado a la fecha en que la campaña realmente va a estar
  // activa (hoy para 'activa', `fecha_publicacion` para 'programada') — no
  // cuenta contra el límite si para esa fecha alguna de las activas
  // actuales ya va a estar cerrada. Los borradores no cuentan nunca. Si
  // `datos.id` viene con valor, actualiza esa campaña (borrador retomado)
  // en vez de crear una nueva — así "Guardar borrador" varias veces sobre
  // el mismo wizard no duplica filas.
  //
  // "Una campaña, varios hospitales" (2026-10-27, pedido explícito de la
  // usuaria): `datos.hospital_id` sigue siendo el hospital que CREA/
  // administra la campaña (el único que la puede editar/pausar/cerrar) —
  // pero ya no es el único lugar donde se puede donar. `datos.hospitales`
  // es un array con la config de cada hospital PARTICIPANTE (incluido el
  // creador, si también va a recibir donantes): `{hospital_id,
  // dias_atencion, horarios_atencion, duracion_turno_min, cupo_por_turno}`.
  // Cada uno con su propio horario/cupo — un hospital puede atender
  // lunes/miércoles y otro martes/jueves, cada uno con su propia duración
  // de turno. El límite del plan sigue siendo solo del hospital creador
  // (los participantes no gastan cupo de SU plan por sumarse a la campaña
  // de otro — decisión tomada por alcance, no pedida explícitamente, para
  // no bloquear a un hospital chico que solo presta un lugar de donación).
  function crearCampana(datos) {
    const { estado } = datos;
    if (estado === 'activa' || estado === 'programada') {
      const fechaRef = estado === 'activa' ? ahora() : new Date(datos.fecha_publicacion);
      const plan = obtenerPlanHospital(datos.hospital_id);
      const ocupado = cupoOcupadoEn(datos.hospital_id, fechaRef, datos.id);
      if (plan && ocupado >= plan.max_campanas_simultaneas) {
        const cuando = estado === 'activa' ? 'ahora mismo' : 'para esa fecha';
        return { ok: false, error: `Tu plan ${plan.nombre} permite hasta ${plan.max_campanas_simultaneas} campañas activas simultáneas, y ${cuando} ya tenés ese cupo ocupado. Pausá o cerrá una campaña existente antes de continuar.` };
      }
    }
    const hospitales = datos.hospitales && datos.hospitales.length
      ? datos.hospitales
      : [{ hospital_id: datos.hospital_id, dias_atencion: datos.dias_atencion, horarios_atencion: datos.horarios_atencion, duracion_turno_min: datos.duracion_turno_min, cupo_por_turno: datos.cupo_por_turno }];
    if (!hospitales.length) return { ok: false, error: 'Elegí al menos un hospital donde se pueda donar.' };

    const campo = {
      hospital_id: datos.hospital_id,
      paciente_id: datos.paciente_id ?? null,
      titulo: datos.titulo,
      descripcion: datos.descripcion || '',
      tipo_sangre_requerida: datos.tipo_sangre_requerida ?? null,
      unidades_requeridas: datos.unidades_requeridas,
      unidades_obtenidas: datos.unidades_obtenidas ?? 0,
      estado,
      urgente: !!datos.urgente,
      fecha_publicacion: estado === 'borrador' ? null : (datos.fecha_publicacion || ahora().toISOString()),
      fecha_cierre: datos.fecha_cierre,
      alcance: datos.alcance || 'local',
      confirmacion_automatica: !!datos.confirmacion_automatica,
      creado_en: datos.creado_en || new Date().toISOString(),
    };

    const campana = datos.id
      ? HemoRed.db.actualizar('campanas', datos.id, campo)
      : HemoRed.db.crear('campanas', campo);

    // Reemplaza la config de hospitales participantes entera — más simple
    // y seguro que tratar de "mergear" altas/bajas de hospitales cada vez
    // que se edita (el wizard siempre manda la lista completa vigente).
    HemoRed.db.where('campana_hospital', 'campana_id', campana.id).forEach(ch => HemoRed.db.eliminar('campana_hospital', ch.id));
    hospitales.forEach(h => {
      HemoRed.db.crear('campana_hospital', {
        campana_id: campana.id,
        hospital_id: h.hospital_id,
        dias_atencion: h.dias_atencion || [],
        horarios_atencion: h.horarios_atencion || [],
        duracion_turno_min: h.duracion_turno_min || 30,
        cupo_por_turno: h.cupo_por_turno ?? 1,
      });
    });

    return { ok: true, campana };
  }

  // Mismo crearCampana pero fuerza estado 'borrador' y no valida límite de
  // plan (los borradores no cuentan) — separado para que el wizard no
  // tenga que acordarse de pasar el estado a mano al guardar un borrador.
  function guardarBorradorCampana(datos) {
    return crearCampana({ ...datos, estado: 'borrador' });
  }

  // Listado real para hospital/campanas.html — cada campaña ya trae
  // unidades_obtenidas/unidades_requeridas (cupos) directo del registro,
  // no hace falta recalcular nada contra turnos para esa columna.
  // "Una campaña, varios hospitales" (2026-10-27): incluye tanto las que
  // este hospital CREÓ como aquellas en las que solo PARTICIPA como punto
  // de donación (creadas por otro hospital) — `esCreador` distingue las dos,
  // para que la UI pueda mostrar "Participás" en vez de las acciones de
  // dueño (editar/pausar/cerrar, que siguen siendo solo del creador).
  function cargarCampanasHospital(hospitalId) {
    const creadas = HemoRed.db.where('campanas', 'hospital_id', hospitalId);
    const idsCreadas = new Set(creadas.map(c => c.id));
    const idsParticipa = new Set(HemoRed.db.where('campana_hospital', 'hospital_id', hospitalId).map(ch => ch.campana_id));
    const participaSinCrear = [...idsParticipa].filter(id => !idsCreadas.has(id))
      .map(id => HemoRed.db.find('campanas', id)).filter(Boolean);
    return [...creadas, ...participaSinCrear]
      .map(c => ({ ...c, esCreador: c.hospital_id === hospitalId }))
      .sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en));
  }

  // Pausar/reactivar/cerrar: son cambios de ESTADO, separados a propósito
  // de "Editar" (que toca contenido) — pedido explícito de la usuaria,
  // 2026-09-29. Pausada/cerrada no cuentan contra el límite del plan
  // (esCampanaActiva() ya las excluye). Reactivar SÍ vuelve a validar el
  // límite: si mientras tanto el hospital llegó al tope con otras
  // campañas, no puede reactivar esta sin pausar/cerrar alguna primero.
  function pausarCampana(id) {
    const c = HemoRed.db.actualizar('campanas', id, { estado: 'pausada' });
    return c ? { ok: true, campana: c } : { ok: false, error: 'Campaña no encontrada.' };
  }

  function reactivarCampana(id) {
    const campana = HemoRed.db.find('campanas', id);
    if (!campana) return { ok: false, error: 'Campaña no encontrada.' };
    const plan = obtenerPlanHospital(campana.hospital_id);
    const ocupado = cupoOcupadoEn(campana.hospital_id, ahora(), id);
    if (plan && ocupado >= plan.max_campanas_simultaneas) {
      return { ok: false, error: `Tu plan ${plan.nombre} permite hasta ${plan.max_campanas_simultaneas} campañas activas simultáneas, y ese cupo ya está ocupado. Pausá o cerrá otra antes de reactivar esta.` };
    }
    return { ok: true, campana: HemoRed.db.actualizar('campanas', id, { estado: 'activa' }) };
  }

  // Cerrar una campaña cierra también el evento del paciente que la
  // originó (2026-10-20, pedido explícito de la usuaria) — pero solo si no
  // le queda NINGUNA otra campaña sin cerrar (un mismo evento puede tener
  // más de una campaña, ej. una primera que no llegó al cupo y una
  // segunda para completarlo — cerrar la primera no debería liberar al
  // paciente para un evento nuevo si la segunda sigue en curso).
  function cerrarCampana(id) {
    const c = HemoRed.db.actualizar('campanas', id, { estado: 'cerrada' });
    if (!c) return { ok: false, error: 'Campaña no encontrada.' };
    if (c.paciente_id) {
      const quedanAbiertas = HemoRed.db.where('campanas', 'paciente_id', c.paciente_id)
        .some(otra => otra.estado !== 'cerrada');
      if (!quedanAbiertas) {
        const relacionesDelPaciente = HemoRed.db.where('paciente_hospital', 'paciente_id', c.paciente_id).map(r => r.id);
        const evento = HemoRed.db.all('eventos_paciente').find(e => relacionesDelPaciente.includes(e.paciente_hospital_id) && e.activo);
        if (evento) _cerrarEvento(evento.id);
      }
    }
    return { ok: true, campana: c };
  }

  // Borra de verdad (no es un cambio de estado) — solo permitido en
  // borrador: una campaña que ya estuvo activa/programada no se "borra",
  // se cierra (cerrarCampana), para no perder el historial de algo que
  // pudo haber tenido turnos reales.
  function eliminarBorrador(id) {
    const campana = HemoRed.db.find('campanas', id);
    if (!campana) return { ok: false, error: 'Campaña no encontrada.' };
    if (campana.estado !== 'borrador') return { ok: false, error: 'Solo se pueden eliminar borradores — esta campaña ya está publicada.' };
    HemoRed.db.eliminar('campanas', id);
    return { ok: true };
  }

  // Detalle real para hospital/campana_detalle.html — campaña + sus
  // turnos con el donante ya resuelto (nombre/documento), para las 3
  // pestañas (turnos / descripción / donantes confirmados).
  // "Una campaña, varios hospitales" (2026-10-27): `hospitales` trae TODOS
  // los participantes con su propia config (días/horarios/cupo) + los
  // datos del hospital — `hospital` (singular) sigue siendo el creador, a
  // propósito, para no romper nada que ya lo use así.
  function cargarDetalleCampana(id) {
    _procesarVencimientosTurnos();
    const campana = HemoRed.db.find('campanas', id);
    if (!campana) return null;
    const hospital = HemoRed.db.find('hospitales', campana.hospital_id);
    const paciente = campana.paciente_id ? HemoRed.db.find('pacientes', campana.paciente_id) : null;
    const hospitales = HemoRed.db.where('campana_hospital', 'campana_id', id)
      .map(ch => ({ ...ch, hospital: HemoRed.db.find('hospitales', ch.hospital_id) }));
    const turnos = HemoRed.db.where('turnos', 'campana_id', id)
      .map(t => ({ ...t, donante: HemoRed.db.find('usuarios', t.usuario_id) }))
      .sort((a, b) => `${a.fecha}${a.hora}`.localeCompare(`${b.fecha}${b.hora}`));
    return { campana, hospital, hospitales, paciente, turnos };
  }

  // Qué turnos reales de esta campaña dejarían de encajar si se guardara
  // la config nueva — para el flujo de "Editar" cuando la campaña ya tiene
  // turnos: la usuaria pidió explícitamente (2026-09-29) poder cancelarlos
  // a mano ahí mismo para destrabar el guardado, sin que la ventana de
  // tiempo ni `confirmacion_automatica` entren en juego (por eso esto no
  // usa cancelarTurno() del donante — un rechazo administrativo del
  // hospital usa rechazarTurno(), que no tiene ninguna de esas dos
  // restricciones). `hospitalesConfig` es un array (una fila por hospital
  // participante, "una campaña, varios hospitales" 2026-10-27) — cada
  // turno se chequea contra la config de SU PROPIO hospital, no una sola
  // compartida. Un turno de un hospital que ya no participa (se sacó de
  // la lista) también bloquea — no hay config con la que comparar, así
  // que se interpreta como "ya no encaja".
  function turnosQueBloqueanEdicion(campanaId, hospitalesConfig) {
    _procesarVencimientosTurnos();
    const turnos = HemoRed.db.where('turnos', 'campana_id', campanaId)
      .filter(t => t.estado !== 'cancelado');
    return turnos.filter(t => {
      const config = hospitalesConfig.find(h => h.hospital_id === t.hospital_id);
      if (!config) return true; // el hospital de este turno ya no está en la lista
      const slots = generarSlotsDisponibles(config, t.fecha);
      return !slots || !slots.includes(t.hora);
    }).map(t => ({ ...t, donante: HemoRed.db.find('usuarios', t.usuario_id) }));
  }

  async function cargarTurnosHoy() {
    const db = await HemoRed.db.init();
    _procesarVencimientosTurnos();
    const s = HemoRed.sesion.get();
    const usuario = HemoRed.db.find('usuarios', s?.usuario_id);
    const hospital = HemoRed.db.find('hospitales', usuario?.hospital_id);

    const hoy = hoyISO();
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
  // `bolsas` ahora lo carga el extraccionista a mano, una por una (antes era un
  // solo número que se generaba solo + un volumen único para toda la
  // donación) — puede haber más de una bolsa por extracción real (ej. se
  // cambió de bolsa a mitad de camino), y cada una puede tener un volumen
  // distinto (la que se interrumpió no necesariamente llegó a 450ml).
  // La primera bolsa sigue siendo el ancla de `formulario_postdonacion`
  // (el token de F4 nunca se ata a la identidad del donante, ver docs/01).
  // `volumen_ml` del registro de la donación queda como la suma de todas,
  // para no romper las pantallas que ya muestran un único total (Mis
  // donaciones, Ver registro, etc.).
  function registrarDonacion(turnoId, { profesionalId, bolsas, observaciones }) {
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
    if (!bolsas?.length || !bolsas[0]?.numero) return { ok: false, error: 'Ingresá el número de bolsa.' };

    const [hh, mm] = turno.hora.split(':').map(Number);
    const finMin = mm + 20;
    const horaFin = `${String(hh + Math.floor(finMin / 60)).padStart(2, '0')}:${String(finMin % 60).padStart(2, '0')}`;
    const volumenTotal = bolsas.reduce((sum, b) => sum + (b.volumenMl || 0), 0);

    const donacion = HemoRed.db.crear('donaciones', {
      turno_id: turnoId,
      campana_id: turno.campana_id,
      usuario_id: turno.usuario_id,
      hospital_id: turno.hospital_id,
      profesional_id: profesionalId,
      numero_bolsa: bolsas[0].numero,
      bolsas,
      volumen_ml: volumenTotal || 450,
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
      resultado_apto: true,
      reacciones: null,
      observaciones: observaciones || null,
      registrado_en: ahora().toISOString(),
    });

    HemoRed.db.actualizar('turnos', turnoId, { estado: 'completado' });

    // El token y su expiración ya usaban la hora real de por sí (ahora
    // `ahora()` también es la hora real en todos lados, ver más arriba).
    const token = generarTokenPostdonacion();
    const formularioPostdonacion = HemoRed.db.crear('formulario_postdonacion', {
      numero_bolsa: bolsas[0].numero,
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

  // La extracción se intentó pero no se completó (reacción del donante,
  // vena colapsada, etc.) — pedido explícito de la usuaria: a diferencia de
  // registrarDonacion(), esto NO crea un registro en `donaciones` (no hay
  // bolsa real utilizable) ni genera F4. Deja el turno en un estado nuevo
  // ('incompleta') para que no quede eternamente "Lista para donar".
  function registrarAtencionSinDonacion(turnoId, { profesionalId, observaciones }) {
    const turno = HemoRed.db.find('turnos', turnoId);
    if (!turno) return { ok: false, error: 'Turno no encontrado.' };
    if (turno.estado !== 'confirmado') return { ok: false, error: 'Este turno no está en condiciones de registrar esto.' };
    if (!profesionalId) return { ok: false, error: 'Falta identificar al profesional.' };

    const turnoActualizado = HemoRed.db.actualizar('turnos', turnoId, {
      estado: 'incompleta',
      atencion_observaciones: observaciones || null,
      atencion_registrada_por: profesionalId,
      atencion_registrada_en: ahora().toISOString(),
    });
    return { ok: true, turno: turnoActualizado };
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
    _procesarVencimientosTurnos();
    const s = HemoRed.sesion.get();
    const prof = HemoRed.db.where('profesionales', 'usuario_id', s?.usuario_id)[0];
    const ph = HemoRed.db.where('profesional_hospital', 'profesional_id', prof?.id);
    const hospital_ids = ph.map(p => p.hospital_id);

    // Pasados, presentes y futuros (pedido explícito de la usuaria,
    // 2026-10-06) — antes se filtraba a `t.fecha === hoy`, mostrando solo
    // "hoy" y perdiendo cualquier noción de "a quién atendí ayer" o "qué
    // me queda esta semana". El stat "Turnos hoy" sigue siendo literal
    // (hoy, nada más); el resto de los stats y la lista abajo cubren todo
    // el rango, ordenado cronológicamente, para que el profesional (médico
    // o extraccionista) pueda ver su agenda completa, no solo el día de hoy.
    const hoy = hoyISO();
    // Pedido explícito de la usuaria: un turno todavía "pendiente" (el
    // hospital nunca lo confirmó) no le aparece al profesional en ningún
    // período — ni presente, ni futuro, ni como historial — porque nunca
    // llegó a ser algo que él tuviera que esperar. "cancelado" SÍ puede
    // seguir apareciendo: también cubre un turno que SÍ estuvo confirmado
    // y el donante canceló después, y eso sí le atañe.
    const turnos = HemoRed.db.all('turnos').filter(t => hospital_ids.includes(t.hospital_id) && t.estado !== 'pendiente');
    const usuarios = HemoRed.db.all('usuarios');
    const campanas = HemoRed.db.all('campanas');
    const donaciones = HemoRed.db.all('donaciones');
    const evaluaciones = HemoRed.db.all('evaluacion_clinica');

    const turnosConDonacion = turnos
      .map(t => ({
        ...t,
        donante: usuarios.find(u => u.id === t.usuario_id),
        campana: campanas.find(c => c.id === t.campana_id),
        donacion: donaciones.find(d => d.turno_id === t.id) || null,
        evaluacion: evaluaciones.find(e => e.turno_id === t.id) || null,
      }))
      .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));

    const turnosHoy = turnosConDonacion.filter(t => t.fecha === hoy);

    // Las 4 tarjetas de arriba del dashboard — a pedido explícito,
    // acotadas al día de hoy (no todo el historial) y partidas según lo
    // que de verdad le toca a CADA rol: para el médico, el turno es
    // "suyo" desde que se agenda hasta que carga la evaluación clínica;
    // para el extraccionista, recién entra en juego cuando el médico ya dio el
    // apto, y antes de eso cae en "Pendientes" (por eso esos números se
    // van corriendo de una tarjeta a otra a medida que el médico evalúa,
    // sin que el extraccionista haga nada). Los 4 baldes son mutuamente
    // excluyentes y suman el total de turnos de hoy.
    let completados, cancelados, enProceso, pendientes;
    if (prof?.tipo === 'medico') {
      // "En proceso" = el médico tiene la entrevista ABIERTA ahora mismo
      // (turno.estado === 'en_curso', puesto por iniciarEntrevistaClinica()
      // al clickear "Iniciar entrevista" — no por estar simplemente listo
      // para empezar, eso cae en "Pendiente"). Si cancela el modal sin
      // terminar, cancelarEntrevistaClinica() lo vuelve a 'confirmado' y
      // reaparece acá como pendiente.
      cancelados = turnosHoy.filter(t => ['cancelado', 'ausente'].includes(t.estado));
      completados = turnosHoy.filter(t => !!t.evaluacion && !cancelados.includes(t));
      enProceso = turnosHoy.filter(t => t.estado === 'en_curso');
    } else {
      cancelados = turnosHoy.filter(t => ['no_apto', 'cancelado', 'ausente', 'incompleta'].includes(t.estado));
      completados = turnosHoy.filter(t => !!t.donacion && !cancelados.includes(t));
      enProceso = turnosHoy.filter(t => !completados.includes(t) && !cancelados.includes(t) && !!t.evaluacion);
    }
    pendientes = turnosHoy.filter(t => !completados.includes(t) && !cancelados.includes(t) && !enProceso.includes(t));

    // El badge del menú muestra lo mismo que la tarjeta "En proceso": lo
    // que de verdad le toca a este profesional accionar hoy (no
    // "pendientes", que todavía no le corresponde). Antes contaba "todo
    // lo no cerrado" (pendientes + en proceso juntos), lo que para el
    // extraccionista mostraba un número mayor al de la tarjeta "En proceso" y
    // no explicaba nada — un médico con todo evaluado y un extraccionista con
    // todo extraído veían el mismo número sin que dijera qué les tocaba.
    _set('nav-badge-turnos', enProceso.length);

    const totalHoy = turnosHoy.length;
    _set('stat-completados', completados.length);
    _set('stat-en-proceso', enProceso.length);
    _set('stat-pendientes', pendientes.length);
    _set('stat-cancelados', cancelados.length);
    if (typeof HemoRed !== 'undefined' && HemoRed.ui?.pintarPorcentaje) {
      HemoRed.ui.pintarPorcentaje('trend-completados', completados.length, totalHoy, { bg: '#e1f5ee', color: '#27ae60' });
      HemoRed.ui.pintarPorcentaje('trend-en-proceso', enProceso.length, totalHoy, { bg: '#efeefd', color: '#7f77dd' });
      HemoRed.ui.pintarPorcentaje('trend-pendientes', pendientes.length, totalHoy, { bg: '#fdf3e8', color: '#e67e22' });
      HemoRed.ui.pintarPorcentaje('trend-cancelados', cancelados.length, totalHoy, { bg: '#fde8e8', color: '#c0392b' });
    }
    _set('sub-completados', `${completados.length} de ${totalHoy} turnos hoy`);
    _set('sub-en-proceso', `${enProceso.length} de ${totalHoy} turnos hoy`);
    _set('sub-pendientes', `${pendientes.length} de ${totalHoy} turnos hoy`);
    _set('sub-cancelados', `${cancelados.length} de ${totalHoy} turnos hoy`);

    return turnosConDonacion.map(t => ({ ...t, tieneDonacionRegistrada: !!t.donacion, tieneEvaluacionClinica: !!t.evaluacion }));
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
    ahora,
    fechaISO,
    hoyISO,
    crearMensajeContacto,
    restablecerPasswordPorEmail,
    CAMPOS_PERFIL_PERSONAL,
    CAMPOS_PERFIL_MEDICOS,
    verificarPerfilIncompleto,
    cargarDashboardDonante,
    renderCampanas,
    crearTurno,
    verificarElegibilidadReserva,
    actualizarTurno,
    cancelarTurno,
    confirmarTurno,
    rechazarTurno,
    marcarAusente,
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
    cambiarPasswordDonante,
    cambiarEmailDonante,
    eliminarCuentaDonante,
    cargarDashboardHospital,
    cargarPacientesHospital,
    crearPaciente,
    cargarDetallePaciente,
    cargarProfesionalesHospital,
    crearProfesional,
    cargarMetricasHospital,
    cargarDocumentacionHospital,
    esCampanaActiva,
    obtenerPlanHospital,
    contarCampanasActivas,
    cupoOcupadoEn,
    generarSlotsDisponibles,
    fechasAtencionCampana,
    calcularStatsTurnos,
    calcularStatsTurnosTotal,
    campanaHospital: _campanaHospital,
    crearCampana,
    guardarBorradorCampana,
    cargarCampanasHospital,
    pausarCampana,
    reactivarCampana,
    cerrarCampana,
    eliminarBorrador,
    cargarDetalleCampana,
    turnosQueBloqueanEdicion,
    cargarTurnosHoy,
    registrarDonacion,
    registrarAtencionSinDonacion,
    validarTokenPostdonacion,
    guardarRespuestaPostdonacion,
    cargarTurnosProfesional,
    cargarRevisionClinica,
    corregirRespuestasCuestionario,
    iniciarEntrevistaClinica,
    cancelarEntrevistaClinica,
    registrarEvaluacionClinica,
    cargarHistorialDonante,
    cargarDashboardAdmin,
  };
})();
