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
      await expect(page.locator('#modal-turno-dia')).toHaveText('23');
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

});
