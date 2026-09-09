/**
 * Test E2E de "Mis documentos" del rol Donante: 4 pestañas (Resultados,
 * Evaluaciones clínicas, Certificados, Consentimientos) + solicitar un
 * certificado nuevo.
 *
 * Contexto importante:
 * - `documentos` es solo un índice (`tipo` + `referencia_id`), no una tabla
 *   con los datos en sí — HemoRed.data.cargarMisDocumentos() ya resuelve el
 *   join contra `resultado_analisis`/`certificado_donacion`/`donaciones`
 *   (para evaluación clínica, los signos vitales viven en `donaciones`, no
 *   hay tabla propia) / `formulario_consentimiento` (que ni pasa por
 *   `documentos`, se consulta directo por `usuario_id`).
 * - La pestaña "Evaluaciones clínicas" estaba rota antes de este cambio: el
 *   botón existía pero el contenido nunca se armó, así que clickearla
 *   tiraba un error de JS. Este test la prueba específicamente.
 * - "Solicitar certificado" no tiene ningún caso natural para probar con la
 *   cuenta demo (sus 2 donaciones semilla ya tienen certificado) — el test
 *   fuerza el escenario borrando el documento existente vía localStorage
 *   antes de solicitar uno nuevo.
 */

const { test, expect } = require('@playwright/test');

test.describe('Mis documentos (donante)', () => {

  test('las 4 pestañas muestran datos reales de la cuenta demo', async ({ page }) => {
    await test.step('loguearse con la cuenta demo y entrar a Mis documentos', async () => {
      await page.goto('/publico/login.html');
      await page.fill('#email', 'donante@hemored.com');
      await page.fill('#password', 'donante123');
      await page.click('button:has-text("Iniciar sesión")');
      await page.goto('/donante/mis_documentos.html');
    });

    await test.step('Resultados: la tarjeta y el detalle muestran el análisis real', async () => {
      const card = page.locator('#lista-resultados .doc-card').first();
      await expect(card).toContainText('Hospital Ramos Mejía');
      await card.click();
      await expect(page.locator('#resultado-contenido')).toContainText('BLS-2026-0834');
      await expect(page.locator('#resultado-contenido')).toContainText('Negativo'); // serología
      await expect(page.locator('#resultado-contenido')).toContainText('13.8 g/dL'); // hemoglobina
      await page.click('.view.active .back-btn');
    });

    await test.step('Evaluaciones clínicas: la pestaña estaba rota (tiraba error de JS), ahora funciona', async () => {
      const errores = [];
      page.on('pageerror', e => errores.push(e.message));

      await page.locator('.tab', { hasText: 'Evaluaciones' }).click();
      await expect(page.locator('#lista-evaluaciones .doc-card')).toHaveCount(1);

      await page.locator('#lista-evaluaciones .doc-card').first().click();
      await expect(page.locator('#evaluacion-contenido')).toContainText('Presión arterial');
      await expect(page.locator('#evaluacion-contenido')).toContainText('120/80 mmHg');
      await expect(page.locator('#evaluacion-contenido')).toContainText('Apto para donar');
      await page.click('.view.active .back-btn');

      expect(errores).toHaveLength(0);
    });

    await test.step('Certificados: la tarjeta y el detalle muestran el certificado real', async () => {
      await page.locator('.tab', { hasText: 'Certificados' }).click();
      const card = page.locator('#lista-certificados .doc-card').first();
      await expect(card.locator('.doc-badge')).toHaveText('Emitido');
      await card.click();
      await expect(page.locator('#certificado-contenido')).toContainText('CERT-2026-RM-0834');
      await expect(page.locator('#certificado-contenido')).toContainText('Dr. Carlos Méndez');
    });

    await test.step('"Reportar dato incorrecto" abre el modal de solicitud de corrección (flujo completo probado en solicitudes-correccion.spec.js)', async () => {
      await page.click('button:has-text("Reportar dato incorrecto")');
      await expect(page.locator('#modal-solicitud-correccion')).toHaveClass(/active/);
      await expect(page.locator('#solicitud-campos-lista')).toContainText('Nombre');
      await page.click('#modal-solicitud-correccion button:has-text("Cancelar")');
    });

    await test.step('Consentimientos: la tarjeta y el detalle muestran el formulario F1/F2 real', async () => {
      await page.click('.view.active .back-btn');
      await page.locator('.tab', { hasText: 'Consentimientos' }).click();
      await expect(page.locator('#lista-consentimientos .doc-card')).toHaveCount(1);
      await page.locator('#lista-consentimientos .doc-card').first().click();
      await expect(page.locator('#consentimiento-contenido')).toContainText('Sofía Páez');
      // La cuenta demo tiene el cuestionario completado por el profesional
      // (dato semilla) — confirma que se lee el campo real, no un texto fijo.
      await expect(page.locator('#consentimiento-contenido')).toContainText('El profesional');
    });
  });

  test('solicitar un certificado nuevo lo deja "pendiente" y no se puede duplicar', async ({ page }) => {
    await page.goto('/publico/login.html');
    await page.fill('#email', 'donante@hemored.com');
    await page.fill('#password', 'donante123');
    await page.click('button:has-text("Iniciar sesión")');

    await test.step('preparar el escenario: una donación sin certificado (no existe hoy en los datos semilla)', async () => {
      await page.goto('/donante/mis_documentos.html');
      await page.evaluate(() => {
        const overrides = JSON.parse(localStorage.getItem('hemored_overrides') || '{}');
        overrides.documentos = (overrides.documentos || []).filter(d => !(d.donacion_id === 2 && d.tipo === 'certificado'));
        localStorage.setItem('hemored_overrides', JSON.stringify(overrides));
      });
      await page.reload();
      await page.locator('.tab', { hasText: 'Certificados' }).click();
      await expect(page.locator('#lista-certificados')).toContainText('Solicitar certificado');
    });

    await test.step('solicitar el certificado lo deja "Pendiente"', async () => {
      await page.click('button:has-text("Solicitar certificado")');
      await expect(page.locator('.toast')).toContainText('Certificado solicitado');
      await expect(page.locator('#lista-certificados')).toContainText('Pendiente');
      await expect(page.locator('#lista-certificados')).not.toContainText('Solicitar certificado');
    });

    await test.step('no se puede pedir dos veces el certificado de la misma donación', async () => {
      const resultado = await page.evaluate(() => HemoRed.data.solicitarCertificado(2));
      expect(resultado.ok).toBe(false);
      expect(resultado.error).toContain('Ya existe');
    });
  });

});
