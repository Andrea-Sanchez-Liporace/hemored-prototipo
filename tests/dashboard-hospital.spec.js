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

    const filas = page.locator('#lista-campanas-recientes .campana-row');
    await expect(filas).toHaveCount(2);
    await expect(filas.first().locator('.campana-badge')).toHaveText('Urgente');
  });

  test('sin turnos pendientes muestra el estado vacío', async ({ page }) => {
    await loginHospital(page);
    // Los datos semilla del hospital 1 no tienen ningún turno "pendiente" hoy
    await expect(page.locator('#lista-turnos-pendientes .turno-row')).toHaveCount(0);
    await expect(page.locator('#lista-turnos-pendientes .empty-title')).toHaveText('No hay turnos pendientes');
  });

  test('confirmar un turno pendiente desde el dashboard lo confirma de verdad', async ({ page }) => {
    await loginHospital(page);

    // Turno de prueba: no hay ninguno pendiente en la semilla para poder probar la acción
    const turnoId = await page.evaluate(() => {
      const t = HemoRed.db.crear('turnos', {
        usuario_id: 1, hospital_id: 1, campana_id: 1,
        fecha: HemoRed.data.ahora().toISOString().slice(0, 10),
        hora: '15:00', estado: 'pendiente',
        formulario_autoexclusion_completado: false,
        formulario_cuestionario_completado: false,
        confirmacion_automatica: false,
      });
      return t.id;
    });
    await page.reload();

    await expect(page.locator('#lista-turnos-pendientes .turno-row')).toHaveCount(1);
    await expect(page.locator('.turno-meta').first()).toContainText('Hoy · 15:00hs');
    await expect(page.locator('#turnos-hoy')).toHaveText('1');

    await page.click('.btn-xs-ok');
    await expect(page.locator('#lista-turnos-pendientes .turno-row')).toHaveCount(0);
    await expect(page.locator('#bienvenida-turnos-pendientes')).toHaveText('0');

    const estado = await page.evaluate((id) => HemoRed.db.find('turnos', id).estado, turnoId);
    expect(estado).toBe('confirmado');
  });

  test('rechazar un turno pendiente desde el dashboard lo rechaza de verdad', async ({ page }) => {
    await loginHospital(page);

    const turnoId = await page.evaluate(() => {
      const t = HemoRed.db.crear('turnos', {
        usuario_id: 1, hospital_id: 1, campana_id: 1,
        fecha: HemoRed.data.ahora().toISOString().slice(0, 10),
        hora: '16:00', estado: 'pendiente',
        formulario_autoexclusion_completado: false,
        formulario_cuestionario_completado: false,
        confirmacion_automatica: false,
      });
      return t.id;
    });
    await page.reload();

    page.once('dialog', d => d.accept('No hay cupo disponible'));
    await page.click('.btn-xs-no');
    await expect(page.locator('#lista-turnos-pendientes .turno-row')).toHaveCount(0);

    // rechazarTurno() marca el turno como "cancelado" (no existe un estado
    // "rechazado" separado) y guarda el motivo.
    const turno = await page.evaluate((id) => HemoRed.db.find('turnos', id), turnoId);
    expect(turno.estado).toBe('cancelado');
    expect(turno.motivo_rechazo).toBe('No hay cupo disponible');
  });

});
