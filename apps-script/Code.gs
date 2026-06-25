/* ============================================================================
   INFO 7 · Puente Google Sheets → Firebase  (Google Apps Script)
   ----------------------------------------------------------------------------
   Pega TODO este archivo en el editor de Apps Script de tu Google Sheet
   (Extensiones → Apps Script). Sirve para que, cada vez que el productor
   edite la escaleta en la hoja, las 5 horas + estrategia se publiquen en
   Firebase y aparezcan SOLAS en el control de cintillos (render/control),
   sin que el operador refresque nada.

   ── CONFIGURACIÓN (una sola vez) ──────────────────────────────────────────
   1) Sube tu "ESCALETA INFO7 MAESTRA.xlsx" a Google Drive y ábrelo como
      Hoja de cálculo de Google (Archivo → Guardar como Hoja de cálculo de Google).
      Las pestañas deben llamarse: ESTRATEGIA, 6AM, 7AM, 8AM, 9AM, 10AM
      (también valen "6 AM", "7:00", etc.).
   2) Extensiones → Apps Script. Borra lo que haya y pega este archivo.
   3) Llena las dos constantes de abajo (FIREBASE_URL y FIREBASE_SECRET).
   4) Menú: ejecuta la función  instalarDisparador  una vez (autoriza permisos).
      A partir de ahí, cada edición se publica automáticamente (con anti-rebote).
      También puedes ejecutar  publicarAhora  manualmente para forzar el envío.

   ── ¿De dónde salen FIREBASE_URL y FIREBASE_SECRET? ───────────────────────
   • FIREBASE_URL: Firebase Console → Realtime Database → es la URL que aparece
     arriba, p.ej. https://info7-cintillo-default-rtdb.firebaseio.com
   • FIREBASE_SECRET (para que Apps Script pueda escribir):
     Firebase Console → ⚙️ Configuración del proyecto → Cuentas de servicio →
     "Secretos de base de datos" → Mostrar/crear secreto. Cópialo aquí.
     (Si no ves "Secretos de base de datos", actívalo o usa reglas públicas de
      escritura en la ruta /info7/ingest sólo mientras pruebas.)
   ============================================================================ */

const FIREBASE_URL    = "https://infographics-62747-default-rtdb.firebaseio.com"; // ← cámbialo
const FIREBASE_SECRET = "ViOZeGQz2RrwHIiNEP9TBLeLS1uusBuoR2viIiUA";                              // ← cámbialo
const INGEST_PATH     = "info7/ingest"; // debe coincidir con ingestPath de firebase-config.js

/* ---- Disparadores ---------------------------------------------------------- */
function instalarDisparador() {
  // limpia anteriores
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'onEditPublicar') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('onEditPublicar')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();
  publicarAhora();
  SpreadsheetApp.getActive().toast('Disparador instalado. La escaleta se publicará al editar.', 'INFO 7', 5);
}

function onEditPublicar(e) {
  // anti-rebote: agenda una publicación 1.2 s después de la última edición
  PropertiesService.getScriptProperties().setProperty('dirty', String(Date.now()));
  Utilities.sleep(1200);
  var last = Number(PropertiesService.getScriptProperties().getProperty('dirty') || 0);
  if (Date.now() - last >= 1100) publicarAhora();
}

