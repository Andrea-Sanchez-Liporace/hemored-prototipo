/**
 * Test E2E del botón para mostrar/ocultar contraseña, agregado 2026-09-22
 * a pedido explícito de la usuaria (hito acordado con el profesor).
 *
 * `HemoRed.ui.mejorarPasswords()` (ui.js) envuelve automáticamente
 * cualquier `<input type="password">` del sitio con un botón de ojo —
 * mismo criterio que `mejorarSelects()` para los `<select>` — así no hace
 * falta tocar cada formulario a mano. Un campo puede optar afuera con
 * `data-sin-toggle="1"` (el único caso real: el CVV de `publico/pago.html`,
 * que usa `type="password"` para taparse visualmente pero no tiene
 * sentido "revelar").
 */

const { test, expect } = require('@playwright/test');

test.describe('Mostrar/ocultar contraseña', () => {

  test('el botón de ojo alterna el campo entre oculto y visible, en login', async ({ page }) => {
    await page.goto('/publico/login.html');
    const input = page.locator('#password');
    await input.fill('secreto123');
    await expect(input).toHaveAttribute('type', 'password');

    await page.click('.hr-pass-toggle');
    await expect(input).toHaveAttribute('type', 'text');
    await expect(input).toHaveValue('secreto123');

    await page.click('.hr-pass-toggle');
    await expect(input).toHaveAttribute('type', 'password');
  });

  test('se agrega a los 4 campos de contraseña del registro (donante e hospital) y a los 2 de recuperar contraseña', async ({ page }) => {
    await page.goto('/publico/registro.html');
    await page.click('text=Soy donante');
    await expect(page.locator('#d-pass').locator('xpath=..').locator('.hr-pass-toggle')).toBeVisible();
    await expect(page.locator('#d-pass2').locator('xpath=..').locator('.hr-pass-toggle')).toBeVisible();

    await page.goto('/publico/registro.html');
    await page.click('text=Soy una institución');
    await expect(page.locator('#h-pass').locator('xpath=..').locator('.hr-pass-toggle')).toBeVisible();
    await expect(page.locator('#h-pass2').locator('xpath=..').locator('.hr-pass-toggle')).toBeVisible();

    await page.goto('/publico/recuperar.html');
    await expect(page.locator('.hr-pass-toggle')).toHaveCount(2);
  });

  test('en Seguridad de la cuenta (perfil.html) se agrega a los 3 modales: cambiar contraseña, cambiar email y eliminar cuenta', async ({ page }) => {
    await page.goto('/publico/login.html');
    await page.fill('#email', 'donante@hemored.com');
    await page.fill('#password', 'donante123');
    await page.click('.form-btn');
    await page.waitForURL('**/donante/dashboard.html');
    await page.goto('/donante/perfil.html');
    await page.click('#sec-seguridad .seccion-header');

    await page.click('text=Cambiar contraseña');
    await expect(page.locator('#modal-password .hr-pass-toggle')).toHaveCount(3);
    await page.click('#modal-password .modal-close');

    await page.click('text=Cambiar email');
    await expect(page.locator('#modal-email .hr-pass-toggle')).toHaveCount(1);
    await page.click('#modal-email .modal-close');

    await page.click('text=Eliminar cuenta');
    await expect(page.locator('#modal-eliminar-cuenta .hr-pass-toggle')).toHaveCount(1);
  });

  test('el CVV de publico/pago.html NO tiene botón de mostrar (data-sin-toggle)', async ({ page }) => {
    await page.goto('/publico/pago.html');
    const cvv = page.locator('input[maxlength="4"]');
    await expect(cvv).toBeVisible();
    await expect(page.locator('.hr-pass-toggle')).toHaveCount(0);
  });

});
