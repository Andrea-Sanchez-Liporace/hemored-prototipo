/**
 * Test E2E de "Ver/gestionar campañas" (`hospital/campanas.html` +
 * `campana_detalle.html`), agregado 2026-09-29 — el punto siguiente del
 * orden de ataque de Hospital, ya con campañas reales gracias al wizard.
 *
 * De paso se encontraron y corrigieron 2 bugs de CSS preexistentes, no de
 * esta vuelta: `.table-row` y `.turnos-table-header` tenían `display:grid`
 * sin ningún `grid-template-columns` — las filas se apilaban en vez de
 * alinearse en columnas. Nunca se había notado porque estas 2 pantallas
 * eran 100% estáticas hasta ahora.
 *
 * "Editar" una campaña que ya tiene turnos reales, y el cambio de días/
 * horarios/duración deja a alguno sin encajar, permite cancelarlos ahí
 * mismo para destrabar el guardado (pedido explícito de la usuaria) —
 * usa rechazarTurno() (sin ventana de tiempo, sin depender de
 * confirmacion_automatica), no cancelarTurno() del donante.
 */

const { test, expect } = require('@playwright/test');

async function loginHospital(page) {
  await page.goto('/publico/login.html');
  await page.fill('#email', 'hospital@hemored.com');
  await page.fill('#password', 'hospital123');
  await page.click('.form-btn');
  await page.waitForURL('**/hospital/dashboard.html');
}

async function irYEsperar(page, url, variableLista) {
  // eval() a propósito: las variables de estado de cada página (_detalle,
  // hospitalActual, _hospitalId) son `let`/`var` de script clásico, no
  // quedan colgadas de `window` — hace falta evaluarlas como identificador
  // suelto, no como propiedad de window (eso solo funciona para `var`).
  await page.goto(url);
  await page.waitForFunction((v) => eval(`typeof ${v} !== 'undefined' && ${v} !== null`), variableLista);
}

