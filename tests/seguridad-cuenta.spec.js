/**
 * Test E2E de la sección "Seguridad de la cuenta" en `donante/perfil.html`
 * (cambiar contraseña, cambiar email, eliminar cuenta) — hasta el
 * 2026-09-15 los 3 botones no tenían ninguna acción detrás (hallazgo de la
 * segunda auditoría de consistencia del rol Donante, ver docs/04).
 *
 * Contexto importante:
 * - Las validaciones (contraseña actual correcta, email con formato válido
 *   y no duplicado, contraseña >= 8 caracteres) viven en
 *   `HemoRed.data.cambiarPasswordDonante()` / `cambiarEmailDonante()` /
 *   `eliminarCuentaDonante()` (frontend/js/data.js), no en el HTML.
 * - "Eliminar cuenta" es una baja lógica (`usuarios.activo = false`), no un
 *   borrado real — turnos/donaciones/certificados ya emitidos desde otros
 *   roles siguen referenciando este usuario_id. El login (sesion.js)
 *   rechaza a una cuenta con `activo === false`.
 * - Se registra un donante nuevo (no la cuenta demo hardcodeada) porque el
 *   login de las 4 cuentas demo de `sesion.js` no consulta `usuarios.
 *   password_hash` en absoluto — cambiar la contraseña o el email desde acá
 *   no tendría ningún efecto observable para esas cuentas en particular.
 */

const { test, expect } = require('@playwright/test');

const timestamp = Date.now();
const donanteEmail = `donante.seguridad.${timestamp}@example.com`;
const donantePassword = 'password123';

test.describe('Seguridad de la cuenta (donante)', () => {

  test('cambiar contraseña, cambiar email y eliminar cuenta', async ({ page }) => {

    await test.step('registrar un donante nuevo y entrar a Mi perfil', async () => {
      await page.goto('/publico/registro.html');
      await page.click('text=Soy donante');
      await page.fill('#d-nombre', 'Lucía');
      await page.fill('#d-apellido', 'Testigo');
      await page.fill('#d-email', donanteEmail);
      await page.fill('#d-tel', '11-7777-8888');
      await page.fill('#d-pass', donantePassword);
      await page.fill('#d-pass2', donantePassword);
      await page.click('#btn-crear-cuenta-donante');
      await page.waitForURL('**/donante/dashboard.html');

      await page.goto('/donante/perfil.html');
      await page.click('.seccion-header:has-text("Seguridad de la cuenta")');
      await expect(page.locator('#seg-email-sub')).toContainText(donanteEmail);
    });

    await test.step('cambiar contraseña: rechaza actual incorrecta y confirmación que no coincide', async () => {
      await page.click('button:has-text("Cambiar contraseña")');
      await page.fill('#pw-actual', 'contraseñaMala');
      await page.fill('#pw-nueva', 'nuevaPassword1');
      await page.fill('#pw-nueva2', 'nuevaPassword1');
      await page.click('#modal-password button:has-text("Guardar")');
      await expect(page.locator('#pw-error')).toContainText('no es correcta');

      await page.fill('#pw-actual', donantePassword);
      await page.fill('#pw-nueva2', 'otraDistinta1');
      await page.click('#modal-password button:has-text("Guardar")');
      await expect(page.locator('#pw-error')).toContainText('no coinciden');
    });

    await test.step('cambiar contraseña: éxito, y la nueva sirve para volver a loguearse', async () => {
      await page.fill('#pw-nueva2', 'nuevaPassword1');
      await page.click('#modal-password button:has-text("Guardar")');
      await expect(page.locator('.toast')).toContainText('Contraseña actualizada');
      await expect(page.locator('#seg-password-sub')).toContainText('Última modificación');

      await page.evaluate(() => window.HemoRed.sesion.logout());
      await page.waitForURL('**/publico/login.html');
      await page.fill('#email', donanteEmail);
      await page.fill('#password', donantePassword);
      await page.click('.form-btn');
      await expect(page.locator('#login-error')).toBeVisible(); // la vieja ya no sirve

      await page.fill('#email', donanteEmail);
      await page.fill('#password', 'nuevaPassword1');
      await page.click('.form-btn');
      await page.waitForURL('**/donante/dashboard.html');
    });

    await test.step('cambiar email: rechaza formato inválido y el mismo email actual', async () => {
      await page.goto('/donante/perfil.html');
      await page.click('.seccion-header:has-text("Seguridad de la cuenta")');
      await page.click('button:has-text("Cambiar email")');

      await page.fill('#email-nuevo', 'no-es-un-email');
      await page.fill('#email-pass-actual', 'nuevaPassword1');
      await page.click('#modal-email button:has-text("Guardar")');
      await expect(page.locator('#email-error')).toContainText('válido');

      await page.fill('#email-nuevo', donanteEmail);
      await page.click('#modal-email button:has-text("Guardar")');
      await expect(page.locator('#email-error')).toContainText('ya es tu email actual');
    });

    const nuevoEmail = `donante.seguridad.nuevo.${timestamp}@example.com`;

    await test.step('cambiar email: éxito, queda pendiente de verificación', async () => {
      await page.fill('#email-nuevo', nuevoEmail);
      await page.click('#modal-email button:has-text("Guardar")');
      await expect(page.locator('.toast')).toContainText('Email actualizado');
      await expect(page.locator('#perfil-email')).toHaveText(nuevoEmail);
      await expect(page.locator('#seg-email-sub')).toContainText('Pendiente de verificación');
    });

    await test.step('eliminar cuenta: rechaza contraseña incorrecta', async () => {
      await page.click('button:has-text("Eliminar cuenta")');
      await page.fill('#eliminar-pass-actual', 'contraseñaMala');
      await page.click('#modal-eliminar-cuenta button:has-text("Eliminar mi cuenta")');
      await expect(page.locator('#eliminar-error')).toContainText('no es correcta');
    });

    await test.step('eliminar cuenta: éxito cierra la sesión y bloquea futuros logins', async () => {
      await page.fill('#eliminar-pass-actual', 'nuevaPassword1');
      await page.click('#modal-eliminar-cuenta button:has-text("Eliminar mi cuenta")');
      await page.waitForURL('**/publico/login.html');

      await page.fill('#email', nuevoEmail);
      await page.fill('#password', 'nuevaPassword1');
      await page.click('.form-btn');
      await expect(page.locator('#login-error')).toContainText('eliminada');
    });
  });

});
