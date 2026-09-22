/**
 * Test E2E del aviso "Perfil incompleto" (sidebar, todas las pantallas de
 * Donante) y de los badges Completo/Pendiente de cada sección de
 * `donante/perfil.html`, agregado 2026-09-22.
 *
 * Antes de este cambio, el aviso del sidebar era HTML 100% fijo —
 * "Completá tu tipo de sangre para ver campañas compatibles" — solo
 * existía en `dashboard.html` (ausente en el resto de las pantallas con
 * sidebar) y se mostraba siempre, sin mirar el dato real del donante
 * logueado. La usuaria lo reportó probando con la cuenta demo
 * (donante@hemored.com), que ya tiene tipo de sangre y datos médicos
 * cargados pero igual veía el aviso. Además el badge "Datos médicos" de
 * `perfil.html` también era texto fijo ("Pendiente"), sin relación con
 * si esos campos estaban cargados o no.
 *
 * Ahora `HemoRed.data.verificarPerfilIncompleto()` (data.js) es la única
 * fuente de verdad — usa los mismos 7 campos (`CAMPOS_PERFIL_PERSONAL` +
 * `CAMPOS_PERFIL_MEDICOS`) que ya usaba el % de completitud de
 * `perfil.html` — y se llama desde las 7 pantallas de Donante que tienen
 * sidebar.
 */

const { test, expect } = require('@playwright/test');

const timestamp = Date.now();
const donanteEmail = `donante.incompleto.${timestamp}@example.com`;
const donantePassword = 'password123';

test.describe('Perfil incompleto — aviso del sidebar y badges de perfil.html', () => {

  test('un donante recién registrado ve el aviso en el sidebar de varias pantallas, y desaparece al completar sus datos', async ({ page }) => {
    await test.step('registrar un donante nuevo (datos mínimos: solo nombre/apellido/email/teléfono)', async () => {
      await page.goto('/publico/registro.html');
      await page.click('text=Soy donante');
      await page.fill('#d-nombre', 'Marina');
      await page.fill('#d-apellido', 'Incompleta');
      await page.fill('#d-email', donanteEmail);
      await page.fill('#d-tel', '11-5555-4444');
      await page.fill('#d-pass', donantePassword);
      await page.fill('#d-pass2', donantePassword);
      await page.click('#btn-crear-cuenta-donante');
      await page.waitForURL('**/donante/dashboard.html');
    });

    await test.step('el aviso "Perfil incompleto" se ve en el dashboard (le faltan fecha de nacimiento, DNI, provincia, ciudad, tipo de sangre y peso)', async () => {
      await expect(page.locator('#sidebar-alerta-perfil')).toBeVisible();
      await expect(page.locator('#sidebar-alerta-perfil')).toContainText('Perfil incompleto');
    });

    await test.step('el mismo aviso también se ve en otra pantalla (antes solo existía en dashboard.html)', async () => {
      await page.goto('/donante/mis_turnos.html');
      await expect(page.locator('#sidebar-alerta-perfil')).toBeVisible();
    });

    await test.step('en perfil.html, la sección "Datos médicos" está en Pendiente', async () => {
      await page.goto('/donante/perfil.html');
      await expect(page.locator('#status-sec-medicos')).toHaveText('Pendiente');
      await expect(page.locator('#status-sec-medicos')).toHaveClass(/pendiente/);
    });

    await test.step('completar datos personales y médicos', async () => {
      // "Datos personales" arranca abierta por default, no hace falta clickearla
      // (y clickearla la cerraría, ver toggleSeccion() en perfil.html).
      await page.fill('#input-fecha-nacimiento', '1998-04-20');
      await page.fill('#input-dni', '40123456');
      await page.locator('#input-provincia').selectOption('CABA');
      await page.fill('#input-ciudad', 'CABA');
      await page.click('button:has-text("Guardar cambios")');

      await page.click('#sec-medicos .seccion-header');
      await page.click('.sangre-opt[data-tipo="0+"]');
      await page.fill('#input-peso', '65');
      await page.locator('#input-experiencia').selectOption('primera_vez');
      await page.locator('#sec-medicos button:has-text("Guardar cambios")').click();
    });

    await test.step('las dos secciones pasan a Completo, y el % de completitud llega a 100%', async () => {
      await expect(page.locator('#status-sec-personal')).toHaveText('Completo');
      await expect(page.locator('#status-sec-medicos')).toHaveText('Completo');
      await expect(page.locator('#completitud-pct')).toHaveText('100%');
    });

    await test.step('el aviso del sidebar ya no se muestra, ni acá ni en otra pantalla', async () => {
      await expect(page.locator('#sidebar-alerta-perfil')).toBeHidden();
      await page.goto('/donante/dashboard.html');
      await expect(page.locator('#sidebar-alerta-perfil')).toBeHidden();
    });
  });

  test('la cuenta demo (donante@hemored.com), que ya tiene todos los datos cargados, no ve el aviso', async ({ page }) => {
    await page.goto('/publico/login.html');
    await page.fill('#email', 'donante@hemored.com');
    await page.fill('#password', 'donante123');
    await page.click('.form-btn');
    await page.waitForURL('**/donante/dashboard.html');

    await expect(page.locator('#sidebar-alerta-perfil')).toBeHidden();

    await page.goto('/donante/perfil.html');
    await expect(page.locator('#status-sec-personal')).toHaveText('Completo');
    await expect(page.locator('#status-sec-medicos')).toHaveText('Completo');
  });

});
