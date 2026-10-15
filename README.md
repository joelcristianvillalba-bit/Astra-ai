# Astra AI — Live Sports (Free stack)

Este repo contiene una demo 'premium' de un dashboard deportivo con:
- UI rediseñada (index.html)
- Live Feed y simulador de eventos
- Soporte para WebSocket + Push (implementación local / gratuita)

Qué añadí en la rama update/premium-live-full
- /server: pequeño backend Node.js que sirve como relay y emite eventos simulados.
- service-worker.js: recibe push y muestra notificaciones.
- index.html (actualizado) registra el service worker y permite suscribirse a Push.

Cómo probar localmente (gratis)
1. Cloná el repo y cambiá a la rama `update/premium-live-full`:
   ```bash
   git checkout update/premium-live-full
   ```
2. Iniciar el servidor mock (necesitas Node.js >= 14):
   ```bash
   cd server
   npm install
   npm start
   ```
   El servidor correrá en http://localhost:3030 y mostrará la VAPID PUBLIC KEY en la consola.

3. Serví la carpeta raíz en HTTPS para poder usar Push API (opciones gratuitas):
   - Usá `npx serve` y ngrok (https) para exponer a la web, o
   - Usá `live-server` con un certificado local, o
   - Subilo a un host gratuito que soporte HTTPS (Vercel / Netlify / Railway).

4. Abrí la página y click en "Activar notificaciones" para aceptar permisos. Luego hacé click en "Simular partido" y verás eventos en el Live Feed y recibirás notificaciones (si tu navegador lo permite).

Notas
- Esta implementación usa almacenamiento en memoria para suscripciones y favoritos (es gratis pero efímero). Para producción recomiendo una base de datos (Supabase/Postgres) — tengo los endpoints listos para integrarlo.
- Para Push persistente y en producción deberás usar HTTPS y almacenar las claves VAPID en variables de entorno.
