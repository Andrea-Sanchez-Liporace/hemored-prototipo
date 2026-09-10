/**
 * Test E2E de "Registrar donación" (Hospital, `hospital/turnos.html`) y del
 * formulario post-donación anónimo F4 (`donante/postdonacion_anonimo.html`)
 * que ese registro dispara — son un solo flujo de punta a punta, no dos.
 *
 * Contexto importante:
 * - Antes de esto, `registrarDonacion()` no existía: el botón "Confirmar
 *   donación" del modal llamaba a la misma función que "Cancelar", y el
 *   modal ni siquiera leía los campos. El botón "Registrar donación"
 *   aparecía además con un criterio incorrecto (`turno.estado ===
 *   'completado'` — el estado AL QUE se llega después de registrar, no
 *   antes). Ahora aparece cuando el turno está `confirmado` y el donante ya
 *   completó los 2 formularios pre-donación (F1/F2), y solo si todavía no
 *   existe una donación para ese turno.
 * - Al registrar la donación se genera un token de un solo uso para F4 y se
 *   entrega por 2 canales, cada uno apropiado a su contexto (decisión
 *   explícita de la usuaria, ver docs/04): un QR en la pantalla del
 *   profesional (para que el donante lo escanee con SU celular antes de
 *   irse — dos dispositivos distintos, tiene sentido un QR) y una
 *   notificación in-app con el link directo (mismo dispositivo, un QR ahí
 *   no serviría). NO se manda ningún mail real — el prototipo no tiene
 *   backend, no se simula un envío que nunca pasaría de verdad.
 * - F4 es la única función de escritura del rol Donante que debe funcionar
 *   SIN sesión (por diseño de anonimato: `formulario_postdonacion` se ancla
 *   a `numero_bolsa`, nunca a `usuario_id`) — se prueba explícitamente
 *   completándolo desde un contexto de navegador nuevo, sin login.
 */

const { test, expect } = require('@playwright/test');

const timestamp = Date.now();
const donanteEmail = `donante.f4.${timestamp}@example.com`;
const donantePassword = 'password123';
const donanteNombre = 'Rocío';
const donanteApellido = 'Testigo';

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

