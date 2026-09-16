/**
 * Test E2E del select personalizado (`HemoRed.ui.mejorarSelects()`, ver
 * `frontend/js/ui.js` + `.hr-select-*` en `frontend/estilos/global.css`),
 * agregado 2026-09-15 a pedido explícito de la usuaria: el color de
 * resaltado de las opciones de un `<select>` nativo (el azul del sistema
 * operativo) no se puede cambiar con CSS en ningún navegador — por eso
 * cada `<select>` del sitio se reemplaza visualmente por un botón + una
 * lista propia, coloreada con la paleta de la marca.
 *
 * Contexto importante:
 * - El `<select>` real sigue existiendo en el DOM (mismo id, mismo
 *   `.value`), solo queda oculto — así todo el código de cada pantalla que
 *   ya lee/escribe `.value` en un select sigue funcionando sin cambios.
 *   Por eso este test también verifica el "camino largo": que elegir una
 *   opción en el panel personalizado realmente dispare el comportamiento
 *   de la pantalla (folder ejemplo: filtrar campañas), no solo que el
 *   panel visual se vea bien.
 * - Las asignaciones programáticas (`elemento.value = x`, que la app hace
 *   todo el tiempo para precargar formularios) no disparan ningún evento
 *   nativo — se interceptan con `Object.defineProperty` para mantener
 *   sincronizado el botón. Este test lo prueba entrando a un perfil ya
 *   completado (cuenta demo) y confirmando que el botón ya muestra el
 *   valor guardado sin haber hecho ningún click.
 */

const { test, expect } = require('@playwright/test');

