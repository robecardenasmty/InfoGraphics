/* ============================================================
   INFO 7 · Lector de Excel en el navegador (sin librerías)
   Expone window.INFO7_parseEscaletaXlsx(arrayBuffer) -> {horas, estrategia}
   con EXACTAMENTE el mismo formato que escaleta-seed.js, para que el
   importador del control pueda mezclarlo con la escaleta actual.
   ============================================================ */
(function () {
  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }

  async function inflate(u8) {
    const ds = new DecompressionStream('deflate-raw');
    const w = ds.writable.getWriter(); w.write(u8); w.close();
    const ab = await new Response(ds.readable).arrayBuffer();
    return new Uint8Array(ab);
  }

  async function unzip(bytes) {
    let eocd = -1;
    for (let i = bytes.length - 22; i >= 0; i--) { if (u32(bytes, i) === 0x06054b50) { eocd = i; break; } }
    if (eocd < 0) throw new Error('No es un archivo .xlsx válido');
    const cdCount = u16(bytes, eocd + 10), cdOff = u32(bytes, eocd + 16);
    let p = cdOff; const entries = {};
    for (let n = 0; n < cdCount; n++) {
      if (u32(bytes, p) !== 0x02014b50) break;
      const method = u16(bytes, p + 10), compSize = u32(bytes, p + 20),
        nameLen = u16(bytes, p + 28), extraLen = u16(bytes, p + 30), commLen = u16(bytes, p + 32), lho = u32(bytes, p + 42);
      const name = new TextDecoder().decode(bytes.slice(p + 46, p + 46 + nameLen));
      entries[name] = { method, compSize, lho };
      p += 46 + nameLen + extraLen + commLen;
    }
    const out = {};
    for (const name in entries) {
      const e = entries[name];
      const nLen = u16(bytes, e.lho + 26), xLen = u16(bytes, e.lho + 28);
      const start = e.lho + 30 + nLen + xLen;
      const raw = bytes.slice(start, start + e.compSize);
      const data = e.method === 0 ? raw : await inflate(raw);
      out[name] = new TextDecoder().decode(data);
    }
    return out;
  }

  function dec(s) { return s.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'); }

  function parseShared(xml) {
    const ss = []; if (!xml) return ss;
    const re = /<si>([\s\S]*?)<\/si>/g; let m;
    while ((m = re.exec(xml))) ss.push(dec(m[1].replace(/<[^>]+>/g, '')));
    return ss;
  }

  function decodeSheet(xml, ss) {
    const rows = [];
    const rre = /<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g; let rm;
    while ((rm = rre.exec(xml))) {
      const rownum = +rm[1]; const cells = {};
      const cre = /<c r="([A-Z]+)\d+"(?:[^>]*t="([^"]*)")?[^>]*>(?:<v>([\s\S]*?)<\/v>|<is><t[^>]*>([\s\S]*?)<\/t><\/is>)?<\/c>/g; let cm;
      while ((cm = cre.exec(rm[2]))) {
        const col = cm[1], type = cm[2], v = cm[3], inl = cm[4];
        let val = '';
        if (inl != null) val = dec(inl);
        else if (v != null) val = type === 's' ? (ss[+v] || '') : v;
        cells[col] = val;
      }
      rows.push({ rownum, cells });
    }
    return rows;
  }

  function durToSec(t) {
    t = (t || '').trim(); if (!t) return 0;
    const a = t.split(':').map(x => parseInt(x, 10));
    if (a.some(isNaN)) return 0;
    if (a.length === 3) return a[0] * 3600 + a[1] * 60 + a[2];
    if (a.length === 2) return a[0] * 60 + a[1];
    return a[0] || 0;
  }

  function autoGc(graficos, formato, contenido) {
    const g = (graficos || '').toLowerCase(); const c = (contenido || '').toLowerCase(); const f = (formato || '').toUpperCase();
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

  // Mapea cada hoja por su nombre. Acepta 6AM, "6 AM", "6:00", etc.
  function normHour(name) {
    const m = /(\d{1,2})\s*(?:am|:00|hrs)?/i.exec(name || '');
    if (!m) return null;
    return m[1] + 'AM';
  }

  async function parse(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    const files = await unzip(bytes);
    const ss = parseShared(files['xl/sharedStrings.xml']);

    // workbook → sheet name ↔ file
    const wb = files['xl/workbook.xml'] || '';
    const rels = files['xl/_rels/workbook.xml.rels'] || '';
    const relMap = {}; let rm;
    const rre = /<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g;
    while ((rm = rre.exec(rels))) relMap[rm[1]] = rm[2].replace(/^\/?xl\//, '').replace(/^\//, '');
    const sheets = []; let sm;
    const sre = /<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g;
    while ((sm = sre.exec(wb))) {
      let target = relMap[sm[2]] || '';
      if (target && !target.startsWith('xl/')) target = 'xl/' + target;
      sheets.push({ name: dec(sm[1]), file: target });
    }

    const horas = []; let estrategia = [];
    for (const sh of sheets) {
      const xml = files[sh.file]; if (!xml) continue;
      const rows = decodeSheet(xml, ss);
      const hk = normHour(sh.name);
      if (!hk) {
        // hoja de estrategia: toma columnas B (título) y C (texto)
        if (/estrategia/i.test(sh.name)) {
          estrategia = rows.map(r => ({ h: (r.cells.B || '').trim(), b: (r.cells.C || '').trim() }))
            .filter(e => e.h || e.b);
        }
        continue;
      }
      const items = []; let seq = 0;
      for (const r of rows) {
        const c = r.cells;
        const A = (c.A || '').trim(), B = (c.B || '').trim(), C = (c.C || '').trim(), D = (c.D || '').trim(),
          E = (c.E || '').trim(), F = (c.F || '').trim(), G = (c.G || '').trim(), H = (c.H || '').trim();
        if (r.rownum === 1) continue;
        if (A === '#') continue;
        if (!A && !B) continue;
        const id = hk + '-' + (++seq);
        if (A && !B && isNaN(parseInt(A, 10))) { items.push({ id, type: 'block', label: A }); continue; }
        if (B.toUpperCase().startsWith('CORTE')) { items.push({ id, type: 'corte', label: B.replace(/\s{2,}/g, '   '), durSec: durToSec(D), note: E }); continue; }
        const reserved = /^\+\s*ESPACIO/i.test(B);
        items.push({
          id, type: 'item', num: parseInt(A, 10) || seq, contenido: B, formato: C, durSec: durToSec(D),
          responsable: E, graficos: (F && F !== '—') ? F : '', fuente: (G && G !== '—') ? G : '', gancho: H,
          gcKind: autoGc(F, C, B), status: reserved ? 'borrador' : 'listo'
        });
      }
      horas.push({ id: hk, title: (rows[0] && (rows[0].cells.A || rows[0].cells.B)) || hk, items });
    }
    return { horas, estrategia };
  }

  window.INFO7_parseEscaletaXlsx = parse;
})();
