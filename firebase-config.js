/* ============================================================
   INFO 7 · Cintillo — Credenciales de Firebase Realtime Database
   ------------------------------------------------------------
   1) Crea un proyecto gratis en https://console.firebase.google.com
   2) Realtime Database → Crear base de datos (modo de prueba)
   3) Configuración del proyecto (⚙️) → "Tus apps" → app Web (</>) → copia el objeto firebaseConfig
   4) Pega tus valores aquí abajo (entre las comillas) y agrega "databaseURL".

   Mientras "databaseURL" esté vacío, control.html y render.html siguen
   funcionando en modo LOCAL (mismo navegador) vía BroadcastChannel.
   Con credenciales válidas, se sincronizan por internet entre equipos distintos.
   ============================================================ */
window.INFO7_FIREBASE_CONFIG = {
  apiKey:            "PEGA_AQUI_TU_apiKey",
  authDomain:        "PEGA_AQUI_TU_authDomain",
  databaseURL:       "PEGA_AQUI_TU_databaseURL",   // ← IMPRESCINDIBLE (lo da Realtime Database)
  projectId:         "PEGA_AQUI_TU_projectId",
  storageBucket:     "PEGA_AQUI_TU_storageBucket",
  messagingSenderId: "PEGA_AQUI_TU_messagingSenderId",
  appId:             "PEGA_AQUI_TU_appId",

  // ── Rutas (NO las cambies si no sabes; deben coincidir con el Apps Script) ──

  // Estado del cintillo AL AIRE (control → render).
  path: "info7/cintillo",

  // Escaleta compartida entre operadores.
  rundownPath: "info7/rundown",

  // Donde el Apps Script del Excel del productor publica la escaleta.
  // DEBE ser igual al INGEST_PATH del Code.gs (por defecto: info7/ingest).
  ingestPath: "info7/ingest"
};
