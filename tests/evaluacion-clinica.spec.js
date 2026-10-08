/**
 * Test E2E de la "Entrevista clínica" del médico clínico
 * (`profesional/dashboard.html`, modal "Atención clínica" recortado a
 * F1→F3), agregado 2026-10-08 — cierra el hallazgo de dominio documentado
 * en la memoria del proyecto: "Profesional de salud" no es un solo perfil,
 * son 2 con facultades distintas (médico clínico vs. enfermero/extractor).
 *
 * El médico revisa F1/F2 (ya completados por el donante, con posibilidad
 * de corregir una respuesta) y carga un F3 nuevo (evaluación clínica:
 * signos vitales + decisión apto/no apto + firma) — es el gate real del
 * camino feliz: "no apto" corta el turno ahí mismo, nunca llega al
 * enfermero/extractor ni genera una donación.
 *
 * Bug real encontrado armando este test, no de esta tarea sino
 * preexistente: a `#f2-items` (dentro del modal "Atención clínica") le
 * faltaba su `</div>` de cierre — F3/F4/f-ok terminaban anidados DENTRO
 * de F2 (oculto, `display:none`), así que `goF(3)` nunca llegaba a
 * mostrarse aunque le pusiera `display:block` a un `#f3` que en realidad
 * era descendiente de un ancestro escondido. Nunca se había notado porque
 * nada de ese modal estaba conectado hasta ahora. Corregido agregando el
 * `</div>` que faltaba.
 *
 * Segundo bug real encontrado, también preexistente: el canvas de firma
 * de F3 (`initPads()`) se inicializa una sola vez, 150ms después de
 * entrar al paso — pero elegir "No apto" revela el bloque "Motivo" debajo
 * de la decisión, empujando la firma más abajo. El tamaño en píxeles ya
 * quedado fijado antes de ese corrimiento quedaba desalineado con la
 * posición real, y firmar no dejaba ningún trazo. Corregido: `setApto()`
 * fuerza un reinicio del pad (sigue vacío en ese punto del flujo, no se
 * pierde nada real).
 */

const { test, expect } = require('@playwright/test');

async function firmar(page, canvasSelector) {
  const canvas = page.locator(canvasSelector);
  // scrollIntoView explícito (no el scrollIntoViewIfNeeded de Playwright):
  // el canvas vive dentro del scroll interno del modal (`#modal-inner`,
  // `overflow-y:auto`), y con contenido largo arriba (ej. el bloque
  // "Motivo" del camino "no apto") puede quedar fuera del área ya
  // visible sin que Playwright lo note solo.
  await page.evaluate((sel) => document.querySelector(sel).scrollIntoView({ block: 'center' }), canvasSelector);
  await page.waitForTimeout(100);
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + 20, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.4);
  await page.mouse.up();
}

async function loginProfesional(page, email, password) {
  await page.goto('/publico/login.html');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('.form-btn');
  await page.waitForURL('**/profesional/dashboard.html');
  await page.waitForFunction(() => window._turnosProfesional && window._turnosProfesional.length > 0);
}

