// Configuración de Playwright para el test E2E del prototipo HemoRed.
//
// ¿Qué es Playwright? Una librería que abre un navegador de verdad (Chromium,
// sin ventana visible por defecto = "headless") y lo maneja por código: entra
// a una URL, hace click, completa formularios, y verifica qué aparece en
// pantalla. Es la forma correcta de probar "¿esto funciona en el navegador?"
// en vez de solo leer el código y asumir que va a andar.
//
// Docs oficiales: https://playwright.dev/docs/test-configuration

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  // Dónde están los archivos de test (los que terminan en .spec.js)
  testDir: '.',

  // Tiempo máximo que puede tardar UN test completo antes de marcarse como fallido.
  timeout: 30 * 1000,

  // Si un assert (expect) falla, cuánto tiempo reintenta antes de darse por vencido.
  // Útil porque el navegador puede tardar un toque en renderizar después de un click.
  expect: { timeout: 5000 },

  // No reintentar tests fallidos en desarrollo local (sí tendría sentido en un CI).
  retries: 0,

  // Un solo worker: los tests de este proyecto comparten el mismo servidor
  // y la misma "base de datos" simulada en localStorage, así que no conviene
  // correrlos en paralelo (se pisarían entre sí).
  workers: 1,

  // Reporte HTML navegable al terminar (se abre con `npm run report`).
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    // URL base: así en el test escribimos '/donante/dashboard.html' en vez
    // de 'http://localhost:8791/donante/dashboard.html' cada vez.
    baseURL: 'http://localhost:8791',

    // Guarda una captura de pantalla automáticamente si un test falla,
    // para poder ver "en qué pantalla exacta se rompió" sin tener que
    // reproducirlo a mano.
    screenshot: 'only-on-failure',

    // Graba un video solo si falla (ayuda mucho para flujos de varios pasos).
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Playwright levanta este comando ANTES de correr los tests, espera a que
  // la URL responda, corre los tests, y lo apaga al terminar. Si ya tenés
  // el server corriendo manualmente (ej. porque lo usás vos para mirar la
  // página), reusa ese en vez de levantar uno nuevo (reuseExistingServer).
  webServer: {
    // Sirve la carpeta frontend/ (tests/ vive en la raíz del repo, al lado
    // de frontend/, no adentro — así queda afuera de lo que se publica en
    // GitHub Pages, que solo sube frontend/ tal cual).
    // Requiere Python (ya usado en el resto del proyecto, ver /README.md).
    // Si no tenés Python instalado, reemplazá este comando por:
    //   'npx serve -l 8791 ../frontend'
    command: 'python -m http.server 8791 --directory ../frontend',
    url: 'http://localhost:8791/index.html',
    reuseExistingServer: true,
    timeout: 15 * 1000,
  },
});
