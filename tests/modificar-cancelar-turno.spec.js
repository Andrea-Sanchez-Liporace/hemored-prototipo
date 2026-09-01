/**
 * Test E2E del segundo bloque del rol Donante: modificar y cancelar un
 * turno ya reservado, incluyendo el caso en que la ventana de tiempo
 * (24hs para modificar, 2hs para cancelar) ya se venció.
 *
 * Ver docs/04-estado-actual-prototipo.md ("Próximos pasos — Donante",
 * paso 1) y docs/03-documentacion-tecnica-consolidada.md (sección
 * "Mis turnos") para las reglas de negocio que este test verifica.
 *
 * Nota sobre fechas: el dataset de demo y las validaciones de
 * actualizarTurno()/cancelarTurno() (frontend/js/data.js) usan una
 * fecha/hora de referencia fija ("AHORA_DEMO" = 2026-05-17 09:00),
 * no la hora real del sistema — por eso este test elige a propósito
 * turnos lejanos (>24hs) o cercanos (<2hs) respecto de esa referencia,
 * no respecto de "hoy" en el calendario real.
 */

const { test, expect } = require('@playwright/test');

const timestamp = Date.now();
const donanteEmail = `donante.mod.${timestamp}@example.com`;
const donantePassword = 'password123';

// Registra un donante nuevo y reserva un turno para la pestaña de fecha
// que se le indique (0 = hoy, 1 = mañana, etc.) en el primer horario libre.
// Devuelve el número de turno (#TRN-<id>) para poder ubicarlo después.
async function registrarYReservar(page, indiceFecha) {
  await page.goto('/publico/registro.html');
  await page.click('text=Soy donante');
  await page.fill('#d-nombre', 'Marina');
  await page.fill('#d-apellido', 'Testigo');
  await page.fill('#d-email', donanteEmail);
  await page.fill('#d-tel', '11-5555-4444');
  await page.fill('#d-pass', donantePassword);
  await page.fill('#d-pass2', donantePassword);
  await page.click('#btn-crear-cuenta-donante');
  await page.waitForURL('**/donante/dashboard.html');

  await page.locator('.campaign-btn').first().click();
  await page.waitForURL('**/campana_detalle.html**');
  await page.click('#btn-reservar');

  const tabs = page.locator('.fecha-tab');
  await tabs.first().waitFor();
  await tabs.nth(indiceFecha).click();

  const slotLibre = page.locator('.turno-opt[data-hora]').first();
  await slotLibre.waitFor();
  await slotLibre.click();
  await page.click('#btn-continuar');
  await page.click('#btn-confirmar-reserva');
  await expect(page.locator('#paso-4')).toHaveClass(/active/);
  const numero = await page.locator('#exito-numero').textContent();
  return numero.replace('#', '');
}

test.describe('Modificar y cancelar turno', () => {

  test('un turno reservado con más de 24hs de anticipación se puede modificar y luego cancelar', async ({ page }) => {
    let numeroTurno;

    await test.step('registrar donante y reservar un turno lejano (pestaña de fecha #3, ~2 días de anticipación)', async () => {
      numeroTurno = await registrarYReservar(page, 3);
    });

    await test.step('abrir "Modificar" desde Mis turnos', async () => {
      await page.goto('/donante/mis_turnos.html');
      const card = page.locator('.turno-card', { hasText: `${numeroTurno}` });
      await expect(card).toBeVisible();
      await card.locator('button:has-text("Modificar")').click();
      await expect(page.locator('#modal-modificar')).toBeVisible();
    });

    await test.step('elegir una fecha/horario distinto y confirmar el cambio', async () => {
      // El modal ya abre con la pestaña de fecha más lejana disponible por
      // default (índice 0 = HOY); elegimos la última pestaña para asegurar
      // que seguimos respetando la ventana de 24hs incluso reprogramando.
      const tabs = page.locator('.fecha-tab-m');
      await tabs.first().waitFor();
      await tabs.last().click();

      const slotLibre = page.locator('.turno-m[data-hora]').first();
      await slotLibre.waitFor();
      await slotLibre.click();

      await page.click('#btn-confirmar-cambio');

      // Si la validación de negocio bloqueó el cambio, fallar con un mensaje
      // claro en vez de un timeout genérico.
      const huboError = await page.locator('#modal-error').isVisible().catch(() => false);
      if (huboError) {
        const msg = await page.locator('#modal-error').textContent();
        throw new Error(`El cambio de turno fue rechazado: "${msg}"`);
      }

      await expect(page.locator('#modal-modificar')).toBeHidden();
    });

    await test.step('cancelar el mismo turno', async () => {
      const card = page.locator('.turno-card', { hasText: `${numeroTurno}` });
      await card.locator('button:has-text("Modificar")').click();
      await page.click('text=Cancelar este turno');
      await expect(page.locator('#modal-cancelar')).toBeVisible();
      await page.click('text=Sí, cancelar turno');

      const huboError = await page.locator('#modal-cancelar-error').isVisible().catch(() => false);
      if (huboError) {
        const msg = await page.locator('#modal-cancelar-error').textContent();
        throw new Error(`La cancelación fue rechazada: "${msg}"`);
      }
    });

    await test.step('el turno aparece en la pestaña "Cancelados"', async () => {
      await page.click('text=Cancelados');
      const card = page.locator('#lista-cancelados .turno-card', { hasText: `${numeroTurno}` });
      await expect(card).toBeVisible();
      await expect(card.locator('.turno-badge')).toHaveText('Cancelado');
    });
  });

  test('un turno para "hoy" (ya pasada la ventana) no se puede modificar ni cancelar', async ({ page }) => {
    let numeroTurno;

    await test.step('registrar donante y reservar un turno para hoy, primer horario del día', async () => {
      // Índice 0 = HOY. AHORA_DEMO está fijado a las 09:00 (ver data.js);
      // el primer horario libre de la grilla (08:00 en adelante) puede caer
      // antes o muy cerca de esa referencia, así que la ventana de 2h/24h
      // ya está vencida para este turno.
      numeroTurno = await registrarYReservar(page, 0);
    });

    await test.step('intentar cancelar: debe rechazarse con el motivo de negocio', async () => {
      await page.goto('/donante/mis_turnos.html');
      const card = page.locator('.turno-card', { hasText: `${numeroTurno}` });
      await card.locator('button:has-text("Modificar")').click();
      await page.click('text=Cancelar este turno');
      await page.click('text=Sí, cancelar turno');

      await expect(page.locator('#modal-cancelar-error')).toBeVisible();
      await expect(page.locator('#modal-cancelar-error')).toContainText('2hs');
      await expect(page.locator('#modal-cancelar-error')).toContainText('Contactá al hospital');
    });
  });

});
