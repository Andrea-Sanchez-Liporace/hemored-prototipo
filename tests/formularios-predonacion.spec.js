/**
 * Test E2E de los formularios pre-donación del donante (F1 autoexclusión +
 * F2 cuestionario médico), `donante/formularios_predonacion.html`.
 *
 * Contexto importante — leer antes de tocar este archivo:
 * - F1/F2 es el formulario ESTÁNDAR que usan todos los hemocentros del país.
 *   Su contenido (preguntas, texto legal) no se modifica ni se le agregan
 *   campos propios de HemoRed — si en algún momento se necesita agregar algo
 *   de la app (ej. "última donación"), eso va en el perfil del donante
 *   (`donante/perfil.html`), no acá. Ver la nota completa en `docs/01`.
 * - El formulario se guarda contra `turno_id` (no `donacion_id`): al
 *   completar F1/F2 la donación todavía no existe como registro — la crea
 *   el profesional más adelante, en un flujo que todavía no está conectado
 *   (`registrarDonacion()`, ver `docs/04`).
 * - Hay DOS firmas del donante (no una): una para F1 (autoexclusión) y otra
 *   para F2 (cuestionario + consentimiento), porque son dos momentos de
 *   consentimiento distintos.
 *
 * Qué prueba este archivo: que el turno real se carga desde la URL
 * (?turno_id=), que las respuestas del cuestionario (incluidos los valores
 * por default, no solo los que el donante cambia) y ambas firmas se
 * persisten de verdad, y que "Mis turnos" refleja el estado completado.
 */

const { test, expect } = require('@playwright/test');

const timestamp = Date.now();
const donanteEmail = `donante.f1f2.${timestamp}@example.com`;
const donantePassword = 'password123';

// Dibuja un trazo simple sobre un canvas de firma. Hace falta hacer scroll
// hasta el canvas primero: como esta pantalla es larga (34 preguntas), si no
// se hace scrollIntoViewIfNeeded() las coordenadas del mouse pueden apuntar
// a un punto fuera del viewport visible y el trazo nunca se registra.
async function firmar(page, canvasSelector) {
  const canvas = page.locator(canvasSelector);
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + 20, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.3);
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.6);
  await page.mouse.up();
}

