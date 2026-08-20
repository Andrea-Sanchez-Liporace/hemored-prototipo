/**
 * Test E2E ("end-to-end", de punta a punta) del camino feliz principal de HemoRed.
 *
 * ¿Qué es un test E2E? A diferencia de un test unitario (que prueba UNA función
 * aislada), este test simula a una persona real usando la página en un navegador:
 * abre la URL, completa formularios, hace click en botones, y verifica que lo
 * que aparece en pantalla sea lo esperado. Prueba el sistema completo tal como
 * lo usaría un usuario, no partes sueltas de código.
 *
 * ¿Por qué existe este archivo? Porque el prototipo no tiene backend: "guardar
 * un turno" significa escribir en `localStorage` del navegador (ver
 * frontend/js/db.js, funciones crear()/actualizar()). Eso solo se puede
 * verificar corriendo la página de verdad en un navegador — leyendo el código
 * no alcanza para confirmar que un botón realmente hace lo que dice hacer.
 *
 * Qué camino recorre (ver docs/04-estado-actual-prototipo.md para el detalle
 * de qué funciona hoy y qué no):
 *   1. Un donante nuevo se registra (publico/registro.html)
 *   2. Ve campañas reales en su dashboard (donante/dashboard.html)
 *   3. Reserva un turno en una campaña (donante/campana_detalle.html)
 *   4. El hospital ve ese turno como "Pendiente" (hospital/turnos.html)
 *   5. El hospital lo confirma
 *   6. El donante, al volver a loguearse, ve el turno "Confirmado" en
 *      donante/mis_turnos.html
 *
 * Cómo correrlo: ver README.md en esta misma carpeta.
 */

const { test, expect } = require('@playwright/test');

// Cada corrida usa un email distinto (basado en la hora actual) para no
// chocar con un usuario ya registrado en una corrida anterior — recordá que
// el "registro de usuario ya existe" es una validación real que agregamos
// (ver HemoRed.sesion.registrarDonante en frontend/js/sesion.js), así que
// si reusáramos el mismo email, el test fallaría en el paso de registro.
const timestamp = Date.now();
const donanteEmail = `donante.qa.${timestamp}@example.com`;
const donantePassword = 'password123';
const donanteNombre = 'Marina';
const donanteApellido = 'Testigo';

