/**
 * Test E2E de "Notificaciones" del donante — pasó de ser 100% estática (6
 * tarjetas fijas en el HTML, "Marcar todas como leídas" sin `onclick`) a
 * leer datos reales de la tabla nueva `notificaciones_donante`.
 *
 * Contexto importante:
 * - Se convirtieron los 6 ejemplos estáticos originales en datos semilla
 *   reales (`frontend/db/notificaciones_donante.json`), agrupados por
 *   'hoy'/'ayer'/'semana' contra la misma fecha fija de demo (`AHORA_DEMO`)
 *   que usa el resto del sitio — no contra la fecha real del navegador.
 * - Es también el destino de la notificación que genera
 *   `resolverSolicitudCorreccion()` al rechazar una solicitud de corrección
 *   (ver `solicitudes-correccion.spec.js` para ese caso específico) — este
 *   archivo prueba la pantalla en sí, con los datos semilla.
 */

const { test, expect } = require('@playwright/test');

test.describe('Notificaciones (donante)', () => {

  test('carga datos reales, filtra por tipo y marca como leídas', async ({ page }) => {
    await test.step('loguearse y entrar a Notificaciones', async () => {
      await page.goto('/publico/login.html');
      await page.fill('#email', 'donante@hemored.com');
      await page.fill('#password', 'donante123');
      await page.click('button:has-text("Iniciar sesión")');
      await page.goto('/donante/notificaciones.html');
    });

    await test.step('se ven los 6 ejemplos reales, agrupados en Hoy/Ayer/Esta semana', async () => {
      await expect(page.locator('.notif-item')).toHaveCount(6);
      await expect(page.locator('.notif-group', { hasText: 'Hoy' })).toContainText('Tu certificado está listo');
      await expect(page.locator('.notif-group', { hasText: 'Ayer' })).toContainText('Recordatorio de turno');
      await expect(page.locator('.notif-group', { hasText: 'Esta semana' })).toContainText('¡Gracias por tu donación!');
      // 3 de los 6 datos semilla arrancan sin leer
      await expect(page.locator('.notif-item.unread')).toHaveCount(3);
    });

    await test.step('el filtro "Documentos" muestra solo esas notificaciones', async () => {
      await page.click('.filtro-chip:has-text("Documentos")');
      await expect(page.locator('.notif-item:visible')).toHaveCount(2);
      await page.click('.filtro-chip:has-text("Todas")');
    });

    await test.step('el filtro "No leídas" muestra solo las 3 sin leer', async () => {
      await page.click('.filtro-chip:has-text("No leídas")');
      await expect(page.locator('.notif-item:visible')).toHaveCount(3);
    });

    await test.step('clickear una notificación la marca como leída (persiste tras recargar)', async () => {
      await page.click('.filtro-chip:has-text("Todas")');
      const item = page.locator('.notif-item', { hasText: 'Turno confirmado' });
      await expect(item).toHaveClass(/unread/);
      await item.click();
      await expect(item).not.toHaveClass(/unread/);
      await page.reload();
      await expect(page.locator('.notif-item', { hasText: 'Turno confirmado' })).not.toHaveClass(/unread/);
    });

    await test.step('"Marcar todas como leídas" deja todo sin marca', async () => {
      await page.click('button:has-text("Marcar todas como leídas")');
      await expect(page.locator('.toast')).toContainText('Todas marcadas como leídas');
      await expect(page.locator('.notif-item.unread')).toHaveCount(0);
      await page.reload();
      await expect(page.locator('.notif-item.unread')).toHaveCount(0);
    });
  });

});