test.describe('Entrevista clínica (médico clínico)', () => {

  test('camino apto: el médico evalúa, el enfermero recién ahí puede registrar la donación', async ({ page }) => {
    await loginProfesional(page, 'profesional@hemored.com', 'prof123');

    const fila = page.locator('.turno-card', { hasText: 'Ana Rodríguez' }).filter({ hasText: 'Esperando evaluación médica' });
    await expect(fila).toBeVisible();
    await fila.locator('button:has-text("Iniciar entrevista")').click();
    await expect(page.locator('#modal')).toHaveClass(/active/);

    await test.step('F1 se muestra como resumen de solo lectura (sin respuestas item por item guardadas)', async () => {
      await expect(page.locator('#f1-revision-resumen')).toBeVisible();
      await expect(page.locator('#f1-form-interactivo')).toBeHidden();
      await page.click('#f1 button:has-text("Siguiente")');
    });

    await test.step('F2 muestra las 34 respuestas reales del donante, no un cuestionario vacío', async () => {
      const items = page.locator('#f2-items .excl-item');
      await expect(items).toHaveCount(34);
      // La primera pregunta es "invertida" (Sí es la respuesta esperada) —
      // tiene que venir precargada con lo que el donante respondió de verdad.
      await expect(items.first().locator('.excl-btn.sel-si, .excl-btn.sel-no')).toHaveCount(1);
      await page.click('#f2 button:has-text("Siguiente")');
    });

    await test.step('F3: signos vitales + decisión "apto" + firma', async () => {
      await page.fill('#f3-presion', '120/80');
      await page.fill('#f3-frecuencia', '72');
      await page.fill('#f3-temperatura', '36.5');
      await page.fill('#f3-glucosa', '90');
      await page.fill('#f3-peso', '70');
      await page.fill('#f3-hemoglobina', '13.5');
      await page.click('#f3-apto');
      await expect(page.locator('#f3-motivo')).toBeHidden();
      await firmar(page, '#sig-f3');
      await page.click('#f3-btn-sig');
      await expect(page.locator('.toast')).toContainText('apto para donar');
    });

    await test.step('para el médico, el turno queda "apto, esperando extracción" (sin acción propia)', async () => {
      const filaDespues = page.locator('.turno-card', { hasText: 'Ana Rodríguez' }).filter({ hasText: '11:00' });
      await expect(filaDespues).toContainText('Apto — esperando extracción');
    });

    await test.step('recién ahí el enfermero ve "Registrar donación" para ese turno', async () => {
      await page.click('text=Cerrar sesión');
      await loginProfesional(page, 'enfermera@hemored.com', 'enf123');
      const filaEnfermera = page.locator('.turno-card', { hasText: 'Ana Rodríguez' }).filter({ hasText: '11:00' });
      await expect(filaEnfermera.locator('button:has-text("Registrar donación")')).toBeVisible();
    });
  });

  test('camino no apto: corta el turno antes de la extracción', async ({ page }) => {
    await loginProfesional(page, 'profesional@hemored.com', 'prof123');

    const fila = page.locator('.turno-card', { hasText: 'Roberto Fernández' }).filter({ hasText: '10:00' });
    await expect(fila).toBeVisible();
    await expect(fila).toContainText('Esperando evaluación médica');
    await fila.locator('button:has-text("Iniciar entrevista")').click();
    await page.click('#f1 button:has-text("Siguiente")');
    await page.click('#f2 button:has-text("Siguiente")');

    await page.click('#f3-no');
    await expect(page.locator('#f3-motivo')).toBeVisible();
    await page.selectOption('#f3-motivo-select', { label: 'Presión arterial fuera de rango' });
    await firmar(page, '#sig-f3');
    await page.click('#f3-btn-sig');
    await expect(page.locator('.toast')).toContainText('no apto');

    await test.step('el turno queda "No apto", terminal — ya no es accionable', async () => {
      const filaDespues = page.locator('.turno-card', { hasText: 'Roberto Fernández' }).filter({ hasText: '10:00' });
      await expect(filaDespues).toContainText('No apto');
      await filaDespues.locator('button:has-text("Ver evaluación")').click();
      await expect(page.locator('#modal-ver-registro')).toBeVisible();
      await expect(page.locator('#ver-registro-body')).toContainText('Presión arterial fuera de rango');
    });

    await test.step('el enfermero no ve ninguna acción para este turno (no llega a él)', async () => {
      await page.click('#modal-ver-registro button:has-text("Cerrar")');
      await page.click('text=Cerrar sesión');
      await loginProfesional(page, 'enfermera@hemored.com', 'enf123');
      const filaEnfermera = page.locator('.turno-card', { hasText: 'Roberto Fernández' }).filter({ hasText: '10:00' });
      await expect(filaEnfermera).toContainText('No apto');
      await expect(filaEnfermera.locator('button:has-text("Registrar donación")')).toHaveCount(0);
    });
  });

  test('el médico puede corregir una respuesta del cuestionario durante la entrevista', async ({ page }) => {
    await loginProfesional(page, 'profesional@hemored.com', 'prof123');

    const fila = page.locator('.turno-card', { hasText: 'Sofía Páez' }).filter({ hasText: 'Esperando evaluación médica' });
    await fila.locator('button:has-text("Iniciar entrevista")').click();
    await page.click('#f1 button:has-text("Siguiente")');

    await expect(page.locator('#f2-bmod')).toBeVisible();
    await page.click('#f2-bmod');
    await expect(page.locator('#f2-av-mod')).toBeVisible();

    // Cambia la primera respuesta (una pregunta "invertida": estaba en Sí,
    // la pasa a No) para confirmar que el click queda habilitado de verdad
    // en modo edición, no solo visualmente.
    const primerItem = page.locator('#f2-items .excl-item').first();
    await primerItem.locator('.excl-btn', { hasText: 'No' }).click();
    await expect(primerItem.locator('.excl-btn.sel-no')).toBeVisible();

    await page.click('#f2 button:has-text("Siguiente")');
    await page.click('#f3-apto');
    await firmar(page, '#sig-f3');
    await page.click('#f3-btn-sig');
    await expect(page.locator('.toast')).toContainText('apto para donar');

    const formulario = await page.evaluate(() => {
      const ev = HemoRed.db.all('evaluacion_clinica').filter(e => e.usuario_id === 1).pop();
      return HemoRed.db.where('formulario_consentimiento', 'turno_id', ev.turno_id)[0];
    });
    expect(formulario.cuestionario_modificado_por_profesional).toBe(true);
    expect(formulario.respuestas_cuestionario.info_escrita_autoexclusion).toBe('no');
  });

});
