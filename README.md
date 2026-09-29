# CRM para agencias de IA

Base pública para desarrollar un CRM personalizado que reúna oportunidades,
clientes, proyectos y servicios recurrentes de una agencia de inteligencia artificial.

## Estado actual

Incluye un tablero con columnas, tareas, imágenes y arrastre, adaptado a móvil.
Guarda la información en IndexedDB del navegador. Todavía no incorpora acceso
de usuarios, sincronización, pipeline comercial ni aislamiento entre agencias.
El plan de evolución está en [ROADMAP.md](ROADMAP.md).

## Ejecutar

Requiere Node.js 22 o posterior y npm.

1. Copia `firebase-init.example.js` a `firebase-init.js`.
2. Para trabajar sin Firebase, conserva `firebaseConfig = null`.
3. Para conectar Firebase, introduce en ese archivo la configuración web de tu
   app registrada. No utilices claves de cuentas de servicio.
4. Ejecuta `npm install` y `npm run build`.
5. Abre `index.html` en un navegador moderno para utilizar el tablero local.

Los datos de una página local y de un dominio publicado son independientes.
Borrar los datos del navegador también elimina el tablero.

## Pruebas

```sh
npx playwright install chromium
npm test
```

Puedes establecer `TEST_URL` para verificar una URL publicada. Las pruebas usan
un contexto de navegador nuevo y datos ficticios. `BROWSER_CHANNEL=msedge`
permite utilizar Microsoft Edge cuando está instalado.

## Firebase Hosting

Utilizaremos Firebase para el CRM. La configuración de Hosting publica solo
los seis archivos generados en `public/`, nunca la carpeta completa del proyecto.

```sh
npx -y firebase-tools@latest login
npx -y firebase-tools@latest deploy --only hosting --project TU_PROJECT_ID
```

El despliegue ejecuta la compilación automáticamente. Selecciona el proyecto
existente correcto. No hay despliegue automático desde GitHub.
La configuración del SDK web se entrega al navegador y es visible al publicar;
se excluye de Git para mantener separados los entornos. Nunca debe contener
credenciales de servidor. La protección de futuros datos dependerá de la
autenticación y las reglas de acceso, no de ocultar esa configuración.

## Publicación responsable

Lee [AGENTS.md](AGENTS.md) y [SECURITY.md](SECURITY.md). El repositorio incluye
solo código y documentación técnica revisados. El `.gitignore` utiliza una lista
explícita de archivos permitidos. Antes de publicar:

```sh
git diff --cached --name-only
git diff --cached
npm run check:publication
```

El SDK Firebase incluido conserva sus avisos de licencia originales. La
visibilidad pública no establece por sí sola una licencia para el código propio.