test.describe('Camino feliz: registro → reserva de turno → confirmación', () => {

  test('un donante nuevo puede registrarse, reservar un turno y verlo confirmado', async ({ page }) => {

    await test.step('1. Registro de donante nuevo', async () => {
      await page.goto('/publico/registro.html');

      // El formulario de registro tiene dos "pasos" (donante / hospital) que
      // se muestran/ocultan con JS al elegir un rol — no son páginas distintas.
      await page.click('text=Soy donante');

      await page.fill('#d-nombre', donanteNombre);
      await page.fill('#d-apellido', donanteApellido);
      await page.fill('#d-email', donanteEmail);
      await page.fill('#d-tel', '11-5555-4444');
      await page.fill('#d-pass', donantePassword);
      await page.fill('#d-pass2', donantePassword);

      await page.click('#btn-crear-cuenta-donante');

      // Si el registro funcionó, registrarDonante() (sesion.js) loguea
      // automáticamente y redirige acá. Si algo falla, esta espera hace
      // timeout y el test se reporta como fallido con captura de pantalla.
      await page.waitForURL('**/donante/dashboard.html');
    });

    await test.step('2. El dashboard muestra campañas reales (no datos de ejemplo)', async () => {
      // Esperamos a que aparezca al menos una tarjeta de campaña. Esto prueba
      // que HemoRed.data.renderCampanas() (frontend/js/data.js) efectivamente
      // leyó campanas.json y las pintó — antes de nuestro cambio, estas 4
      // tarjetas estaban escritas a mano en el HTML y no dependían de nada.
      const campaignCards = page.locator('.campaign-card');
      await expect(campaignCards.first()).toBeVisible();
      await expect(campaignCards).not.toHaveCount(0);

      // El saludo debe mostrar el nombre real de la sesión, no un valor fijo.
      await expect(page.locator('#donante-primer-nombre')).toHaveText(donanteNombre);

      // Un donante recién creado no tiene donaciones previas.
      await expect(page.locator('#total-donaciones')).toHaveText('0');
    });

    let numeroTurno;

    await test.step('3. Reservar un turno en la primera campaña disponible', async () => {
      await page.locator('.campaign-btn').first().click();
      await page.waitForURL('**/campana_detalle.html**');

      // El detalle de campaña debe cargar el hospital real (no "—", que es
      // el placeholder que se ve mientras todavía no llegó la data).
      await expect(page.locator('#d-hospital-nombre')).not.toHaveText('—');

      await page.click('#btn-reservar'); // pasa al paso 2 del wizard

      // Los horarios se generan dinámicamente chequeando turnos.json real
      // (ver renderTurnosGrid() en campana_detalle.html) — por eso hay que
      // esperar a que aparezcan en vez de asumir que ya están en el HTML.
      const primerHorarioLibre = page.locator('.turno-opt[data-hora]').first();
      await primerHorarioLibre.waitFor();
      await primerHorarioLibre.click();

      await page.click('#btn-continuar'); // pasa al paso 3 (confirmación)
      await expect(page.locator('#paso-3')).toHaveClass(/active/);

      await page.click('#btn-confirmar-reserva');

      // Acá hay dos caminos posibles: éxito, o un error de validación real
      // (ej. "ese horario ya no está disponible", o la regla de 90 días —
      // ver crearTurno() en frontend/js/data.js). Si esto te pasa corriendo
      // el test muchas veces seguidas, no es un bug: es la validación de
      // negocio funcionando. Lo hacemos fallar con un mensaje claro en vez
      // de un timeout genérico para que se entienda rápido qué pasó.
      const huboError = await page.locator('#reserva-error').isVisible().catch(() => false);
      if (huboError) {
        const mensaje = await page.locator('#reserva-error').textContent();
        throw new Error(`La reserva fue rechazada por una validación de negocio: "${mensaje}". Esto puede ser esperado si corriste el test muchas veces seguidas contra los mismos datos de ejemplo.`);
      }

      await expect(page.locator('#paso-4')).toHaveClass(/active/);
      numeroTurno = await page.locator('#exito-numero').textContent();
      expect(numeroTurno).toMatch(/#TRN-\d+/);
    });

    await test.step('4. El hospital ve el turno nuevo como "Pendiente"', async () => {
      await page.goto('/publico/login.html');
      await page.fill('#email', 'hospital@hemored.com');
      await page.fill('#password', 'hospital123');
      await page.click('.form-btn');
      await page.waitForURL('**/hospital/dashboard.html');

      await page.goto('/hospital/turnos.html');

      const filaDelTurno = page.locator('.turno-row', { hasText: `${donanteNombre} ${donanteApellido}` });
      await expect(filaDelTurno).toBeVisible();
      await expect(filaDelTurno.locator('.turno-badge')).toHaveText('Pendiente');
    });

    await test.step('5. El hospital confirma el turno', async () => {
      const filaDelTurno = page.locator('.turno-row', { hasText: `${donanteNombre} ${donanteApellido}` });
      await filaDelTurno.locator('button:has-text("Confirmar")').click();

      // confirmarTurnoUI() vuelve a renderizar la lista después de guardar
      // el cambio — esperamos a que el badge realmente cambie, no que el
      // botón haya sido clickeado (eso no prueba que se haya guardado nada).
      await expect(filaDelTurno.locator('.turno-badge')).toHaveText('Confirmado');
    });

    await test.step('6. El donante, al volver a loguearse, ve el turno confirmado', async () => {
      await page.goto('/publico/login.html');
      await page.fill('#email', donanteEmail);
      await page.fill('#password', donantePassword);
      await page.click('.form-btn');

      // Este paso prueba algo específico: que HemoRed.sesion.login() sepa
      // encontrar usuarios creados por registrarDonante(), y no solo las 4
      // cuentas demo hardcodeadas. Si este waitForURL da timeout, revisá
      // primero login() en frontend/js/sesion.js.
      await page.waitForURL('**/donante/dashboard.html');

      await page.goto('/donante/mis_turnos.html');

      const turnoEnProximos = page.locator('#lista-proximos .turno-card').first();
      await expect(turnoEnProximos).toBeVisible();
      await expect(turnoEnProximos.locator('.turno-badge')).toHaveText('Confirmado');
      await expect(turnoEnProximos).toContainText(numeroTurno.replace('#', ''));
    });
  });

});
