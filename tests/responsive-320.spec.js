/**
 * Test E2E de "no hay scroll horizontal" en las pantallas de Donante a
 * 320px de ancho (el celular más chico que sigue siendo común, ej. iPhone
 * SE 1ª gen), agregado 2026-09-23 tras una auditoría de responsive pedida
 * por la usuaria ("en mobile veo vistas que no estan ajustadas").
 *
 * A 375px (el ancho que se venía usando de referencia) varias de estas
 * pantallas ya pasaban por casualidad, pero el bug de fondo seguía ahí: un
 * elemento de flex nunca se achica más allá del contenido más "terco" que
 * tenga adentro (el default CSS es min-width:auto, no 0) — sin
 * `min-width: 0` explícito en cada nivel de la cadena, ese ancho mínimo se
 * propaga hacia arriba y termina agrandando TODA la página en vez de
 * forzar a wrappear/apilarse solo al elemento que no entraba. Se corrigió
 * en la base (`.main`) y en cada componente puntual que lo necesitaba
 * (`.pb-text` del banner de próximo turno, `.turno-info`/`.turno-top-row`
 * de las tarjetas de turno, `.perfil-header`, `.steps-indicator` de
 * campana_detalle.html, `.notif-item`). Ver docs/04-estado-actual-
 * prototipo.md, "Auditoría de responsive — rol Donante (segunda vuelta,
 * 320px)".
 *
 * Este test no revisa el diseño pixel a pixel — solo confirma la
 * propiedad más básica y objetiva: que `document.documentElement`
 * no necesite scrollear horizontalmente. Es la señal más confiable de
 * este tipo de bug (más que una captura de pantalla, que en `fullPage`
 * puede llegar a ESCONDER un desborde horizontal en vez de mostrarlo).
 */

const { test, expect } = require('@playwright/test');

async function sinScrollHorizontal(page) {
  const { vw, sw } = await page.evaluate(() => ({
    vw: document.documentElement.clientWidth,
    sw: document.documentElement.scrollWidth,
  }));
  expect(sw, `documentElement.scrollWidth (${sw}) no debería superar clientWidth (${vw})`).toBeLessThanOrEqual(vw + 1);
}

