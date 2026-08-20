/* ============================================================
   HEMORED — sesion.js
   Manejo de sesión de demo (login, logout, rol activo)
   ============================================================ */

HemoRed.sesion = (function() {
  const USUARIOS = {
    'donante@hemored.com':      { pass: 'donante123',   rol: 'donante',      usuario_id: 1, nombre: 'Sofía Páez',       iniciales: 'SP', dest: '../donante/dashboard.html' },
    'hospital@hemored.com':     { pass: 'hospital123',  rol: 'hospital',     usuario_id: 3, nombre: 'Hospital Ramos Mejía', iniciales: 'RM', dest: '../hospital/dashboard.html' },
    'profesional@hemored.com':  { pass: 'prof123',      rol: 'profesional',  usuario_id: 4, nombre: 'Dr. Carlos Méndez', iniciales: 'CM', dest: '../profesional/dashboard.html' },
    'admin@hemored.com':        { pass: 'admin123',     rol: 'equipo_hemored', usuario_id: 2, nombre: 'Admin HemoRed',    iniciales: 'AH', dest: '../admin/dashboard.html' },
  };

  const DEST_POR_ROL = {
    donante: '../donante/dashboard.html',
    hospital: '../hospital/dashboard.html',
    profesional: '../profesional/dashboard.html',
    equipo_hemored: '../admin/dashboard.html',
  };

  let _sesion = null;

  // Async porque, si no matchea ninguna de las 4 cuentas demo hardcodeadas,
  // busca entre los usuarios reales creados en este navegador (ej. donantes
  // que se registraron vía publico/registro.html) — eso requiere db.init().
  async function login(email, password) {
    const emailNorm = email.toLowerCase().trim();
    const u = USUARIOS[emailNorm];
    if (u && u.pass === password) {
      _sesion = { email: emailNorm, rol: u.rol, usuario_id: u.usuario_id, nombre: u.nombre, iniciales: u.iniciales };
      sessionStorage.setItem('hemored_sesion', JSON.stringify(_sesion));
      return { ok: true, dest: u.dest };
    }

    await HemoRed.db.init();
    const registrado = HemoRed.db.where('usuarios', 'email', emailNorm)[0];
    if (registrado && registrado.password_hash === password) {
      const nombreCompleto = `${registrado.nombre} ${registrado.apellido || ''}`.trim();
      const iniciales = registrado.avatar_iniciales || (nombreCompleto[0] || '?').toUpperCase();
      _sesion = { email: registrado.email, rol: registrado.rol, usuario_id: registrado.id, nombre: nombreCompleto, iniciales };
      sessionStorage.setItem('hemored_sesion', JSON.stringify(_sesion));
      return { ok: true, dest: DEST_POR_ROL[registrado.rol] || '../publico/login.html' };
    }

    return { ok: false };
  }

  // Crea un usuario donante nuevo en la BD simulada, lo loguea y devuelve
  // el destino al que redirigir. No valida contra sesion.login() porque
  // los usuarios creados acá no forman parte del objeto USUARIOS hardcodeado.
  function registrarDonante({ nombre, apellido, email, telefono, password }) {
    const emailNorm = email.toLowerCase().trim();
    const existente = HemoRed.db.where('usuarios', 'email', emailNorm);
    if (existente.length > 0) {
      return { ok: false, error: 'Ya existe una cuenta con ese email.' };
    }
    const iniciales = (nombre[0] || '').toUpperCase() + (apellido[0] || '').toUpperCase();
    // nombre/apellido separados: mismo esquema que usa usuarios.json (no un string combinado)
    const usuario = HemoRed.db.crear('usuarios', {
      nombre,
      apellido,
      email: emailNorm,
      password_hash: password, // demo: sin hash real, no hay backend
      rol: 'donante',
      tipo_documento_id: null,
      numero_documento: null,
      fecha_nacimiento: null,
      telefono: telefono || null,
      direccion: null,
      ciudad: null,
      provincia: null,
      tipo_sangre: null,
      peso_kg: null,
      empleadores_frecuentes: [],
      activo: true,
      fecha_registro: new Date().toISOString().slice(0, 10),
      avatar_iniciales: iniciales,
    });
    const nombreCompleto = `${nombre} ${apellido}`.trim();
    _sesion = { email: usuario.email, rol: 'donante', usuario_id: usuario.id, nombre: nombreCompleto, iniciales };
    sessionStorage.setItem('hemored_sesion', JSON.stringify(_sesion));
    return { ok: true, dest: '../donante/dashboard.html' };
  }

  function logout() {
    _sesion = null;
    sessionStorage.removeItem('hemored_sesion');
    window.location.href = '../publico/login.html';
  }

  function get() {
    if (_sesion) return _sesion;
    const stored = sessionStorage.getItem('hemored_sesion');
    if (stored) { _sesion = JSON.parse(stored); return _sesion; }
    return null;
  }

  function requerirLogin(rolEsperado) {
    const s = get();
    if (!s) { window.location.href = '../publico/login.html'; return null; }
    if (rolEsperado && s.rol !== rolEsperado) { window.location.href = '../publico/login.html'; return null; }
    return s;
  }

  function inyectarPerfil() {
    const s = get();
    if (!s) return;
    document.querySelectorAll('[data-sesion-nombre]').forEach(el => el.textContent = s.nombre);
    document.querySelectorAll('[data-sesion-iniciales]').forEach(el => el.textContent = s.iniciales);
    document.querySelectorAll('[data-sesion-rol]').forEach(el => el.textContent = s.rol);
  }

  return { login, logout, get, requerirLogin, inyectarPerfil, registrarDonante };
})();
