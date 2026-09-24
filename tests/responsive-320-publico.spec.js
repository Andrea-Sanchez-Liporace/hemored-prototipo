/**
 * Test E2E de "no hay scroll horizontal" en las 10 páginas públicas
 * (index.html + las 9 de publico/) a 320px de ancho, agregado 2026-09-23
 * a pedido explícito de la usuaria de escanear todo el sitio público en
 * busca de bugs (mismo criterio que responsive-320.spec.js, ya aplicado
 * al rol Donante).
 *
 * El único caso real que encontró esta auditoría fue publico/pago.html:
 * `.metodos` es un grid de 3 columnas (Tarjeta/Transferencia/Mercado
 * Pago) y por default un ítem de grid no se achica más allá del ancho de
 * su contenido (min-width:auto) — "Transferencia" es una sola palabra
 * sin espacios, así que a 320px esa columna no podía angostarse lo
 * suficiente y desbordaba toda la tarjeta de pago 10px. Se corrigió con
 * `min-width: 0` en `.metodo-opt` + `overflow-wrap: break-word` en
 * `.metodo-name`. Ver docs/04-estado-actual-prototipo.md, "Público /
 * Onboarding".
 */

const { test, expect } = require('@playwright/test');

async function sinScrollHorizontal(page) {
  const { vw, sw } = await page.evaluate(() => ({
    vw: document.documentElement.clientWidth,
    sw: document.documentElement.scrollWidth,
  }));
  expect(sw, `documentElement.scrollWidth (${sw}) no debería superar clientWidth (${vw})`).toBeLessThanOrEqual(vw + 1);
}

const PAGINAS_PUBLICAS = [
  '/index.html',
  '/publico/nosotros.html',
  '/publico/contacto.html',
  '/publico/terminos.html',
  '/publico/privacidad.html',
  '/publico/login.html',
  '/publico/registro.html',
  '/publico/recuperar.html',
  '/publico/pago.html',
  '/publico/cuenta_pendiente.html',
];

test.describe('Sin scroll horizontal en el sitio público a 320px', () => {

  test('las 10 páginas públicas no desbordan', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    for (const url of PAGINAS_PUBLICAS) {
      await page.goto(url);
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
      await sinScrollHorizontal(page);
    }
  });

  test('los 3 métodos de pago ("Tarjeta"/"Transferencia"/"Mercado Pago") entran sin desbordar la tarjeta', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto('/publico/pago.html');
    await sinScrollHorizontal(page);

    const formCard = page.locator('.form-card');
    const metodos = page.locator('.metodo-opt');
    const cardBox = await formCard.boundingBox();
    const count = await metodos.count();
    expect(count).toBe(3);
    for (let i = 0; i < count; i++) {
      const box = await metodos.nth(i).boundingBox();
      expect(box.x + box.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1);
    }
  });

});
