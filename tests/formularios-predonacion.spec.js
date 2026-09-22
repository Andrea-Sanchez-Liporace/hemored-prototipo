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
 * - Las 34 preguntas del cuestionario médico NO vienen con ningún valor
 *   pre-seleccionado (corregido 2026-09-15, a pedido explícito de la
 *   usuaria) — el donante tiene que contestar cada una para poder enviar.
 *   Una vez enviado el cuestionario, queda en modo solo-lectura: el donante
 *   puede volver a verlo pero no volver a tocarlo. La única forma de
 *   corregir una respuesta ya enviada es que el profesional de salud la
 *   actualice durante la revisión presencial previa a la donación (ese
 *   flujo, del lado Profesional de salud, todavía no existe).
 *
 * Qué prueba este archivo: que el turno real se carga desde la URL
 * (?turno_id=), que el cuestionario exige las 34 respuestas antes de
 * habilitar el envío, que las respuestas y ambas firmas se persisten de
 * verdad, que "Mis turnos" refleja el estado completado, y que al reentrar
 * al mismo turno el cuestionario queda congelado (solo lectura).
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

// Contesta las 34 preguntas del cuestionario médico, todas "No" salvo las
// claves que se pasen en `excepciones` (ej. { info_escrita_autoexclusion: 'Sí' }).
// Hace falta contestarlas todas para que se habilite "Confirmar y enviar
// formularios" — ya no hay ningún valor por default. Ojo: cualquier "Sí" en
// una pregunta que NO sea de comprensión del proceso (ver más abajo) ahora
// autoexcluye al donante y bloquea el envío — para un camino feliz que
// llegue a enviar, no pasar ninguna excepción en "Sí" salvo esas dos.
async function responderCuestionario(page, excepciones = {}) {
  const items = page.locator('.excl-item');
  const total = await items.count();
  for (let i = 0; i < total; i++) {
    const item = items.nth(i);
    const key = await item.getAttribute('data-key');
    const val = excepciones[key] || 'No';
    await item.locator('.excl-btn', { hasText: val }).click();
  }
}

