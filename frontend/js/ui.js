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

  // ===== INIT GENERAL =====
  function init() {
    initSidebar();
    initFiltros();
    initTabs();
    HemoRed.sesion?.inyectarPerfil();
  }

  return { init, initSidebar, abrirModal, cerrarModal, cerrarTodosModales, toast, initFiltros, initTabs, initFirma, limpiarFirma };
})();

// Auto-init on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => HemoRed.ui.init());
