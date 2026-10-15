# Astra AI — Live Sports (Free stack)

Este repo contiene una demo 'premium' de un dashboard deportivo con:
- UI rediseñada (index.html)
- Live Feed y simulador de eventos
- Soporte para WebSocket + Push (implementación local / gratuita)
- Opcional: persistencia de favoritos usando Supabase (plan gratuito)

Qué añadí en la rama update/premium-live-full
- /server: pequeño backend Node.js que sirve como relay y emite eventos simulados.
- service-worker.js: recibe push y muestra notificaciones.
- index.html (actualizado) registra el service worker y permite suscribirse a Push.
- Integración opcional con Supabase para persistencia de favoritos (cuando se configuren variables de entorno).

Cómo probar localmente (gratis)
1. Cloná el repo y cambiá a la rama `update/premium-live-full`:
   ```bash
   git fetch origin
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

Configurar Supabase (opcional, gratuito)
1. Creá una cuenta en https://app.supabase.com/ (plan gratuito).
2. Creá un proyecto nuevo y en SQL Editor ejecutá:

```sql
create table favorites (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  team text not null,
  created_at timestamptz default now()
);
```

3. En Settings -> API copiá la URL del proyecto y en Project Settings -> Service API keys copiá la `service_role` key.
4. En tu entorno (Railway/Vercel/.env) define:

```
SUPABASE_URL="https://xxxx.supabase.co"
SUPABASE_KEY="<service_role_key>"
VAPID_PUBLIC="<optional_public_key>"
VAPID_PRIVATE="<optional_private_key>"
```

5. Si usás Supabase, el servidor guardará favoritos en la tabla `favorites`.

Despliegue rápido (gratis)
- Puedes desplegar el servidor en Railway (plan gratuito) o en Render/Heroku (free tiers vary) y el frontend en Vercel/Netlify (gratis con HTTPS).

Notas
- El servidor actualmente usa almacenamiento en memoria para suscripciones y favoritos si no configuras Supabase.
- Para usar push en producción guardá las VAPID keys en environment variables del host.
