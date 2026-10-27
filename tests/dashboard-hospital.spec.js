/**
 * Test E2E del dashboard de Hospital (`hospital/dashboard.html`), agregado
 * 2026-09-24. Era el flujo más barato de conectar (`docs/06`): la función
 * `cargarDashboardHospital()` ya traía los datos reales, pero el HTML no
 * tenía los `id` para mostrarlos, y las 2 listas ("Campañas recientes" /
 * "Turnos pendientes de confirmación") eran filas 100% hardcodeadas — no
 * era "solo agregar ids" como sugería la estimación de esfuerzo, así que
 * se conectó del todo: nombre del hospital (sidebar + encabezado), los 3
 * KPI (campañas activas / turnos hoy / donaciones del mes) y ambas listas,
 * incluidos los botones "Confirmar"/"Rechazar" (antes sin ninguna acción),
 * reutilizando las mismas funciones reales que ya usa `hospital/turnos.html`
 * (`confirmarTurno()`/`rechazarTurno()`).
 */

const { test, expect } = require('@playwright/test');

async function loginHospital(page) {
  await page.goto('/publico/login.html');
  await page.fill('#email', 'hospital@hemored.com');
  await page.fill('#password', 'hospital123');
  await page.click('.form-btn');
  await page.waitForURL('**/hospital/dashboard.html');
}

test.describe('Dashboard de Hospital', () => {

  test('nombre real, KPIs y campañas recientes con datos reales', async ({ page }) => {
    await loginHospital(page);

    await expect(page.locator('#hospital-nombre-sidebar')).toHaveText('Hospital Ramos Mejía');
    await expect(page.locator('#hospital-nombre')).toHaveText('Hospital Ramos Mejía');

    // Hospital Ramos Mejía (id 1) tiene 2 campañas activas en los datos semilla
    await expect(page.locator('#campanas-activas')).toHaveText('2');
    await expect(page.locator('#bienvenida-campanas')).toHaveText('2');

    const filas = page.locator('#lista-campanas-recientes .campana-row-dash');
    await expect(filas).toHaveCount(2);
    await expect(filas.first().locator('.campana-badge')).toHaveText('Urgente');
  });

  test('sin turnos pendientes muestra el estado vacío', async ({ page }) => {
    await loginHospital(page);
    // Esperar una señal real de que el init() async de la página terminó
    // (mismo criterio documentado en el resto de la suite) antes de tocar
    // HemoRed.db desde el test — si no, el evaluate() de abajo puede correr
    // contra un `data` todavía sin restaurar.
    await expect(page.locator('#hospital-nombre')).toHaveText('Hospital Ramos Mejía');

    // La semilla puede tener algún turno "pendiente" vivo para la demo (ver
    // [[fecha-hoy-dinamica]] — se actualiza de vez en cuando para que no
    // quede vencido) — se limpia antes de afirmar el estado vacío, en vez
    // de asumir que el hospital 1 nunca va a tener ninguno.
    await page.evaluate(() => {
      HemoRed.db.all('turnos').filter(t => t.hospital_id === 1 && t.estado === 'pendiente')
        .forEach(t => HemoRed.data.rechazarTurno(t.id, 'Test: limpiar estado para probar el vacío.'));
    });
    await page.reload();
    await expect(page.locator('#hospital-nombre')).toHaveText('Hospital Ramos Mejía');
    await expect(page.locator('#lista-turnos-pendientes .empty-title')).toHaveText('No hay turnos pendientes');
    await expect(page.locator('#lista-turnos-pendientes .turno-row-dash')).toHaveCount(0);
  });

  test('confirmar un turno pendiente desde el dashboard lo confirma de verdad', async ({ page }) => {
    await loginHospital(page);

    // Turno de prueba: no hay ninguno pendiente en la semilla para poder
    // probar la acción. Hora fija tarde (23:30, no "hace 2hs" ni nada
    // relativo al momento real) a propósito: un turno `pendiente` con
    // fecha+hora ya pasada se cancela solo desde el vencimiento automático
    // (2026-10-16) — con una hora más temprana, correr este test de tarde
    // hacía que naciera ya vencido.
    const turnoId = await page.evaluate(() => {
      const t = HemoRed.db.crear('turnos', {
        usuario_id: 1, hospital_id: 1, campana_id: 1,
        fecha: HemoRed.data.hoyISO(),
        hora: '23:30', estado: 'pendiente',
        formulario_autoexclusion_completado: false,
        formulario_cuestionario_completado: false,
        confirmacion_automatica: false,
      });
      return t.id;
    });
    await page.reload();

    await expect(page.locator('#lista-turnos-pendientes .turno-row-dash')).toHaveCount(1);
    await expect(page.locator('.turno-meta').first()).toContainText('Hoy · 23:30hs');
    await expect(page.locator('#turnos-hoy')).toHaveText('1');

    await page.click('.btn-xs-ok');
    await expect(page.locator('#lista-turnos-pendientes .turno-row-dash')).toHaveCount(0);
    await expect(page.locator('#bienvenida-turnos-pendientes')).toHaveText('0');

    const estado = await page.evaluate((id) => HemoRed.db.find('turnos', id).estado, turnoId);
    expect(estado).toBe('confirmado');
  });

  test('rechazar un turno pendiente desde el dashboard lo rechaza de verdad', async ({ page }) => {
    await loginHospital(page);

    // Mismo motivo que el test anterior: hora fija tarde para que nunca
    // nazca ya vencido, sin importar a qué hora del día corra la suite.
    const turnoId = await page.evaluate(() => {
      const t = HemoRed.db.crear('turnos', {
        usuario_id: 1, hospital_id: 1, campana_id: 1,
        fecha: HemoRed.data.hoyISO(),
        hora: '23:45', estado: 'pendiente',
        formulario_autoexclusion_completado: false,
        formulario_cuestionario_completado: false,
        confirmacion_automatica: false,
      });
      return t.id;
    });
    await page.reload();

    page.once('dialog', d => d.accept('No hay cupo disponible'));
    await page.click('.btn-xs-no');
    await expect(page.locator('#lista-turnos-pendientes .turno-row-dash')).toHaveCount(0);

    // rechazarTurno() marca el turno como "cancelado" (no existe un estado
    // "rechazado" separado) y guarda el motivo.
    const turno = await page.evaluate((id) => HemoRed.db.find('turnos', id), turnoId);
    expect(turno.estado).toBe('cancelado');
    expect(turno.motivo_rechazo).toBe('No hay cupo disponible');
  });

});
