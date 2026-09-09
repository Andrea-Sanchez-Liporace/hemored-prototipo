/**
 * Test E2E del flujo completo de "Solicitudes de corrección": un donante
 * reporta un dato mal cargado en su certificado de donación, y el hospital
 * lo aprueba (aplica el cambio real) o lo rechaza (con motivo).
 *
 * Contexto importante:
 * - Reemplaza el viejo "Enviar observación" (`mis_documentos.html`), que
 *   validaba y mostraba un toast pero no persistía nada — ver docs/04.
 * - Este flujo es SOLO para certificados de donación (los que el donante
 *   pide para presentar en una empresa) — NO para formularios de
 *   consentimiento, que son otra cosa (documentos que se firman antes de
 *   donar, no algo que se "solicite" para un tercero). La versión anterior
 *   de este trabajo lo había extendido por error a consentimiento también.
 * - Tabla `solicitudes_correccion`: `certificado_id` apunta directo a
 *   `certificado_donacion` (no hay `tipo_documento` genérico — no hace
 *   falta, solo existe un tipo de documento corregible hoy).
 * - Al aprobar, `HemoRed.data.resolverSolicitudCorreccion()` aplica cada
 *   campo sobre la tabla real que le corresponda (`usuarios` para
 *   nombre/apellido/DNI, `certificado_donacion` para el resto) — no
 *   alcanza con marcar la solicitud como aprobada, el dato tiene que
 *   cambiar de verdad.
 * - Mientras una solicitud está "pendiente" para un certificado, no se
 *   puede mandar otra para el mismo (se rechaza con un error claro).
 * - Estado visible del certificado (badge en la lista + detalle):
 *   "Emitido" (sin solicitud, o última rechazada) → "En revisión" (pendiente)
 *   → "Emitido con corrección" (aprobada) o de vuelta a "Emitido" (rechazada,
 *   sin marca — el certificado no cambió). En cualquier estado se ve el
 *   detalle de la última solicitud (no se pierde el historial del pedido).
 * - Al rechazar, se genera una notificación real para el donante (tabla
 *   `notificaciones_donante`, nueva) con el mismo motivo que el hospital
 *   escribió al rechazar — no hace falta que el hospital redacte un mensaje
 *   aparte. Componer un mensaje libre desde el hospital queda pendiente
 *   para más adelante (ver docs/04).
 */

const { test, expect } = require('@playwright/test');

