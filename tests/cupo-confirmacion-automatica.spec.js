/**
 * Test E2E de "confirmación automática y cupo por turno" (agregado
 * 2026-09-18, a pedido de la usuaria: "y si lo hacemos automatico en
 * ambas instancias? ... el hospital puede tener la capacidad de atender
 * a mas de una persona en el mismo horario, y eso es algo que setea al
 * momento de crear la campaña").
 *
 * Antes, `crearTurno()` (frontend/js/data.js) siempre nacía en estado
 * `pendiente` (el hospital confirmaba/rechazaba a mano, RF3) y el chequeo
 * de "horario ocupado" bloqueaba apenas existía CUALQUIER turno activo en
 * ese hospital+fecha+hora — capacidad de 1 siempre, sin importar que el
 * mockup de "nueva campaña" (frontend/hospital/nueva_campana_paso2.html)
 * ya diseñaba "Donantes por turno" y "¿Requiere confirmación manual?"
 * como configuración por campaña.
 *
 * Ahora `campanas.json` tiene `cupo_por_turno` y `confirmacion_automatica`
 * reales por campaña, y `crearTurno()`/`actualizarTurno()` los usan: nacen
 * `confirmado` directo si la campaña es automática, y el "ocupado" cuenta
 * turnos activos contra el cupo en vez de bloquear con el primero. Ver
 * docs/04-estado-actual-prototipo.md, sección "Confirmación automática y
 * cupo por turno".
 *
 * Se prueba llamando directo a HemoRed.data.crearTurno() (no por la UI de
 * reserva) porque lo que se valida es la regla de negocio en sí, no el
 * flujo de click a click — mismo criterio que restricciones-elegibilidad.spec.js.
 */

const { test, expect } = require('@playwright/test');

// "Hoy" es la fecha real del sistema (ver HemoRed.data.ahora() en data.js)
// — se arman fechas relativas para no colisionar con los horarios ya
// ocupados por los turnos semilla de mayo 2026.
function diasDesdeHoy(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// Donante mínimo sin fecha de nacimiento/peso cargados (no bloquean por
// default, ver restricciones-elegibilidad.spec.js) — alcanza para probar
// cupo/confirmación, que no dependen de esos datos.
async function crearDonanteMinimo(page, email) {
  return page.evaluate((email) => {
    return HemoRed.db.crear('usuarios', {
      nombre: 'Cupo', apellido: 'Test', email,
      password_hash: 'x', rol: 'donante',
      tipo_documento_id: 1, numero_documento: `cupo-${Date.now()}-${Math.random()}`,
      telefono: '11-0000-0000', fecha_nacimiento: null, peso_kg: null,
      tipo_sangre: null, experiencia_donante: null,
      creado_en: new Date().toISOString(),
    }).id;
  }, email);
}

test.describe('Confirmación automática y cupo por turno', () => {

  test('campaña con confirmación automática (id 2, "Banco de sangre general") confirma el turno al instante', async ({ page }) => {
    await page.goto('/publico/login.html');
    await page.evaluate(() => HemoRed.db.init());
    const donanteId = await crearDonanteMinimo(page, `cupo.auto.${Date.now()}@example.com`);

    const resultado = await page.evaluate(({ donanteId, fecha }) => {
      return HemoRed.data.crearTurno({ usuario_id: donanteId, campana_id: 2, hospital_id: 1, fecha, hora: '10:00' });
    }, { donanteId, fecha: diasDesdeHoy(15) });

    expect(resultado.ok).toBe(true);
    expect(resultado.turno.estado).toBe('confirmado');
  });

  test('campaña sin confirmación automática (id 1, urgente con paciente) sigue naciendo pendiente', async ({ page }) => {
    await page.goto('/publico/login.html');
    await page.evaluate(() => HemoRed.db.init());
    const donanteId = await crearDonanteMinimo(page, `cupo.manual.${Date.now()}@example.com`);

    const resultado = await page.evaluate(({ donanteId, fecha }) => {
      return HemoRed.data.crearTurno({ usuario_id: donanteId, campana_id: 1, hospital_id: 1, fecha, hora: '10:00' });
    }, { donanteId, fecha: diasDesdeHoy(16) });

    expect(resultado.ok).toBe(true);
    expect(resultado.turno.estado).toBe('pendiente');
  });

  test('el cupo de la campaña admite más de un donante en el mismo horario, y lo bloquea al llegar al límite', async ({ page }) => {
    await page.goto('/publico/login.html');
    await page.evaluate(() => HemoRed.db.init());
    // Campaña 2 tiene cupo_por_turno: 2 — el 1º y 2º turno en el mismo
    // hospital+fecha+hora deben entrar, el 3º debe rechazarse.
    const [d1, d2, d3] = await Promise.all([
      crearDonanteMinimo(page, `cupo.a.${Date.now()}@example.com`),
      crearDonanteMinimo(page, `cupo.b.${Date.now()}@example.com`),
      crearDonanteMinimo(page, `cupo.c.${Date.now()}@example.com`),
    ]);
    const fecha = diasDesdeHoy(17);

    const resultados = await page.evaluate(({ d1, d2, d3, fecha }) => {
      const r1 = HemoRed.data.crearTurno({ usuario_id: d1, campana_id: 2, hospital_id: 1, fecha, hora: '11:00' });
      const r2 = HemoRed.data.crearTurno({ usuario_id: d2, campana_id: 2, hospital_id: 1, fecha, hora: '11:00' });
      const r3 = HemoRed.data.crearTurno({ usuario_id: d3, campana_id: 2, hospital_id: 1, fecha, hora: '11:00' });
      return { r1, r2, r3 };
    }, { d1, d2, d3, fecha });

    expect(resultados.r1.ok).toBe(true);
    expect(resultados.r2.ok).toBe(true);
    expect(resultados.r3.ok).toBe(false);
    expect(resultados.r3.error).toContain('no está disponible');
  });

});
