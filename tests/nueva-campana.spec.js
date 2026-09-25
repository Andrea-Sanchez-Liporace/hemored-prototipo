/**
 * Test E2E del wizard "Crear campaña" (3 pasos), agregado 2026-09-25 — el
 * segundo punto del orden de ataque acordado para Hospital (ver
 * docs/06-matriz-flujos-prioridad.md), el que de verdad desbloquea todo lo
 * demás: sin campañas nuevas, no hay nada que gestionar ni que le aparezca
 * al donante en el buscador.
 *
 * Alcance real de esta vuelta (a pedido explícito de la usuaria, con el
 * ajuste de comportamiento indicado): días/horarios/duración de turno
 * pasan a ser reales (antes eran decorativos — el donante siempre veía los
 * próximos 4 días con horarios fijos, sin importar la campaña), el límite
 * de campañas del plan BLOQUEA de verdad al publicar (no es solo un
 * aviso, y se proyecta a la fecha real de publicación — programar para
 * cuando una activa ya haya cerrado libera el cupo aunque HOY el plan esté
 * al límite), "Programar publicación" oculta la campaña del buscador del
 * donante hasta la fecha elegida, y "Guardar borrador" persiste de verdad
 * (sin contar contra el límite del plan).
 *
 * Nota de testing (encontrado armando esto): `page.evaluate()` justo
 * después de `waitForURL()` puede correr ANTES de que el `init()` async de
 * la página (que hace `await HemoRed.db.init()`) haya terminado — un
 * `HemoRed.db.crear()` disparado en esa ventana escribe sobre un `data`
 * todavía incompleto (sin los datos semilla restaurados) y corrompe
 * `localStorage` para el resto del test. Por eso todas las esperas acá son
 * sobre una variable que la propia página solo asigna al final de su
 * `init()` (`hospitalActual`), no un timeout fijo.
 */

const { test, expect } = require('@playwright/test');

async function loginHospital(page) {
  await page.goto('/publico/login.html');
  await page.fill('#email', 'hospital@hemored.com');
  await page.fill('#password', 'hospital123');
  await page.click('.form-btn');
  await page.waitForURL('**/hospital/dashboard.html');
}

async function loginDonante(page) {
  await page.goto('/publico/login.html');
  await page.fill('#email', 'donante@hemored.com');
  await page.fill('#password', 'donante123');
  await page.click('.form-btn');
  await page.waitForURL('**/donante/dashboard.html');
}

// Navega al wizard (o a cualquiera de sus 3 páginas) y espera a que su
// init() async haya terminado de verdad, antes de tocar el DOM o de correr
// page.evaluate() — ver nota de testing arriba.
async function irYEsperar(page, url) {
  await page.goto(url);
  await page.waitForFunction(() => typeof hospitalActual !== 'undefined' && hospitalActual !== null);
}

function fechaEnDias(n) {
  return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
}

