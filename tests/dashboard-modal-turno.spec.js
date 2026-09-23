/**
 * Test E2E del modal "Detalle del turno" en `donante/dashboard.html`
 * (el que se abre con "Ver detalles" desde el banner de "Próximo turno"),
 * agregado 2026-09-16.
 *
 * Contexto: hasta esta fecha, el modal era 100% HTML fijo — mostraba
 * siempre "Hospital Ramos Mejía", "20 may", "Campaña urgente 0−",
 * "#TRN-20240520-0042", etc., sin ninguna relación con el turno real del
 * donante logueado (coincidía por casualidad con la cuenta demo, por eso
 * no se había notado). Sus 3 botones tampoco pasaban ningún id por la URL:
 * "Modificar turno" mandaba a `mis_turnos.html` a secas, obligando a
 * volver a encontrar el turno en la lista y clickear "Modificar" de
 * nuevo — la usuaria lo notó y pidió arreglarlo.
 *
 * Se aprovechó el mismo cambio para conectar el resto del modal a datos
 * reales, no solo los 2 botones que se pidieron.
 */

const { test, expect } = require('@playwright/test');

test.describe('Modal "Detalle del turno" (dashboard)', () => {

  test('muestra el turno real del donante y sus botones llevan al lugar correcto', async ({ page }) => {
    await page.goto('/publico/login.html');
    await page.fill('#email', 'donante@hemored.com');
    await page.fill('#password', 'donante123');
    await page.click('.form-btn');
    await page.waitForURL('**/donante/dashboard.html');

    await test.step('el modal muestra los datos reales del próximo turno confirmado, no el mockup fijo de antes', async () => {
      await page.click('.pt-btn'); // "Ver detalles"
      await expect(page.locator('#modal-turno')).toBeVisible();
      await expect(page.locator('#modal-turno-hospital')).toHaveText('Hospital Ramos Mejía');
      await expect(page.locator('#modal-turno-dia')).toHaveText('30'); // turno id 5, fecha 2026-11-30 (ver frontend/db/turnos.json)
      await expect(page.locator('#modal-turno-fechahora')).toContainText('09:30hs');
      await expect(page.locator('#modal-turno-estado')).toHaveText('Confirmado');
      await expect(page.locator('#modal-turno-campana')).toHaveText('Banco de sangre general — Ramos Mejía');
      await expect(page.locator('#modal-turno-sangre')).toHaveText('Cualquier tipo'); // esta campaña no pide un tipo puntual
      await expect(page.locator('#modal-turno-numero')).toHaveText('#TRN-5');
      // Ninguno de los 2 formularios está completo en el dato semilla de este turno.
      await expect(page.locator('#modal-turno-formularios')).toContainText('Autoexclusión pendiente');
      await expect(page.locator('#modal-turno-formularios')).toContainText('Cuestionario pendiente');
      await expect(page.locator('#modal-turno-btn-cuestionario')).toBeVisible();
    });

    await test.step('"Modificar turno" abre directo el modal de modificación del turno correcto (antes solo mandaba a la lista)', async () => {
      await page.click('#modal-turno-btn-modificar');
      await page.waitForURL('**/mis_turnos.html?turno_id=5**');
      await expect(page.locator('#modal-modificar')).toBeVisible();
      await expect(page.locator('#modal-turno-hospital')).toHaveText('Hospital Ramos Mejía');
    });

    await test.step('"Ver campaña" lleva a la campaña real del turno (antes no pasaba ningún id)', async () => {
      await page.goto('/donante/dashboard.html');
      await page.click('.pt-btn');
      await page.click('#modal-turno-btn-campana');
      await page.waitForURL('**/campana_detalle.html?id=2**');
      await expect(page.locator('#d-hospital-nombre')).toHaveText('Hospital Ramos Mejía');
    });
  });

  // Agregado 2026-09-22, reportado por la usuaria: reservar un turno nuevo en
  // una campaña sin confirmación automática (nace `pendiente`, ver
  // "Confirmación automática y cupo por turno" en docs/04) no lo mostraba acá
  // — el banner y el contador "Turno próximo" solo miraban `confirmado`, así
  // que después de cancelar un turno y reservar uno nuevo pendiente, el
  // dashboard parecía no haber registrado nada.
  test('un turno recién reservado en estado "pendiente" también aparece en el banner y en el contador', async ({ page }) => {
    await page.goto('/publico/registro.html');
    await page.click('text=Soy donante');
    await page.fill('#d-nombre', 'Marina');
    await page.fill('#d-apellido', 'Pendiente');
    await page.fill('#d-email', `donante.pendiente.${Date.now()}@example.com`);
    await page.fill('#d-tel', '11-2222-3333');
    await page.fill('#d-pass', 'password123');
    await page.fill('#d-pass2', 'password123');
    await page.click('#btn-crear-cuenta-donante');
    await page.waitForURL('**/donante/dashboard.html');

    // La primera campaña de la lista ("Lucas Gómez") no tiene confirmación
    // automática — el turno nace pendiente.
    await page.locator('.campaign-btn').first().click();
    await page.waitForURL('**/campana_detalle.html**');
    await page.click('#btn-reservar');
    const tabs = page.locator('.fecha-tab');
    await tabs.first().waitFor();
    await tabs.nth(1).click();
    await page.locator('.turno-opt[data-hora]').first().click();
    await page.click('#btn-continuar');
    await page.click('#btn-confirmar-reserva');

    await page.goto('/donante/dashboard.html');
    await expect(page.locator('#proximos-turnos')).toHaveText('1');
    await expect(page.locator('#proximo-turno-banner')).toBeVisible();
    await expect(page.locator('#proximo-turno-titulo')).toHaveText('Próximo turno (pendiente de confirmación)');

    await page.click('.pt-btn');
    await expect(page.locator('#modal-turno-estado')).toHaveText('Pendiente');
  });

});
