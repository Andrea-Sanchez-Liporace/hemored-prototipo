/**
 * Test E2E del "evento" de un paciente (`hospital/paciente_detalle.html` +
 * `crearCampana()`/`abrirEventoPaciente()`/`cerrarCampana()`), agregado
 * 2026-10-20, reescrito 2026-11-17 tras separar "dar de alta un paciente"
 * de "abrir un evento" (pedido explícito de la usuaria): antes
 * `crearPaciente()` abría el evento ahí mismo (pidiendo diagnóstico/
 * servicio/contacto/observaciones como obligatorios); ahora "Nuevo
 * paciente" solo registra a la persona + la relación permanente, y el
 * evento se abre recién al crear una campaña para ese paciente (si ya
 * tiene uno activo, se reusa sin pedir nada de nuevo).
 *
 * Antecedente (1ª y 2ª vuelta del 2026-10-20, sigue vigente): "internación"/
 * "alta médica" era el concepto equivocado — lo que hace falta es el
 * EVENTO CLÍNICO que origina la necesidad de la campaña (una cirugía, una
 * enfermedad, un accidente), que se cierra solo cuando se cierra la
 * CAMPAÑA asociada (`cerrarCampana()`), nunca a mano. "Relación"
 * paciente↔hospital (`paciente_hospital`) y "evento" (`eventos_paciente`)
 * son conceptualmente distintos: la relación es permanente, el evento
 * tiene principio y fin y puede haber muchos a lo largo del tiempo, uno
 * activo por vez.
 */

const { test, expect } = require('@playwright/test');

async function loginHospital(page) {
  await page.goto('/publico/login.html');
  await page.fill('#email', 'hospital@hemored.com');
  await page.fill('#password', 'hospital123');
  await page.click('.form-btn');
  await page.waitForURL('**/hospital/dashboard.html');
}

// Solo registra a la persona — ya no abre ningún evento (ver cabecera).
async function crearPacienteUI(page, { dni }) {
  await page.click('button.btn-nueva');
  await page.fill('#np-nombre', 'EventoTest');
  await page.fill('#np-apellido-paterno', 'Testigo');
  await page.fill('#np-apellido-materno', 'Suárez');
  await page.fill('#np-dni', dni);
  await page.fill('#np-nacimiento', '2012-01-01');
  await page.click('button:has-text("Guardar paciente")');
}

function crearCampanaConEvento(page, { pacienteId, hospitalId, titulo, diagnostico }) {
  return page.evaluate(({ pid, hid, tit, diag }) => {
    const res = HemoRed.data.crearCampana({
      hospital_id: hid, paciente_id: pid, titulo: tit,
      descripcion: 'desc', unidades_requeridas: 2, estado: 'activa',
      fecha_cierre: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      diagnostico: diag, servicio: 'Pediatría',
    });
    return res;
  }, { pid: pacienteId, hid: hospitalId, tit: titulo, diag: diagnostico });
}