test.describe('Wizard "Crear campaña"', () => {

  test('completar los 3 pasos y publicar crea la campaña real y la muestra en el buscador del donante', async ({ page }) => {
    await loginHospital(page);
    await irYEsperar(page, '/hospital/nueva_campana.html');

    // Paso 1
    await page.fill('#c-titulo', 'Campaña E2E — dadores universales');
    await page.fill('#c-descripcion', 'Necesitamos donantes 0- con urgencia.');
    await page.fill('#c-fecha-cierre', fechaEnDias(60));
    await page.fill('#c-unidades', '20');
    await page.click('.sangre-opt[data-valor="0-"]');
    await page.click('.urgencia-opt[data-valor="urgente"]');
    await page.click('.form-actions .btn-primary');

    // Paso 2 — días de atención y horarios ya vienen con valores por
    // default (Mar/Mié/Jue/Vie, 08-12 y 14-17, 30 min); no hace falta
    // tocar nada para que genere turnos reales.
    await page.waitForURL('**/nueva_campana_paso2.html');
    await page.waitForFunction(() => typeof hospitalActual !== 'undefined' && hospitalActual !== null);
    await expect(page.locator('#stat-turnos')).not.toHaveText('0');
    const turnosPreview = await page.locator('#stat-turnos').textContent();
    await page.click('.form-actions .btn-primary');

    // Paso 3 — checklist real, sin bloqueo (hospital 1 tiene 2/10 activas)
    await page.waitForURL('**/nueva_campana_paso3.html');
    await page.waitForFunction(() => typeof hospitalActual !== 'undefined' && hospitalActual !== null);
    await expect(page.locator('#ck-turnos')).toHaveText(turnosPreview);
    await expect(page.locator('#ck-limite-row')).toBeHidden();
    await page.click('.form-actions .btn-primary'); // Publicar

    await expect(page.locator('#exito-view')).toHaveClass(/active/);
    await expect(page.locator('#ex-titulo')).toHaveText('Campaña E2E — dadores universales');

    // Se ve del lado del donante — el hueco que bloqueaba todo lo demás.
    // La tarjeta de campaña no muestra el título en ningún lado (solo
    // nombre del hospital + descripción), así que se busca por descripción.
    await loginDonante(page);
    await expect(page.locator('.campaign-card', { hasText: 'Necesitamos donantes 0- con urgencia.' })).toBeVisible();
  });

  test('al llegar al límite de campañas activas del plan, publicar "ahora" queda bloqueado', async ({ page }) => {
    await loginHospital(page);
    await irYEsperar(page, '/hospital/nueva_campana.html');

    // Hospital 1 (plan Provincial, máx. 10) ya tiene 2 activas en la
    // semilla — se completan 8 más para llegar justo al límite. Corre
    // recién acá (no antes) porque hospitalActual ya confirmó que
    // HemoRed.db terminó de restaurar los datos semilla.
    await page.evaluate(() => {
      for (let i = 0; i < 8; i++) {
        HemoRed.db.crear('campanas', {
          hospital_id: 1, paciente_id: null, titulo: `Campaña de relleno ${i}`,
          descripcion: '', tipo_sangre_requerida: null, unidades_requeridas: 5,
          unidades_obtenidas: 0, estado: 'activa', urgente: false,
          fecha_publicacion: new Date().toISOString(),
          fecha_cierre: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
          alcance: 'local', cupo_por_turno: 1, confirmacion_automatica: false,
          dias_atencion: [], horarios_atencion: [], duracion_turno_min: 30,
          creado_en: new Date().toISOString(),
        });
      }
    });

    // Se recarga la página para que el checklist/info-box lean el nuevo total.
    await irYEsperar(page, '/hospital/nueva_campana.html');
    await expect(page.locator('#plan-info-box')).toBeVisible();
    await expect(page.locator('#plan-info-text')).toContainText('10/10');

    await page.fill('#c-titulo', 'Campaña que no debería entrar');
    await page.fill('#c-fecha-cierre', fechaEnDias(30));
    await page.fill('#c-unidades', '5');
    await page.click('.form-actions .btn-primary');
    await page.waitForURL('**/nueva_campana_paso2.html');
    await page.waitForFunction(() => typeof hospitalActual !== 'undefined' && hospitalActual !== null);
    await page.click('.form-actions .btn-primary');
    await page.waitForURL('**/nueva_campana_paso3.html');
    await page.waitForFunction(() => typeof hospitalActual !== 'undefined' && hospitalActual !== null);

    await expect(page.locator('#ck-limite-row')).toBeVisible();
    await expect(page.locator('#ck-limite-texto')).toContainText('Bloqueado');

    await page.click('.form-actions .btn-primary'); // Publicar
    await expect(page.locator('.toast.visible')).toContainText('Pausá o cerrá una campaña existente');
    // No pasó a la vista de éxito — se quedó en el formulario.
    await expect(page.locator('#exito-view')).not.toHaveClass(/active/);

    const titulos = await page.evaluate(() => HemoRed.db.where('campanas', 'hospital_id', 1).map(c => c.titulo));
    expect(titulos).not.toContain('Campaña que no debería entrar');
    expect(titulos.length).toBe(11); // 2 activas + 1 cerrada de la semilla + 8 de relleno, ninguna nueva
  });

  test('programar una campaña para cuando una activa ya haya cerrado deja publicar, aunque HOY el plan esté al límite', async ({ page }) => {
    // Pedido explícito de la usuaria: "si tiene 5 activas y programa una
    // para cuando una de esas termine, debería poder". Se arma un
    // escenario chico y controlado (no depende del plan real de ningún
    // hospital semilla) llamando directo a crearCampana(), para probar la
    // regla de negocio sin la fricción del wizard completo.
    await loginHospital(page);
    await irYEsperar(page, '/hospital/nueva_campana.html');

    const resultado = await page.evaluate(() => {
      const hospital = HemoRed.db.crear('hospitales', {
        nombre: 'Hospital de prueba límite', ciudad: 'CABA', provincia: 'Buenos Aires',
        plan_id: 1, // plan "Local", máx. 3 simultáneas
        estado: 'activo',
      });
      // 3 campañas activas = límite del plan alcanzado HOY.
      const cierraPronto = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
      const cierraTarde = new Date(Date.now() + 200 * 86400000).toISOString().slice(0, 10);
      HemoRed.db.crear('campanas', { hospital_id: hospital.id, titulo: 'A (cierra en 5 días)', estado: 'activa', fecha_cierre: cierraPronto, unidades_requeridas: 1, unidades_obtenidas: 0 });
      HemoRed.db.crear('campanas', { hospital_id: hospital.id, titulo: 'B (larga)', estado: 'activa', fecha_cierre: cierraTarde, unidades_requeridas: 1, unidades_obtenidas: 0 });
      HemoRed.db.crear('campanas', { hospital_id: hospital.id, titulo: 'C (larga)', estado: 'activa', fecha_cierre: cierraTarde, unidades_requeridas: 1, unidades_obtenidas: 0 });

      const fechaProgramada = new Date(Date.now() + 10 * 86400000).toISOString(); // después de que A cierre

      const bloqueadaHoy = HemoRed.data.crearCampana({
        hospital_id: hospital.id, titulo: 'Nueva, publicar YA', estado: 'activa',
        unidades_requeridas: 1, fecha_cierre: cierraTarde,
      });
      const permitidaProgramada = HemoRed.data.crearCampana({
        hospital_id: hospital.id, titulo: 'Nueva, programada para después de A', estado: 'programada',
        fecha_publicacion: fechaProgramada, unidades_requeridas: 1, fecha_cierre: cierraTarde,
      });

      return { bloqueadaHoy, permitidaProgramada };
    });

    expect(resultado.bloqueadaHoy.ok).toBe(false); // hoy, con las 3 activas, no entra
    expect(resultado.permitidaProgramada.ok).toBe(true); // para esa fecha, A ya cerró — sí entra
  });

  test('una campaña programada no aparece en el buscador del donante hasta que llega su fecha', async ({ page }) => {
    await loginHospital(page);
    await irYEsperar(page, '/hospital/nueva_campana.html');

    await page.evaluate(() => {
      const cierre = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
      HemoRed.data.crearCampana({
        hospital_id: 1, titulo: 'Campaña programada a futuro', descripcion: 'DESC-PROGRAMADA-A-FUTURO', estado: 'programada',
        fecha_publicacion: new Date(Date.now() + 30 * 86400000).toISOString(),
        unidades_requeridas: 5, fecha_cierre: cierre,
      });
      HemoRed.data.crearCampana({
        hospital_id: 1, titulo: 'Campaña programada ya vigente', descripcion: 'DESC-PROGRAMADA-YA-VIGENTE', estado: 'programada',
        fecha_publicacion: new Date(Date.now() - 86400000).toISOString(), // ayer
        unidades_requeridas: 5, fecha_cierre: cierre,
      });
    });

    // La tarjeta de campaña no muestra el título, así que se busca por
    // descripción (ver nota en el primer test de este archivo).
    await loginDonante(page);
    await expect(page.locator('.campaign-card', { hasText: 'DESC-PROGRAMADA-YA-VIGENTE' })).toBeVisible();
    await expect(page.locator('.campaign-card', { hasText: 'DESC-PROGRAMADA-A-FUTURO' })).toHaveCount(0);
  });

  test('"Guardar borrador" persiste la campaña sin contar contra el límite del plan ni mostrarse al donante', async ({ page }) => {
    await loginHospital(page);
    await irYEsperar(page, '/hospital/nueva_campana.html');

    const activasAntes = await page.evaluate(() => HemoRed.data.contarCampanasActivas(1));

    await page.fill('#c-titulo', 'Borrador sin terminar');
    await page.fill('#c-descripcion', 'DESC-BORRADOR-SIN-TERMINAR');
    await page.fill('#c-fecha-cierre', fechaEnDias(45));
    await page.fill('#c-unidades', '8');
    await page.click('.form-actions .btn-draft');

    await expect(page.locator('.toast.visible')).toContainText('Borrador guardado');

    const { activasDespues, borrador } = await page.evaluate(() => ({
      activasDespues: HemoRed.data.contarCampanasActivas(1),
      borrador: HemoRed.db.all('campanas').find(c => c.titulo === 'Borrador sin terminar'),
    }));
    expect(borrador).toBeTruthy();
    expect(borrador.estado).toBe('borrador');
    expect(activasDespues).toBe(activasAntes); // no cuenta como activa

    await loginDonante(page);
    await expect(page.locator('.campaign-card', { hasText: 'DESC-BORRADOR-SIN-TERMINAR' })).toHaveCount(0);
  });

});
