# INFO 7 · Cintillo en vivo (control + render)

Sistema de **lower third / cintillo** para transmisión en vivo, listo para **GitHub + Vercel**, con sincronización en tiempo real por **Firebase Realtime Database**.

| Archivo | Qué es | Dónde se usa |
|---|---|---|
| `control.html` | **Consola del operador**: textos de INFO 7, plantillas, animaciones de entrada/salida, colores, chroma, sombras, ticker. | El operador, en cualquier PC o tablet. |
| `render.html` | **Señal limpia Full HD 1920×1080, fondo 100% transparente** (canal alfa). Escucha la base de datos y dibuja/anima el cintillo. | Se mete fijo a **vMix / OBS** como *Browser Input / Browser Source*. |
| `index.html` | Portada con enlaces a ambas. | Opcional. |
| `firebase-config.js` | **Tus credenciales** de Firebase (lo único que editas). | — |
| `firebase-bridge.js` | Puente con la base de datos. No se edita. | — |
| `vercel.json` | Config de despliegue. | — |

> **Sin credenciales** el sistema funciona en **modo local** (BroadcastChannel): control y render se sincronizan solo si están abiertos **en el mismo navegador y origen**. Para sincronizar **entre equipos distintos por internet**, configura Firebase (abajo).

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
- `render.html` y `control.html` son **autocontenidos** (fuentes, logo, motor de animación y export PNG embebidos). Lo único externo son `firebase-config.js` y `firebase-bridge.js`.
- Sincronía con **triple respaldo**: Firebase (entre equipos) → BroadcastChannel (mismo navegador) → `localStorage` (sondeo). Si Firebase no está configurado, sigue el modo local sin errores.
- `render.html` se escala solo a cualquier resolución manteniendo el lienzo 1920×1080.
- Exporta PNG **Full HD / 4K** con alfa desde la consola (tarjeta *Fondo & exportar*).