test.describe('Select personalizado (todas las pantallas)', () => {

  test('abrir, resaltar en rosa y elegir una opción filtra de verdad', async ({ page }) => {
    await page.goto('/publico/login.html');
    await page.fill('#email', 'donante@hemored.com');
    await page.fill('#password', 'donante123');
    await page.click('.form-btn');
    await page.waitForURL('**/donante/dashboard.html');
    // renderCampanas() es async (espera HemoRed.db.init()) — sin esta
    // espera, el paso de más abajo que filtra por Córdoba puede correr
    // ANTES de que existan las tarjetas, y "0 resultados" da un falso
    // positivo (no porque filtró de verdad, sino porque nunca hubo nada
    // que mostrar todavía).
    await page.waitForSelector('.campaign-card');

    await test.step('el <select> real queda invisible y sin poder clickearse, el botón lo reemplaza en su lugar', async () => {
      // No se usa toBeHidden(): a propósito el <select> real conserva un
      // bounding box real (no width/height 0) para que Playwright pueda
      // seguir usando selectOption() sobre él en otros tests — la
      // invisibilidad es por opacity, no por display/visibility, así que
      // se verifica directo el estilo computado en vez de la visibilidad
      // "de Playwright".
      const nativo = page.locator('#f-provincia');
      await expect(nativo).toHaveCSS('opacity', '0');
      await expect(nativo).toHaveCSS('pointer-events', 'none');
      await expect(page.locator('#f-provincia + button.hr-select-trigger')).toBeVisible();
    });

    await test.step('al abrirlo aparece un panel propio (no el popup nativo del navegador)', async () => {
      await page.locator('#f-provincia + button').click();
      await expect(page.locator('.hr-select-panel')).toBeVisible();
      await expect(page.locator('.hr-select-option')).toHaveCount(25); // "Provincia" + 24 jurisdicciones
    });

    await test.step('la opción resaltada usa el rosa de la marca, no el azul del navegador', async () => {
      const opcion = page.locator('.hr-select-option', { hasText: 'Córdoba' });
      await opcion.hover();
      await expect(opcion).toHaveClass(/hr-select-highlight/);
      const color = await opcion.evaluate(el => getComputedStyle(el).backgroundColor);
      // #fdf0f3 (--color-rosa-pale) en rgb
      expect(color).toBe('rgb(253, 240, 243)');
    });

    await test.step('elegirla actualiza el botón, el <select> real, y filtra las campañas de verdad', async () => {
      await page.locator('.hr-select-option', { hasText: 'Córdoba' }).click();
      await expect(page.locator('#f-provincia + button .hr-select-label')).toHaveText('Córdoba');
      await expect(page.locator('#f-provincia')).toHaveValue('Córdoba');
      // Los datos semilla no tienen ninguna campaña en Córdoba — confirma
      // que filtrarCampanas() reaccionó de verdad al cambio, no solo la UI.
      await expect(page.locator('#sin-resultados-campanas')).toBeVisible();
    });

    await test.step('Escape cierra el panel sin cambiar nada', async () => {
      await page.locator('#f-sangre + button').click();
      await expect(page.locator('.hr-select-panel')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('.hr-select-panel')).toHaveCount(0);
      await expect(page.locator('#f-sangre')).toHaveValue('');
    });

    await test.step('click afuera también lo cierra', async () => {
      await page.locator('#f-orden + button').click();
      await expect(page.locator('.hr-select-panel')).toBeVisible();
      await page.click('.campaigns-title');
      await expect(page.locator('.hr-select-panel')).toHaveCount(0);
    });
  });

  test('un select bloqueado (disabled) no abre el panel al clickearlo', async ({ page }) => {
    // La cuenta demo ya tiene "¿Donaste antes?" completado — el select
    // queda con `disabled = true` (escritura única, ver docs/01).
    await page.goto('/publico/login.html');
    await page.fill('#email', 'donante@hemored.com');
    await page.fill('#password', 'donante123');
    await page.click('.form-btn');
    await page.waitForURL('**/donante/dashboard.html');
    await page.goto('/donante/perfil.html');
    await page.click('.seccion-header:has-text("Datos médicos")');

    const trigger = page.locator('#input-experiencia + button');
    await expect(trigger).toHaveClass(/hr-select-disabled/);
    await trigger.click({ force: true }); // force: el propio botón queda con cursor not-allowed
    await expect(page.locator('.hr-select-panel')).toHaveCount(0);
  });

  test('una asignación programática de .value (precargar el perfil) sincroniza el botón sin ningún click', async ({ page }) => {
    // Entrar a un perfil ya cargado (cuenta demo) hace que `cargarPerfil()`
    // asigne `input-provincia.value = 'Buenos Aires'` por código — sin la
    // sincronización vía Object.defineProperty, el botón se quedaría
    // mostrando el placeholder en vez del valor real.
    await page.goto('/publico/login.html');
    await page.fill('#email', 'donante@hemored.com');
    await page.fill('#password', 'donante123');
    await page.click('.form-btn');
    await page.waitForURL('**/donante/dashboard.html');
    await page.goto('/donante/perfil.html');

    await expect(page.locator('#input-provincia + button .hr-select-label')).toHaveText('Buenos Aires');
  });

  test('no genera scroll horizontal en mobile (bug real encontrado y corregido)', async ({ page }) => {
    // El <select> real queda position:absolute + opacity:0 pero SIN
    // colapsar a tamaño 0 (ver arriba, para que Playwright siga usando
    // selectOption()). Eso casi genera un regresión real: sin ancestro
    // `position:relative` en casi ninguna pantalla del sitio, un
    // `width:100%` heredado de `.form-input` se resolvía contra el
    // viewport completo en vez de su contenedor original, generando
    // scroll horizontal en cualquier pantalla con ese tipo de select
    // (encontrado por la usuaria en publico/pago.html y contacto.html,
    // pero afectaba a cualquier página con selects `.form-input` — ver
    // `.hr-select-native` en global.css, forzado a 1x1px por esto mismo).
    await page.setViewportSize({ width: 375, height: 800 });
    for (const url of ['/publico/contacto.html', '/publico/pago.html']) {
      await page.goto(url);
      await page.waitForTimeout(200);
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth, `${url} no debería generar scroll horizontal`).toBeLessThanOrEqual(clientWidth);
    }
  });

  test('publico/pago.html y publico/contacto.html también tienen el select personalizado', async ({ page }) => {
    // Estas 2 pantallas son mockups estáticos que nunca cargaron el
    // framework de HemoRed (ni siquiera db.js) — se les agregó db.js+ui.js
    // únicamente para este componente (ver docs/04).
    await page.goto('/publico/pago.html');
    await expect(page.locator('#pago-condicion-iva + button.hr-select-trigger')).toBeVisible();

    await page.goto('/publico/contacto.html');
    const selects = ['c-provincia', 'c-campanas-mes', 'c-simultaneas', 'c-horario'];
    for (const id of selects) {
      await expect(page.locator(`#${id} + button.hr-select-trigger`)).toBeVisible();
    }
    await page.locator('#c-provincia + button').click();
    await page.locator('.hr-select-option', { hasText: 'Mendoza' }).click();
    await expect(page.locator('#c-provincia')).toHaveValue('Mendoza');
  });

  test('el panel no genera scroll horizontal interno con opciones largas, y se puede scrollear para ver las de más abajo', async ({ page }) => {
    // Bug real #1: el panel se achicaba al ancho exacto del botón (ej.
    // "Provincia" ≈100px) — una opción larga como "Santiago del Estero" no
    // entraba, y como el panel tiene `overflow-y:auto`, el navegador agrega
    // `overflow-x:auto` solo (regla del spec de CSS, no pedida), generando
    // scroll horizontal ADENTRO del panel. Se probaron 2 arreglos que la
    // usuaria rechazó por verse mal: ensanchar el panel más que el botón
    // (quedaba desproporcionado), y partir el texto largo en 2 líneas
    // (partía palabras a la mitad, ej. "Catamarc"+"a"). **Arreglo final:**
    // ensanchar el CAMPO (`.filter-select`, `min-width:200px`) para que el
    // contenido más largo entre en una sola línea sin partirse — el panel
    // simplemente copia el ancho del campo (quedan siempre proporcionados
    // entre sí), con `overflow-x:hidden` explícito como red de seguridad.
    // Bug real #2: al scrollear DENTRO del panel para llegar a las
    // opciones de más abajo (la lista de 24 provincias no entra completa
    // en los 260px de alto), el panel se cerraba solo — el listener que
    // cierra el panel al scrollear la página de atrás no distinguía el
    // scroll interno del panel del scroll de la página.
    await page.goto('/publico/login.html');
    await page.fill('#email', 'donante@hemored.com');
    await page.fill('#password', 'donante123');
    await page.click('.form-btn');
    await page.waitForURL('**/donante/dashboard.html');

    await page.locator('#f-provincia + button').click();
    const panel = page.locator('.hr-select-panel');
    await expect(panel).toBeVisible();

    // Bajar hasta el final de la lista (scroll DENTRO del panel).
    await page.mouse.move(...(await panel.boundingBox().then(b => [b.x + b.width / 2, b.y + b.height / 2])));
    await page.mouse.wheel(0, 600);
    await expect(panel, 'el panel no debería cerrarse al scrollear adentro').toBeVisible();

    const opcionLarga = page.locator('.hr-select-option', { hasText: 'Santiago del Estero' });
    await expect(opcionLarga).toBeVisible();
    const [panelBox, opcionBox] = await Promise.all([panel.boundingBox(), opcionLarga.boundingBox()]);
    // La opción completa (sin cortarse) tiene que entrar dentro del ancho del panel.
    expect(opcionBox.x + opcionBox.width).toBeLessThanOrEqual(panelBox.x + panelBox.width + 1);
    const overflowX = await panel.evaluate(el => getComputedStyle(el).overflowX);
    expect(overflowX).toBe('hidden');
  });

});
