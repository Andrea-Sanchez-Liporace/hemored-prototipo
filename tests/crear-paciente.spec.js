/**
 * Test E2E de "Creación de pacientes" (`hospital/pacientes.html`), agregado
 * 2026-10-20. El listado y las tarjetas KPI ya estaban conectados a datos
 * reales desde el 2026-10-14 (`cargarPacientesHospital()`) — lo que faltaba
 * era que "Guardar paciente" persistiera algo de verdad: antes el modal
 * tenía todos sus inputs sin `id`, sin validación y sin ningún `onclick`
 * real, el botón solo cerraba el modal sin crear nada.
 *
 * Pedido explícito de la usuaria, mismo día: todos los campos del
 * formulario son obligatorios salvo el tipo de sangre (único opcional).
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

    await test.step('completar todo salvo el tipo de sangre y guardar', async () => {
      await page.click('button.btn-nueva');
      await page.fill('#np-nombre', 'Tomás');
      await page.fill('#np-apellido', 'Benítez');
      await page.fill('#np-dni', '41222333');
      await page.fill('#np-nacimiento', '2016-03-10');
      await page.fill('#np-diagnostico', 'Anemia ferropénica');
      await page.fill('#np-contacto', 'Marta Benítez - 11-4444-5555');
      await page.fill('#np-observaciones', 'Requiere acompañante en los controles.');
      await page.click('button:has-text("Guardar paciente")');
    });

    await expect(page.locator('#hemored-toast, .toast')).toContainText('Paciente creado');
    await expect(page.locator('#modal-nuevo')).not.toHaveClass(/active/);
    await expect(page.locator('#pac-stat-total')).toHaveText(String(totalAntes + 1));
    const fila = page.locator('.pac-row', { hasText: 'Tomás Benítez' });
    await expect(fila).toBeVisible();
    await expect(fila.locator('.td').first()).toHaveText('—'); // sin tipo de sangre, no debe mostrar "null"
  });

  test('sin DNI no guarda, avisa el error y el modal queda abierto', async ({ page }) => {
    await loginHospital(page);
    await page.goto('/hospital/pacientes.html');
    await expect(page.locator('#pac-stat-total')).not.toHaveText('—');
    const totalAntes = Number(await page.locator('#pac-stat-total').textContent());

    await page.click('button.btn-nueva');
    await page.fill('#np-nombre', 'Sin DNI');
    await page.fill('#np-apellido', 'Testigo');
    await page.click('button:has-text("Guardar paciente")');

    await expect(page.locator('#hemored-toast, .toast')).toContainText('DNI');
    await expect(page.locator('#modal-nuevo')).toHaveClass(/active/);
    await expect(page.locator('#pac-stat-total')).toHaveText(String(totalAntes));
  });

  test('sin contacto de referencia no guarda (obligatorio salvo tipo de sangre)', async ({ page }) => {
    await loginHospital(page);
    await page.goto('/hospital/pacientes.html');
    await expect(page.locator('#pac-stat-total')).not.toHaveText('—');

    await page.click('button.btn-nueva');
    await page.fill('#np-nombre', 'Sin Contacto');
    await page.fill('#np-apellido', 'Testigo');
    await page.fill('#np-dni', '41555666');
    await page.fill('#np-nacimiento', '2017-01-01');
    await page.fill('#np-diagnostico', 'Diagnóstico de prueba');
    await page.fill('#np-observaciones', 'Observación de prueba');
    await page.click('button:has-text("Guardar paciente")');

    await expect(page.locator('#hemored-toast, .toast')).toContainText('contacto');
    await expect(page.locator('#modal-nuevo')).toHaveClass(/active/);
  });

});
