/* ============================================================
   INFO 7 · Cintillo — Puente Firebase Realtime Database
   No necesitas editar este archivo. Las credenciales van en firebase-config.js.
   Expone:
     window.INFO7_FIREBASE          → sincroniza el gráfico AL AIRE (control → render)
     window.INFO7_FIREBASE_RUNDOWN  → sincroniza la ESCALETA entre operadores
     window.INFO7_FIREBASE_INGEST   → RECIBE la escaleta del Excel del productor (Google Sheets → Firebase)
     window.INFO7_FIREBASE_STORAGE   → sube videos a Storage y devuelve su URL (playout de video)
   Si no hay credenciales, no conecta nada y las páginas siguen en modo local.
   ============================================================ */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getStorage, ref as sRef, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

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
  var video = makeChannel();
  window.INFO7_FIREBASE = Object.assign(window.INFO7_FIREBASE || {}, program.api);
  window.INFO7_FIREBASE_RUNDOWN = Object.assign(window.INFO7_FIREBASE_RUNDOWN || {}, rundown.api);
  window.INFO7_FIREBASE_INGEST = Object.assign(window.INFO7_FIREBASE_INGEST || {}, ingest.api);
  window.INFO7_FIREBASE_PROMPTER = Object.assign(window.INFO7_FIREBASE_PROMPTER || {}, prompter.api);
  window.INFO7_FIREBASE_VIDEO = Object.assign(window.INFO7_FIREBASE_VIDEO || {}, video.api);

  // ---- Storage de video (cola: si se llama antes de conectar, se encola) ----
  var storageImpl = null, storageQueue = [];
  window.INFO7_FIREBASE_STORAGE = Object.assign(window.INFO7_FIREBASE_STORAGE || {}, {
    // sube un File; onProgress(0..100); resuelve {url, path}
    upload: function (file, path, onProgress) {
      return new Promise(function (resolve, reject) {
        var run = function () { storageImpl.upload(file, path, onProgress).then(resolve, reject); };
        if (storageImpl) run(); else storageQueue.push(run);
      });
    },
    remove: function (path) {
      return new Promise(function (resolve, reject) {
        var run = function () { storageImpl.remove(path).then(resolve, reject); };
        if (storageImpl) run(); else storageQueue.push(run);
      });
    },
    ready: function () { return !!storageImpl; }
  });

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

    // Video playout: el RUNDOWN/consola manda comandos (play/stop/preload); el render reproduce.
    var rVid = ref(db, cfg.videoPath || "info7/video");
    video.bind(function (p) { try { set(rVid, { payload: p, t: Date.now() }); } catch (e) {} });
    onValue(rVid, function (snap) { var v = snap.val(); if (v && v.payload) video.emit(v.payload); });

    // Storage de video: subir archivo → URL pública (getDownloadURL).
    try {
      var storage = getStorage(app);
      storageImpl = {
        upload: function (file, path, onProgress) {
          return new Promise(function (resolve, reject) {
            var r = sRef(storage, path);
            var task = uploadBytesResumable(r, file, { contentType: file.type || "video/mp4" });
            task.on("state_changed",
              function (s) { if (onProgress) onProgress(Math.round((s.bytesTransferred / s.totalBytes) * 100)); },
              function (err) { reject(err); },
              function () { getDownloadURL(task.snapshot.ref).then(function (url) { resolve({ url: url, path: path }); }, reject); }
            );
          });
        },
        remove: function (path) { return deleteObject(sRef(storage, path)); }
      };
      for (var i = 0; i < storageQueue.length; i++) storageQueue[i]();
      storageQueue = [];
    } catch (e) { console.warn("INFO 7 · Storage no disponible:", e && e.message); }

    window.dispatchEvent(new Event("info7-fb-ready"));
    console.info("INFO 7 · Firebase conectado · gráfico:", cfg.path || "info7/cintillo", "· escaleta:", cfg.rundownPath || "info7/rundown", "· ingesta:", cfg.ingestPath || "info7/ingest", "· prompter:", cfg.prompterPath || "info7/prompter");
  } catch (e) {
    console.warn("INFO 7 · Firebase no disponible:", e && e.message);
  }
})();