test.describe('Evento del paciente: se abre al crear la campaña, se cierra con ella (Hospital)', () => {

  test('alta de paciente sin evento, la campaña abre uno, rechazo de un evento en paralelo, cierre automático y evento nuevo después', async ({ page }) => {
    await loginHospital(page);
    const dni = String(Date.now()).slice(-8);
    let pacienteId, campanaId;

    await test.step('1. crear paciente NO abre ningún evento', async () => {
      await page.goto('/hospital/pacientes.html');
      await expect(page.locator('#pac-stat-total')).not.toHaveText('—');
      await crearPacienteUI(page, { dni });
      await expect(page.locator('#hemored-toast, .toast')).toContainText('Paciente creado');
      pacienteId = await page.evaluate((d) => HemoRed.db.all('pacientes').find(p => p.numero_documento === d).id, dni);

      await page.goto(`/hospital/paciente_detalle.html?id=${pacienteId}`);
      await expect(page.locator('#pd-badge-estado')).toContainText('Sin evento abierto');
    });

    await test.step('2. crear una campaña real para este paciente abre el evento', async () => {
      const res = await crearCampanaConEvento(page, { pacienteId, hospitalId: 1, titulo: 'Campaña de prueba evento', diagnostico: 'Causa inicial' });
      expect(res.ok).toBe(true);
      campanaId = res.campana.id;
    });

    await test.step('3. el detalle muestra el evento abierto y la campaña real', async () => {
      await page.goto(`/hospital/paciente_detalle.html?id=${pacienteId}`);
      await expect(page.locator('#pd-badge-estado')).toContainText('Evento abierto');
      await expect(page.locator('#pd-diagnostico')).toHaveText('Causa inicial');
      await expect(page.locator('#pd-resumen-campanas-totales')).toHaveText('1');
      await expect(page.locator('#pd-campanas')).toContainText('Campaña de prueba evento');
    });

    await test.step('4. con el evento todavía abierto, OTRO hospital no puede abrirle uno en paralelo', async () => {
      const res = await page.evaluate((pid) => HemoRed.data.abrirEventoPaciente(pid, 2, { diagnostico: 'Intento en paralelo', servicio: 'Pediatría' }), pacienteId);
      expect(res.ok).toBe(false);
      expect(res.error).toContain('ya tiene un evento abierto');
    });

    await test.step('5. cerrar la campaña cierra el evento solo (sin ningún botón manual)', async () => {
      await page.evaluate((cid) => HemoRed.data.cerrarCampana(cid), campanaId);
      await page.goto(`/hospital/paciente_detalle.html?id=${pacienteId}`);
      await expect(page.locator('#pd-badge-estado')).toContainText('Evento cerrado');
    });

    await test.step('6. con el evento cerrado, una campaña nueva abre uno nuevo para el mismo paciente', async () => {
      const res = await crearCampanaConEvento(page, { pacienteId, hospitalId: 1, titulo: 'Segunda campaña, distinta causa', diagnostico: 'Segundo evento, distinta causa' });
      expect(res.ok).toBe(true);

      await page.goto(`/hospital/paciente_detalle.html?id=${pacienteId}`);
      await expect(page.locator('#pd-diagnostico')).toHaveText('Segundo evento, distinta causa');
      await expect(page.locator('#pd-historial-internaciones')).toBeVisible();
      await expect(page.locator('#pd-historial-lista')).toContainText('Causa inicial');
    });
  });

  test('cerrar UNA de dos campañas del mismo evento no lo cierra (le queda otra abierta)', async ({ page }) => {
    await loginHospital(page);
    const dni = String(Date.now()).slice(-8);

    await page.goto('/hospital/pacientes.html');
    await expect(page.locator('#pac-stat-total')).not.toHaveText('—');
    await crearPacienteUI(page, { dni });
    const pacienteId = await page.evaluate((d) => HemoRed.db.all('pacientes').find(p => p.numero_documento === d).id, dni);

    // La 1ra campaña abre el evento (sin uno activo todavía); la 2da lo
    // reusa sin pedir diagnóstico de nuevo (tieneEventoActivo ya da true).
    const campanaId1 = (await crearCampanaConEvento(page, { pacienteId, hospitalId: 1, titulo: 'Primera campaña', diagnostico: 'Causa con 2 campañas' })).campana.id;
    const campanaId2 = (await crearCampanaConEvento(page, { pacienteId, hospitalId: 1, titulo: 'Segunda campaña', diagnostico: 'ignorado, ya hay evento activo' })).campana.id;

    await page.evaluate((cid) => HemoRed.data.cerrarCampana(cid), campanaId1);
    await page.goto(`/hospital/paciente_detalle.html?id=${pacienteId}`);
    await expect(page.locator('#pd-badge-estado')).toContainText('Evento abierto'); // sigue abierto, queda la 2da

    await page.evaluate((cid) => HemoRed.data.cerrarCampana(cid), campanaId2);
    await page.goto(`/hospital/paciente_detalle.html?id=${pacienteId}`);
    await expect(page.locator('#pd-badge-estado')).toContainText('Evento cerrado'); // ahora sí, ninguna campaña sigue abierta
  });

});
