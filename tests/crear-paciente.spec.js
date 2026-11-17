/**
 * Test E2E de "Creación de pacientes" (`hospital/pacientes.html`), agregado
 * 2026-10-20, reescrito 2026-11-17: "Nuevo paciente" ya no abre ningún
 * evento (diagnóstico/servicio/contacto/observaciones se separaron del
 * todo — ver evento-paciente.spec.js) y ahora pide apellido paterno y
 * materno por separado (pedido explícito, más control de identidad). El
 * listado y las tarjetas KPI ya estaban conectados a datos reales desde
 * el 2026-10-14 (`cargarPacientesHospital()`).
 */

const { test, expect } = require('@playwright/test');

async function loginHospital(page) {
  await page.goto('/publico/login.html');
  await page.fill('#email', 'hospital@hemored.com');
  await page.fill('#password', 'hospital123');
  await page.click('.form-btn');
  await page.waitForURL('**/hospital/dashboard.html');
}

test.describe('Creación de pacientes (Hospital)', () => {

  test('crear un paciente nuevo SIN tipo de sangre: aparece en el listado y suma al total', async ({ page }) => {
    await loginHospital(page);
    await page.goto('/hospital/pacientes.html');
    await expect(page.locator('#pac-stat-total')).not.toHaveText('—');

    const totalAntes = Number(await page.locator('#pac-stat-total').textContent());

    await test.step('completar nombre + los 2 apellidos + DNI + nacimiento, sin tipo de sangre, y guardar', async () => {
      await page.click('button.btn-nueva');
      await page.fill('#np-nombre', 'Tomás');
      await page.fill('#np-apellido-paterno', 'Benítez');
      await page.fill('#np-apellido-materno', 'Acosta');
      await page.fill('#np-dni', '41222333');
      await page.fill('#np-nacimiento', '2016-03-10');
      await page.click('button:has-text("Guardar paciente")');
    });

    await expect(page.locator('#hemored-toast, .toast')).toContainText('Paciente creado');
    await expect(page.locator('#modal-nuevo')).not.toHaveClass(/active/);
    await expect(page.locator('#pac-stat-total')).toHaveText(String(totalAntes + 1));
    const fila = page.locator('.pac-row', { hasText: 'Tomás Benítez' });
    await expect(fila).toBeVisible();
    await expect(fila.locator('.td').first()).toHaveText('—'); // sin tipo de sangre, no debe mostrar "null"

    const guardado = await page.evaluate(() => HemoRed.db.all('pacientes').find(p => p.numero_documento === '41222333'));
    expect(guardado.apellido_paterno).toBe('Benítez');
    expect(guardado.apellido_materno).toBe('Acosta');
    expect(guardado.apellido).toBeUndefined(); // no hay campo genérico combinado — solo paterno/materno
  });

  test('sin DNI no guarda, avisa el error y el modal queda abierto', async ({ page }) => {
    await loginHospital(page);
    await page.goto('/hospital/pacientes.html');
    await expect(page.locator('#pac-stat-total')).not.toHaveText('—');
    const totalAntes = Number(await page.locator('#pac-stat-total').textContent());

    await page.click('button.btn-nueva');
    await page.fill('#np-nombre', 'Sin DNI');
    await page.fill('#np-apellido-paterno', 'Testigo');
    await page.fill('#np-apellido-materno', 'Suárez');
    await page.click('button:has-text("Guardar paciente")');

    await expect(page.locator('#hemored-toast, .toast')).toContainText('DNI');
    await expect(page.locator('#modal-nuevo')).toHaveClass(/active/);
    await expect(page.locator('#pac-stat-total')).toHaveText(String(totalAntes));
  });

  test('sin apellido materno no guarda (pedido explícito: los 2 apellidos son obligatorios)', async ({ page }) => {
    await loginHospital(page);
    await page.goto('/hospital/pacientes.html');
    await expect(page.locator('#pac-stat-total')).not.toHaveText('—');

    await page.click('button.btn-nueva');
    await page.fill('#np-nombre', 'Sin Materno');
    await page.fill('#np-apellido-paterno', 'Testigo');
    await page.fill('#np-dni', '41555666');
    await page.fill('#np-nacimiento', '2017-01-01');
    await page.click('button:has-text("Guardar paciente")');

    await expect(page.locator('#hemored-toast, .toast')).toContainText('apellido materno');
    await expect(page.locator('#modal-nuevo')).toHaveClass(/active/);
  });

  // Garrahan (hospital_id 2) ya tiene login real en la semilla
  // (garrahan@hemored.com), pero igual se crea una cuenta descartable vía
  // evaluate() en cada test que la necesita, sin tocar ninguna cuenta/dato
  // real del resto del sitio.
  async function loginHospital2(page) {
    await page.goto('/publico/login.html');
    const email = await page.evaluate(async () => {
      await HemoRed.db.init();
      const u = HemoRed.db.crear('usuarios', {
        nombre: 'Hospital', apellido: 'Garrahan (test)', email: `hospital2.${Date.now()}@example.com`,
        password_hash: 'test123', rol: 'hospital', hospital_id: 2, activo: true,
      });
      return u.email;
    });
    await page.fill('#email', email);
    await page.fill('#password', 'test123');
    await page.click('.form-btn');
    await page.waitForURL('**/hospital/dashboard.html');
  }

  test('paciente ya registrado en OTRO hospital: se vincula, no se duplica la persona', async ({ page }) => {
    await loginHospital2(page);

    await page.goto('/hospital/pacientes.html');
    await expect(page.locator('#pac-stat-total')).not.toHaveText('—');
    const personasAntes = await page.evaluate(() => HemoRed.db.all('pacientes').length);

    await page.click('button.btn-nueva');
    await page.fill('#np-nombre', 'Lucas');
    await page.fill('#np-apellido-paterno', 'Gómez');
    await page.fill('#np-apellido-materno', 'Fernández');
    await page.fill('#np-dni', '99123456'); // DNI real de Lucas Gómez, ya registrado en Hospital Ramos Mejía (id 1)
    await page.fill('#np-nacimiento', '2019-04-12');
    await page.click('button:has-text("Guardar paciente")');

    await expect(page.locator('#hemored-toast, .toast')).toContainText('vinculado');
    await expect(page.locator('.pac-row', { hasText: 'Lucas Gómez' })).toBeVisible();

    const personasDespues = await page.evaluate(() => HemoRed.db.all('pacientes').length);
    expect(personasDespues).toBe(personasAntes); // no se creó una persona nueva, se reusó la existente
  });

});
