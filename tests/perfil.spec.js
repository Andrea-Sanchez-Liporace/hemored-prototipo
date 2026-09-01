/**
 * Test E2E de "Mi perfil" del rol Donante: edición de datos personales,
 * datos médicos, preferencias de notificación y empleadores frecuentes.
 *
 * Contexto de negocio: ver docs/01-relevamiento-requisitos.md (sección
 * `usuarios`, campos agregados 2026-09-01) y docs/04-estado-actual-prototipo.md
 * ("Editar perfil"). Los campos nuevos (experiencia_donante, ultima_donacion_fecha,
 * ultima_donacion_fecha_aproximada, ultima_donacion_lugar, condiciones_medicas,
 * notif_recordatorio_turno, notif_resultado_analisis, notif_campanas_urgentes)
 * viven en `usuarios` porque son una "foto" del perfil, editable en cualquier
 * momento — no confundir con los campos homónimos del formulario de
 * pre-donación (formulario_consentimiento), que son un concepto distinto,
 * atado a cada proceso de donación puntual, y que este test no toca.
 *
 * "¿Donaste antes?" (y sus campos asociados de última donación) es un dato
 * histórico de escritura única: una vez guardado con una respuesta afirmativa
 * o "primera vez", queda bloqueado permanentemente (igual que el email) — no
 * tiene sentido de negocio que alguien "deje de haber donado antes".
 *
 * Se registra un donante nuevo (perfil vacío) en vez de usar la cuenta demo,
 * para poder probar el flujo completo "sin cargar nada" -> "cargar todo".
 */

const { test, expect } = require('@playwright/test');

const timestamp = Date.now();
const donanteEmail = `donante.perfil.${timestamp}@example.com`;
const donantePassword = 'password123';

