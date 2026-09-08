/**
 * Test E2E de "Mis donaciones" del rol Donante — flujo de solo lectura,
 * sin ninguna función de escritura (`cargarMisDonaciones()` en data.js).
 *
 * Qué prueba:
 * 1. Con la cuenta demo (que ya tiene una donación real en
 *    frontend/db/donaciones.json), las estadísticas, el banner de "próxima
 *    fecha habilitada" y la tarjeta del historial muestran datos reales,
 *    no el contenido fijo que tenía antes esta pantalla.
 * 2. La "próxima fecha habilitada" reutiliza la misma ventana de 90 días
 *    que ya usa crearTurno() para bloquear una reserva — no es un número
 *    nuevo inventado para esta pantalla (ver cargarMisDonaciones() en
 *    frontend/js/data.js).
 * 3. Los filtros (año / resultado), que ya eran funcionales antes sobre
 *    contenido fijo, siguen funcionando sobre las tarjetas reales.
 * 4. Un donante sin ninguna donación ve el estado vacío correctamente
 *    (stats en "—", sin banner, sin romper nada).
 */

const { test, expect } = require('@playwright/test');

test.describe('Mis donaciones (donante)', () => {

  test('la cuenta demo ve su historial real, con stats y banner calculados de verdad', async ({ page }) => {
    await test.step('loguearse con la cuenta demo y entrar a Mis donaciones', async () => {
      await page.goto('/publico/login.html');
      await page.fill('#email', 'donante@hemored.com');
      await page.fill('#password', 'donante123');
      await page.click('button:has-text("Iniciar sesión")');
      await page.goto('/donante/mis_donaciones.html');
    });

    await test.step('las estadísticas reflejan la donación real (no el "3" / "1.350 ml" fijo que tenía antes)', async () => {
      await expect(page.locator('#stat-total-donaciones')).toHaveText('1');
      await expect(page.locator('#stat-total-ml')).toHaveText('450 ml');
      await expect(page.locator('#stat-ultima-donacion')).toContainText('17');
      await expect(page.locator('#stat-ultima-donacion')).toContainText('2026');
    });

    await test.step('el banner de "próxima fecha habilitada" usa la misma ventana de 90 días que crearTurno()', async () => {
      // La donación real quedó registrada el 17/05/2026 → habilitado recién
      // el 15/08/2026 (90 días después). Si este número cambia porque se
      // resuelve el pendiente de "85 vs 90 días" (ver docs/04), hay que
      // actualizar este test también.
      await expect(page.locator('#proximo-banner')).toBeVisible();
      await expect(page.locator('#proximo-banner-valor')).toContainText('15 de agosto de 2026');
      await expect(page.locator('#proximo-banner-valor')).toContainText('días');
    });

    await test.step('la tarjeta del historial muestra el hospital, tipo de sangre y número de bolsa reales', async () => {
      const card = page.locator('#lista-donaciones .turno-card').first();
      await expect(card).toContainText('Hospital Ramos Mejía');
      await expect(card).toContainText('450 ml');
      await expect(card).toContainText('#BLS-2026-0834');
      await expect(card.locator('.turno-badge')).toHaveText('Apto');
    });

    await test.step('el filtro por año sigue funcionando sobre las tarjetas reales', async () => {
      await page.selectOption('#f-anio', '2024'); // no hay donaciones ese año
      await expect(page.locator('#sin-resultados')).toBeVisible();
      await expect(page.locator('#lista-donaciones .turno-card:visible')).toHaveCount(0);

      await page.selectOption('#f-anio', '');
      await expect(page.locator('#sin-resultados')).toBeHidden();
      await expect(page.locator('#lista-donaciones .turno-card:visible')).toHaveCount(1);
    });
  });

  test('un donante sin donaciones ve el estado vacío, sin romper nada', async ({ page }) => {
    const timestamp = Date.now();
    const email = `donante.sindonaciones.${timestamp}@example.com`;

    await test.step('registrar un donante nuevo (sin ninguna donación todavía)', async () => {
      await page.goto('/publico/registro.html');
      await page.click('text=Soy donante');
      await page.fill('#d-nombre', 'Sin');
      await page.fill('#d-apellido', 'Donaciones');
      await page.fill('#d-email', email);
      await page.fill('#d-tel', '11-0000-0000');
      await page.fill('#d-pass', 'password123');
      await page.fill('#d-pass2', 'password123');
      await page.click('#btn-crear-cuenta-donante');
      await page.waitForURL('**/donante/dashboard.html');
    });

    await test.step('Mis donaciones muestra el estado vacío, no un error ni datos de otro donante', async () => {
      await page.goto('/donante/mis_donaciones.html');
      await expect(page.locator('#stat-total-donaciones')).toHaveText('0');
      await expect(page.locator('#stat-total-ml')).toHaveText('—');
      await expect(page.locator('#stat-ultima-donacion')).toHaveText('—');
      await expect(page.locator('#proximo-banner')).toBeHidden();
      await expect(page.locator('#sin-resultados')).toBeVisible();
      await expect(page.locator('#lista-donaciones .turno-card')).toHaveCount(0);
    });
  });

});
