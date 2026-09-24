/**
 * Test E2E de "Recuperar contraseña" (`publico/recuperar.html`), agregado
 * 2026-09-24. Antes eran 4 pasos que solo alternaban clases CSS, sin leer
 * ni validar nada real.
 *
 * Mismo criterio que `cambiarPasswordDonante()` (Seguridad de la cuenta,
 * `perfil.html`) pero buscando por email en vez de por `usuarioId` — acá
 * quien lo usa todavía no tiene sesión, es justamente el problema que
 * resuelve (`HemoRed.data.restablecerPasswordPorEmail()`).
 *
 * El paso 2 ("Revisá tu email") sigue siendo solo de interfaz a propósito:
 * el prototipo no tiene forma de mandar un código real por email (mismo
 * criterio ya documentado para la validación de email del donante) — solo
 * se exige que las 6 casillas estén completas, no se verifica el valor.
 *
 * Límite conocido, no un bug de este flujo: para las 4 cuentas demo
 * (`donante@hemored.com` y las otras 3), restablecer la contraseña acá
 * actualiza `usuarios.json` mismo, pero el login de esas cuentas puntuales
 * sigue mirando el objeto `USUARIOS` fijo de `sesion.js` primero — mismo
 * límite ya documentado para `cambiarPasswordDonante`. Por eso el caso de
 * "ciclo completo" de este test usa un donante recién registrado (el
 * camino real de la demo), no una cuenta fija.
 */

const { test, expect } = require('@playwright/test');

test.describe('Recuperar contraseña', () => {

  test('email inexistente muestra error y no avanza', async ({ page }) => {
    await page.goto('/publico/recuperar.html');
    await page.fill('#r-email', 'noexiste@hemored.com');
    await page.click('.form-btn');
    await expect(page.locator('#email-error')).toBeVisible();
    await expect(page.locator('#email-error')).toHaveText('No encontramos ninguna cuenta con ese email.');
    await expect(page.locator('#step-email')).toHaveClass(/active/);
  });

  test('código incompleto no deja avanzar', async ({ page }) => {
    await page.goto('/publico/recuperar.html');
    await page.fill('#r-email', 'donante@hemored.com');
    await page.click('.form-btn');
    await expect(page.locator('#step-codigo')).toHaveClass(/active/);

    await page.click('#step-codigo .form-btn');
    await expect(page.locator('#codigo-error')).toBeVisible();
    await expect(page.locator('#step-codigo')).toHaveClass(/active/);
  });

  test('ciclo completo con un donante nuevo: la contraseña cambia de verdad', async ({ page }) => {
    // Registro real de un donante para tener un email/password conocidos
    await page.goto('/publico/registro.html');
    const email = `recuperar${Date.now()}@hemored.com`;
    await page.click('.rol-card[onclick*="donante"]');
    await page.fill('#d-nombre', 'Test');
    await page.fill('#d-apellido', 'Recuperar');
    await page.fill('#d-email', email);
    await page.fill('#d-pass', 'password123');
    await page.fill('#d-pass2', 'password123');
    await page.click('#btn-crear-cuenta-donante');
    await page.waitForURL('**/donante/dashboard.html');

    await page.goto('/publico/recuperar.html');
    await page.fill('#r-email', email);
    await page.click('.form-btn');
    await expect(page.locator('#step-codigo')).toHaveClass(/active/);
    await expect(page.locator('#email-display')).toHaveText(email);

    const codeInputs = page.locator('.code-input');
    for (let i = 0; i < 6; i++) await codeInputs.nth(i).fill(String(i));
    await page.click('#step-codigo .form-btn');
    await expect(page.locator('#step-nueva')).toHaveClass(/active/);

    // Contraseña corta
    await page.fill('#r-pass', '123');
    await page.fill('#r-pass2', '123');
    await page.click('#step-nueva .form-btn');
    await expect(page.locator('#nueva-error')).toHaveText('La contraseña debe tener al menos 8 caracteres.');

    // No coinciden
    await page.fill('#r-pass', 'nuevaPassword1');
    await page.fill('#r-pass2', 'otraPassword2');
    await page.click('#step-nueva .form-btn');
    await expect(page.locator('#nueva-error')).toHaveText('Las contraseñas no coinciden.');

    // Reset real
    await page.fill('#r-pass', 'nuevaPassword1');
    await page.fill('#r-pass2', 'nuevaPassword1');
    await page.click('#step-nueva .form-btn');
    await expect(page.locator('#step-exito')).toHaveClass(/active/);

    // Confirma que la contraseña cambió de verdad: login con la nueva
    await page.click('#step-exito .form-btn');
    await page.waitForURL('**/publico/login.html');
    await page.fill('#email', email);
    await page.fill('#password', 'nuevaPassword1');
    await page.click('.form-btn');
    await page.waitForURL('**/donante/dashboard.html');
  });

});
