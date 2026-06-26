/* ============================================================
   INFO 7 · Cintillo — Credenciales de Firebase Realtime Database
   ------------------------------------------------------------
   1) Crea un proyecto gratis en https://console.firebase.google.com
   2) Realtime Database → Crear base de datos (modo de prueba)
   3) Configuración del proyecto (⚙️) → "Tus apps" → app Web (</>) → copia el objeto firebaseConfig
   4) Pega tus valores aquí abajo y agrega "databaseURL" (lo da Realtime Database).

   Mientras "databaseURL" esté vacío, control.html y render.html siguen
   funcionando en modo LOCAL (mismo navegador) vía BroadcastChannel.
   Con credenciales válidas, se sincronizan por internet entre equipos distintos.
   ============================================================ */
window.INFO7_FIREBASE_CONFIG = {
  apiKey:            "",   // ej. "AIzaSyBxMXVODvKnREKlBGYYCHk-2jJPlRI4C80",
  authDomain:        "",   // ej. "infographics-62747.firebaseapp.com",
  databaseURL:       "",   // ej. "https://infographics-62747-default-rtdb.firebaseio.com",  ← IMPRESCINDIBLE
  projectId:         "",   // ej. "infographics-62747",
  storageBucket:     "",   // ej. "infographics-62747.firebasestorage.app",
  messagingSenderId: "",   // ej. "748846969922",
  appId:             "",   // ej. "1:748846969922:web:b5a95f4086891c09a729db",

  // Ruta donde se guarda el estado del cintillo. Cambia el sufijo para tener
  // varios "canales" independientes (ej. "info7/estudioA", "info7/estudioB").
  path: "info7/cintillo",

  // Ruta donde se guarda la ESCALETA compartida entre operadores.
  rundownPath: "info7/rundown",

  // Ruta donde el Apps Script del Excel del productor publica la escaleta.
  // El control la ESCUCHA y refresca las horas en tiempo real.
  ingestPath: "info7/ingest",

  // Teleprompter: el RUNDOWN manda el guion + comandos; prompter.html (estudio) recibe.
  prompterPath: "info7/prompter"
};
