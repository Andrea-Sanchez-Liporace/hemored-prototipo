/**
 * Test E2E del segundo bloque del rol Donante: modificar y cancelar un
 * turno ya reservado, incluyendo el caso en que la ventana de tiempo
 * (24hs para modificar, 2hs para cancelar) ya se venció.
 *
 * Ver docs/04-estado-actual-prototipo.md ("Próximos pasos — Donante",
 * paso 1) y docs/03-documentacion-tecnica-consolidada.md (sección
 * "Mis turnos") para las reglas de negocio que este test verifica.
 *
 * Nota sobre fechas (actualizada 2026-09-16): `actualizarTurno()`/
 * `cancelarTurno()` (frontend/js/data.js) validan las ventanas de 24hs/2hs
 * contra la hora real del sistema (antes usaban una constante fija,
 * `AHORA_DEMO` = 2026-05-17 09:00 — se sacó, ver el mismo cambio en
 * docs/04). El primer caso de este archivo elige a propósito un turno
 * lejano (>24hs desde HOY real) vía la pestaña de fecha #3 del calendario.
 * El segundo caso (turno de HOY, ya vencido) no depende de ninguna pestaña
 * de la UI — arma el turno directo contra la fecha/hora real menos un
 * rato, para no depender de en qué momento del día corra el test (a la
 * mañana, el primer horario de "hoy" de la grilla todavía podría estar a
 * más de 2hs de distancia).
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

    await test.step('el banner de "próximo turno" está visible antes de cancelar (es el único turno del donante)', async () => {
      await expect(page.locator('#proximo-banner')).toBeVisible();
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

    await test.step('el banner de "próximo turno" desaparece al no quedar ningún turno próximo (bug real, encontrado y corregido 2026-09-22)', async () => {
      await expect(page.locator('#proximo-banner')).toBeHidden();
    });
  });

  test('un turno para "hoy" (ya pasada la ventana) no se puede modificar ni cancelar', async ({ page }) => {
    await page.goto('/publico/registro.html');
    await page.click('text=Soy donante');
    await page.fill('#d-nombre', 'Marina');
    await page.fill('#d-apellido', 'Testigo');
    await page.fill('#d-email', `donante.mod.vencido.${Date.now()}@example.com`);
    await page.fill('#d-tel', '11-5555-4444');
    await page.fill('#d-pass', donantePassword);
    await page.fill('#d-pass2', donantePassword);
    await page.click('#btn-crear-cuenta-donante');
    await page.waitForURL('**/donante/dashboard.html');

    await test.step('crear directo un turno confirmado para hace 1 hora (ya vencido)', async () => {
      // Se arma directo contra la fecha/hora real menos 1 hora, en vez de
      // elegir "hoy" en la grilla de la UI — así el test no depende de en
      // qué momento del día real corra (a la mañana temprano, el primer
      // horario de la grilla de "hoy" todavía podría estar a más de 2hs).
      await page.evaluate(async () => {
        await HemoRed.db.init();
        const s = HemoRed.sesion.get();
        const donante = HemoRed.db.where('usuarios', 'email', s.email)[0];
        const haceUnaHora = new Date(Date.now() - 3600000);
        // fecha/hora en hora LOCAL, no UTC (toISOString() da la fecha en
        // UTC) — horasHastaElTurno() en data.js arma `new Date(fecha+'T'+hora)`
        // sin sufijo de zona horaria, que el navegador interpreta como hora
        // LOCAL. Mezclar una fecha en UTC con una hora local podía referirse
        // a un momento distinto al real "hace 1 hora" (bug real, encontrado
        // al correr este test).
        const pad = (n) => String(n).padStart(2, '0');
        const fechaLocal = `${haceUnaHora.getFullYear()}-${pad(haceUnaHora.getMonth() + 1)}-${pad(haceUnaHora.getDate())}`;
        const horaLocal = `${pad(haceUnaHora.getHours())}:${pad(haceUnaHora.getMinutes())}`;
        HemoRed.db.crear('turnos', {
          campana_id: 1, usuario_id: donante.id, hospital_id: 1,
          fecha: fechaLocal,
          hora: horaLocal,
          estado: 'confirmado',
          formulario_autoexclusion_completado: false, formulario_autoexclusion_completado_en: null,
          autoexclusion_completado_por: null, formulario_cuestionario_completado: false,
          formulario_cuestionario_completado_en: null, cuestionario_completado_por: null,
          creado_en: new Date().toISOString(),
        });
      });
    });

    await test.step('intentar cancelar: debe rechazarse con el motivo de negocio', async () => {
      await page.goto('/donante/mis_turnos.html');
      const card = page.locator('#lista-proximos .turno-card').first();
      await card.locator('button:has-text("Modificar")').click();
      await page.click('text=Cancelar este turno');
      await page.click('text=Sí, cancelar turno');

      await expect(page.locator('#modal-cancelar-error')).toBeVisible();
      await expect(page.locator('#modal-cancelar-error')).toContainText('2hs');
      await expect(page.locator('#modal-cancelar-error')).toContainText('Contactá al hospital');
    });
  });

});