test.describe('Formularios pre-donación (F1 + F2)', () => {

  test('completar F1 y F2 persiste ambas firmas, las respuestas y actualiza el turno', async ({ page }) => {

    await test.step('registrar un donante y reservar un turno', async () => {
      await page.goto('/publico/registro.html');
      await page.click('text=Soy donante');
      await page.fill('#d-nombre', 'Carla');
      await page.fill('#d-apellido', 'Testigo');
      await page.fill('#d-email', donanteEmail);
      await page.fill('#d-tel', '11-4444-3333');
      await page.fill('#d-pass', donantePassword);
      await page.fill('#d-pass2', donantePassword);
      await page.click('#btn-crear-cuenta-donante');
      await page.waitForURL('**/donante/dashboard.html');

      await page.locator('.campaign-btn').first().click();
      await page.waitForURL('**/campana_detalle.html**');
      await page.click('#btn-reservar');
      const tabs = page.locator('.fecha-tab');
      await tabs.first().waitFor();
      await tabs.nth(3).click();
      await page.locator('.turno-opt[data-hora]').first().click();
      await page.click('#btn-continuar');
      await page.click('#btn-confirmar-reserva');
    });

    await test.step('entrar a "Completar formularios" desde Mis turnos, con el turno real en la URL', async () => {
      await page.goto('/donante/mis_turnos.html');
      await page.click('button:has-text("Completar formularios")');
      await page.waitForURL('**/formularios_predonacion.html?turno_id=**');

      // El banner ya no debe mostrar el texto fijo viejo — tiene que reflejar
      // el turno real que se acaba de reservar.
      await expect(page.locator('#banner-hospital')).toHaveText('Hospital Ramos Mejía');
      await expect(page.locator('#banner-meta')).not.toContainText('martes 20 de mayo');
    });

    await test.step('Paso 1 (autoexclusión): el botón sigue bloqueado hasta tildar los 3 checks y firmar', async () => {
      await expect(page.locator('#btn-paso1')).toBeDisabled();
      await page.check('#check1');
      await page.check('#check2');
      await expect(page.locator('#btn-paso1')).toBeDisabled(); // falta el check 3 y la firma
      await page.check('#check3');
      await expect(page.locator('#btn-paso1')).toBeDisabled(); // falta la firma

      await firmar(page, '#sig-f1');
      await expect(page.locator('#f1-sig-st')).toHaveText('✓ Firmado');
      await expect(page.locator('#btn-paso1')).toBeEnabled();

      await page.click('#btn-paso1');
      await expect(page.locator('#step-2')).toHaveClass(/active/);
    });

    await test.step('Paso 2 (cuestionario): cambiar una respuesta del default y agregar una observación', async () => {
      // Todas las preguntas arrancan con un valor por default ya seleccionado
      // (ver donante/formularios_predonacion.html) — acá cambiamos una para
      // confirmar que el cambio se guarda, no solo los defaults.
      await page.locator('.excl-item[data-key="fiebre_2sem"] .excl-btn', { hasText: 'Sí' }).click();
      await expect(page.locator('.excl-item[data-key="fiebre_2sem"] .excl-btn.sel-si')).toHaveText('Sí');
      await page.fill('#input-observaciones', 'Nota de prueba E2E.');
    });

    await test.step('intentar confirmar sin firmar el cuestionario se rechaza', async () => {
      await page.click('button:has-text("Confirmar y enviar formularios")');
      await expect(page.locator('.toast')).toContainText('Falta firmar');
      await expect(page.locator('#step-2')).toHaveClass(/active/); // no avanzó
    });

    await test.step('firmar y confirmar: avanza a la pantalla de éxito', async () => {
      await firmar(page, '#sig-f2');
      await expect(page.locator('#f2-sig-st')).toHaveText('✓ Firmado');
      await page.click('button:has-text("Confirmar y enviar formularios")');
      await expect(page.locator('#step-3')).toHaveClass(/active/);
      await expect(page.locator('.success-title')).toContainText('¡Todo listo');
    });

    await test.step('Mis turnos refleja que ambos formularios quedaron completados', async () => {
      await page.goto('/donante/mis_turnos.html');
      const badges = page.locator('.form-badge');
      await expect(badges.filter({ hasText: 'Autoexclusión completado' })).toBeVisible();
      await expect(badges.filter({ hasText: 'Cuestionario completado' })).toBeVisible();
    });

    await test.step('los datos guardados en la BD simulada son correctos', async () => {
      // Verificación directa sobre localStorage: más específica que solo
      // mirar la UI, confirma que se guardaron las 34 respuestas (no solo
      // la que cambiamos), ambas firmas como imágenes reales, y que
      // donacion_id quedó en null (la donación todavía no existe).
      const overrides = await page.evaluate(() => JSON.parse(localStorage.getItem('hemored_overrides') || '{}'));
      const lista = overrides.formulario_consentimiento || [];
      const formulario = lista[lista.length - 1]; // _persistir() guarda la tabla completa, no un delta

      expect(formulario.donacion_id).toBeNull();
      expect(formulario.autoexclusion_completado_por).toBe('donante');
      expect(formulario.cuestionario_completado_por).toBe('donante');
      expect(formulario.firma_donante_autoexclusion_url).toMatch(/^data:image/);
      expect(formulario.firma_donante_cuestionario_url).toMatch(/^data:image/);
      expect(formulario.observaciones).toBe('Nota de prueba E2E.');
      expect(formulario.respuestas_cuestionario.fiebre_2sem).toBe('si');
      expect(formulario.respuestas_cuestionario.cancer).toBe('no'); // quedó en su default, sin tocar
      expect(Object.keys(formulario.respuestas_cuestionario).length).toBe(34);

      const turno = (overrides.turnos || []).find(t => t.id === formulario.turno_id);
      expect(turno.formulario_autoexclusion_completado).toBe(true);
      expect(turno.formulario_cuestionario_completado).toBe(true);
    });
  });

});
