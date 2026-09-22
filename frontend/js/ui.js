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
    initFiltros();
    initTabs();
    mejorarSelects();
    mejorarPasswords();
    HemoRed.sesion?.inyectarPerfil();
  }

  return { init, initSidebar, abrirModal, cerrarModal, cerrarTodosModales, toast, initFiltros, initTabs, initFirma, limpiarFirma, mejorarSelects, mejorarPasswords };
})();

// Auto-init on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => HemoRed.ui.init());