/* ---- Publicación ----------------------------------------------------------- */
function publicarAhora() {
  var data = construirEscaleta();
  var url = FIREBASE_URL.replace(/\/$/, '') + '/' + INGEST_PATH + '.json?auth=' + encodeURIComponent(FIREBASE_SECRET);
  var res = UrlFetchApp.fetch(url, {
    method: 'put',
    contentType: 'application/json',
    payload: JSON.stringify({ payload: data, t: Date.now() }),
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  if (code >= 200 && code < 300) {
    SpreadsheetApp.getActive().toast('Escaleta publicada (' + data.horas.length + ' horas).', 'INFO 7', 3);
  } else {
    SpreadsheetApp.getActive().toast('Error ' + code + ': ' + res.getContentText().slice(0, 120), 'INFO 7', 8);
  }
}

/* ---- Lectura de la hoja → mismo JSON que entiende el control --------------- */
function construirEscaleta() {
  var ss = SpreadsheetApp.getActive();
  var horas = [];
  var estrategia = [];

  ss.getSheets().forEach(function (sheet) {
    var name = sheet.getName();
    var hk = normHour(name);
    var rows = sheet.getDataRange().getValues();

    if (!hk) {
      if (/estrateg/i.test(name)) {
        estrategia = rows.map(function (r) {
          return { h: String(r[1] || '').trim(), b: String(r[2] || '').trim() };
        }).filter(function (e) { return e.h || e.b; });
      }
      return;
    }

    var items = []; var seq = 0;
    // Detecta columnas POR ENCABEZADO (no por posición fija): el operador puede
    // mover SEGUNDA LÍNEA / FUENTE / GANCHO a donde quiera y se entiende igual.
    function norm(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim(); }
    var col = null;
    for (var hi = 0; hi < rows.length; hi++) {
      if (norm(rows[hi][0]) === '#') {
        col = {};
        for (var k = 0; k < rows[hi].length; k++) {
          var h = norm(rows[hi][k]);
          if (h === '#') col.num = k;
          else if (h.indexOf('CONTENIDO') === 0) col.contenido = k;
          else if (h.indexOf('FORMATO') === 0) col.formato = k;
          else if (h.indexOf('DUR') === 0) col.dur = k;
          else if (h.indexOf('RESPONSABLE') === 0) col.responsable = k;
          else if (h.indexOf('SEGUNDA') === 0 || h.indexOf('BAJADA') === 0) col.segunda = k;
          else if (h.indexOf('GRAFICO') === 0 || h.indexOf('GC') === 0) col.graficos = k;
          else if (h.indexOf('FUENTE') === 0 || h.indexOf('INSUMO') === 0) col.fuente = k;
          else if (h.indexOf('GANCHO') === 0 || h.indexOf('EDITORIAL') === 0) col.gancho = k;
        }
        break;
      }
    }
    if (!col) col = { num: 0, contenido: 1, formato: 2, dur: 3, responsable: 4, graficos: 5, fuente: 6, gancho: 7, segunda: 8 };
    function G(r, field) { var k = col[field]; return (k == null) ? '' : String(r[k] || '').trim(); }

    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var A = G(r, 'num'), B = G(r, 'contenido');
      if (i === 0 && !A && !B) continue; // título
      if (norm(A) === '#') continue;     // encabezado de columnas
      if (!A && !B) continue;            // vacía
      var C = G(r, 'formato'), D = G(r, 'dur'), E = G(r, 'responsable'),
          F = G(r, 'graficos'), Gv = G(r, 'fuente'), H = G(r, 'gancho'), I = G(r, 'segunda');
      var id = hk + '-' + (++seq);
      if (A && !B && isNaN(parseInt(A, 10))) { items.push({ id: id, type: 'block', label: A }); continue; }
      if (B.toUpperCase().indexOf('CORTE') === 0) {
        items.push({ id: id, type: 'corte', label: B.replace(/\s{2,}/g, '   '), durSec: durToSec(D), note: E });
        continue;
      }
      var reserved = /^\+\s*ESPACIO/i.test(B);
      items.push({
        id: id, type: 'item', num: parseInt(A, 10) || seq, contenido: B, formato: C, durSec: durToSec(D),
        responsable: E, graficos: (F && F !== '—') ? F : '', fuente: (Gv && Gv !== '—') ? Gv : '', gancho: H, segunda: (I && I !== '—') ? I : '',
        gcKind: autoGc(F, C, B), status: reserved ? 'borrador' : 'listo'
      });
    }
    horas.push({ id: hk, title: String((rows[0] && (rows[0][0] || rows[0][1])) || hk), items: items });
  });

  return { horas: horas, estrategia: estrategia };
}

/* ---- Helpers (mismos que el control) -------------------------------------- */
function normHour(name) {
  var m = /(\d{1,2})\s*(?:am|:00|hrs)?/i.exec(name || '');
  return m ? (m[1] + 'AM') : null;
}
function durToSec(t) {
  t = String(t || '').trim(); if (!t) return 0;
  // Google Sheets puede entregar la duración como objeto Date; normaliza a texto h:mm:ss
  var a = t.split(':').map(function (x) { return parseInt(x, 10); });
  if (a.some(isNaN)) return 0;
  if (a.length === 3) return a[0] * 3600 + a[1] * 60 + a[2];
  if (a.length === 2) return a[0] * 60 + a[1];
  return a[0] || 0;
}
function autoGc(graficos, formato, contenido) {
  var g = String(graficos || '').toLowerCase(), c = String(contenido || '').toLowerCase(), f = String(formato || '').toUpperCase();
  if (f === 'CORT' || /cortinilla/.test(g)) return 'cortinilla';
  if (/mosca|whatsapp|redes/.test(g)) return 'mosca';
  if (/localiz|reportero \+ lugar|en vivo|enlace/.test(g) || /enlace|en vivo/.test(c)) return 'localizacion';
  if (/dólar|dolar|litro|barril|bmv|índice|indice|precio|compra-venta/.test(g)) return 'datos';
  if (/mapa|temperatura|clima/.test(g) || /clima/.test(c)) return 'clima';
  if (/pregunta|opciones|encuesta/.test(g)) return 'datos';
  if (/mensaje|nombre\/colonia|ciudadano/.test(g)) return 'nombre';
  if (/nombre|conductor|cargo/.test(g)) return 'nombre';
  if (/antes-después|antes/.test(g)) return 'datos';
  if (/titular/.test(g) || /'más adelante'|'al regresar'|'a las/.test(g)) return 'titular';
  if (/deporte/.test(c) || /deporte/.test(g)) return 'deportes';
  if (/escena|espectácul|espectacul/.test(c)) return 'espectaculos';
  if (/datos|apoyo/.test(g)) return 'datos';
  if (!g || g === '—') return 'ninguno';
  return 'titular';
}
