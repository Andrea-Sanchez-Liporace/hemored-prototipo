/**
 * Test E2E del menú lateral (sidebar) de Donante en pantallas chicas,
 * agregado 2026-09-23 a raíz de una auditoría de responsive pedida por la
 * usuaria ("todo el sitio de donante, no es responsive?").
 *
 * Hasta ahora el sidebar fijo (240px) solo colapsaba a menú hamburguesa
 * por debajo de los 768px — en tablet (820px, una de las 3 resoluciones
 * de referencia del proyecto) se mostraba completo y fijo, apretando el
 * contenido contra un sidebar que no se podía ocultar. El breakpoint de
 * colapso pasó a 1024px (confirmado con la usuaria), y de paso se agregó
 * un botón X para cerrar el menú (antes solo se podía cerrar tocando
 * afuera, sin ningún control visible).
 *
 * Ver docs/04-estado-actual-prototipo.md, "Auditoría de responsive — rol
 * Donante".
 */

const { test, expect } = require('@playwright/test');

async function login(page) {
  await page.goto('/publico/login.html');
  await page.fill('#email', 'donante@hemored.com');
  await page.fill('#password', 'donante123');
  await page.click('.form-btn');
  await page.waitForURL('**/donante/dashboard.html');
}

test.describe('Sidebar de Donante en mobile/tablet', () => {

  test('en desktop el sidebar está siempre visible, sin botón de menú ni de cerrar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await login(page);
    await expect(page.locator('#sidebar')).toBeVisible();
    await expect(page.locator('.mobile-topbar-btn')).toBeHidden();
    await expect(page.locator('.sidebar-close-btn')).toBeHidden();
  });

  test('en tablet (820px) el sidebar arranca colapsado y se abre/cierra con el botón de menú y la X', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await login(page);

    // Colapsado por default: fuera de pantalla (no hace falta que Playwright
    // lo considere "hidden", solo que no ocupe el viewport visible).
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
    await login(page);

    await page.click('.mobile-topbar-btn');
    await expect(page.locator('#sidebar')).toHaveClass(/open/);

    await page.click('#sidebar-overlay', { position: { x: 350, y: 10 } });
    await expect(page.locator('#sidebar')).not.toHaveClass(/open/);
  });
});
