/**
 * Test E2E de "Creación de profesionales" (`hospital/profesionales.html`),
 * agregado 2026-10-20, mismo día y mismo pedido que "Creación de
 * pacientes" (ver crear-paciente.spec.js). El listado y las tarjetas KPI
 * ya estaban conectados a datos reales desde el 2026-10-14
 * (`cargarProfesionalesHospital()`) — lo que faltaba era que "Guardar
 * profesional" persistiera algo de verdad.
 *
 * A diferencia de un paciente, un profesional necesita poder loguearse de
 * verdad — el modal sumó 2 campos que antes no existían: "Perfil" (médico
 * clínico / extraccionista, ninguno de los dos se podía dar de alta sin esto)
 * y contraseña + repetir, con la misma validación que usa el registro
 * público de donante (mínimo 8 caracteres, deben coincidir).
 */

const { test, expect } = require('@playwright/test');

async function loginHospital(page) {
  await page.goto('/publico/login.html');
  await page.fill('#email', 'hospital@hemored.com');
  await page.fill('#password', 'hospital123');
  await page.click('.form-btn');
  await page.waitForURL('**/hospital/dashboard.html');
}

test.describe('Creación de profesionales (Hospital)', () => {

  test('crear un extraccionista nuevo: aparece en el listado, suma al total y puede loguearse', async ({ page }) => {
    await loginHospital(page);
    await page.goto('/hospital/profesionales.html');
    await expect(page.locator('#prof-stat-total')).not.toHaveText('—');
    const totalAntes = Number(await page.locator('#prof-stat-total').textContent());
    const email = `diego.ramirez.${Date.now()}@hospitalramosmejia.com.ar`;
    const dni = String(Date.now()).slice(-8);

    await test.step('completar y guardar el formulario', async () => {
      await page.click('.btn-nueva');
      await page.fill('#np-nombre', 'Diego');
      await page.fill('#np-apellido', 'Ramírez');
      await page.fill('#np-dni', dni);
      await page.evaluate(() => { document.getElementById('np-tipo').value = 'extraccionista'; });
      await page.fill('#np-matricula', '50123');
      await page.evaluate(() => { document.getElementById('np-especialidad').value = 'Hematología'; });
      await page.fill('#np-email', email);
      await page.fill('#np-pass', 'claveProvisoria1');
      await page.fill('#np-pass2', 'claveProvisoria1');
      await page.click('button:has-text("Guardar profesional")');
    });

    await expect(page.locator('#hemored-toast, .toast')).toContainText('Profesional creado');
    await expect(page.locator('#modal-nuevo')).not.toHaveClass(/active/);
    await expect(page.locator('#prof-stat-total')).toHaveText(String(totalAntes + 1));
    await expect(page.locator('.prof-card', { hasText: 'Diego Ramírez' })).toBeVisible();

    await test.step('la cuenta nueva puede loguearse de verdad', async () => {
      await page.goto('/publico/login.html');
      await page.fill('#email', email);
      await page.fill('#password', 'claveProvisoria1');
      await page.click('.form-btn');
      await page.waitForURL('**/profesional/dashboard.html');
    });
  });

  test('contraseñas que no coinciden no guardan nada', async ({ page }) => {
    await loginHospital(page);
    await page.goto('/hospital/profesionales.html');
    await expect(page.locator('#prof-stat-total')).not.toHaveText('—');
    const totalAntes = Number(await page.locator('#prof-stat-total').textContent());

    await page.click('.btn-nueva');
    await page.fill('#np-nombre', 'Prueba');
    await page.fill('#np-apellido', 'Testigo');
    await page.fill('#np-dni', String(Date.now()).slice(-8));
    await page.evaluate(() => { document.getElementById('np-tipo').value = 'medico'; });
    await page.fill('#np-matricula', '99999');
    await page.evaluate(() => { document.getElementById('np-especialidad').value = 'Cardiología'; });
    await page.fill('#np-email', `prueba.${Date.now()}@hospital.com.ar`);
    await page.fill('#np-pass', 'claveUno123');
    await page.fill('#np-pass2', 'claveDistinta456');
    await page.click('button:has-text("Guardar profesional")');

    await expect(page.locator('#hemored-toast, .toast')).toContainText('no coinciden');
    await expect(page.locator('#modal-nuevo')).toHaveClass(/active/);
    await expect(page.locator('#prof-stat-total')).toHaveText(String(totalAntes));
  });

  test('email ya usado (por otra persona) no guarda nada', async ({ page }) => {
    await loginHospital(page);
    await page.goto('/hospital/profesionales.html');
    await expect(page.locator('#prof-stat-total')).not.toHaveText('—');

    await page.click('.btn-nueva');
    await page.fill('#np-nombre', 'Otro');
    await page.fill('#np-apellido', 'Médico');
    await page.fill('#np-dni', String(Date.now()).slice(-8)); // DNI nuevo, no es el conflicto
    await page.evaluate(() => { document.getElementById('np-tipo').value = 'medico'; });
    await page.fill('#np-matricula', '11111');
    await page.evaluate(() => { document.getElementById('np-especialidad').value = 'Pediatría'; });
    await page.fill('#np-email', 'profesional@hemored.com'); // ya existe (cuenta demo, otra persona)
    await page.fill('#np-pass', 'claveProvisoria1');
    await page.fill('#np-pass2', 'claveProvisoria1');
    await page.click('button:has-text("Guardar profesional")');

    await expect(page.locator('#hemored-toast, .toast')).toContainText('Ya existe una cuenta');
    await expect(page.locator('#modal-nuevo')).toHaveClass(/active/);
  });

  test('profesional que ya trabaja en otro hospital del sistema: no duplica la cuenta, solo vincula', async ({ page }) => {
    // Hospital 2 (Garrahan) no tiene una cuenta de login real en la semilla
    // — se crea una de prueba vía evaluate() para loguearse como ese
    // segundo hospital, sin tocar ninguna cuenta/dato real del resto del sitio.
    await page.goto('/publico/login.html');
    const emailHospital2 = await page.evaluate(async () => {
      await HemoRed.db.init();
      const u = HemoRed.db.crear('usuarios', {
        nombre: 'Hospital', apellido: 'Garrahan (test)', email: `hospital2.${Date.now()}@example.com`,
        password_hash: 'test123', rol: 'hospital', hospital_id: 2, activo: true,
      });
      return u.email;
    });
    await page.fill('#email', emailHospital2);
    await page.fill('#password', 'test123');
    await page.click('.form-btn');
    await page.waitForURL('**/hospital/dashboard.html');

    await page.goto('/hospital/profesionales.html');
    await expect(page.locator('#prof-stat-total')).not.toHaveText('—'); // vacío, 0, pero ya renderizado
    const cuentasAntes = await page.evaluate(() => HemoRed.db.all('usuarios').length);

    await page.click('.btn-nueva');
    await page.fill('#np-nombre', 'Carlos');
    await page.fill('#np-apellido', 'Méndez');
    await page.fill('#np-dni', '29654321'); // DNI real del Dr. Carlos Méndez, ya vinculado al Hospital Ramos Mejía (id 1)
    await page.evaluate(() => { document.getElementById('np-tipo').value = 'medico'; });
    await page.fill('#np-matricula', '45231');
    await page.evaluate(() => { document.getElementById('np-especialidad').value = 'Hematología'; });
    await page.fill('#np-email', 'cmendez@hospitalgarrahan.com.ar'); // institucional PROPIO de este hospital
    // sin contraseña: no hace falta, ya tiene cuenta
    await page.click('button:has-text("Guardar profesional")');

    await expect(page.locator('#hemored-toast, .toast')).toContainText('vinculado');
    await expect(page.locator('.prof-card', { hasText: 'Dr. Carlos Méndez' })).toBeVisible();
    await expect(page.locator('.prof-card', { hasText: 'cmendez@hospitalgarrahan.com.ar' })).toBeVisible();

    const cuentasDespues = await page.evaluate(() => HemoRed.db.all('usuarios').length);
    expect(cuentasDespues).toBe(cuentasAntes); // no se creó ninguna cuenta nueva
  });

});
