/**
 * Test E2E de "Restricciones de elegibilidad para reservar turno"
 * (`donante/campana_detalle.html`), agregado 2026-09-10.
 *
 * Contexto importante — quedaba anotado como pendiente de diseño desde
 * 2026-09-01, se resolvió y conectó recién ahora:
 * - Antes, "Requisitos para donar" (edad, peso, 3 meses) era una lista fija
 *   en verde, sin importar quién la mirara — no validaba nada de verdad.
 * - "Ya tener un turno" antes bloqueaba solo por la MISMA campaña, y ni
 *   siquiera consideraba un turno en estado `pendiente` como bloqueante
 *   (bug real encontrado al tocar este código). Ahora es un turno activo
 *   (`pendiente`/`confirmado`/`en_curso`) en TODA la plataforma.
 * - La regla de "85 días" que había quedado anotada como posible
 *   discrepancia con la de 90 días ya implementada se resolvió: es la
 *   misma regla, 90 días es el número correcto (85 era aproximado).
 * - "Condición médica inhabilitante" queda explícitamente AFUERA de esta
 *   vuelta — no hay campos estructurados para eso todavía (ver docs/01).
 * - El botón "Reservar turno" ahora se deshabilita de entrada (antes de
 *   elegir fecha/hora) si el donante no es elegible, con el motivo visible
 *   — no hace falta llegar hasta el paso de confirmación para enterarse.
 */

const { test, expect } = require('@playwright/test');

const timestamp = Date.now();
const donanteEmail = `donante.elegibilidad.${timestamp}@example.com`;
const donantePassword = 'password123';

