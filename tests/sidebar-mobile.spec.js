/**
 * Test E2E del menú lateral (sidebar) en mobile/tablet, para los 4 roles
 * con sesión (Donante, Hospital, Profesional, Admin).
 *
 * Se agregó originalmente para Donante el 2026-09-23 (el sidebar fijo de
 * 240px solo colapsaba a hamburguesa por debajo de los 768px — en tablet,
 * 820px, quedaba fijo apretando el contenido, sin forma de ocultarlo). Se
 * propagó a los otros 3 roles el 2026-09-24, a pedido explícito de la
 * usuaria ("me gusta más cómo están alineados los ítems en Hospital, pero
 * le falta el scroll, el botón de cerrar y que sea responsive — después
 * propaguemos todo eso a Donante, Profesional y Admin"): mismo breakpoint
 * (1024px), mismo botón X, y de paso scroll interno del menú en los 4
 * roles (ninguno lo tenía, ni siquiera Donante — con `.sidebar { height:
 * 100vh }` en vez de `min-height`, y `.sidebar-nav { min-height:0;
 * overflow-y:auto }`, mismo patrón que `min-width:0` ya usado muchas
 * veces en este proyecto, pero en el eje vertical).
 *
 * Admin usa su propia paleta (fondo navy, texto blanco translúcido) — el
 * botón de cerrar ahí se posiciona con `position:absolute` en vez de
 * flex+space-between, porque `.sidebar-logo` ya tenía un segundo
 * contenido propio (el badge "Super Admin") que depende de wrappear en su
 * propia línea; un flex lo hubiera empujado a pisarse con el botón.
 *
 * Ver docs/04-estado-actual-prototipo.md, "Sidebar unificado (los 4
 * roles)".
 */

const { test, expect } = require('@playwright/test');

const ROLES = [
  { nombre: 'Donante',     email: 'donante@hemored.com',     password: 'donante123', dashboard: '**/donante/dashboard.html' },
  { nombre: 'Hospital',    email: 'hospital@hemored.com',    password: 'hospital123', dashboard: '**/hospital/dashboard.html' },
  { nombre: 'Profesional', email: 'profesional@hemored.com', password: 'prof123',    dashboard: '**/profesional/dashboard.html' },
  { nombre: 'Admin',       email: 'admin@hemored.com',       password: 'admin123',   dashboard: '**/admin/dashboard.html' },
];

async function login(page, rol) {
  await page.goto('/publico/login.html');
  await page.fill('#email', rol.email);
  await page.fill('#password', rol.password);
  await page.click('.form-btn');
  await page.waitForURL(rol.dashboard);
}

for (const rol of ROLES) {
  test.describe(`Sidebar de ${rol.nombre} en mobile/tablet`, () => {

    test('en desktop el sidebar está siempre visible, sin botón de menú ni de cerrar', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await login(page, rol);
      await expect(page.locator('#sidebar')).toBeVisible();
      await expect(page.locator('.mobile-topbar-btn')).toBeHidden();
      await expect(page.locator('.sidebar-close-btn')).toBeHidden();
    });

    test('en tablet (820px) el sidebar arranca colapsado y se abre/cierra con el botón de menú y la X', async ({ page }) => {
      await page.setViewportSize({ width: 820, height: 1180 });
      await login(page, rol);

      await expect(page.locator('.mobile-topbar-btn')).toBeVisible();
      await expect(page.locator('#sidebar')).not.toHaveClass(/open/);

      await page.click('.mobile-topbar-btn');
      await expect(page.locator('#sidebar')).toHaveClass(/open/);
      await expect(page.locator('.sidebar-close-btn')).toBeVisible();

      await page.click('.sidebar-close-btn');
      await expect(page.locator('#sidebar')).not.toHaveClass(/open/);
    });

    test('en mobile (375px) el overlay también cierra el menú al tocar afuera', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await login(page, rol);

      await page.click('.mobile-topbar-btn');
      await expect(page.locator('#sidebar')).toHaveClass(/open/);

      await page.click('#sidebar-overlay', { position: { x: 350, y: 10 } });
      await expect(page.locator('#sidebar')).not.toHaveClass(/open/);
    });

    test('el menú no crece más allá de la ventana: si no entra, scrollea internamente', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 420 });
      await login(page, rol);

      const info = await page.evaluate(() => {
        const nav = document.querySelector('.sidebar-nav');
        const sidebar = document.getElementById('sidebar');
        return {
          sidebarNoExcedeViewport: sidebar.getBoundingClientRect().bottom <= window.innerHeight + 1,
          navScrolleable: nav.scrollHeight > nav.clientHeight ? true : null, // null = no hacía falta scroll con este menú
        };
      });
      expect(info.sidebarNoExcedeViewport).toBe(true);

      // Si el menú de este rol es largo como para necesitar scroll, confirmar
      // que efectivamente se puede llegar al último ítem (ej. "Cerrar sesión").
      if (info.navScrolleable) {
        await page.locator('.sidebar-nav').evaluate(el => el.scrollTo(0, el.scrollHeight));
        await expect(page.locator('.sidebar-nav .nav-item').last()).toBeInViewport();
      }
    });

  });
}
