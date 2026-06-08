/* ============================================================
   HEMORED — sesion.js
   Manejo de sesión de demo (login, logout, rol activo)
   ============================================================ */

HemoRed.sesion = (function() {
  const USUARIOS = {
    'donante@hemored.com':      { pass: 'donante123',   rol: 'donante',      usuario_id: 1, nombre: 'Sofía Páez',       iniciales: 'SP', dest: '../donante/dashboard.html' },
    'hospital@hemored.com':     { pass: 'hospital123',  rol: 'hospital',     usuario_id: 3, nombre: 'Hospital Ramos Mejía', iniciales: 'RM', dest: '../hospital/dashboard.html' },
    'profesional@hemored.com':  { pass: 'prof123',      rol: 'profesional',  usuario_id: 4, nombre: 'Dr. Carlos Méndez', iniciales: 'CM', dest: '../profesional/dashboard.html' },
    'admin@hemored.com':        { pass: 'admin123',     rol: 'superadmin',   usuario_id: 2, nombre: 'Admin HemoRed',    iniciales: 'AH', dest: '../admin/dashboard.html' },
  };

  let _sesion = null;

  function login(email, password) {
    const u = USUARIOS[email.toLowerCase().trim()];
    if (u && u.pass === password) {
      _sesion = { email, rol: u.rol, usuario_id: u.usuario_id, nombre: u.nombre, iniciales: u.iniciales };
      sessionStorage.setItem('hemored_sesion', JSON.stringify(_sesion));
      return { ok: true, dest: u.dest };
    }
    return { ok: false };
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

  return { login, logout, get, requerirLogin, inyectarPerfil };
})();
