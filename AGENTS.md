# Instrucciones para agentes

## Producto
Este repositorio contiene la base de un CRM personalizado para agencias de IA.
El estado actual es un tablero de tareas local. Consulta README.md y ROADMAP.md;
no presentes funcionalidades previstas como si ya estuvieran implementadas.

## Firebase
Utilizaremos Firebase para la infraestructura del CRM. Antes de cualquier tarea
relacionada con Firebase, busca y utiliza las habilidades oficiales adecuadas de
Firebase Agent Skills, distribuidas mediante el plugin `firebase@firebase`.
Consulta las habilidades de Hosting, Authentication, Firestore y reglas de
seguridad según la tarea. Reutiliza el proyecto y la app web existentes indicados
por el propietario; no crees recursos duplicados ni publiques en otro proyecto.
La configuración concreta se mantiene local y fuera de Git.

La versión actual solo inicializa Firebase Core y usa IndexedDB para las tareas.
Hosting publica exclusivamente `public/`. La futura persistencia compartida debe
incluir autenticación, aislamiento por agencia, roles y reglas probadas antes de
incorporar datos reales. Las claves privadas de proveedores de IA solo pueden
utilizarse en un backend con gestión de secretos.

## Repositorio público
- Trabaja únicamente dentro de este repositorio; no añadas archivos de carpetas superiores.
- No publiques contratos, estrategias, presupuestos, datos de clientes, correos
  privados, credenciales, exportaciones, logs ni capturas con información real.
- Usa datos ficticios en ejemplos, pruebas y documentación.
- No añadas `.env`, `firebase-init.js`, `.firebaserc`, cuentas de servicio ni tokens.
- Conserva los avisos de licencia de las dependencias incluidas.
- Antes de cada commit o push, revisa `git diff --cached`, `git diff --cached --name-only`
  y ejecuta `npm run check:publication`. El escáner es una ayuda, no sustituye la revisión.
- Revisa también el historial que vas a publicar y usa una identidad de commit
  sin correo personal, salvo autorización expresa del propietario.
- No habilites despliegues automáticos ni cambies producción sin una petición que lo autorice.

## Validación
Ejecuta `npm run build` y `npm test` cuando cambies la aplicación.
Mantén las pruebas portables y verifica persistencia, teclado y pantallas pequeñas.
