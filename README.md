# INFO 7 · Suite de gráficos en vivo (Preview/Live + TAKE)

Sistema de **gráficos para transmisión** (lower thirds, backs y categorías: Breaking, Deportes, Espectáculos, Genérico), con flujo de **switcher profesional**: editas en **Preview**, lo mandas al aire con **TAKE** y sale en el **render** que entra a vMix. Listo para **GitHub + Vercel** con sincronización en tiempo real por **Firebase Realtime Database**.

| Archivo | Qué es | Dónde se usa |
|---|---|---|
| `control.html` | **Consola del operador**: cajas **Preview \| Programa**, botón **TAKE / SACAR**, pestañas (Categoría, Textos, Animación, Colores, Elementos·Fondo). | El operador, en cualquier PC o tablet. |
| `render.html` | **Señal limpia Full HD 1920×1080, fondo transparente** (alfa). Recibe el PROGRAMA y reproduce la animación de entrada/salida. | Se mete fijo a **vMix / OBS** como *Browser Input / Source*. |
| `Grafico.dc.html` | **Motor gráfico** compartido por consola y render. **No borrar** — los dos lo cargan. | — |
| `support.js` | Runtime de los gráficos. No se edita. | — |
| `index.html` | Portada con enlaces a consola y render. | Opcional. |
| `firebase-config.js` | **Tus credenciales** de Firebase (lo único que editas). | — |
| `firebase-bridge.js` | Puente con la base de datos. No se edita. | — |
| `escaleta-seed.js` | **Escaleta maestra** del matutino (5 horas + estrategia) ya cargada. | — |
| `xlsx-ingest.js` | Lector de Excel en el navegador (para el botón **Importar Excel**). No se edita. | — |
| `apps-script/Code.gs` | **Google Apps Script** para publicar la escaleta del productor a Firebase en tiempo real. | Se pega en la Hoja de Google del productor. |
| `vercel.json` | Config de despliegue. | — |

> ⚠️ **Importante:** este proyecto es **multi-archivo** (la consola y el render cargan `Grafico.dc.html` y `support.js`). Súbelos **todos juntos** y **sírvelos por web** (Vercel). No funciona abriendo el `.html` con doble clic desde el disco (necesita estar servido por HTTP) — para eso está el deploy en Vercel.

## Flujo de trabajo (switcher)

1. En **Preview** eliges categoría, escribes textos y ajustas colores/animación. Nada de esto sale al aire todavía.
2. Pulsas **TAKE**: lo que ves en Preview pasa a **Programa** y se reproduce en el render con su animación de entrada.
3. Pulsas **◀ SACAR** para retirarlo del aire (animación de salida).
4. Mientras algo está al aire, puedes preparar el siguiente gráfico en Preview sin afectar la señal.

> **Sin credenciales** Firebase, control y render se sincronizan solo en el **mismo navegador** (BroadcastChannel). Para sincronizar **entre equipos distintos**, configura Firebase (abajo).

---

## 1) Configurar Firebase Realtime Database (gratis)

1. Entra a <https://console.firebase.google.com> y crea un proyecto nuevo.
2. Menú **Realtime Database → Crear base de datos**. Elige una región y **modo de prueba** (reglas abiertas temporales).
3. En **⚙️ Configuración del proyecto → Tus apps**, crea una app **Web** (`</>`). Firebase te muestra un objeto `firebaseConfig`.
4. Abre **`firebase-config.js`** y pega tus valores. **`databaseURL` es imprescindible** (lo da la sección Realtime Database, termina en `firebaseio.com`):

   ```js
   window.INFO7_FIREBASE_CONFIG = {
     apiKey: "AIza...",
     authDomain: "info7-cintillo.firebaseapp.com",
     databaseURL: "https://info7-cintillo-default-rtdb.firebaseio.com",
     projectId: "info7-cintillo",
     storageBucket: "info7-cintillo.appspot.com",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abcdef",
     path: "info7/cintillo"
   };
   ```

5. (Para salir al aire rápido) En **Realtime Database → Reglas**, deja lectura/escritura abiertas:

   ```json
   { "rules": { ".read": true, ".write": true } }
   ```

   > ⚠️ Reglas abiertas = cualquiera con la URL puede escribir. Para producción seria, restringe por **App Check** o autenticación. Para un estudio cerrado suele bastar con mantener la URL privada y usar un `path` difícil de adivinar.

6. ¿Varios estudios o programas a la vez? Cambia `path` (ej. `"info7/estudioA"`, `"info7/matutino"`). Cada `path` es un canal independiente.

---

## 2) Subir a GitHub

```bash
cd deploy
git init
git add .
git commit -m "INFO 7 · cintillo control + render"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/info7-cintillo.git
git push -u origin main
```

> Si no quieres exponer tus llaves en un repo público, sube `firebase-config.js` solo a Vercel (variables/instalación privada) o haz el repo **privado**. Las llaves Web de Firebase no son secretas por sí mismas, pero las **reglas** de la base de datos son lo que realmente protege tus datos.

---

## 3) Desplegar en Vercel

**Opción A — desde GitHub (recomendada):**
1. Entra a <https://vercel.com> → **Add New… → Project** → importa tu repo.
2. **Framework Preset:** `Other`. **Root Directory:** la carpeta que contiene estos archivos (si subiste `deploy/`, selecciónala). Sin build command. **Output:** raíz.
3. **Deploy.** Vercel te da una URL, por ejemplo `https://info7-cintillo.vercel.app`.

**Opción B — desde tu PC con Vercel CLI:**
```bash
npm i -g vercel
cd deploy
vercel        # sigue el asistente
vercel --prod # publicar a producción
```

---

## 4) Usar al aire

- **Operador:** abre `https://TU-PROYECTO.vercel.app/control.html`
- **vMix / OBS:** agrega un **Browser Input / Browser Source** con `https://TU-PROYECTO.vercel.app/render.html`, en **1920×1080**.
  - vMix detecta el canal alfa del navegador automáticamente (fondo transparente).
  - En OBS, el Browser Source ya respeta la transparencia.
- Cambia textos, dispara **▶ Entrada / ◀ Salida** o las **transiciones completas** en `control.html`: se reflejan al instante en `render.html`.

### Fondos y chroma
- En la consola, tarjeta **Fondo & exportar**: `Transparente` (alfa, por defecto), `Estudio`, `Chroma verde`, `Chroma azul` (con **selector de color** propio), o `Imagen propia`.
- **Sombras de los elementos**: interruptor en *Encender / apagar*. Apágalo para que el chroma quede parejo.

---

## Notas técnicas
- El proyecto es **multi-archivo**: `control.html` y `render.html` cargan `Grafico.dc.html` (motor gráfico) y `support.js` (runtime). Mantén los 4 juntos en el mismo directorio servido. React/fuentes se cargan de CDN, así que requiere internet (normal en un equipo de transmisión).
- Sincronía con **triple respaldo**: Firebase (entre equipos) → BroadcastChannel (mismo navegador) → `localStorage`. Si Firebase no está configurado, sigue el modo local sin errores.
- `render.html` se escala solo a cualquier resolución manteniendo el lienzo 1920×1080.
- Exporta PNG **Full HD / 4K** con alfa desde la consola (tarjeta *Fondo & exportar*).