// "Hoy" ya no es una fecha fija de demo (corregido 2026-09-16, ver
// HemoRed.data.ahora() en data.js) — estos helpers arman fechas relativas
// al momento real en que corre el test, para no repetir el problema que
// tenía este archivo antes (fechas de nacimiento/turnos hardcodeadas
// asumiendo que "hoy" era el 17 de mayo de 2026).
function fechaNacimientoParaEdad(edad) {
  return `${new Date().getFullYear() - edad}-01-01`;
}
function diasDesdeHoy(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

async function registrarYEntrarACampana(page) {
  await page.goto('/publico/registro.html');
  await page.click('text=Soy donante');
  await page.fill('#d-nombre', 'Julieta');
  await page.fill('#d-apellido', 'Testigo');
  await page.fill('#d-email', donanteEmail);
  await page.fill('#d-tel', '11-2222-3333');
  await page.fill('#d-pass', donantePassword);
  await page.fill('#d-pass2', donantePassword);
  await page.click('#btn-crear-cuenta-donante');
  await page.waitForURL('**/donante/dashboard.html');
  await page.locator('.campaign-btn').first().click();
  await page.waitForURL('**/campana_detalle.html**');
}

test.describe('Restricciones de elegibilidad para reservar turno', () => {

  test('un donante sin fecha de nacimiento/peso cargados no queda bloqueado por default', async ({ page }) => {
    await registrarYEntrarACampana(page);
    // Recién registrado: fecha_nacimiento/peso_kg quedan null (el registro
    // no los pide) — los requisitos no validables se mantienen en verde,
    // no se asume "no cumple" solo porque falta el dato.
    await expect(page.locator('#req-edad i')).toHaveClass(/ti-check/);
    await expect(page.locator('#req-peso i')).toHaveClass(/ti-check/);
    await expect(page.locator('#btn-reservar')).toBeEnabled();
  });

  test('menor de 18: el requisito de edad se marca en rojo y el botón queda deshabilitado', async ({ page }) => {
    await registrarYEntrarACampana(page);
    await page.evaluate(async (fecha_nacimiento) => {
      await HemoRed.db.init();
      const donante = HemoRed.db.where('usuarios', 'email', HemoRed.sesion.get().email)[0];
      HemoRed.db.actualizar('usuarios', donante.id, { fecha_nacimiento });
    }, fechaNacimientoParaEdad(11));
    await page.reload();

    await expect(page.locator('#req-edad i')).toHaveClass(/ti-x/);
    await expect(page.locator('#btn-reservar')).toBeDisabled();
    await expect(page.locator('#btn-reservar-nota')).toContainText('al menos 18 años');
  });

  test('tope de edad: 65 para donante normal, pero hasta 70 si es donante habitual', async ({ page }) => {
    await registrarYEntrarACampana(page);
    // 67 años a hoy: pasa el tope de 65, pero no el de 70
    await page.evaluate(async (fecha_nacimiento) => {
      await HemoRed.db.init();
      const donante = HemoRed.db.where('usuarios', 'email', HemoRed.sesion.get().email)[0];
      HemoRed.db.actualizar('usuarios', donante.id, { fecha_nacimiento });
    }, fechaNacimientoParaEdad(67));
    await page.reload();
    await expect(page.locator('#req-edad-texto')).toHaveText('Tener entre 18 y 65 años');
    await expect(page.locator('#req-edad i')).toHaveClass(/ti-x/);
    await expect(page.locator('#btn-reservar')).toBeDisabled();
    await expect(page.locator('#btn-reservar-nota')).toContainText('65 años');

    // El mismo donante, pero marcado como habitual: el tope sube a 70, 67 años ya entra
    await page.evaluate(async () => {
      await HemoRed.db.init();
      const donante = HemoRed.db.where('usuarios', 'email', HemoRed.sesion.get().email)[0];
      HemoRed.db.actualizar('usuarios', donante.id, { experiencia_donante: 'habitual' });
    });
    await page.reload();
    await expect(page.locator('#req-edad-texto')).toHaveText('Tener entre 18 y 70 años (donante habitual)');
    await expect(page.locator('#req-edad i')).toHaveClass(/ti-check/);
    await expect(page.locator('#btn-reservar')).toBeEnabled();
  });

  test('menos de 50kg: el requisito de peso se marca en rojo y el botón queda deshabilitado', async ({ page }) => {
    await registrarYEntrarACampana(page);
    await page.evaluate(async (fecha_nacimiento) => {
      await HemoRed.db.init();
      const s = HemoRed.sesion.get();
      const donante = HemoRed.db.where('usuarios', 'email', s.email)[0];
      HemoRed.db.actualizar('usuarios', donante.id, { fecha_nacimiento, peso_kg: 45 });
    }, fechaNacimientoParaEdad(30));
    await page.reload();

    await expect(page.locator('#req-edad i')).toHaveClass(/ti-check/); // edad sí cumple, no se cruzan los chequeos
    await expect(page.locator('#req-peso i')).toHaveClass(/ti-x/);
    await expect(page.locator('#btn-reservar')).toBeDisabled();
    await expect(page.locator('#btn-reservar-nota')).toContainText('al menos 50kg');
  });

  test('un turno activo en OTRA campaña también bloquea (antes solo bloqueaba la misma campaña)', async ({ page }) => {
    await registrarYEntrarACampana(page);
    await page.evaluate(async (fecha) => {
      await HemoRed.db.init();
      const s = HemoRed.sesion.get();
      const donante = HemoRed.db.where('usuarios', 'email', s.email)[0];
      // Turno pendiente en una campaña cualquiera — antes este estado ni
      // siquiera se consideraba bloqueante por un bug real del chequeo viejo.
      HemoRed.db.crear('turnos', {
        campana_id: 1, usuario_id: donante.id, hospital_id: 1,
        fecha, hora: '10:00', estado: 'pendiente',
        formulario_autoexclusion_completado: false, formulario_autoexclusion_completado_en: null,
        autoexclusion_completado_por: null, formulario_cuestionario_completado: false,
        formulario_cuestionario_completado_en: null, cuestionario_completado_por: null,
        creado_en: new Date().toISOString(),
      });
    }, diasDesdeHoy(14));
    await page.reload(); // seguimos en la MISMA página de campaña (campana_detalle.html?id=X), no necesariamente la campana_id=1 de arriba

    await expect(page.locator('#btn-reservar')).toBeDisabled();
    await expect(page.locator('#btn-reservar-nota')).toContainText('Ya tenés un turno activo');

    // Confirmación directa contra la función real, por si la campaña de la URL
    // coincidiera por casualidad con la del turno creado arriba (no debería
    // cambiar el resultado en ningún caso, ambas son bloqueo "toda la plataforma"):
    const resultado = await page.evaluate(async (fecha) => {
      await HemoRed.db.init();
      const s = HemoRed.sesion.get();
      const donante = HemoRed.db.where('usuarios', 'email', s.email)[0];
      return HemoRed.data.crearTurno({ usuario_id: donante.id, campana_id: 2, hospital_id: 1, fecha, hora: '11:00' });
    }, diasDesdeHoy(20));
    expect(resultado.ok).toBe(false);
    expect(resultado.error).toContain('Ya tenés un turno activo');
  });

  test('reprogramar un turno re-valida elegibilidad completa, no solo la ventana de 24hs', async ({ page }) => {
    await page.goto('/publico/registro.html');
    await page.click('text=Soy donante');
    await page.fill('#d-nombre', 'Julieta');
    await page.fill('#d-apellido', 'Testigo');
    await page.fill('#d-email', `donante.reprogramar.${Date.now()}@example.com`);
    await page.fill('#d-tel', '11-2222-3333');
    await page.fill('#d-pass', donantePassword);
    await page.fill('#d-pass2', donantePassword);
    await page.click('#btn-crear-cuenta-donante');
    await page.waitForURL('**/donante/dashboard.html');

    const fechaTurno = diasDesdeHoy(14);
    const fechaReprogramada = diasDesdeHoy(25);

    let turnoId;
    await test.step('crear un turno confirmado, con más de 24hs de anticipación, siendo elegible', async () => {
      turnoId = await page.evaluate(async ({ fechaNacimiento, fecha }) => {
        await HemoRed.db.init();
        const s = HemoRed.sesion.get();
        const donante = HemoRed.db.where('usuarios', 'email', s.email)[0];
        HemoRed.db.actualizar('usuarios', donante.id, { fecha_nacimiento: fechaNacimiento, peso_kg: 60 });
        const turno = HemoRed.db.crear('turnos', {
          campana_id: 1, usuario_id: donante.id, hospital_id: 1,
          fecha, hora: '10:00', estado: 'confirmado',
          formulario_autoexclusion_completado: false, formulario_autoexclusion_completado_en: null,
          autoexclusion_completado_por: null, formulario_cuestionario_completado: false,
          formulario_cuestionario_completado_en: null, cuestionario_completado_por: null,
          creado_en: new Date().toISOString(),
        });
        return turno.id;
      }, { fechaNacimiento: fechaNacimientoParaEdad(30), fecha: fechaTurno });
    });

    await test.step('bajar el peso por debajo de 50kg en el medio: reprogramar ahora se rechaza', async () => {
      const resultado = await page.evaluate(({ id, fecha }) => {
        const s = HemoRed.sesion.get();
        const donante = HemoRed.db.where('usuarios', 'email', s.email)[0];
        HemoRed.db.actualizar('usuarios', donante.id, { peso_kg: 40 }); // cambió DESPUÉS de reservar
        return HemoRed.data.actualizarTurno(id, { fecha, hora: '11:00' });
      }, { id: turnoId, fecha: fechaReprogramada });
      expect(resultado.ok).toBe(false);
      expect(resultado.error).toContain('al menos 50kg');
    });

    await test.step('con el peso corregido de nuevo, reprogramar funciona (y no se bloquea contra sí mismo)', async () => {
      const resultado = await page.evaluate(({ id, fecha }) => {
        const s = HemoRed.sesion.get();
        const donante = HemoRed.db.where('usuarios', 'email', s.email)[0];
        HemoRed.db.actualizar('usuarios', donante.id, { peso_kg: 60 });
        return HemoRed.data.actualizarTurno(id, { fecha, hora: '11:00' });
      }, { id: turnoId, fecha: fechaReprogramada });
      expect(resultado.ok).toBe(true);
      expect(resultado.turno.fecha).toBe(fechaReprogramada);
    });
  });

  test('el dashboard muestra un banner global (no por tarjeta) si el donante no es elegible', async ({ page }) => {
    await page.goto('/publico/registro.html');
    await page.click('text=Soy donante');
    await page.fill('#d-nombre', 'Julieta');
    await page.fill('#d-apellido', 'Testigo');
    await page.fill('#d-email', `donante.banner.${Date.now()}@example.com`);
    await page.fill('#d-tel', '11-2222-3333');
    await page.fill('#d-pass', donantePassword);
    await page.fill('#d-pass2', donantePassword);
    await page.click('#btn-crear-cuenta-donante');
    await page.waitForURL('**/donante/dashboard.html');

    await expect(page.locator('#no-elegible-banner')).toBeHidden(); // recién registrado, sin datos que lo bloqueen

    await page.evaluate(async () => {
      await HemoRed.db.init();
      const s = HemoRed.sesion.get();
      const donante = HemoRed.db.where('usuarios', 'email', s.email)[0];
      HemoRed.db.actualizar('usuarios', donante.id, { peso_kg: 40 });
    });
    await page.reload();

    await expect(page.locator('#no-elegible-banner')).toBeVisible();
    await expect(page.locator('#no-elegible-motivo')).toContainText('al menos 50kg');
    // Es un solo banner arriba de todo, no un indicador repetido por tarjeta:
    await expect(page.locator('.campaign-card .ti-alert-triangle')).toHaveCount(0);
  });

  // Bug real encontrado 2026-09-16 (reportado por la usuaria: "quiero
  // modificar mi turno y me dice que ya tengo uno activo"): el turno id 3
  // de los datos semilla (usuario 1, la cuenta demo) había quedado
  // duplicado en estado `en_curso` — mismo hospital/fecha/hora/campaña que
  // el turno id 6, ya `completado`, que es el que realmente tiene una
  // donación real asociada (`donaciones.json`, turno_id: 6). Como la regla
  // de "un solo turno activo en toda la plataforma" es posterior a cuando
  // se armó ese dato semilla, nadie había notado que la cuenta demo violaba
  // su propia regla. Se sacó el turno 3 duplicado de `turnos.json`. Este
  // test es una guarda de datos, no de UI: confirma que ningún donante de
  // los datos semilla tiene más de un turno activo a la vez, para no
  // repetir este tipo de inconsistencia sin darse cuenta.
  test('ningún donante de los datos semilla tiene más de un turno activo a la vez (consistencia de datos)', async ({ page }) => {
    await page.goto('/publico/login.html');
    const porUsuario = await page.evaluate(async () => {
      await HemoRed.db.init();
      const activos = HemoRed.db.all('turnos').filter(t => ['pendiente', 'confirmado', 'en_curso'].includes(t.estado));
      const conteo = {};
      activos.forEach(t => { conteo[t.usuario_id] = (conteo[t.usuario_id] || 0) + 1; });
      return conteo;
    });
    Object.entries(porUsuario).forEach(([usuarioId, cantidad]) => {
      expect(cantidad, `usuario_id ${usuarioId} tiene ${cantidad} turnos activos a la vez`).toBeLessThanOrEqual(1);
    });
  });

});