test.describe('Sin scroll horizontal en Donante a 320px', () => {

  test('pantallas principales con la cuenta demo', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto('/publico/login.html');
    await page.fill('#email', 'donante@hemored.com');
    await page.fill('#password', 'donante123');
    await page.click('.form-btn');
    await page.waitForURL('**/donante/dashboard.html');
    await sinScrollHorizontal(page);

    for (const url of ['mis_turnos.html', 'mis_donaciones.html', 'mis_documentos.html', 'perfil.html', 'notificaciones.html']) {
      await page.goto('/donante/' + url);
      await page.waitForLoadState('networkidle');
      await sinScrollHorizontal(page);
    }
  });

  test('la tarjeta de turno con formularios pendientes no desborda (mis_turnos.html)', async ({ page }) => {
    // Este es el caso puntual que disparó el hallazgo: una tarjeta con
    // fecha + hospital + badge + botones + el cuadro de "Formularios
    // pre-donación" con sus 2 pastillas, todo en la fila de arriba.
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto('/publico/login.html');
    await page.fill('#email', 'donante@hemored.com');
    await page.fill('#password', 'donante123');
    await page.click('.form-btn');
    await page.waitForURL('**/donante/dashboard.html');
    await page.goto('/donante/mis_turnos.html');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.forms-row')).toBeVisible();
    await sinScrollHorizontal(page);
  });

  test('los 4 pasos del wizard de reserva no desbordan (campana_detalle.html)', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    const ts = Date.now();
    await page.goto('/publico/registro.html');
    await page.click('text=Soy donante');
    await page.fill('#d-nombre', 'Marina');
    await page.fill('#d-apellido', 'Testigo');
    await page.fill('#d-email', `donante.responsive320.${ts}@example.com`);
    await page.fill('#d-tel', '11-5555-4444');
    await page.fill('#d-pass', 'password123');
    await page.fill('#d-pass2', 'password123');
    await page.click('#btn-crear-cuenta-donante');
    await page.waitForURL('**/donante/dashboard.html');

    await page.locator('.campaign-btn').first().click();
    await page.waitForURL('**/campana_detalle.html**');
    await sinScrollHorizontal(page); // paso 1

    await page.click('#btn-reservar');
    const tabs = page.locator('.fecha-tab');
    await tabs.first().waitFor();
    await sinScrollHorizontal(page); // paso 2, el steps-indicator con las 4 etiquetas es el más ancho

    await tabs.nth(3).click();
    await page.locator('.turno-opt[data-hora]').first().click();
    await page.click('#btn-continuar');
    await sinScrollHorizontal(page); // paso 3

    await page.click('#btn-confirmar-reserva');
    await sinScrollHorizontal(page); // paso 4
  });

  test('perfil.html: el header no tiene elementos superpuestos y los campos van uno debajo del otro', async ({ page }) => {
    // Bug real, reportado por la usuaria con una captura: a este ancho
    // "Sofía Páez" se superponía con la barra de "Perfil completado", y
    // Nombre/Apellido (y el resto de los pares del formulario) seguían
    // mostrándose en 2 columnas apretadas en vez de una debajo de otra.
    // Causa real: varias reglas de "@media" para mobile estaban ubicadas
    // ANTES en el archivo que las reglas base que debían anular — con
    // igual especificidad, gana la que aparece más abajo en el archivo,
    // así que la regla base "ganaba" de nuevo y la de mobile no hacía
    // nada. Se corrigió moviendo todo el bloque de reglas de mobile al
    // final de donante.css (ver el comentario ahí). Un chequeo de
    // scrollWidth (como el resto de este archivo) no detecta este tipo de
    // bug — dos elementos superpuestos no generan scroll horizontal, así
    // que este test compara posiciones/tamaños reales en vez de eso.
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto('/publico/login.html');
    await page.fill('#email', 'donante@hemored.com');
    await page.fill('#password', 'donante123');
    await page.click('.form-btn');
    await page.waitForURL('**/donante/dashboard.html');
    await page.goto('/donante/perfil.html');
    await page.waitForLoadState('networkidle');

    const infoBox = await page.locator('.perfil-info').boundingBox();
    const completitudBox = await page.locator('.perfil-completitud').boundingBox();
    // No se pisan verticalmente: el bloque de completitud empieza donde
    // termina el de info (o más abajo), no en el medio.
    expect(completitudBox.y).toBeGreaterThanOrEqual(infoBox.y + infoBox.height - 1);

    const nombreBox = await page.locator('#input-nombre').boundingBox();
    const apellidoBox = await page.locator('#input-apellido').boundingBox();
    // Un campo por fila: Apellido tiene que estar DEBAJO de Nombre, no al
    // lado (misma fila = misma "y" aproximada).
    expect(apellidoBox.y).toBeGreaterThan(nombreBox.y + nombreBox.height / 2);
    // Y cada campo ocupa (casi) todo el ancho disponible, no la mitad.
    expect(nombreBox.width).toBeGreaterThan(200);
  });

  test('mis_documentos.html: las 3 vistas de detalle (Ver resultado/evaluación/certificado) no desbordan', async ({ page }) => {
    // Estas 3 vistas no se ven en la lista principal de mis_documentos.html
    // — se llega haciendo click en "Ver" desde una tarjeta — así que
    // quedaron afuera de la primera y segunda vuelta de esta auditoría. La
    // usuaria las encontró rotas con capturas reales: el grid de 2
    // columnas de "Evaluación clínica" (presión, pulso, temperatura, etc.,
    // cada celda con 3 líneas de texto) y el de "Certificado" (fecha,
    // profesional, emitido para, número) no se achicaban a 1 columna en
    // mobile.
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto('/publico/login.html');
    await page.fill('#email', 'donante@hemored.com');
    await page.fill('#password', 'donante123');
    await page.click('.form-btn');
    await page.waitForURL('**/donante/dashboard.html');
    await page.goto('/donante/mis_documentos.html');
    await page.waitForLoadState('networkidle');

    await page.locator('#tab-resultados .doc-card').first().locator('button:has-text("Ver")').click();
    await sinScrollHorizontal(page);
    await page.click('.view.active .back-btn');

    await page.click('text=Evaluaciones clínicas');
    await page.locator('#tab-evaluaciones .doc-card').first().locator('button:has-text("Ver")').click();
    await sinScrollHorizontal(page);
    // El grid de signos vitales tiene que quedar en 1 columna, no 2.
    const cols = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.signos-vitales-grid')).gridTemplateColumns.split(' ').length);
    expect(cols).toBe(1);
    await page.click('.view.active .back-btn');

    await page.click('text=Certificados');
    await page.locator('#tab-certificados .doc-card').first().locator('button:has-text("Ver")').click();
    await sinScrollHorizontal(page);
  });

  test('campana_detalle.html: el topbar no desborda con un título largo o corto (back-link + separador + ícono)', async ({ page }) => {
    // Bug real: "← Campañas / Confirmación" + el ícono de notificaciones a
    // la derecha desbordaba 8px en el paso 3 del wizard (320px), aunque el
    // título de otros pasos (más largo, ej. "Detalle de campaña") no lo
    // disparaba — el título no se achicaba nunca (sin min-width:0), así
    // que alcanzaba con estar justo en el límite. Se corrigió con
    // min-width:0 + elipsis en .topbar-title en vez de wrappear (cambiaría
    // el alto de la barra, que es sticky).
    await page.setViewportSize({ width: 320, height: 900 });
    const ts = Date.now();
    await page.goto('/publico/registro.html');
    await page.click('text=Soy donante');
    await page.fill('#d-nombre', 'Marina');
    await page.fill('#d-apellido', 'Testigo');
    await page.fill('#d-email', `donante.topbar320.${ts}@example.com`);
    await page.fill('#d-tel', '11-5555-4444');
    await page.fill('#d-pass', 'password123');
    await page.fill('#d-pass2', 'password123');
    await page.click('#btn-crear-cuenta-donante');
    await page.waitForURL('**/donante/dashboard.html');

    await page.locator('.campaign-btn').first().click();
    await page.waitForURL('**/campana_detalle.html**');
    await page.click('#btn-reservar');
    const tabs = page.locator('.fecha-tab');
    await tabs.first().waitFor();
    await tabs.nth(3).click();
    await page.locator('.turno-opt[data-hora]').first().click();
    await page.click('#btn-continuar');
    await expect(page.locator('#topbar-title')).toHaveText('Confirmación');
    await sinScrollHorizontal(page);
  });

  test('mis_documentos.html: la tarjeta de documento va ícono → badge/botones → detalle, y el detalle de resultado no queda en 2 columnas', async ({ page }) => {
    // Pedido explícito de la usuaria, con capturas: el orden visual de
    // .doc-card en mobile debe ser ícono arriba, después el badge + los
    // botones Ver/Descargar (más anchos que antes), y el título/fecha al
    // final — antes el detalle iba primero. Se implementó con `order` en
    // CSS, así que un chequeo de posición real (no de orden en el DOM) es
    // la única forma de confirmar que se ve como se pidió.
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto('/publico/login.html');
    await page.fill('#email', 'donante@hemored.com');
    await page.fill('#password', 'donante123');
    await page.click('.form-btn');
    await page.waitForURL('**/donante/dashboard.html');
    await page.goto('/donante/mis_documentos.html');
    await page.waitForLoadState('networkidle');

    const card = page.locator('#tab-resultados .doc-card').first();
    const iconBox = await card.locator('.doc-icon').boundingBox();
    const rightBox = await card.locator('.doc-right').boundingBox();
    const infoBox = await card.locator('.doc-info').boundingBox();
    expect(iconBox.y).toBeLessThan(rightBox.y);
    expect(rightBox.y).toBeLessThan(infoBox.y);

    // Los 2 botones (Ver/Descargar) se reparten el ancho disponible, no
    // quedan angostos del tamaño de su propio contenido.
    const verBtn = card.locator('button:has-text("Ver")');
    const verBox = await verBtn.boundingBox();
    expect(verBox.width).toBeGreaterThan(100);

    // Detalle de "Resultado de análisis": Donante/Grupo sanguíneo/
    // Laboratorio/Nro. de bolsa, un dato por fila (antes 2 por fila).
    await verBtn.click();
    const donanteBox = await page.locator('.resultado-meta .meta-item').nth(0).boundingBox();
    const grupoBox = await page.locator('.resultado-meta .meta-item').nth(1).boundingBox();
    expect(grupoBox.y).toBeGreaterThan(donanteBox.y + donanteBox.height / 2);
  });
});
