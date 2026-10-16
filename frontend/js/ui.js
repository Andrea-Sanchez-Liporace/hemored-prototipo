/* ============================================================
   HEMORED — ui.js
   Helpers de UI: sidebar, modales, toasts, filtros, firma
   ============================================================ */

HemoRed.ui = (function() {

  // ===== SIDEBAR MOBILE =====
  function initSidebar() {
    const btn   = document.getElementById('sidebar-btn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (btn) btn.addEventListener('click', () => toggleSidebar(true));
    if (overlay) overlay.addEventListener('click', () => toggleSidebar(false));
  }

  function toggleSidebar(open) {
    document.getElementById('sidebar')?.classList.toggle('open', open);
    document.getElementById('sidebar-overlay')?.classList.toggle('open', open);
  }

  // ===== SIDEBAR DEL HOSPITAL (único, compartido por las 16 páginas) =====
  // Antes el <aside> entero (logo, nombre, plan, nav, tarjeta de plan del
  // footer) estaba copiado y pegado en cada página de hospital/*.html —
  // con el tiempo quedaron desincronizadas: algunas tenían "Facturación"
  // en el menú y no "Notificaciones" (o viceversa), el nombre/email del
  // hospital estaba hardcodeado en todas menos dashboard.html, y la
  // tarjeta de plan del pie ("3 de 3 campañas activas") era texto fijo,
  // nunca actualizado — podía (y terminó) contradiciendo el número real
  // que se ve en Campañas. Centralizado acá 2026-10-14: cada página solo
  // necesita `<aside class="sidebar" id="sidebar"></aside>` vacío + un
  // `<script>` que llame a esto, y moverse/agregar un ítem de menú es un
  // cambio en un solo lugar.
  const NAV_HOSPITAL = [
    { grupo: 'Principal', items: [
      { href: 'dashboard.html', icon: 'layout-dashboard', label: 'Inicio' },
      { href: 'campanas.html', icon: 'speakerphone', label: 'Campañas' },
      { href: 'turnos.html', icon: 'calendar', label: 'Turnos' },
      { href: 'metricas.html', icon: 'chart-bar', label: 'Métricas' },
    ] },
    { grupo: 'Gestión', items: [
      { href: 'pacientes.html', icon: 'user-plus', label: 'Pacientes' },
      { href: 'profesionales.html', icon: 'stethoscope', label: 'Profesionales' },
      { href: 'documentacion.html', icon: 'file-text', label: 'Documentación' },
    ] },
    { grupo: 'Cuenta', items: [
      { href: 'perfil.html', icon: 'building-hospital', label: 'Perfil del hospital' },
      { href: 'facturacion.html', icon: 'receipt', label: 'Facturación' },
      { href: 'notificaciones.html', icon: 'bell', label: 'Notificaciones' },
      { href: '../publico/login.html', icon: 'logout', label: 'Cerrar sesión', absoluta: true },
    ] },
  ];

  async function montarSidebarHospital() {
    const el = document.getElementById('sidebar');
    if (!el) return;

    // El esqueleto (nav, botón de cerrar, listeners de abrir/cerrar) no
    // depende de ningún dato real — se arma ya mismo, sincrónico, para
    // que el botón de menú funcione desde el primer instante. El nombre
    // del hospital y la tarjeta de plan (que sí son reales) se completan
    // después de `await HemoRed.db.init()`, actualizando esos nodos
    // puntuales en vez de reescribir el innerHTML entero (eso tiraría
    // abajo los listeners ya enganchados).
    const paginaActual = location.pathname.split('/').pop();
    const navHTML = NAV_HOSPITAL.map(grupo => `
      <div class="nav-section-label">${grupo.grupo}</div>
      ${grupo.items.map(it => {
        const href = it.absoluta ? it.href : `../hospital/${it.href}`;
        const activo = !it.absoluta && it.href === paginaActual;
        return `<a class="nav-item${activo ? ' active' : ''}" href="${href}"><i class="ti ti-${it.icon}" aria-hidden="true"></i>${it.label}</a>`;
      }).join('')}
    `).join('');

    el.innerHTML = `
      <div class="sidebar-logo">
        <a href="../index.html">Hemo<span>red</span></a>
        <button class="sidebar-close-btn" aria-label="Cerrar menu"><i class="ti ti-x" aria-hidden="true"></i></button>
      </div>
      <div class="sidebar-hospital">
        <div class="sidebar-hospital-name" id="hospital-nombre-sidebar">—</div>
        <div style="font-size:12px;color:#f28b98;margin-top:2px;" id="hospital-email-sidebar"></div>
        <div class="sidebar-hospital-plan" id="hospital-plan-badge"><i class="ti ti-star" style="font-size:10px;" aria-hidden="true"></i>Plan —</div>
      </div>
      <nav class="sidebar-nav">${navHTML}</nav>
      <div class="sidebar-footer">
        <div class="plan-card-side">
          <div class="plan-card-side-title" id="plan-card-title">Plan —</div>
          <div class="plan-card-side-sub" id="plan-card-sub">—</div>
          <div style="height:4px;background:rgba(255,255,255,0.1);border-radius:2px;margin-top:8px;overflow:hidden;">
            <div style="height:100%;width:0%;background:#ef647c;border-radius:2px;" id="plan-card-bar"></div>
          </div>
          <div style="font-size:10px;color:#f28b98;margin-top:6px;" id="plan-card-limite"><a href="../publico/pago.html" style="color:#ef647c;text-decoration:none;">Actualizar plan</a></div>
        </div>
      </div>
    `;

    document.querySelector('.mobile-topbar-btn')?.addEventListener('click', () => toggleSidebar(true));
    document.getElementById('sidebar-overlay')?.addEventListener('click', () => toggleSidebar(false));
    el.querySelector('.sidebar-close-btn')?.addEventListener('click', () => toggleSidebar(false));

    initScrollSidebar();

    await HemoRed.db.init();
    const s = HemoRed.sesion.get();
    const usuario = s ? HemoRed.db.find('usuarios', s.usuario_id) : null;
    const hospital = usuario ? HemoRed.db.find('hospitales', usuario.hospital_id) : null;
    const plan = hospital ? HemoRed.data.obtenerPlanHospital(hospital.id) : null;
    const campanasActivas = hospital ? HemoRed.data.contarCampanasActivas(hospital.id) : 0;
    const max = plan?.max_campanas_simultaneas || 0;
    const pctPlan = max ? Math.min(100, Math.round((campanasActivas / max) * 100)) : 0;
    const alLimite = max > 0 && campanasActivas >= max;

    document.getElementById('hospital-nombre-sidebar').textContent = hospital?.nombre || '—';
    document.getElementById('hospital-email-sidebar').textContent = hospital?.email || '';
    document.getElementById('hospital-plan-badge').innerHTML = `<i class="ti ti-star" style="font-size:10px;" aria-hidden="true"></i>Plan ${plan?.nombre || '—'}`;
    document.getElementById('plan-card-title').textContent = `Plan ${plan?.nombre || '—'}`;
    document.getElementById('plan-card-sub').textContent = `${campanasActivas} de ${max} campañas activas`;
    document.getElementById('plan-card-bar').style.width = pctPlan + '%';
    if (alLimite) {
      document.getElementById('plan-card-limite').innerHTML =
        'Límite alcanzado · <a href="../publico/pago.html" style="color:#ef647c;text-decoration:none;">Actualizar plan</a>';
    }
  }

  // ===== SIDEBAR DEL PROFESIONAL (dashboard.html + perfil.html) =====
  // Mismo motivo que montarSidebarHospital(): el <aside> estaba copiado en
  // los 2 archivos, y el nombre/especialidad/hospital del profesional se
  // recalculaban por separado en cada uno (de formas levemente distintas).
  async function montarSidebarProfesional() {
    const el = document.getElementById('sidebar');
    if (!el) return;

    const paginaActual = location.pathname.split('/').pop();
    el.innerHTML = `
      <div class="sidebar-logo"><a href="../index.html">Hemo<span>red</span></a>
        <button class="sidebar-close-btn" aria-label="Cerrar menu"><i class="ti ti-x" aria-hidden="true"></i></button></div>
      <div class="sidebar-prof">
        <div class="sidebar-avatar" id="sidebar-avatar">—</div>
        <div>
          <div class="sidebar-prof-name" id="sidebar-prof-name">—</div>
          <div class="sidebar-prof-role" id="sidebar-prof-role"></div>
        </div>
      </div>
      <nav class="sidebar-nav">
        <div class="nav-section-label">Principal</div>
        <a class="nav-item${paginaActual === 'dashboard.html' ? ' active' : ''}" href="../profesional/dashboard.html"><i class="ti ti-calendar"></i>Turnos<span class="nav-badge" id="nav-badge-turnos"></span></a>
        <div class="nav-section-label">Cuenta</div>
        <a class="nav-item${paginaActual === 'perfil.html' ? ' active' : ''}" href="../profesional/perfil.html"><i class="ti ti-user"></i>Perfil</a>
        <a class="nav-item" href="../publico/login.html"><i class="ti ti-logout"></i>Cerrar sesión</a>
      </nav>
    `;

    document.querySelector('.mobile-topbar-btn')?.addEventListener('click', () => toggleSidebar(true));
    document.getElementById('sidebar-overlay')?.addEventListener('click', () => toggleSidebar(false));
    el.querySelector('.sidebar-close-btn')?.addEventListener('click', () => toggleSidebar(false));
    initScrollSidebar();

    await HemoRed.db.init();
    const s = HemoRed.sesion.get();
    const usuario = s ? HemoRed.db.find('usuarios', s.usuario_id) : null;
    const prof = usuario ? HemoRed.db.where('profesionales', 'usuario_id', usuario.id)[0] : null;
    const hospitalProf = prof ? HemoRed.db.where('profesional_hospital', 'profesional_id', prof.id)[0] : null;
    const hospital = hospitalProf ? HemoRed.db.find('hospitales', hospitalProf.hospital_id) : null;

    document.getElementById('sidebar-avatar').textContent = s?.iniciales || '';
    document.getElementById('sidebar-prof-name').textContent = prof?.nombre_completo || s?.nombre || '—';
    document.getElementById('sidebar-prof-role').textContent = [prof?.especialidad, hospital?.nombre].filter(Boolean).join(' · ');

    // Llena #nav-badge-turnos reusando la función real (ya hace su propio
    // _set('nav-badge-turnos', ...) como efecto de lado) — hace falta
    // llamarla de nuevo acá porque en perfil.html nadie más la llama, y en
    // dashboard.html su propio DOMContentLoaded corre ANTES de que este
    // mount cree el <span> del badge (si no, ese primer _set() le pega a
    // un elemento que todavía no existe).
    HemoRed.data?.cargarTurnosProfesional?.();
  }

  // ===== SIDEBAR DEL DONANTE (7 páginas con sesión) =====
  // El nombre/iniciales ya se completaban solos vía los atributos
  // [data-sesion-nombre]/[data-sesion-iniciales] que aplica sesion.js en
  // cualquier página — eso no cambia acá. Lo que estaba duplicado 7 veces
  // es el <nav> en sí (y por eso nunca se habían notado del todo parejos
  // los 2 ítems de "Cuenta").
  const NAV_DONANTE = [
    { grupo: 'Principal', items: [
      { href: 'dashboard.html', icon: 'search', label: 'Buscar campañas' },
      { href: 'mis_turnos.html', icon: 'calendar', label: 'Mis turnos' },
      { href: 'mis_donaciones.html', icon: 'heart', label: 'Mis donaciones' },
      { href: 'mis_documentos.html', icon: 'file-text', label: 'Mis documentos' },
    ] },
    { grupo: 'Cuenta', items: [
      { href: 'perfil.html', icon: 'user', label: 'Perfil' },
      { href: 'notificaciones.html', icon: 'bell', label: 'Notificaciones' },
      { href: '../publico/login.html', icon: 'logout', label: 'Cerrar sesión', absoluta: true },
    ] },
  ];

  function montarSidebarDonante() {
    const el = document.getElementById('sidebar');
    if (!el) return;

    const paginaActual = location.pathname.split('/').pop();
    const navHTML = NAV_DONANTE.map(grupo => `
      <div class="nav-section-label">${grupo.grupo}</div>
      ${grupo.items.map(it => {
        const href = it.absoluta ? it.href : `../donante/${it.href}`;
        const activo = !it.absoluta && it.href === paginaActual;
        return `<a class="nav-item${activo ? ' active' : ''}" href="${href}"><i class="ti ti-${it.icon}" aria-hidden="true"></i>${it.label}</a>`;
      }).join('')}
    `).join('');

    el.innerHTML = `
      <div class="sidebar-logo">
        <a href="../index.html">Hemo<span>red</span></a>
        <button class="sidebar-close-btn" aria-label="Cerrar menu"><i class="ti ti-x" aria-hidden="true"></i></button>
      </div>
      <div class="sidebar-user">
        <div class="sidebar-avatar" data-sesion-iniciales></div>
        <div class="sidebar-user-info">
          <div class="sidebar-user-name"><span data-sesion-nombre></span></div>
          <div class="sidebar-user-role">Donante</div>
        </div>
      </div>
      <nav class="sidebar-nav">${navHTML}</nav>
      <div class="sidebar-footer">
        <div class="sidebar-alert hidden" id="sidebar-alerta-perfil">
          <div class="sidebar-alert-title">⚠️ Perfil incompleto</div>
          <div class="sidebar-alert-text">Completá tus datos personales y médicos para agilizar tu próxima donación.</div>
          <a class="sidebar-alert-btn" href="../donante/perfil.html">Completar perfil</a>
        </div>
      </div>
    `;

    // HemoRed.ui.init() ya corrió inyectarPerfil() en el DOMContentLoaded
    // general, pero en ese momento el <aside> todavía estaba vacío (este
    // mount corre después) — sin este segundo llamado, el nombre/iniciales
    // del sidebar se quedarían en blanco para siempre.
    HemoRed.sesion?.inyectarPerfil();
    document.querySelector('.mobile-topbar-btn')?.addEventListener('click', () => toggleSidebar(true));
    document.getElementById('sidebar-overlay')?.addEventListener('click', () => toggleSidebar(false));
    el.querySelector('.sidebar-close-btn')?.addEventListener('click', () => toggleSidebar(false));
    initScrollSidebar();
  }

  // ===== SIDEBAR DEL ADMIN (9 páginas — documentacion.html usa su propio
  // layout técnico, .app-sidebar, y queda afuera a propósito) =====
  // Admin todavía no está conectado a datos reales en el resto del rol
  // (ver memoria del proyecto), así que acá tampoco: se centraliza la
  // estructura para no seguir copiándola, pero el nombre/avatar siguen
  // siendo el mismo texto fijo que ya mostraban las 9 páginas. Los 2
  // badges sí se calculan reales (son un conteo de una sola línea cada
  // uno) en vez de quedar pisados con "4"/"2" para siempre.
  const NAV_ADMIN = [
    { grupo: 'Principal', items: [
      { href: 'dashboard.html', icon: 'layout-dashboard', label: 'Dashboard' },
      { href: 'hospitales.html', icon: 'building-hospital', label: 'Hospitales', badge: 'hospitales' },
      { href: 'donantes.html', icon: 'users', label: 'Donantes' },
      { href: 'metricas.html', icon: 'chart-bar', label: 'Métricas globales' },
    ] },
    { grupo: 'Negocio', items: [
      { href: 'planes.html', icon: 'star', label: 'Planes' },
      { href: 'facturacion.html', icon: 'receipt', label: 'Facturación global', badge: 'facturas' },
    ] },
    { grupo: 'Sistema', items: [
      { href: 'dashboard.html', icon: 'settings', label: 'Configuración', noActivo: true },
      { href: '../publico/login.html', icon: 'logout', label: 'Cerrar sesión', absoluta: true },
    ] },
  ];

  async function montarSidebarAdmin() {
    const el = document.getElementById('sidebar');
    if (!el) return;

    const paginaActual = location.pathname.split('/').pop();
    const navHTML = NAV_ADMIN.map(grupo => `
      <div class="nav-section-label">${grupo.grupo}</div>
      ${grupo.items.map(it => {
        const href = it.absoluta ? it.href : `../admin/${it.href}`;
        const activo = !it.absoluta && !it.noActivo && it.href === paginaActual;
        const badge = it.badge ? `<span class="nav-badge${activo ? ' active' : ''}" id="nav-badge-${it.badge}"></span>` : '';
        return `<a class="nav-item${activo ? ' active' : ''}" href="${href}"><i class="ti ti-${it.icon}"></i>${it.label}${badge}</a>`;
      }).join('')}
    `).join('');

    el.innerHTML = `
      <div class="sidebar-logo">
        <a href="../index.html">Hemo<span>red</span></a>
        <div class="sidebar-badge"><i class="ti ti-shield" style="font-size:10px;"></i>Super Admin
        <button class="sidebar-close-btn" aria-label="Cerrar menu"><i class="ti ti-x" aria-hidden="true"></i></button></div>
      </div>
      <div class="sidebar-user">
        <div class="sidebar-avatar">SA</div>
        <div>
          <div class="sidebar-user-name">Admin HemoRed</div>
          <div class="sidebar-user-role">Superadministrador</div>
        </div>
      </div>
      <nav class="sidebar-nav">${navHTML}</nav>
    `;

    document.querySelector('.mobile-topbar-btn')?.addEventListener('click', () => toggleSidebar(true));
    document.getElementById('sidebar-overlay')?.addEventListener('click', () => toggleSidebar(false));
    el.querySelector('.sidebar-close-btn')?.addEventListener('click', () => toggleSidebar(false));
    initScrollSidebar();

    await HemoRed.db.init();
    document.getElementById('nav-badge-hospitales').textContent = HemoRed.db.all('hospitales').length;
    document.getElementById('nav-badge-facturas').textContent =
      HemoRed.db.all('facturas').filter(f => f.estado === 'pendiente' || f.estado === 'vencida').length;
  }

  // Indicador de scroll propio del menú lateral — ver la nota larga en
  // global.css (.sidebar-nav-scrollbar) sobre por qué no se usa el
  // scrollbar nativo del navegador. Se cuelga solo de cualquier
  // `.sidebar-nav` que encuentre en la página (los 4 roles comparten la
  // misma clase), así que no hace falta llamarlo distinto por rol.
  function initScrollSidebar() {
    const nav = document.querySelector('.sidebar-nav');
    if (!nav) return;

    // El track/thumb NO puede vivir adentro de .sidebar-nav: al ser
    // .sidebar-nav el propio elemento con overflow-y:auto, un hijo
    // position:absolute anclado a su padding box scrollea junto con el
    // resto del contenido (se va de la vista apenas se baja el menú) en
    // vez de quedarse fijo en pantalla. Se envuelve .sidebar-nav en un
    // wrapper que SÍ se queda quieto, y el indicador va ahí, como hermano
    // del nav, no como hijo.
    const wrap = document.createElement('div');
    wrap.className = 'sidebar-nav-wrap';
    nav.parentNode.insertBefore(wrap, nav);
    wrap.appendChild(nav);

    const track = document.createElement('div');
    track.className = 'sidebar-nav-scrollbar';
    const thumb = document.createElement('div');
    thumb.className = 'sidebar-nav-scrollbar-thumb';
    track.appendChild(thumb);
    wrap.appendChild(track);

    let alturaThumbActual = 0;

    function actualizar() {
      const necesitaScroll = nav.scrollHeight > nav.clientHeight + 1;
      track.classList.toggle('visible', necesitaScroll);
      if (!necesitaScroll) return;
      const alturaThumb = Math.max((nav.clientHeight / nav.scrollHeight) * nav.clientHeight, 24);
      alturaThumbActual = alturaThumb;
      const maxScroll = nav.scrollHeight - nav.clientHeight;
      const posicion = maxScroll > 0 ? (nav.scrollTop / maxScroll) * (nav.clientHeight - alturaThumb) : 0;
      thumb.style.height = alturaThumb + 'px';
      thumb.style.transform = `translateY(${posicion}px)`;
    }

    // Click sostenido + arrastre sobre el thumb, como cualquier scrollbar de
    // verdad — la rueda del mouse y el teclado (flechas, con el foco en un
    // link del menú) ya andaban por ser scroll nativo del navegador, pero
    // arrastrar el thumb es un gesto que este indicador tiene que resolver
    // a mano, no viene gratis por ser un div propio.
    let arrastrando = false;
    let arrastreInicioY = 0;
    let arrastreInicioScroll = 0;

    thumb.addEventListener('mousedown', (e) => {
      arrastrando = true;
      arrastreInicioY = e.clientY;
      arrastreInicioScroll = nav.scrollTop;
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!arrastrando) return;
      const recorridoThumb = nav.clientHeight - alturaThumbActual;
      const maxScroll = nav.scrollHeight - nav.clientHeight;
      if (recorridoThumb <= 0 || maxScroll <= 0) return;
      const deltaScroll = ((e.clientY - arrastreInicioY) / recorridoThumb) * maxScroll;
      nav.scrollTop = Math.max(0, Math.min(maxScroll, arrastreInicioScroll + deltaScroll));
      actualizar();
    });

    document.addEventListener('mouseup', () => {
      if (!arrastrando) return;
      arrastrando = false;
      document.body.style.userSelect = '';
    });

    nav.addEventListener('scroll', actualizar);
    window.addEventListener('resize', actualizar);
    // La primera medición puede quedar corta si todavía no cargaron las
    // fuentes (Lobster/Inter, por @import de Google Fonts) — el texto con
    // la fuente de reserva ocupa menos alto, así que en ese momento puede
    // dar que "no hace falta scroll" y quedarse así aunque después, con la
    // fuente real, el menú sí desborde. Se vuelve a medir cuando termine de
    // cargar la página entera y, si el navegador lo soporta, apenas las
    // fuentes terminen de aplicarse.
    window.addEventListener('load', actualizar);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(actualizar);
    actualizar();
  }

  // ===== MODALES =====
  function abrirModal(id) {
    document.getElementById(id)?.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function cerrarModal(id) {
    document.getElementById(id)?.classList.remove('active');
    document.body.style.overflow = '';
  }

  function cerrarTodosModales() {
    document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
    document.body.style.overflow = '';
  }

  // ===== TOAST =====
  function toast(msg, tipo = 'ok') {
    let t = document.getElementById('hemored-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'hemored-toast';
      t.className = 'toast';
      document.body.appendChild(t);
    }
    t.innerHTML = `<i class="ti ti-${tipo === 'ok' ? 'check' : 'alert-circle'}"></i><span>${msg}</span>`;
    t.style.background = tipo === 'ok' ? 'var(--color-borravino)' : 'var(--color-danger)';
    t.classList.add('visible');
    setTimeout(() => t.classList.remove('visible'), 3000);
  }

  // Reemplazo propio del sitio para window.confirm() (pedido explícito de
  // la usuaria, 2026-10-16: no le gusta el popup nativo del navegador) —
  // reusa las mismas clases del componente modal compartido
  // (.modal-overlay/.modal/.modal-header/.btn-primary/.btn-secondary) para
  // que salga ya con la paleta de cada rol, sin tener que armar un modal
  // nuevo por página. Devuelve una Promise<boolean>: true = "Sí".
  function confirmar(mensaje, { titulo = 'Confirmar', textoSi = 'Sí', textoNo = 'No' } = {}) {
    return new Promise((resolve) => {
      let overlay = document.getElementById('hemored-confirm-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'hemored-confirm-overlay';
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
          <div class="modal" style="max-width:380px;border-radius:var(--radius-md);overflow:hidden;">
            <div class="modal-header" style="justify-content:center;">
              <div class="modal-title" id="hemored-confirm-titulo" style="text-align:center;">Confirmar</div>
            </div>
            <div class="modal-body">
              <p id="hemored-confirm-mensaje" style="font-size:14px;color:var(--color-text-secondary);line-height:1.5;margin:0;"></p>
            </div>
            <div class="modal-actions" style="gap:12px;">
              <button class="btn btn-secondary" id="hemored-confirm-no" style="flex:1;padding:13px;font-size:15px;"></button>
              <button class="btn btn-primary" id="hemored-confirm-si" style="flex:1;padding:13px;font-size:15px;"></button>
            </div>
          </div>`;
        document.body.appendChild(overlay);
      }
      document.getElementById('hemored-confirm-titulo').textContent = titulo;
      document.getElementById('hemored-confirm-mensaje').textContent = mensaje;
      const btnSi = document.getElementById('hemored-confirm-si');
      const btnNo = document.getElementById('hemored-confirm-no');
      btnSi.textContent = textoSi;
      btnNo.textContent = textoNo;
      overlay.classList.add('active');

      const cerrar = (valor) => {
        overlay.classList.remove('active');
        btnSi.onclick = null;
        btnNo.onclick = null;
        resolve(valor);
      };
      btnSi.onclick = () => cerrar(true);
      btnNo.onclick = () => cerrar(false);
    });
  }

  // ===== TARJETAS DE MÉTRICAS (.kpi-trend) =====
  // Pinta el badge de tendencia (flechita + %) de una tarjeta tipo
  // hospital/metricas.html a partir de un valor real y su valor del
  // período anterior — nunca inventa el número: si no hay valor anterior
  // (y permitirNulo es true) deja el badge vacío en vez de mostrar algo
  // falso. Compartido entre hospital/dashboard.html, metricas.html,
  // pacientes.html, profesionales.html y documentacion.html (agregado
  // 2026-10-14 para no repetir la misma lógica en cada página).
  function pintarTrend(elId, actual, anterior, { permitirNulo = false, sufijo = '%' } = {}) {
    const el = document.getElementById(elId);
    if (!el) return;
    if (permitirNulo && (anterior == null)) {
      el.innerHTML = '<span>—</span>';
      el.className = 'kpi-trend flat';
      return;
    }
    if (!anterior) {
      const hayAlgo = actual > 0;
      el.innerHTML = hayAlgo ? '<i class="ti ti-arrow-up" style="font-size:10px;"></i>nuevo' : '<span>—</span>';
      el.className = 'kpi-trend ' + (hayAlgo ? 'up' : 'flat');
      return;
    }
    const delta = sufijo === '%'
      ? Math.round(((actual - anterior) / anterior) * 100)
      : actual - anterior;
    if (delta === 0) {
      el.innerHTML = '<span>—</span>';
      el.className = 'kpi-trend flat';
      return;
    }
    const sube = delta > 0;
    el.innerHTML = `<i class="ti ti-arrow-${sube ? 'up' : 'down'}" style="font-size:10px;"></i>${sube ? '+' : ''}${delta}${sufijo === '%' ? '%' : ''}`;
    el.className = 'kpi-trend ' + (sube ? 'up' : 'down');
  }

  // Variante de pintarTrend() para tarjetas que no tienen un "período
  // anterior" real con el que compararse (ej. los filtros por estado de
  // turnos/campañas) — en vez de una tendencia inventada, muestra qué
  // porción real representan del total, con el mismo look de badge de
  // color. `tono` es 'up'/'down' (usa los colores ya definidos en
  // .kpi-trend); para un color propio (ej. para que el badge combine con
  // el ícono de esa tarjeta) pasar { bg, color } en su lugar.
  function pintarPorcentaje(elId, n, total, tono = 'up') {
    const el = document.getElementById(elId);
    if (!el) return;
    const pct = total ? Math.round((n / total) * 100) : 0;
    el.textContent = `${pct}%`;
    if (typeof tono === 'object' && tono.bg) {
      el.className = 'kpi-trend';
      el.style.background = tono.bg;
      el.style.color = tono.color || '#5a1e37';
    } else {
      el.className = 'kpi-trend ' + tono;
      el.style.background = '';
      el.style.color = '';
    }
  }

  // ===== FILTROS =====
  function initFiltros(attr = 'data-estado') {
    document.querySelectorAll('.filtro-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.filtro-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const val = chip.dataset.filtro;
        document.querySelectorAll(`[${attr}]`).forEach(el => {
          el.style.display = val === 'todos' || el.getAttribute(attr) === val ? '' : 'none';
        });
      });
    });
  }

  // ===== TABS =====
  function initTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const grupo = tab.dataset.grupo || 'default';
        document.querySelectorAll(`.tab[data-grupo="${grupo}"]`).forEach(t => t.classList.remove('active'));
        document.querySelectorAll(`.tab-content[data-grupo="${grupo}"]`).forEach(c => c.style.display = 'none');
        tab.classList.add('active');
        const target = document.getElementById(tab.dataset.tab);
        if (target) target.style.display = 'block';
      });
    });
  }

  // ===== SIGNATURE PAD =====
  function initFirma(canvasId, statusId) {
    const cv = document.getElementById(canvasId);
    if (!cv || !window.SignaturePad) return null;
    const r = Math.max(window.devicePixelRatio || 1, 1);
    cv.width = cv.offsetWidth * r;
    cv.getContext('2d').scale(r, r);
    const pad = new SignaturePad(cv, { penColor: '#1a0a0f', minWidth: 1.2, maxWidth: 3 });
    pad.addEventListener('endStroke', () => actualizarStatusFirma(pad, statusId));
    return pad;
  }

  function actualizarStatusFirma(pad, statusId) {
    const el = document.getElementById(statusId);
    if (!el) return;
    const vacio = pad.isEmpty();
    el.textContent = vacio ? 'Sin firmar' : '✓ Firmado';
    el.className = 'sig-badge ' + (vacio ? 'vacio' : 'firmado');
  }

  function limpiarFirma(pad, statusId) {
    if (pad) { pad.clear(); actualizarStatusFirma(pad, statusId); }
  }

  // ===== SELECT PERSONALIZADO =====
  // Ver el bloque de comentarios en estilos/global.css (".hr-select-*"):
  // ningún navegador deja estilizar con CSS el color de resaltado de las
  // opciones del popup nativo de un <select> (lo dibuja el sistema
  // operativo), así que se reemplaza visualmente por un botón + lista
  // propia. El <select> real queda oculto pero existe igual, con su mismo
  // id, como fuente de verdad — todo el código de cada pantalla que ya lee
  // o escribe `.value` sigue funcionando sin ningún cambio.
  let panelAbierto = null; // { trigger, panel, select } del popup abierto, si hay uno

  function mejorarSelects(root = document) {
    root.querySelectorAll('select').forEach(mejorarSelect);
  }

  function mejorarSelect(select) {
    if (select.dataset.hrEnhanced) return;
    select.dataset.hrEnhanced = '1';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = (select.className + ' hr-select-trigger').trim();
    // Algunos selects del sitio están armados con un `style="..."` inline
    // en vez de una clase (ej. hospital/turnos.html, admin/metricas.html)
    // — se copia también, así el botón queda con el mismo aspecto sin
    // duplicar esos estilos acá.
    if (select.getAttribute('style')) trigger.setAttribute('style', select.getAttribute('style'));
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.innerHTML = '<span class="hr-select-label"></span><i class="ti ti-chevron-down hr-select-chevron" aria-hidden="true"></i>';
    const label = trigger.querySelector('.hr-select-label');

    select.classList.add('hr-select-native');
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');
    select.insertAdjacentElement('afterend', trigger);

    function sync() {
      const opt = select.options[select.selectedIndex];
      label.textContent = opt ? opt.text : '';
      trigger.classList.toggle('hr-select-disabled', select.disabled);
      trigger.disabled = select.disabled;
    }

    // El resto de la app precarga selects todo el tiempo con asignaciones
    // directas (`elemento.value = x`, ej. al restaurar un perfil guardado)
    // — eso no dispara ningún evento nativo, así que sin interceptarlo acá
    // el botón se quedaría mostrando el texto viejo hasta el próximo click.
    ['value', 'selectedIndex', 'disabled'].forEach(prop => {
      const nativo = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, prop);
      if (!nativo) return;
      Object.defineProperty(select, prop, {
        configurable: true,
        get() { return nativo.get.call(select); },
        set(v) { nativo.set.call(select, v); sync(); },
      });
    });

    trigger.addEventListener('click', () => {
      if (panelAbierto && panelAbierto.trigger === trigger) cerrarPanelAbierto();
      else abrirPanel(select, trigger, label);
    });
    trigger.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        abrirPanel(select, trigger, label);
      }
    });

    sync();
  }

  function cerrarPanelAbierto() {
    if (!panelAbierto) return;
    panelAbierto.panel.remove();
    panelAbierto.trigger.classList.remove('hr-select-open');
    panelAbierto.trigger.setAttribute('aria-expanded', 'false');
    panelAbierto = null;
  }

  function marcarActiva(panel, item) {
    panel.querySelectorAll('.hr-select-highlight').forEach(el => el.classList.remove('hr-select-highlight'));
    if (item) item.classList.add('hr-select-highlight');
  }

  function posicionarPanel(trigger, panel) {
    const r = trigger.getBoundingClientRect();
    // El panel usa el mismo ancho que el botón (no más angosto: se vería
    // desalineado; no más ancho: un panel mucho más grande que un botón
    // chico como "Provincia" se veía mal, reportado por la usuaria). El
    // texto largo (ej. "Santiago del Estero") pasa a la línea siguiente en
    // vez de forzar más ancho (ver white-space en .hr-select-option).
    panel.style.width = r.width + 'px';
    panel.style.left = r.left + 'px';
    panel.style.top = (r.bottom + 4) + 'px';
    // Si no entra hacia abajo (ej. select cerca del pie de página), se abre hacia arriba.
    if (r.bottom + panel.offsetHeight + 8 > window.innerHeight) {
      panel.style.top = Math.max(4, r.top - panel.offsetHeight - 4) + 'px';
    }
    // Si crecer a la derecha se sale de la pantalla, se corrige el left
    // para que quede pegado al borde en vez de generar scroll horizontal.
    const excedente = r.left + panel.offsetWidth - window.innerWidth;
    if (excedente > 0) {
      panel.style.left = Math.max(4, r.left - excedente) + 'px';
    }
  }

  function abrirPanel(select, trigger, label) {
    if (select.disabled) return;
    cerrarPanelAbierto();

    const panel = document.createElement('div');
    panel.className = 'hr-select-panel';
    panel.setAttribute('role', 'listbox');
    const estilo = getComputedStyle(trigger);
    panel.style.fontFamily = estilo.fontFamily;
    panel.style.fontSize = estilo.fontSize;

    Array.from(select.options).forEach((opt, i) => {
      const item = document.createElement('div');
      item.className = 'hr-select-option';
      item.textContent = opt.text;
      item.setAttribute('role', 'option');
      if (i === select.selectedIndex) item.setAttribute('aria-selected', 'true');
      item.addEventListener('mouseenter', () => marcarActiva(panel, item));
      item.addEventListener('click', () => {
        select.selectedIndex = i; // pasa por el setter interceptado: sincroniza el botón
        select.dispatchEvent(new Event('change', { bubbles: true }));
        cerrarPanelAbierto();
        trigger.focus();
      });
      panel.appendChild(item);
    });

    document.body.appendChild(panel);
    posicionarPanel(trigger, panel);
    trigger.classList.add('hr-select-open');
    trigger.setAttribute('aria-expanded', 'true');
    panelAbierto = { trigger, panel, select };
    marcarActiva(panel, panel.querySelector('[aria-selected="true"]') || panel.firstElementChild);
  }

  document.addEventListener('keydown', e => {
    if (!panelAbierto) return;
    const { panel, trigger } = panelAbierto;
    const items = Array.from(panel.children);
    const activaIdx = items.findIndex(i => i.classList.contains('hr-select-highlight'));
    if (e.key === 'Escape') { cerrarPanelAbierto(); trigger.focus(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); marcarActiva(panel, items[Math.min(items.length - 1, activaIdx + 1)]); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); marcarActiva(panel, items[Math.max(0, activaIdx - 1)]); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (activaIdx >= 0) items[activaIdx].click(); }
  });
  document.addEventListener('click', e => {
    if (!panelAbierto) return;
    // e.target puede ser el <span>/<i> de adentro del botón, no el <button>
    // en sí — hay que revisar con .contains(), no comparar por igualdad,
    // si no el mismo click que abre el panel lo vuelve a cerrar al burbujear.
    if (panelAbierto.trigger.contains(e.target) || panelAbierto.panel.contains(e.target)) return;
    cerrarPanelAbierto();
  });
  // Cierra el panel si se scrollea la página de atrás (para que no quede
  // "flotando" en un lugar que ya no corresponde a su botón) — pero NO si
  // el scroll es DENTRO del propio panel (ej. bajando por la lista de
  // provincias, que no entra completa en los 260px de alto): sin este
  // chequeo, el listener de scroll en fase de captura también agarraba
  // ese scroll interno y cerraba la lista apenas se la intentaba recorrer
  // (bug real, encontrado al revisar el reporte de scroll de la usuaria).
  window.addEventListener('scroll', e => {
    if (panelAbierto && panelAbierto.panel.contains(e.target)) return;
    cerrarPanelAbierto();
  }, true);
  window.addEventListener('resize', () => cerrarPanelAbierto());

  // ===== MOSTRAR/OCULTAR CONTRASEÑA =====
  // Mismo criterio que mejorarSelects(): se agrega automáticamente a
  // cualquier <input type="password"> del sitio, sin tener que tocar cada
  // formulario a mano (login, registro, recuperar contraseña, seguridad
  // de la cuenta). Un input puede optar afuera con `data-sin-toggle`
  // (ej. el CVV de publico/pago.html — se ve igual que una contraseña
  // pero no tiene sentido "revelarlo").
  function mejorarPasswords(root = document) {
    root.querySelectorAll('input[type="password"]').forEach(mejorarPassword);
  }

  function mejorarPassword(input) {
    if (input.dataset.hrEnhanced || input.dataset.sinToggle) return;
    input.dataset.hrEnhanced = '1';

    const wrap = document.createElement('div');
    wrap.className = 'hr-pass-wrap';
    input.insertAdjacentElement('beforebegin', wrap);
    wrap.appendChild(input);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hr-pass-toggle';
    btn.setAttribute('aria-label', 'Mostrar contraseña');
    btn.innerHTML = '<i class="ti ti-eye" aria-hidden="true"></i>';
    wrap.appendChild(btn);

    btn.addEventListener('click', () => {
      const mostrar = input.type === 'password';
      input.type = mostrar ? 'text' : 'password';
      btn.innerHTML = `<i class="ti ti-${mostrar ? 'eye-off' : 'eye'}" aria-hidden="true"></i>`;
      btn.setAttribute('aria-label', mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña');
    });
  }

  // ===== INIT GENERAL =====
  function init() {
    initSidebar();
    initScrollSidebar();
    initFiltros();
    initTabs();
    mejorarSelects();
    mejorarPasswords();
    HemoRed.sesion?.inyectarPerfil();
  }

  return { init, initSidebar, initScrollSidebar, montarSidebarHospital, montarSidebarProfesional, montarSidebarDonante, montarSidebarAdmin, abrirModal, cerrarModal, cerrarTodosModales, toast, confirmar, pintarTrend, pintarPorcentaje, initFiltros, initTabs, initFirma, limpiarFirma, mejorarSelects, mejorarPasswords };
})();

// Auto-init on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => HemoRed.ui.init());
