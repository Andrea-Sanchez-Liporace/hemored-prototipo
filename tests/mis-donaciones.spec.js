/**
 * Test E2E de "Mis donaciones" del rol Donante — flujo de solo lectura,
 * sin ninguna función de escritura (`cargarMisDonaciones()` en data.js).
 *
 * Qué prueba:
 * 1. Con la cuenta demo (que ya tiene una donación real en
 *    frontend/db/donaciones.json), las estadísticas y la tarjeta del
 *    historial muestran datos reales, no el contenido fijo que tenía antes
 *    esta pantalla.
 * 2. La "próxima fecha habilitada" reutiliza la misma ventana de 90 días
 *    que ya usa crearTurno() para bloquear una reserva — no es un número
 *    nuevo inventado para esta pantalla (ver cargarMisDonaciones() en
 *    frontend/js/data.js). Se prueba con un donante fresco cuya donación se
 *    crea a propósito "hace 30 días" (dentro de la ventana), no con la
 *    cuenta demo — desde que "hoy" pasó a ser la fecha real del sistema
 *    (2026-09-16, ver docs/04), la donación semilla de la cuenta demo
 *    (17/05/2026, a propósito sin tocar) ya quedó afuera de los 90 días
 *    hace rato, así que el banner correctamente ya NO se muestra para ella.
 * 3. Los filtros (año / resultado), que ya eran funcionales antes sobre
 *    contenido fijo, siguen funcionando sobre las tarjetas reales.
 * 4. Un donante sin ninguna donación ve el estado vacío correctamente
 *    (stats en "—", sin banner, sin romper nada).
 */

const { test, expect } = require('@playwright/test');

function diasDesdeHoy(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

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

    await test.step('el banner de "próxima fecha habilitada" ya no se muestra: la donación semilla (17/05/2026) quedó afuera de los 90 días hace rato', async () => {
      await expect(page.locator('#proximo-banner')).toBeHidden();
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

  test('un donante con una donación reciente (dentro de los 90 días) ve el banner con la fecha correcta', async ({ page }) => {
    await page.goto('/publico/registro.html');
    await page.click('text=Soy donante');
    await page.fill('#d-nombre', 'Reciente');
    await page.fill('#d-apellido', 'Testigo');
    await page.fill('#d-email', `donante.reciente.${Date.now()}@example.com`);
    await page.fill('#d-tel', '11-1111-1111');
    await page.fill('#d-pass', 'password123');
    await page.fill('#d-pass2', 'password123');
    await page.click('#btn-crear-cuenta-donante');
    await page.waitForURL('**/donante/dashboard.html');

    const fechaEsperada = await page.evaluate(async () => {
      await HemoRed.db.init();
      const s = HemoRed.sesion.get();
      const donante = HemoRed.db.where('usuarios', 'email', s.email)[0];
      const hace30dias = new Date(Date.now() - 30 * 86400000);
      HemoRed.db.crear('donaciones', {
        turno_id: null, campana_id: 1, usuario_id: donante.id, hospital_id: 1, profesional_id: 1,
        numero_bolsa: 'BLS-TEST-0001', volumen_ml: 450, resultado_apto: true,
        registrado_en: hace30dias.toISOString(),
      });
      // Misma cuenta que ya usa la pantalla: 90 días desde la donación.
      const habilitado = new Date(hace30dias.getTime() + 90 * 86400000);
      return habilitado.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
    });

    await page.goto('/donante/mis_donaciones.html');
    await expect(page.locator('#proximo-banner')).toBeVisible();
    await expect(page.locator('#proximo-banner-valor')).toContainText(fechaEsperada);
    await expect(page.locator('#proximo-banner-valor')).toContainText('días');
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