test.describe('Mi perfil (donante)', () => {

  test('editar datos personales, médicos, preferencias y empleadores persiste tras recargar', async ({ page }) => {

    await test.step('registrar un donante nuevo', async () => {
      await page.goto('/publico/registro.html');
      await page.click('text=Soy donante');
      await page.fill('#d-nombre', 'Marina');
      await page.fill('#d-apellido', 'Testigo');
      await page.fill('#d-email', donanteEmail);
      await page.fill('#d-tel', '11-5555-4444');
      await page.fill('#d-pass', donantePassword);
      await page.fill('#d-pass2', donantePassword);
      await page.click('#btn-crear-cuenta-donante');
      await page.waitForURL('**/donante/dashboard.html');
    });

    await test.step('ir a Mi perfil', async () => {
      await page.goto('/donante/perfil.html');
      await expect(page.locator('#perfil-nombre-completo')).toHaveText('Marina Testigo');
      // Perfil recién creado: sin tipo de sangre, así que el badge de alerta debe verse.
      await expect(page.locator('#perfil-badge-sangre')).toBeVisible();
    });

    await test.step('editar datos personales y guardar', async () => {
      await page.fill('#input-telefono', '11-2222-3333');
      await page.fill('#input-fecha-nacimiento', '1998-04-10');
      await page.fill('#input-dni', '40123456');
      await page.selectOption('#input-provincia', 'Córdoba');
      await page.fill('#input-ciudad', 'Villa Carlos Paz');
      await page.click('#sec-personal button:has-text("Guardar cambios")');
      await expect(page.locator('.toast')).toContainText('Datos personales guardados');
    });

    await test.step('el nombre del sidebar se actualiza sin recargar', async () => {
      await page.fill('#input-nombre', 'Marina Inés');
      await page.click('#sec-personal button:has-text("Guardar cambios")');
      await expect(page.locator('[data-sesion-nombre]')).toHaveText('Marina Inés Testigo');
    });

    await test.step('abrir Datos médicos, elegir tipo de sangre y guardar', async () => {
      await page.click('#sec-medicos .seccion-header');
      await page.click('.sangre-opt[data-tipo="A+"]');
      await page.fill('#input-peso', '65');
      await page.fill('#input-condiciones', 'Ninguna');
      await expect(page.locator('#bloque-ultima-donacion')).toBeHidden();
    });

    await test.step('"¿Donaste antes?" = Sí: aparece el bloque de última donación, todavía editable (no se guardó nada aún)', async () => {
      await page.selectOption('#input-experiencia', 'habitual');
      await expect(page.locator('#bloque-ultima-donacion')).toBeVisible();
      await page.fill('#input-ultima-fecha', '2026-02-10');

      // Antes de guardar por primera vez, se puede ir y venir libremente entre
      // fecha exacta y aproximada (son mutuamente excluyentes).
      await page.check('#chk-no-recuerdo-fecha');
      await expect(page.locator('#input-ultima-fecha')).toBeDisabled();
      await expect(page.locator('#input-ultima-fecha-aprox')).toBeEnabled();
      await page.uncheck('#chk-no-recuerdo-fecha');
      await expect(page.locator('#input-ultima-fecha')).toBeEnabled();

      await page.fill('#input-ultima-fecha', '2026-02-10');
      await page.fill('#input-ultima-lugar', 'Hospital Ramos Mejía');
    });

    await test.step('guardar la respuesta la deja fija: "¿donaste antes?" y tipo de sangre quedan bloqueados para siempre', async () => {
      // Ambos son datos de escritura única (no preferencias): "¿donaste antes?"
      // es un dato histórico, y tipo de sangre es autoreportado y pendiente de
      // verificación médica real — una vez contestados, HemoRed los trata como
      // definitivos y no se pueden volver a editar desde el perfil (igual que
      // pasa con el email).
      await page.click('#sec-medicos button:has-text("Guardar cambios")');
      await expect(page.locator('.toast')).toContainText('Datos médicos guardados');

      await page.reload();
      await page.click('#sec-medicos .seccion-header');
      await expect(page.locator('#input-experiencia')).toHaveValue('habitual');
      await expect(page.locator('#input-ultima-fecha')).toHaveValue('2026-02-10');
      await expect(page.locator('#input-ultima-lugar')).toHaveValue('Hospital Ramos Mejía');
      await expect(page.locator('.sangre-opt[data-tipo="A+"]')).toHaveClass(/selected/);

      await expect(page.locator('#input-experiencia')).toBeDisabled();
      await expect(page.locator('#input-ultima-fecha')).toBeDisabled();
      await expect(page.locator('#chk-no-recuerdo-fecha')).toBeDisabled();
      await expect(page.locator('#input-ultima-fecha-aprox')).toBeDisabled();
      await expect(page.locator('#input-ultima-lugar')).toBeDisabled();
      await expect(page.locator('#hint-experiencia-bloqueada')).toBeVisible();
      // El hint que explica QUÉ pregunta "¿donaste antes?" (previas al registro
      // en HemoRed) tiene que seguir visible aunque esté bloqueado — si no,
      // se pierde esa aclaración y el campo queda ambiguo.
      await expect(page.locator('#hint-experiencia-normal')).toBeVisible();

      await expect(page.locator('#sangre-grid')).toHaveClass(/bloqueado/);
      await expect(page.locator('#hint-sangre-bloqueada')).toBeVisible();
      await expect(page.locator('#hint-sangre-normal')).toBeHidden();

      // Intentar clickear otro tipo de sangre no debe cambiar nada.
      await page.click('.sangre-opt[data-tipo="0-"]');
      await expect(page.locator('.sangre-opt[data-tipo="A+"]')).toHaveClass(/selected/);
      await expect(page.locator('.sangre-opt[data-tipo="0-"]')).not.toHaveClass(/selected/);
    });

    await test.step('guardar otra vez (ej. cambiar condiciones médicas) no altera lo ya bloqueado', async () => {
      await page.fill('#input-condiciones', 'Ninguna');
      await page.click('#sec-medicos button:has-text("Guardar cambios")');
      await page.reload();
      await page.click('#sec-medicos .seccion-header');
      await expect(page.locator('#input-condiciones')).toHaveValue('Ninguna');
      await expect(page.locator('#input-experiencia')).toHaveValue('habitual');
      await expect(page.locator('#input-ultima-fecha')).toHaveValue('2026-02-10');
      await expect(page.locator('.sangre-opt[data-tipo="A+"]')).toHaveClass(/selected/);
    });

    await test.step('abrir Preferencias de notificaciones y desmarcar una', async () => {
      await page.click('#sec-notif .seccion-header');
      // Nuevo registro: recordatorio y resultado vienen activados por default
      // (ver sesion.js registrarDonante), urgentes viene desactivado.
      await expect(page.locator('#notif-recordatorio')).toBeChecked();
      await expect(page.locator('#notif-urgentes')).not.toBeChecked();
      await page.check('#notif-urgentes');
      await page.uncheck('#notif-resultado');
      await page.click('button:has-text("Guardar preferencias")');
      await expect(page.locator('.toast')).toContainText('Preferencias guardadas');
    });

    await test.step('abrir Datos laborales y agregar un empleador', async () => {
      await page.click('#sec-laboral .seccion-header');
      await expect(page.locator('#empleadores-lista')).toContainText('Todavía no agregaste');
      await page.click('#btn-agregar-emp');
      await page.fill('#input-nuevo-emp', 'Empresa Demo SRL');
      await page.click('#form-nuevo-emp button:has-text("Guardar")');
      await expect(page.locator('#empleadores-lista')).toContainText('Empresa Demo SRL');
    });

    await test.step('editar el nombre del empleador ya guardado', async () => {
      await page.click('.empleador-item[data-nombre="Empresa Demo SRL"] button[title="Editar"]');
      const input = page.locator('#input-editar-emp');
      await expect(input).toHaveValue('Empresa Demo SRL');
      await input.fill('Empresa Demo SRL (renombrada)');
      await page.click('.empleador-item button:has-text("Guardar")');
      await expect(page.locator('#empleadores-lista')).toContainText('Empresa Demo SRL (renombrada)');
      await expect(page.locator('#empleadores-lista')).not.toContainText('"Empresa Demo SRL"');

      await page.reload();
      await page.click('#sec-laboral .seccion-header');
      await expect(page.locator('#empleadores-lista')).toContainText('Empresa Demo SRL (renombrada)');
    });

    await test.step('cancelar una edición no guarda el cambio', async () => {
      await page.click('.empleador-item[data-nombre="Empresa Demo SRL (renombrada)"] button[title="Editar"]');
      await page.fill('#input-editar-emp', 'Este texto no se debería guardar');
      await page.click('.empleador-item button:has-text("Cancelar")');
      await expect(page.locator('#empleadores-lista')).toContainText('Empresa Demo SRL (renombrada)');
      await expect(page.locator('#empleadores-lista')).not.toContainText('Este texto no se debería guardar');
    });

    await test.step('agregar un segundo empleador y confirmar que no se puede renombrar duplicando al otro', async () => {
      await page.click('#btn-agregar-emp');
      await page.fill('#input-nuevo-emp', 'Segundo Empleador SA');
      await page.click('#form-nuevo-emp button:has-text("Guardar")');
      await expect(page.locator('#empleadores-lista')).toContainText('Segundo Empleador SA');

      await page.click('.empleador-item[data-nombre="Segundo Empleador SA"] button[title="Editar"]');
      await page.fill('#input-editar-emp', 'Empresa Demo SRL (renombrada)');
      await page.click('.empleador-item button:has-text("Guardar")');
      await expect(page.locator('.toast')).toContainText('Ya tenés un empleador guardado con ese nombre');
      // El formulario de edición se queda abierto (no se pierde lo escrito) en
      // vez de volver silenciosamente a la vista normal — el donante puede
      // corregir el nombre y reintentar sin tener que volver a abrir "Editar".
      await expect(page.locator('#input-editar-emp')).toHaveValue('Empresa Demo SRL (renombrada)');
      await page.click('.empleador-item button:has-text("Cancelar")');
      // Tras cancelar, ninguno de los dos nombres se duplicó ni se perdió.
      await expect(page.locator('#empleadores-lista')).toContainText('Segundo Empleador SA');
      await expect(page.locator('#empleadores-lista')).toContainText('Empresa Demo SRL (renombrada)');

      // Limpiar el segundo empleador para no ensuciar los pasos siguientes del test.
      await page.click('.empleador-item[data-nombre="Segundo Empleador SA"] button[title="Eliminar"]');
      await expect(page.locator('#empleadores-lista')).not.toContainText('Segundo Empleador SA');
    });

    await test.step('recargar la página y verificar que todo persiste', async () => {
      await page.reload();

      await expect(page.locator('#input-telefono')).toHaveValue('11-2222-3333');
      await expect(page.locator('#input-fecha-nacimiento')).toHaveValue('1998-04-10');
      await expect(page.locator('#input-dni')).toHaveValue('40123456');
      await expect(page.locator('#input-provincia')).toHaveValue('Córdoba');
      await expect(page.locator('#input-ciudad')).toHaveValue('Villa Carlos Paz');
      await expect(page.locator('#perfil-badge-sangre')).toBeHidden();

      await page.click('#sec-medicos .seccion-header');
      await expect(page.locator('.sangre-opt[data-tipo="A+"]')).toHaveClass(/selected/);
      await expect(page.locator('#input-peso')).toHaveValue('65');
      await expect(page.locator('#input-experiencia')).toHaveValue('habitual');
      await expect(page.locator('#input-condiciones')).toHaveValue('Ninguna');

      await page.click('#sec-notif .seccion-header');
      await expect(page.locator('#notif-urgentes')).toBeChecked();
      await expect(page.locator('#notif-resultado')).not.toBeChecked();

      await page.click('#sec-laboral .seccion-header');
      await expect(page.locator('#empleadores-lista')).toContainText('Empresa Demo SRL');
    });

    await test.step('eliminar el empleador agregado', async () => {
      await page.click('#empleadores-lista button[title="Eliminar"]');
      await expect(page.locator('#empleadores-lista')).not.toContainText('Empresa Demo SRL');
      await expect(page.locator('#empleadores-lista')).toContainText('Todavía no agregaste');
    });
  });

});
