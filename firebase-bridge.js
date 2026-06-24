/* ============================================================
   INFO 7 · Cintillo — Puente Firebase Realtime Database
   No necesitas editar este archivo. Las credenciales van en firebase-config.js.
   Expone window.INFO7_FIREBASE.{ write(payload), subscribe(cb) } que usan
   control.html (escribe) y render.html (escucha). Si no hay credenciales,
   no conecta nada y las páginas siguen en modo local (BroadcastChannel).
   ============================================================ */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

(function () {
  // API con cola: si la app llama write/subscribe antes de conectar, se guarda.
  var subs = [], last = null, realWrite = null, queued = null, wTimer = null;
  var api = window.INFO7_FIREBASE || {};
  api.write = function (p) {
    last = p;
    if (realWrite) { clearTimeout(wTimer); wTimer = setTimeout(function () { realWrite(last); }, 70); }
    else { queued = p; }
  };
  api.subscribe = function (cb) { subs.push(cb); if (last) cb(last); };
  window.INFO7_FIREBASE = api;

  var cfg = window.INFO7_FIREBASE_CONFIG;
  if (!(cfg && cfg.databaseURL)) {
    console.info("INFO 7 · Sin databaseURL en firebase-config.js → modo LOCAL (BroadcastChannel).");
    return;
  }

  try {
    var app = initializeApp(cfg);
    var db = getDatabase(app);
    var r = ref(db, cfg.path || "info7/cintillo");

    realWrite = function (p) { try { set(r, { payload: p, t: Date.now() }); } catch (e) {} };

    onValue(r, function (snap) {
      var v = snap.val();
      if (v && v.payload) { last = v.payload; for (var i = 0; i < subs.length; i++) subs[i](v.payload); }
    });

    if (queued != null) realWrite(queued);
    window.dispatchEvent(new Event("info7-fb-ready"));
    console.info("INFO 7 · Firebase conectado en la ruta:", cfg.path || "info7/cintillo");
  } catch (e) {
    console.warn("INFO 7 · Firebase no disponible:", e && e.message);
  }
})();
