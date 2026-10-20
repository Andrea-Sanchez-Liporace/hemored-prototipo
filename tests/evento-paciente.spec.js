/**
 * Test E2E del "evento" de un paciente (`hospital/paciente_detalle.html` +
 * `crearPaciente()`/`cerrarCampana()`), agregado 2026-10-20 — reemplaza a
 * `alta-medica.spec.js` del mismo día, dado de baja por un cambio de
 * concepto pedido explícitamente por la usuaria, en dos vueltas:
 *
 * 1. "Internación"/"alta médica" (1ª vuelta) resultó ser el concepto
 *    equivocado: lo que hace falta es el EVENTO CLÍNICO que origina la
 *    necesidad de la campaña (una cirugía, una enfermedad, un accidente —
 *    "pueden ser muchas las causas"), que se cierra solo cuando se cierra
 *    la CAMPAÑA asociada (`cerrarCampana()`), nunca a mano.
 * 2. "Relación" paciente↔hospital (`paciente_hospital`) y "evento"
 *    (`eventos_paciente`, tabla aparte) son conceptualmente distintos (2ª
 *    vuelta): la relación es permanente (no se borra, un soft-delete se
 *    llevaría puesto el historial de campañas) y puede tener MUCHOS
 *    eventos a lo largo del tiempo, uno activo por vez.
 */

const { test, expect } = require('@playwright/test');

async function loginHospital(page) {
  await page.goto('/publico/login.html');
  await page.fill('#email', 'hospital@hemored.com');
  await page.fill('#password', 'hospital123');
  await page.click('.form-btn');
  await page.waitForURL('**/hospital/dashboard.html');
}

async function crearPacienteUI(page, { dni, diagnostico }) {
  await page.click('button.btn-nueva');
  await page.fill('#np-nombre', 'EventoTest');
  await page.fill('#np-apellido', 'Testigo');
  await page.fill('#np-dni', dni);
  await page.fill('#np-nacimiento', '2012-01-01');
  await page.fill('#np-diagnostico', diagnostico);
  await page.evaluate(() => { document.getElementById('np-servicio').value = 'Pediatría'; });
  await page.fill('#np-contacto', 'Contacto - 11-0000-0000');
  await page.fill('#np-observaciones', 'Observación');
  await page.click('button:has-text("Guardar paciente")');
}

test.describe('Evento del paciente: se cierra con la campaña, no a mano (Hospital)', () => {

  test('abrir evento, campaña real, rechazo de un segundo evento, cierre automático al cerrar la campaña, nuevo evento después', async ({ page }) => {
    await loginHospital(page);
    const dni = String(Date.now()).slice(-8);
    let pacienteId, campanaId;

    await test.step('1. crear paciente abre el evento', async () => {
      await page.goto('/hospital/pacientes.html');
      await expect(page.locator('#pac-stat-total')).not.toHaveText('—');
      await crearPacienteUI(page, { dni, diagnostico: 'Causa inicial' });
      await expect(page.locator('#hemored-toast, .toast')).toContainText('Paciente creado');
      pacienteId = await page.evaluate((d) => HemoRed.db.all('pacientes').find(p => p.numero_documento === d).id, dni);
    });

    await test.step('2. crear una campaña real para este paciente', async () => {
      campanaId = await page.evaluate((pid) => {
        const c = HemoRed.data.crearCampana({
          hospital_id: 1, paciente_id: pid, titulo: 'Campaña de prueba evento',
          descripcion: 'desc', unidades_requeridas: 2, estado: 'activa',
          fecha_cierre: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        });
        return c.campana.id;
      }, pacienteId);
    });

    await test.step('3. el detalle muestra el evento abierto y la campaña real', async () => {
      await page.goto(`/hospital/paciente_detalle.html?id=${pacienteId}`);
      await expect(page.locator('#pd-badge-estado')).toContainText('Evento abierto');
      await expect(page.locator('#pd-resumen-campanas-totales')).toHaveText('1');
      await expect(page.locator('#pd-campanas')).toContainText('Campaña de prueba evento');
    });

    await test.step('4. con el evento todavía abierto, un segundo alta se rechaza', async () => {
      await page.goto('/hospital/pacientes.html');
      await expect(page.locator('#pac-stat-total')).not.toHaveText('—');
      await crearPacienteUI(page, { dni, diagnostico: 'Intento de segundo evento' });
      await expect(page.locator('#hemored-toast, .toast')).toContainText('ya tiene un evento abierto');
      await page.click('.modal-close');
    });

    await test.step('5. cerrar la campaña cierra el evento solo (sin ningún botón manual)', async () => {
      await page.evaluate((cid) => HemoRed.data.cerrarCampana(cid), campanaId);
      await page.goto(`/hospital/paciente_detalle.html?id=${pacienteId}`);
      await expect(page.locator('#pd-badge-estado')).toContainText('Evento cerrado');
    });

    await test.step('6. con el evento cerrado, se puede registrar uno nuevo para el mismo paciente', async () => {
      await page.goto('/hospital/pacientes.html');
      await expect(page.locator('#pac-stat-total')).not.toHaveText('—');
      await crearPacienteUI(page, { dni, diagnostico: 'Segundo evento, distinta causa' });
      await expect(page.locator('#hemored-toast, .toast')).toContainText('vinculado');

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
    await crearPacienteUI(page, { dni, diagnostico: 'Causa con 2 campañas' });
    const pacienteId = await page.evaluate((d) => HemoRed.db.all('pacientes').find(p => p.numero_documento === d).id, dni);

    const [campanaId1, campanaId2] = await page.evaluate((pid) => {
      const datosBase = {
        hospital_id: 1, paciente_id: pid, unidades_requeridas: 2, estado: 'activa',
        descripcion: 'desc', fecha_cierre: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      };
      const c1 = HemoRed.data.crearCampana({ ...datosBase, titulo: 'Primera campaña' });
      const c2 = HemoRed.data.crearCampana({ ...datosBase, titulo: 'Segunda campaña' });
      return [c1.campana.id, c2.campana.id];
    }, pacienteId);

    await page.evaluate((cid) => HemoRed.data.cerrarCampana(cid), campanaId1);
    await page.goto(`/hospital/paciente_detalle.html?id=${pacienteId}`);
    await expect(page.locator('#pd-badge-estado')).toContainText('Evento abierto'); // sigue abierto, queda la 2da

    await page.evaluate((cid) => HemoRed.data.cerrarCampana(cid), campanaId2);
    await page.goto(`/hospital/paciente_detalle.html?id=${pacienteId}`);
    await expect(page.locator('#pd-badge-estado')).toContainText('Evento cerrado'); // ahora sí, ninguna campaña sigue abierta
  });

});
