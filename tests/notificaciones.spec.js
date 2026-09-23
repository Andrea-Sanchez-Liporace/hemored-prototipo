/**
 * Test E2E de "Notificaciones" del donante — pasó de ser 100% estática (6
 * tarjetas fijas en el HTML, "Marcar todas como leídas" sin `onclick`) a
 * leer datos reales de la tabla nueva `notificaciones_donante`.
 *
 * Contexto importante:
 * - Se convirtieron los 6 ejemplos estáticos originales en datos semilla
 *   reales (`frontend/db/notificaciones_donante.json`), agrupados por
 *   'hoy'/'ayer'/'semana'/'antes' contra la fecha real del navegador
 *   (`HemoRed.data.ahora()`, corregido 2026-09-16 — antes era una fecha
 *   fija de demo, ver docs/04).
 * - Los 6 ejemplos semilla de la cuenta demo están fechados en mayo 2026 a
 *   propósito (van con la donación real de esa cuenta, que tampoco se
 *   tocó) — contra la fecha real de hoy, los 6 caen en el grupo "Más
 *   antiguas", no en Hoy/Ayer/Esta semana. Para probar esos 3 grupos de
 *   verdad se arma un donante fresco con notificaciones creadas a
 *   propósito con fecha real de hoy/ayer/hace unos días.
 * - Es también el destino de la notificación que genera
 *   `resolverSolicitudCorreccion()` al rechazar una solicitud de corrección
 *   (ver `solicitudes-correccion.spec.js` para ese caso específico) — este
 *   archivo prueba la pantalla en sí, con los datos semilla.
 */

const { test, expect } = require('@playwright/test');

test.describe('Notificaciones (donante)', () => {

  test('carga datos reales, filtra por tipo y marca como leídas', async ({ page }) => {
    await test.step('loguearse y entrar a Notificaciones', async () => {
      await page.goto('/publico/login.html');
      await page.fill('#email', 'donante@hemored.com');
      await page.fill('#password', 'donante123');
      await page.click('button:has-text("Iniciar sesión")');
      await page.goto('/donante/notificaciones.html');
    });

    await test.step('se ven los 6 ejemplos reales, agrupados en "Más antiguas" (son de mayo 2026, ya lejos de hoy)', async () => {
      await expect(page.locator('.notif-item')).toHaveCount(6);
      const grupo = page.locator('.notif-group', { hasText: 'Más antiguas' });
      await expect(grupo).toContainText('Tu certificado está listo');
      await expect(grupo).toContainText('Recordatorio de turno');
      await expect(grupo).toContainText('¡Gracias por tu donación!');
      await expect(page.locator('.notif-group')).toHaveCount(1); // un solo grupo, no Hoy/Ayer/Semana
      // 3 de los 6 datos semilla arrancan sin leer
      await expect(page.locator('.notif-item.unread')).toHaveCount(3);
    });

    await test.step('el filtro "Documentos" muestra solo esas notificaciones', async () => {
      await page.click('.filtro-chip:has-text("Documentos")');
      await expect(page.locator('.notif-item:visible')).toHaveCount(2);
      await page.click('.filtro-chip:has-text("Todas")');
    });

    await test.step('el filtro "No leídas" muestra solo las 3 sin leer', async () => {
      await page.click('.filtro-chip:has-text("No leídas")');
      await expect(page.locator('.notif-item:visible')).toHaveCount(3);
    });

    await test.step('clickear una notificación la marca como leída (persiste tras recargar)', async () => {
      await page.click('.filtro-chip:has-text("Todas")');
      const item = page.locator('.notif-item', { hasText: 'Turno confirmado' });
      await expect(item).toHaveClass(/unread/);
      await item.click();
      await expect(item).not.toHaveClass(/unread/);
      await page.reload();
      await expect(page.locator('.notif-item', { hasText: 'Turno confirmado' })).not.toHaveClass(/unread/);
    });

    await test.step('"Marcar todas como leídas" deja todo sin marca', async () => {
      // 2026-09-23: pasó de un botón de texto a un ícono en la topbar
      // (mismo estilo que el resto de las pantallas, ver docs/04) — se
      // identifica por el tooltip, no por texto visible.
      await page.click('[data-tooltip="Marcar todas como leídas"]');
      await expect(page.locator('.toast')).toContainText('Todas marcadas como leídas');
      await expect(page.locator('.notif-item.unread')).toHaveCount(0);
      await page.reload();
      await expect(page.locator('.notif-item.unread')).toHaveCount(0);
    });
  });

  test('agrupa Hoy/Ayer/Esta semana contra la fecha real, con notificaciones frescas', async ({ page }) => {
    await page.goto('/publico/registro.html');
    await page.click('text=Soy donante');
    await page.fill('#d-nombre', 'Fresca');
    await page.fill('#d-apellido', 'Testigo');
    await page.fill('#d-email', `donante.notif.${Date.now()}@example.com`);
    await page.fill('#d-tel', '11-2222-2222');
    await page.fill('#d-pass', 'password123');
    await page.fill('#d-pass2', 'password123');
    await page.click('#btn-crear-cuenta-donante');
    await page.waitForURL('**/donante/dashboard.html');

    await page.evaluate(async () => {
      await HemoRed.db.init();
      const s = HemoRed.sesion.get();
      const donante = HemoRed.db.where('usuarios', 'email', s.email)[0];
      const base = { usuario_id: donante.id, tipo: 'campanas', icono: 'ti-heart', tono: 'rosa', leido: false, accion_texto: null, accion_url: null };
      // La agrupación compara por DÍA de calendario (n.fecha.slice(0,10)),
      // no por "hace X horas" — se arma con setDate() para no depender de
      // en qué momento del día real corra el test (restar milisegundos
      // crudos podría caer del lado equivocado de la medianoche).
      const diasAtras = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); };
      HemoRed.db.crear('notificaciones_donante', { ...base, titulo: 'Notificación de hoy', descripcion: 'x', fecha: diasAtras(0) });
      HemoRed.db.crear('notificaciones_donante', { ...base, titulo: 'Notificación de ayer', descripcion: 'x', fecha: diasAtras(1) });
      HemoRed.db.crear('notificaciones_donante', { ...base, titulo: 'Notificación de esta semana', descripcion: 'x', fecha: diasAtras(4) });
      HemoRed.db.crear('notificaciones_donante', { ...base, titulo: 'Notificación vieja', descripcion: 'x', fecha: diasAtras(30) });
    });
    await page.goto('/donante/notificaciones.html');

    await expect(page.locator('.notif-group', { hasText: 'Hoy' })).toContainText('Notificación de hoy');
    await expect(page.locator('.notif-group', { hasText: 'Ayer' })).toContainText('Notificación de ayer');
    await expect(page.locator('.notif-group', { hasText: 'Esta semana' })).toContainText('Notificación de esta semana');
    await expect(page.locator('.notif-group', { hasText: 'Más antiguas' })).toContainText('Notificación vieja');
  });

});