test.describe('Ver/gestionar campañas', () => {

  test('el listado muestra las campañas reales del hospital, con stats y filtros', async ({ page }) => {
    await loginHospital(page);
    await irYEsperar(page, '/hospital/campanas.html', '_hospitalId');

    // Hospital 1 tiene 3 campañas reales en la semilla: 2 activas, 1 cerrada.
    await expect(page.locator('#stat-todas')).toHaveText('3');
    await expect(page.locator('#stat-activa')).toHaveText('2');
    await expect(page.locator('#stat-cerrada')).toHaveText('1');
    await expect(page.locator('.table-row')).toHaveCount(3);

    await page.click('.stat-chip:has-text("Activas")');
    await expect(page.locator('.table-row:visible')).toHaveCount(2);
  });

  test('pausar y reactivar una campaña activa cambia su estado de verdad', async ({ page }) => {
    await loginHospital(page);
    await irYEsperar(page, '/hospital/campanas.html', '_hospitalId');

    const filaActiva = page.locator('.table-row[data-estado="activa"]').first();
    await filaActiva.locator('.btn-xs-pause').click();
    await expect(page.locator('#stat-pausada')).toHaveText('1');
    await expect(page.locator('#stat-activa')).toHaveText('1');

    await page.locator('.table-row[data-estado="pausada"]').first().locator('.btn-xs-activate').click();
    await expect(page.locator('#stat-activa')).toHaveText('2');
    await expect(page.locator('#stat-pausada')).toHaveText('0');
  });

  test('reactivar queda bloqueado si el plan ya está al límite con otras campañas', async ({ page }) => {
    await loginHospital(page);
    await irYEsperar(page, '/hospital/campanas.html', '_hospitalId');

    // Se pausa una campaña y se llena el resto del cupo del plan (Provincial, máx. 10).
    await page.evaluate(() => {
      HemoRed.data.pausarCampana(1);
      for (let i = 0; i < 9; i++) {
        HemoRed.db.crear('campanas', {
          hospital_id: 1, titulo: `Relleno ${i}`, estado: 'activa',
          unidades_requeridas: 1, unidades_obtenidas: 0,
          fecha_cierre: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
          fecha_publicacion: new Date().toISOString(),
        });
      }
    });

    await irYEsperar(page, '/hospital/campanas.html', '_hospitalId');
    await page.locator('.table-row[data-estado="pausada"]').first().locator('.btn-xs-activate').click();
    await expect(page.locator('.toast.visible')).toContainText('Pausá o cerrá otra');
    await expect(page.locator('#stat-pausada')).toHaveText('1'); // sigue pausada
  });

  test('eliminar un borrador lo borra de verdad, y no aparece para el donante', async ({ page }) => {
    await loginHospital(page);
    await irYEsperar(page, '/hospital/campanas.html', '_hospitalId');

    await page.evaluate(() => {
      HemoRed.data.guardarBorradorCampana({
        hospital_id: 1, titulo: 'Borrador para borrar', unidades_requeridas: 5,
        fecha_cierre: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      });
    });
    await irYEsperar(page, '/hospital/campanas.html', '_hospitalId');
    await expect(page.locator('#stat-borrador')).toHaveText('1');

    page.on('dialog', d => d.accept());
    await page.locator('.table-row[data-estado="borrador"]').first().locator('.btn-xs-danger').click();
    await expect(page.locator('#stat-borrador')).toHaveText('0');

    const existe = await page.evaluate(() => HemoRed.db.all('campanas').some(c => c.titulo === 'Borrador para borrar'));
    expect(existe).toBe(false);
  });

  test('el detalle de campaña muestra los turnos reales y permite confirmar/rechazar', async ({ page }) => {
    await loginHospital(page);
    await irYEsperar(page, '/hospital/campanas.html', '_hospitalId');

    await page.evaluate(() => {
      HemoRed.db.crear('turnos', {
        campana_id: 1, usuario_id: 5, hospital_id: 1,
        fecha: HemoRed.data.ahora().toISOString().slice(0, 10), hora: '11:00',
        estado: 'pendiente', creado_en: new Date().toISOString(),
      });
    });

    await irYEsperar(page, '/hospital/campana_detalle.html?id=1', '_detalle');
    await expect(page.locator('#d-titulo')).toHaveText('Campaña pediátrica — Lucas Gómez');
    // Acotado a la pestaña "Turnos": María López ya aparece de la semilla
    // en "Donantes confirmados" también, por otro turno ya completado.
    await expect(page.locator('#d-turnos-lista .turno-row', { hasText: 'María López' }).first()).toBeVisible();

    const pendienteRow = page.locator('#d-turnos-lista .turno-row', { hasText: 'Pendiente' }).first();
    await pendienteRow.locator('.btn-xs-ok').click();
    await expect(page.locator('#r-pendientes')).toHaveText('0');
  });

  test('editar una campaña con turnos reales exige cancelar los que ya no encajan antes de guardar', async ({ page }) => {
    await loginHospital(page);
    await irYEsperar(page, '/hospital/nueva_campana.html?id=1', 'hospitalActual');

    // Paso 1 viene precargado con los datos reales de la campaña 1.
    await expect(page.locator('#c-titulo')).toHaveValue('Campaña pediátrica — Lucas Gómez');
    await expect(page.locator('.topbar-title')).toHaveText('Editar campaña');
    await expect(page.locator('.btn-draft')).toBeHidden(); // no es un borrador, no hay "guardar como borrador"
    await page.click('.form-actions .btn-primary');

    await page.waitForURL('**/nueva_campana_paso2.html');
    await page.waitForFunction(() => typeof hospitalActual !== 'undefined' && hospitalActual !== null);
    await expect(page.locator('#btn-siguiente')).toHaveText(/Guardar cambios/);

    // La campaña 1 no tenía días/horarios configurados — cualquier config
    // nueva dejará bloqueado al menos alguno de sus turnos reales.
    await expect(page.locator('#bloqueantes-card')).toBeVisible();

    // No deja guardar mientras haya bloqueantes.
    await page.click('#btn-siguiente');
    await expect(page).toHaveURL(/nueva_campana_paso2\.html/);

    page.on('dialog', d => d.accept());
    await page.click('button:has-text("Cancelar estos turnos y continuar")');
    await expect(page.locator('#bloqueantes-card')).toBeHidden();

    await page.click('#btn-siguiente');
    await page.waitForURL('**/campana_detalle.html?id=1');
    await page.waitForFunction(() => typeof _detalle !== 'undefined' && _detalle !== null);

    const campanaFinal = await page.evaluate(() => HemoRed.db.find('campanas', 1));
    expect(campanaFinal.dias_atencion.length).toBeGreaterThan(0);
    expect(campanaFinal.estado).toBe('activa'); // editar no le cambia el estado
  });

});