test.describe('Registrar donación (Hospital) + formulario post-donación anónimo (F4)', () => {

  test('camino completo: registrar/reservar/confirmar → F1/F2 → registrar donación → F4 anónimo', async ({ page }) => {
    await test.step('donante nuevo se registra y reserva un turno para hoy', async () => {
      await page.goto('/publico/registro.html');
      await page.click('text=Soy donante');
      await page.fill('#d-nombre', donanteNombre);
      await page.fill('#d-apellido', donanteApellido);
      await page.fill('#d-email', donanteEmail);
      await page.fill('#d-tel', '11-4321-8765');
      await page.fill('#d-pass', donantePassword);
      await page.fill('#d-pass2', donantePassword);
      await page.click('#btn-crear-cuenta-donante');
      await page.waitForURL('**/donante/dashboard.html');

      await page.locator('.campaign-btn').first().click();
      await page.waitForURL('**/campana_detalle.html**');
      await page.click('#btn-reservar');
      // No tocamos las fecha-tabs: la primera (índice 0) es HOY por default,
      // necesario para que el turno aparezca en "Gestión de turnos" del hospital.
      await page.locator('.turno-opt[data-hora]').first().waitFor();
      await page.locator('.turno-opt[data-hora]').first().click();
      await page.click('#btn-continuar');
      await page.click('#btn-confirmar-reserva');
      await expect(page.locator('#paso-4')).toHaveClass(/active/);
    });

    await test.step('el hospital confirma el turno', async () => {
      await page.goto('/publico/login.html');
      await page.fill('#email', 'hospital@hemored.com');
      await page.fill('#password', 'hospital123');
      await page.click('.form-btn');
      await page.waitForURL('**/hospital/dashboard.html');
      await page.goto('/hospital/turnos.html');

      const fila = page.locator('.turno-row', { hasText: `${donanteNombre} ${donanteApellido}` });
      await expect(fila).toBeVisible();
      await expect(fila.locator('.turno-actions')).not.toContainText('Registrar donación'); // todavía sin F1/F2
      await fila.locator('button:has-text("Confirmar")').click();
      await expect(fila.locator('.turno-badge')).toHaveText('Confirmado');
      await expect(fila.locator('.turno-actions')).not.toContainText('Registrar donación'); // confirmado, pero F1/F2 sin completar
    });

    let urlFormulario;
    await test.step('el donante completa F1/F2 (pre-donación)', async () => {
      await page.goto('/publico/login.html');
      await page.fill('#email', donanteEmail);
      await page.fill('#password', donantePassword);
      await page.click('.form-btn');
      await page.waitForURL('**/donante/dashboard.html');

      await page.goto('/donante/mis_turnos.html');
      await page.click('button:has-text("Completar formularios")');
      await page.waitForURL('**/formularios_predonacion.html?turno_id=**');
      urlFormulario = page.url();

      await page.check('#check1');
      await page.check('#check2');
      await page.check('#check3');
      await firmar(page, '#sig-f1');
      await page.click('#btn-paso1');
      await expect(page.locator('#step-2')).toHaveClass(/active/);
      // irPaso(2) inicializa el SignaturePad de F2 en un setTimeout(150ms)
      // propio de la página (formularios_predonacion.html) — sin esta espera,
      // el mouse dibuja sobre un canvas que todavía no tiene el pad enganchado.
      await page.waitForTimeout(250);

      await firmar(page, '#sig-f2');
      await page.click('button:has-text("Confirmar y enviar formularios")');
      await expect(page.locator('#step-3')).toHaveClass(/active/);
    });

    await test.step('ahora sí aparece "Registrar donación" del lado del hospital', async () => {
      await page.goto('/publico/login.html');
      await page.fill('#email', 'hospital@hemored.com');
      await page.fill('#password', 'hospital123');
      await page.click('.form-btn');
      await page.waitForURL('**/hospital/dashboard.html');
      await page.goto('/hospital/turnos.html');

      const fila = page.locator('.turno-row', { hasText: `${donanteNombre} ${donanteApellido}` });
      await fila.locator('button:has-text("Registrar donación")').click();
      await expect(page.locator('#modal-donacion')).toBeVisible();
      await expect(page.locator('#modal-donacion-info-turno')).toContainText(`${donanteNombre} ${donanteApellido}`);
    });

    await test.step('el select de profesionales trae datos reales (no los 4 nombres hardcodeados de antes)', async () => {
      const opciones = await page.locator('#donacion-profesional option').allTextContents();
      expect(opciones).toContain('Dr. Carlos Méndez');
      expect(opciones).not.toContain('Dra. Ana Rodríguez'); // no existe en profesionales.json, era un nombre inventado
    });

    await test.step('confirmar sin elegir profesional se rechaza', async () => {
      await page.click('button:has-text("Confirmar donación")');
      await expect(page.locator('.toast')).toContainText('Seleccioná el profesional');
    });

    await test.step('completar y confirmar registra la donación y muestra el QR', async () => {
      await page.selectOption('#donacion-profesional', { label: 'Dr. Carlos Méndez' });
      await page.click('button:has-text("Confirmar donación")');
      await expect(page.locator('.toast')).toContainText('Donación registrada');
      await expect(page.locator('#modal-donacion-exito')).toBeVisible();
      await expect(page.locator('#donacion-qr img')).toBeVisible(); // qrcode-generator renderiza un <img>
    });

    await test.step('los datos quedaron guardados de verdad', async () => {
      const datos = await page.evaluate(() => {
        const donante = HemoRed.db.all('usuarios').find(u => u.email && u.email.toLowerCase().includes('donante.f4.'));
        const donacion = HemoRed.db.all('donaciones').find(d => d.usuario_id === donante.id);
        const turno = HemoRed.db.find('turnos', donacion.turno_id);
        const f4 = HemoRed.db.all('formulario_postdonacion').find(f => f.numero_bolsa === donacion.numero_bolsa);
        return { donacion, turnoEstado: turno.estado, f4 };
      });
      expect(datos.donacion.numero_bolsa).toMatch(/^BLS-2026-\d{4}$/);
      expect(datos.donacion.volumen_ml).toBe(450);
      expect(datos.donacion.resultado_apto).toBe(true);
      expect(datos.donacion.profesional_id).toBe(1);
      expect(datos.turnoEstado).toBe('completado');
      expect(datos.f4.token).toMatch(/^[A-Z0-9]{6}$/);
      expect(datos.f4.token_usado).toBe(false);
    });

    await test.step('cerrar el modal refresca la fila: ya no ofrece registrar de nuevo', async () => {
      await page.click('#modal-donacion-exito button:has-text("Listo")');
      const fila = page.locator('.turno-row', { hasText: `${donanteNombre} ${donanteApellido}` });
      await expect(fila.locator('.turno-badge')).toHaveText('Donación realizada');
      await expect(fila.locator('.turno-actions')).not.toContainText('Registrar donación');
    });

    await test.step('intentar registrar la misma donación dos veces se rechaza (defensa además de ocultar el botón)', async () => {
      // El turno ya pasó a "completado" al registrar la primera vez, así que
      // el segundo intento se frena por ese chequeo (no llega ni a evaluar
      // si ya existe una donación — el propio cambio de estado ya lo evita).
      const resultado = await page.evaluate(() => {
        const donante = HemoRed.db.all('usuarios').find(u => u.email && u.email.toLowerCase().includes('donante.f4.'));
        const donacion = HemoRed.db.all('donaciones').find(d => d.usuario_id === donante.id);
        return HemoRed.data.registrarDonacion(donacion.turno_id, { profesionalId: 1, volumenMl: 450 });
      });
      expect(resultado.ok).toBe(false);
      expect(resultado.error).toContain('no está en condiciones');
    });

    let tokenF4;
    await test.step('el donante recibe la notificación in-app con el link real (no un QR)', async () => {
      await page.goto('/publico/login.html');
      await page.fill('#email', donanteEmail);
      await page.fill('#password', donantePassword);
      await page.click('.form-btn');
      await page.waitForURL('**/donante/dashboard.html');
      await page.goto('/donante/notificaciones.html');

      const notif = page.locator('.notif-item', { hasText: 'Completá tu formulario post-donación' });
      await expect(notif).toBeVisible();
      const accionHref = await notif.locator('.notif-action').getAttribute('onclick');
      const match = accionHref.match(/token=([A-Z0-9]+)/);
      expect(match).toBeTruthy();
      tokenF4 = match[1];
    });

    await test.step('F4 funciona sin sesión: se completa después de borrar la sesión activa', async () => {
      // No hace falta un contexto de navegador aparte para probar "sin
      // sesión" — alcanza con borrar `hemored_sesion` (sessionStorage) antes
      // de entrar: HemoRed.sesion.get() va a devolver null, igual que a un
      // visitante anónimo, sin perder el localStorage compartido con el
      // resto del test (necesario para verificar la persistencia después).
      await page.evaluate(() => sessionStorage.clear());
      await page.goto(`/donante/postdonacion_anonimo.html?token=${tokenF4}`);

      const sesion = await page.evaluate(() => HemoRed.sesion.get());
      expect(sesion).toBeNull();
      await expect(page.locator('#token-display')).not.toHaveText('A7 · 4K · 9M'); // ya no es el placeholder fijo
      await expect(page.locator('#error-view')).toBeHidden();

      await expect(page.locator('#btn-enviar')).toBeDisabled();
      await page.click('#opt-si');
      await expect(page.locator('#btn-enviar')).toBeEnabled();
      await page.click('#btn-enviar');
      await expect(page.locator('.success-view')).toBeVisible();
    });

    await test.step('la respuesta quedó guardada, y el token ya no se puede reusar', async () => {
      const resultado = await page.evaluate((token) => HemoRed.data.validarTokenPostdonacion(token), tokenF4);
      expect(resultado.ok).toBe(false);
      expect(resultado.error).toContain('ya fue completado');

      const f4 = await page.evaluate((token) => HemoRed.db.all('formulario_postdonacion').find(f => f.token === token), tokenF4);
      expect(f4.usar_para_transfusion).toBe(true);
      expect(f4.token_usado).toBe(true);
    });
  });

  test('token inexistente, ya usado o vencido: cada caso muestra su propio error, sin necesitar sesión', async ({ page }) => {
    await page.goto('/publico/login.html'); // solo para tener HemoRed.db cargado antes del evaluate
    await page.evaluate(async () => { await HemoRed.db.init(); });

    await test.step('token que no existe', async () => {
      await page.goto('/donante/postdonacion_anonimo.html?token=ZZZZZZ');
      await expect(page.locator('#error-view')).toBeVisible();
      await expect(page.locator('#error-mensaje')).toContainText('no es válido');
      await expect(page.locator('#form-body')).toBeHidden();
    });

    await test.step('token ya usado', async () => {
      await page.evaluate(async () => {
        await HemoRed.db.init();
        HemoRed.db.crear('formulario_postdonacion', {
          numero_bolsa: 'BLS-TEST-USADO', token: 'USADOX',
          token_expira_en: new Date(Date.now() + 3600000).toISOString(),
          token_usado: true, usar_para_transfusion: true, motivo_descarte: null,
          completado_en: new Date().toISOString(),
        });
      });
      await page.goto('/donante/postdonacion_anonimo.html?token=USADOX');
      await expect(page.locator('#error-mensaje')).toContainText('ya fue completado');
    });

    await test.step('token vencido', async () => {
      await page.evaluate(async () => {
        await HemoRed.db.init();
        HemoRed.db.crear('formulario_postdonacion', {
          numero_bolsa: 'BLS-TEST-VENCIDO', token: 'VENCID1',
          token_expira_en: new Date(Date.now() - 3600000).toISOString(), // ya venció
          token_usado: false, usar_para_transfusion: null, motivo_descarte: null,
          completado_en: null,
        });
      });
      await page.goto('/donante/postdonacion_anonimo.html?token=VENCID1');
      await expect(page.locator('#error-mensaje')).toContainText('venció');
    });
  });

});