test.describe('Formularios pre-donación (F1 + F2)', () => {

  test('completar F1 y F2 persiste ambas firmas, las respuestas y actualiza el turno', async ({ page }) => {
    let urlFormulario;

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
      urlFormulario = page.url();

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

    await test.step('Paso 2 (cuestionario): arranca sin nada marcado y exige las 34 respuestas antes de habilitar el envío', async () => {
      await expect(page.locator('#btn-paso2')).toBeDisabled();
      // Ninguna pregunta viene con un botón ya seleccionado al cargar.
      await expect(page.locator('.excl-btn.sel-si, .excl-btn.sel-no')).toHaveCount(0);

      // info_escrita_autoexclusion/comprendio_autoexclusion son preguntas de
      // comprensión del proceso, no de factor de riesgo: ahí "Sí" es la
      // respuesta esperada (al revés que el resto) — sin esto, el helper
      // las dejaría en "No" por default y el donante quedaría marcado como
      // autoexcluido antes de llegar a firmar. El resto queda en "No"
      // (ninguna respuesta de riesgo en "Sí") a propósito: desde que una
      // respuesta inhabilitante bloquea el envío (agregado 2026-09-22, ver
      // el test dedicado más abajo), este camino feliz tiene que terminar
      // sin ninguna, para poder llegar hasta enviar de verdad.
      await responderCuestionario(page, {
        info_escrita_autoexclusion: 'Sí',
        comprendio_autoexclusion: 'Sí',
      });
      await expect(page.locator('.excl-item[data-key="info_escrita_autoexclusion"] .excl-btn.sel-si')).toHaveText('Sí');
      await expect(page.locator('.excl-item[data-key="cancer"] .excl-btn.sel-no')).toHaveText('No');
      await page.fill('#input-observaciones', 'Nota de prueba E2E.');

      // Contestadas las 34, todavía falta firmar F2.
      await expect(page.locator('#btn-paso2')).toBeDisabled();
    });

    await test.step('firmar y confirmar: avanza a la pantalla de éxito', async () => {
      await firmar(page, '#sig-f2');
      await expect(page.locator('#f2-sig-st')).toHaveText('✓ Firmado');
      await expect(page.locator('#btn-paso2')).toBeEnabled();
      await page.click('#btn-paso2');
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
      // mirar la UI, confirma que se guardaron las 34 respuestas, ambas
      // firmas como imágenes reales, y que donacion_id quedó en null (la
      // donación todavía no existe).
      const overrides = await page.evaluate(() => JSON.parse(localStorage.getItem('hemored_overrides') || '{}'));
      const lista = overrides.formulario_consentimiento || [];
      const formulario = lista[lista.length - 1]; // _persistir() guarda la tabla completa, no un delta

      expect(formulario.donacion_id).toBeNull();
      expect(formulario.autoexclusion_completado_por).toBe('donante');
      expect(formulario.cuestionario_completado_por).toBe('donante');
      expect(formulario.firma_donante_autoexclusion_url).toMatch(/^data:image/);
      expect(formulario.firma_donante_cuestionario_url).toMatch(/^data:image/);
      expect(formulario.observaciones).toBe('Nota de prueba E2E.');
      expect(formulario.respuestas_cuestionario.info_escrita_autoexclusion).toBe('si');
      expect(formulario.respuestas_cuestionario.cancer).toBe('no');
      expect(Object.keys(formulario.respuestas_cuestionario).length).toBe(34);

      const turno = (overrides.turnos || []).find(t => t.id === formulario.turno_id);
      expect(turno.formulario_autoexclusion_completado).toBe(true);
      expect(turno.formulario_cuestionario_completado).toBe(true);
    });

    await test.step('volver a entrar al mismo turno restaura lo ya completado, en solo lectura (no se puede regrabar)', async () => {
      await page.goto(urlFormulario);
      await page.waitForTimeout(300);

      await expect(page.locator('#input-observaciones')).toHaveValue('Nota de prueba E2E.');
      await expect(page.locator('#input-observaciones')).toHaveAttribute('readonly', '');
      await expect(page.locator('#check1')).toBeChecked();
      await expect(page.locator('#check1')).toBeDisabled();
      await expect(page.locator('#check2')).toBeDisabled();
      await expect(page.locator('#check3')).toBeDisabled();
      await expect(page.locator('.excl-item[data-key="info_escrita_autoexclusion"] .excl-btn.sel-si')).toHaveText('Sí');
      await expect(page.locator('.excl-item[data-key="cancer"] .excl-btn.sel-no')).toHaveText('No');
      await expect(page.locator('#f1-sig-st')).toHaveText('✓ Firmado');
      // El botón solo se habilita si pads['sig-f1'].isEmpty() da false — confirma
      // que fromDataURL() no solo dibujó la imagen sino que actualizó el estado
      // interno del SignaturePad, no únicamente la apariencia visual.
      await expect(page.locator('#btn-paso1')).toBeEnabled();

      await page.click('#btn-paso1');
      await expect(page.locator('#f2-sig-st')).toHaveText('✓ Firmado');

      // Intentar tocar una respuesta ya enviada no hace nada: excl() corta
      // apenas detecta soloLectura.
      await page.locator('.excl-item[data-key="cancer"] .excl-btn', { hasText: 'Sí' }).click();
      await expect(page.locator('.excl-item[data-key="cancer"] .excl-btn.sel-no')).toHaveText('No');

      // El cuestionario queda congelado: el aviso de solo lectura está
      // visible y "Confirmar y enviar formularios" ya no se puede usar.
      await expect(page.locator('#aviso-solo-lectura')).toBeVisible();
      await expect(page.locator('#btn-paso2')).toBeDisabled();
      await expect(page.locator('#btn-paso2')).toContainText('Cuestionario ya enviado');
      await expect(page.locator('.btn-limpiar').first()).toBeDisabled();

      // No se creó ni se pisó ningún registro nuevo: sigue habiendo uno solo
      // para este turno.
      const overridesTrasReingreso = await page.evaluate(() => JSON.parse(localStorage.getItem('hemored_overrides') || '{}'));
      const turnoId = Number(new URL(page.url()).searchParams.get('turno_id'));
      const paraEsteTurno = overridesTrasReingreso.formulario_consentimiento.filter(f => f.turno_id === turnoId);
      expect(paraEsteTurno.length).toBe(1);
    });
  });

  // Agregado 2026-09-22, a pedido de la usuaria: hasta ahora el cuestionario
  // dejaba enviar igual aunque una respuesta autoexcluyera al donante — la
  // enviaba, y recién el profesional se enteraba en la revisión presencial
  // del día del turno. Ahora, apenas se marca una respuesta inhabilitante,
  // se bloquea el envío y se ofrece cancelar el turno directamente ahí.
  //
  // De paso, se corrigió un bug real de color: las 2 preguntas de
  // "Comprensión de la información" (¿le dieron la información escrita?,
  // ¿la entendió?) son preguntas de PROCESO, no de factor de riesgo — ahí
  // "Sí" es la respuesta esperada. Antes usaban el mismo criterio que el
  // resto del cuestionario (Sí=rojo/riesgo), así que contestar "Sí" —lo
  // correcto— se marcaba en rojo como si fuera un problema.
  test('F2: una respuesta inhabilitante bloquea el envío y ofrece cancelar el turno', async ({ page }) => {
    let turnoId;

    await test.step('registrar un donante, reservar un turno, y completar F1', async () => {
      await page.goto('/publico/registro.html');
      await page.click('text=Soy donante');
      await page.fill('#d-nombre', 'Rocío');
      await page.fill('#d-apellido', 'Testigo');
      await page.fill('#d-email', `donante.f2inhab.${Date.now()}@example.com`);
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

      await page.goto('/donante/mis_turnos.html');
      await page.click('button:has-text("Completar formularios")');
      await page.waitForURL('**/formularios_predonacion.html?turno_id=**');
      turnoId = Number(new URL(page.url()).searchParams.get('turno_id'));

      // Espera a que cargarFormulario() termine (banner con el hospital real)
      // antes de tocar nada — si no, el checkeo/firma puede ganarle a
      // initPad('sig-f1') y la firma queda dibujada en un canvas todavía sin
      // SignaturePad enganchado.
      await expect(page.locator('#banner-hospital')).toHaveText('Hospital Ramos Mejía');

      await page.check('#check1');
      await page.check('#check2');
      await page.check('#check3');
      await firmar(page, '#sig-f1');
      await page.click('#btn-paso1');
    });

    await test.step('contestar "Sí" en las 2 preguntas de comprensión: quedan en VERDE (son la respuesta esperada), no bloquean nada', async () => {
      const info = page.locator('.excl-item[data-key="info_escrita_autoexclusion"]');
      const comprendio = page.locator('.excl-item[data-key="comprendio_autoexclusion"]');
      await info.locator('.excl-btn', { hasText: 'Sí' }).click();
      await comprendio.locator('.excl-btn', { hasText: 'Sí' }).click();

      await expect(info.locator('.excl-btn.sel-si')).toHaveCSS('color', 'rgb(39, 174, 96)'); // verde, no rojo
      await expect(page.locator('#f2-aviso-inhabilitante')).toBeHidden();
      await expect(page.locator('#btn-cancelar-turno-f2')).toBeHidden();
    });

    await test.step('contestar "No" en esa misma pregunta: queda en ROJO y bloquea el envío', async () => {
      const info = page.locator('.excl-item[data-key="info_escrita_autoexclusion"]');
      await info.locator('.excl-btn', { hasText: 'No' }).click();

      await expect(info.locator('.excl-btn.sel-no')).toHaveCSS('color', 'rgb(192, 57, 43)'); // rojo
      await expect(page.locator('#f2-aviso-inhabilitante')).toBeVisible();
      await expect(page.locator('#f2-aviso-inhabilitante')).toContainText('autoexcluye');
      await expect(page.locator('#btn-paso2')).toBeHidden();
      await expect(page.locator('#btn-cancelar-turno-f2')).toBeVisible();
    });

    await test.step('corregir la respuesta: el bloqueo se saca solo, sin recargar la página', async () => {
      const info = page.locator('.excl-item[data-key="info_escrita_autoexclusion"]');
      await info.locator('.excl-btn', { hasText: 'Sí' }).click();

      await expect(page.locator('#f2-aviso-inhabilitante')).toBeHidden();
      await expect(page.locator('#btn-cancelar-turno-f2')).toBeHidden();
      await expect(page.locator('#btn-paso2')).toBeVisible();
    });

    await test.step('una respuesta de riesgo normal (ej. "Sí" a una condición médica excluyente) también bloquea, con el mismo criterio de siempre', async () => {
      const cancer = page.locator('.excl-item[data-key="cancer"]');
      await cancer.locator('.excl-btn', { hasText: 'Sí' }).click();
      await expect(page.locator('#f2-aviso-inhabilitante')).toBeVisible();
      await expect(page.locator('#btn-cancelar-turno-f2')).toBeVisible();
    });

    await test.step('cancelar el turno desde ahí lo cancela de verdad y saca al donante de la pantalla', async () => {
      page.once('dialog', dialog => dialog.accept());
      await page.click('#btn-cancelar-turno-f2');
      await page.waitForURL('**/mis_turnos.html');

      const overrides = await page.evaluate(() => JSON.parse(localStorage.getItem('hemored_overrides') || '{}'));
      const turno = (overrides.turnos || []).find(t => t.id === turnoId);
      expect(turno.estado).toBe('cancelado');
    });
  });

});
