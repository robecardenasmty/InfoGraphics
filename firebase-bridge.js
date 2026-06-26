/* ============================================================
   INFO 7 · Cintillo — Puente Firebase Realtime Database
   No necesitas editar este archivo. Las credenciales van en firebase-config.js.
   Expone:
     window.INFO7_FIREBASE          → sincroniza el gráfico AL AIRE (control → render)
     window.INFO7_FIREBASE_RUNDOWN  → sincroniza la ESCALETA entre operadores
     window.INFO7_FIREBASE_INGEST   → RECIBE la escaleta del Excel del productor (Google Sheets → Firebase)
   Si no hay credenciales, no conecta nada y las páginas siguen en modo local.
   ============================================================ */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

(function () {
  // Fábrica de un canal con cola (write/subscribe antes de conectar se guardan).
  function makeChannel() {
    var subs = [], last = null, realWrite = null, queued = null, wTimer = null;
    return {
      api: {
        write: function (p) {
          last = p;
          if (realWrite) { clearTimeout(wTimer); wTimer = setTimeout(function () { realWrite(last); }, 70); }
          else { queued = p; }
        },
        subscribe: function (cb) { subs.push(cb); if (last) cb(last); }
      },
      bind: function (writeFn) { realWrite = writeFn; if (queued != null) realWrite(queued); },
      emit: function (p) { last = p; for (var i = 0; i < subs.length; i++) subs[i](p); }
    };
  }

  var program = makeChannel();
  var rundown = makeChannel();
  var ingest = makeChannel();
  var prompter = makeChannel();
  window.INFO7_FIREBASE = Object.assign(window.INFO7_FIREBASE || {}, program.api);
  window.INFO7_FIREBASE_RUNDOWN = Object.assign(window.INFO7_FIREBASE_RUNDOWN || {}, rundown.api);
  window.INFO7_FIREBASE_INGEST = Object.assign(window.INFO7_FIREBASE_INGEST || {}, ingest.api);
  window.INFO7_FIREBASE_PROMPTER = Object.assign(window.INFO7_FIREBASE_PROMPTER || {}, prompter.api);

  var cfg = window.INFO7_FIREBASE_CONFIG;
  if (!(cfg && cfg.databaseURL)) {
    console.info("INFO 7 · Sin databaseURL en firebase-config.js → modo LOCAL (BroadcastChannel).");
    return;
  }

  try {
    var app = initializeApp(cfg);
    var db = getDatabase(app);

    var rProg = ref(db, cfg.path || "info7/cintillo");
    program.bind(function (p) { try { set(rProg, { payload: p, t: Date.now() }); } catch (e) {} });
    onValue(rProg, function (snap) { var v = snap.val(); if (v && v.payload) program.emit(v.payload); });

    var rRd = ref(db, cfg.rundownPath || "info7/rundown");
    rundown.bind(function (p) { try { set(rRd, { payload: p, t: Date.now() }); } catch (e) {} });
    onValue(rRd, function (snap) { var v = snap.val(); if (v && v.payload) rundown.emit(v.payload); });

    // Ingesta del productor: el Apps Script de Google Sheets escribe aquí; el control solo escucha.
    var rIn = ref(db, cfg.ingestPath || "info7/ingest");
    onValue(rIn, function (snap) { var v = snap.val(); if (v) ingest.emit(v.payload || v); });

    // Teleprompter: el RUNDOWN manda guion + comandos; el prompter del estudio recibe (y publica su posición).
    var rPr = ref(db, cfg.prompterPath || "info7/prompter");
    prompter.bind(function (p) { try { set(rPr, { payload: p, t: Date.now() }); } catch (e) {} });
    onValue(rPr, function (snap) { var v = snap.val(); if (v && v.payload) prompter.emit(v.payload); });

    window.dispatchEvent(new Event("info7-fb-ready"));
    console.info("INFO 7 · Firebase conectado · gráfico:", cfg.path || "info7/cintillo", "· escaleta:", cfg.rundownPath || "info7/rundown", "· ingesta:", cfg.ingestPath || "info7/ingest", "· prompter:", cfg.prompterPath || "info7/prompter");
  } catch (e) {
    console.warn("INFO 7 · Firebase no disponible:", e && e.message);
  }
})();
