/**
 * Test E2E del formulario de contacto / lead institucional
 * (`publico/contacto.html`), agregado 2026-09-24.
 *
 * Antes `enviarFormulario()` solo cambiaba de vista visual sin guardar
 * nada. Ahora persiste el lead en una tabla nueva, `mensajes_contacto`
 * (`HemoRed.data.crearMensajeContacto()`) — NO en `mensajes.json`, que es
 * la mensajería hospital↔admin y requiere un `hospital_id` que acá no
 * existe todavía (quien completa este formulario no es un hospital dado
 * de alta en el sistema, es un lead).
 *
 * Queda pendiente, a propósito, una vista de admin que liste estos
 * mensajes — este test solo cubre que el dato se guarda de verdad.
 */

const { test, expect } = require('@playwright/test');

test.describe('Formulario de contacto', () => {

  test('enviar vacío muestra error y no guarda nada', async ({ page }) => {
    await page.goto('/publico/contacto.html');
    await page.click('.form-btn');
    await expect(page.locator('#contacto-error')).toBeVisible();
    await expect(page.locator('#contacto-error')).toHaveText('Completá nombre, apellido y email.');
    await expect(page.locator('#success-msg')).not.toBeVisible();

    const leads = await page.evaluate(async () => {
      await HemoRed.db.init();
      return HemoRed.db.all('mensajes_contacto');
    });
    expect(leads.length).toBe(0);
  });

  test('completar y enviar guarda el lead real y muestra la vista de éxito', async ({ page }) => {
    await page.goto('/publico/contacto.html');

    await page.fill('#c-nombre', 'María');
    await page.fill('#c-apellido', 'González');
    await page.fill('#c-email', 'maria@hospitaltest.com.ar');
    await page.fill('#c-tel', '+54 11 5555 5555');
    await page.fill('#c-inst', 'Hospital Test');
    await page.check('#ch-red');
    await page.check('#ch-nacional');
    await page.check('#ch-sistema');
    await page.fill('#c-mensaje', 'Consulta de prueba automatizada.');

    await page.click('.form-btn');
    await expect(page.locator('#success-msg')).toBeVisible();

    const leads = await page.evaluate(async () => {
      await HemoRed.db.init();
      return HemoRed.db.all('mensajes_contacto');
    });
    expect(leads.length).toBe(1);
    expect(leads[0]).toMatchObject({
      nombre: 'María',
      apellido: 'González',
      email: 'maria@hospitaltest.com.ar',
      institucion: 'Hospital Test',
      tipo_consulta: ['Consulta para una red de hospitales o instituciones'],
      alcance_geografico: ['Nacional'],
      gestion_actual: ['Usamos algún sistema propio o de terceros'],
      mensaje: 'Consulta de prueba automatizada.',
      estado: 'pendiente',
    });
  });

});