test.describe('Solicitudes de corrección sobre certificados (donante + hospital)', () => {

  test('el donante reporta un dato del certificado y el hospital lo aprueba', async ({ page }) => {
    await test.step('loguearse como donante y abrir el certificado', async () => {
      await page.goto('/publico/login.html');
      await page.fill('#email', 'donante@hemored.com');
      await page.fill('#password', 'donante123');
      await page.click('button:has-text("Iniciar sesión")');
      await page.goto('/donante/mis_documentos.html');
      await page.locator('.tab', { hasText: 'Certificados' }).click();
      await page.locator('#lista-certificados .doc-card').first().click();
    });

    await test.step('abrir el modal y marcar "Apellido" con una corrección', async () => {
      await page.click('button:has-text("Reportar dato incorrecto")');
      await expect(page.locator('#modal-solicitud-correccion')).toHaveClass(/active/);
      // Volumen donado, profesional a cargo y hospital NO son reportables acá
      // (son datos que carga el sistema, no algo que el donante controle)
      await expect(page.locator('#solicitud-campos-lista')).not.toContainText('Volumen donado');
      await expect(page.locator('#solicitud-campos-lista')).not.toContainText('Profesional a cargo');
      await expect(page.locator('#solicitud-campos-lista')).not.toContainText('Hospital');
      await page.locator('#solicitud-campos-lista label', { hasText: 'Apellido' }).locator('input[type=checkbox]').check();
      await expect(page.locator('#campo-correccion-detalle-apellido')).toBeVisible();
      await expect(page.locator('#campo-correccion-detalle-apellido')).toContainText('Páez');
      await page.fill('#campo-correccion-valor-apellido', 'Páez López');
    });

    await test.step('mandar la solicitud sin completar el valor propuesto se rechaza', async () => {
      await page.locator('#solicitud-campos-lista label', { hasText: 'DNI' }).locator('input[type=checkbox]').check();
      await page.click('#modal-solicitud-correccion button:has-text("Enviar solicitud")');
      await expect(page.locator('.toast')).toContainText('Completá la corrección');
      await page.locator('#solicitud-campos-lista label', { hasText: 'DNI' }).locator('input[type=checkbox]').uncheck();
    });

    await test.step('enviar la solicitud completa deja el certificado "En revisión"', async () => {
      await page.click('#modal-solicitud-correccion button:has-text("Enviar solicitud")');
      await expect(page.locator('.toast')).toContainText('Solicitud enviada');
      await expect(page.locator('#certificado-contenido')).toContainText('Detalle de tu solicitud de corrección');
      await expect(page.locator('#certificado-contenido')).toContainText('Solicitada el'); // fecha_solicitud
      await expect(page.locator('#certificado-contenido')).toContainText('Solicitud en revisión');
      // Mientras está pendiente, no hay botón para reportar otro dato (no se pierde el historial: se ve el detalle de lo ya reportado)
      await expect(page.locator('#certificado-contenido button:has-text("Reportar dato incorrecto")')).toHaveCount(0);
      // El badge de la lista también refleja el estado "en revisión"
      await page.click('.view.active .back-btn');
      await expect(page.locator('#lista-certificados .doc-card').first().locator('.doc-badge')).toHaveText('En revisión');
      await page.locator('#lista-certificados .doc-card').first().click();
    });

    await test.step('no se puede mandar una segunda solicitud mientras la primera sigue pendiente', async () => {
      const resultado = await page.evaluate(() => {
        const donante = HemoRed.db.where('usuarios', 'email', 'donante@hemored.com')[0];
        const cert = HemoRed.db.all('certificado_donacion').find(c => c.usuario_id === donante.id);
        return HemoRed.data.crearSolicitudCorreccion(donante.id, cert.id, [
          { campo: 'dni', valorActual: donante.numero_documento, valorPropuesto: '99999999' },
        ]);
      });
      expect(resultado.ok).toBe(false);
      expect(resultado.error).toContain('pendiente');
    });

    await test.step('el hospital ve la solicitud pendiente en Documentación', async () => {
      await page.goto('/publico/login.html');
      await page.fill('#email', 'hospital@hemored.com');
      await page.fill('#password', 'hospital123');
      await page.click('button:has-text("Iniciar sesión")');
      await page.goto('/hospital/documentacion.html');
      await page.locator('.tab', { hasText: 'Solicitudes de corrección' }).click();
      await expect(page.locator('#badge-solicitudes')).toHaveText('1');
      await expect(page.locator('#lista-solicitudes')).toContainText('Sofía Páez');
    });

    await test.step('el hospital revisa y aprueba la corrección', async () => {
      await page.click('#lista-solicitudes button:has-text("Revisar")');
      await expect(page.locator('#modal-solicitud-body')).toContainText('Certificado de donación');
      await expect(page.locator('#modal-solicitud-body')).toContainText('Reportado el'); // fecha_solicitud
      await expect(page.locator('#modal-solicitud-body')).toContainText('Páez'); // dato actual
      await expect(page.locator('#modal-solicitud-body')).toContainText('Páez López'); // corrección propuesta
      await page.click('#modal-solicitud-acciones button:has-text("Aprobar y aplicar")');
      await expect(page.locator('.toast')).toContainText('Corrección aplicada');
      await expect(page.locator('#badge-solicitudes')).toHaveText('0');
    });

    await test.step('el dato corregido queda aplicado de verdad en usuarios', async () => {
      const apellidoActualizado = await page.evaluate(() => {
        return HemoRed.db.where('usuarios', 'email', 'donante@hemored.com')[0].apellido;
      });
      expect(apellidoActualizado).toBe('Páez López');
    });

    await test.step('el donante ve el certificado "Emitido con corrección" con el detalle de lo aprobado', async () => {
      await page.goto('/publico/login.html');
      await page.fill('#email', 'donante@hemored.com');
      await page.fill('#password', 'donante123');
      await page.click('button:has-text("Iniciar sesión")');
      await page.goto('/donante/mis_documentos.html');
      await page.locator('.tab', { hasText: 'Certificados' }).click();
      await expect(page.locator('#lista-certificados .doc-card').first().locator('.doc-badge')).toHaveText('Emitido con corrección');
      await page.locator('#lista-certificados .doc-card').first().click();
      await expect(page.locator('#certificado-contenido')).toContainText('Detalle de tu solicitud de corrección');
      await expect(page.locator('#certificado-contenido')).toContainText('Corrección aplicada');
      await expect(page.locator('#certificado-contenido')).toContainText('aplicó la corrección con éxito, el'); // fecha_resolucion
      await expect(page.locator('#certificado-contenido')).toContainText('Páez López'); // sigue viéndose el detalle de lo que se pidió
    });
  });

  test('el hospital rechaza una solicitud de corrección con motivo', async ({ page }) => {
    await test.step('el donante reporta el DNI del certificado', async () => {
      await page.goto('/publico/login.html');
      await page.fill('#email', 'donante@hemored.com');
      await page.fill('#password', 'donante123');
      await page.click('button:has-text("Iniciar sesión")');
      await page.goto('/donante/mis_documentos.html');
      await page.locator('.tab', { hasText: 'Certificados' }).click();
      await page.locator('#lista-certificados .doc-card').first().click();
      await page.click('button:has-text("Reportar dato incorrecto")');
      await page.locator('#solicitud-campos-lista label', { hasText: 'DNI' }).locator('input[type=checkbox]').check();
      await page.fill('#campo-correccion-valor-dni', '12345679');
      await page.click('#modal-solicitud-correccion button:has-text("Enviar solicitud")');
      await expect(page.locator('.toast')).toContainText('Solicitud enviada');
    });

    await test.step('el hospital rechaza sin escribir motivo: se bloquea', async () => {
      await page.goto('/publico/login.html');
      await page.fill('#email', 'hospital@hemored.com');
      await page.fill('#password', 'hospital123');
      await page.click('button:has-text("Iniciar sesión")');
      await page.goto('/hospital/documentacion.html');
      await page.locator('.tab', { hasText: 'Solicitudes de corrección' }).click();
      await page.locator('#lista-solicitudes button:has-text("Revisar")').first().click();
      await page.click('#modal-solicitud-acciones button:has-text("Rechazar")');
      await expect(page.locator('.toast')).toContainText('Contale al donante');
    });

    await test.step('con motivo, el rechazo se confirma', async () => {
      await page.fill('#motivo-rechazo', 'El DNI cargado coincide con tu documento registrado.');
      await page.click('#modal-solicitud-acciones button:has-text("Rechazar")');
      await expect(page.locator('.toast')).toContainText('Solicitud rechazada');
    });

    await test.step('el DNI del donante NO cambió — rechazar no aplica el dato', async () => {
      const dniActual = await page.evaluate(() => HemoRed.db.where('usuarios', 'email', 'donante@hemored.com')[0].numero_documento);
      expect(dniActual).not.toBe('12345679');
    });

    await test.step('el donante ve el certificado "Emitido" (sin marca) con el detalle de lo rechazado', async () => {
      await page.goto('/publico/login.html');
      await page.fill('#email', 'donante@hemored.com');
      await page.fill('#password', 'donante123');
      await page.click('button:has-text("Iniciar sesión")');
      await page.goto('/donante/mis_documentos.html');
      await page.locator('.tab', { hasText: 'Certificados' }).click();
      // Rechazar NO deja marca visible en el badge: vuelve a "Emitido" a secas
      await expect(page.locator('#lista-certificados .doc-card').first().locator('.doc-badge')).toHaveText('Emitido');
      await page.locator('#lista-certificados .doc-card').first().click();
      await expect(page.locator('#certificado-contenido')).toContainText('Detalle de tu solicitud de corrección');
      await expect(page.locator('#certificado-contenido')).toContainText('12345679'); // lo que se había propuesto, sigue en el historial
      await expect(page.locator('#certificado-contenido')).toContainText('Corrección no aplicada');
      await expect(page.locator('#certificado-contenido')).toContainText('revisó tu solicitud el'); // fecha_resolucion
      await expect(page.locator('#certificado-contenido')).toContainText('sigue disponible para descargar');
    });

    await test.step('"Ver notificaciones" lleva al detalle real del rechazo', async () => {
      await page.click('button:has-text("Ver notificaciones")');
      await expect(page).toHaveURL(/notificaciones\.html/);
      const notif = page.locator('.notif-item', { hasText: 'Tu solicitud de corrección fue rechazada' });
      await expect(notif).toContainText('El DNI cargado coincide con tu documento registrado.');
      await expect(notif).toHaveClass(/unread/);
    });
  });

  test('el formulario de consentimiento NO tiene flujo de corrección (solo certificados)', async ({ page }) => {
    await page.goto('/publico/login.html');
    await page.fill('#email', 'donante@hemored.com');
    await page.fill('#password', 'donante123');
    await page.click('button:has-text("Iniciar sesión")');
    await page.goto('/donante/mis_documentos.html');
    await page.locator('.tab', { hasText: 'Consentimientos' }).click();
    await page.locator('#lista-consentimientos .doc-card').first().click();
    await expect(page.locator('#consentimiento-contenido button:has-text("Reportar dato incorrecto")')).toHaveCount(0);
  });

});
