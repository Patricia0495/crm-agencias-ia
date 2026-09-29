# Información pública y privada

Este repositorio es público. No debe incluir datos de clientes ni documentos
internos de la agencia. No publiques información sensible en issues o pull requests.

Mantén fuera de Git las credenciales, archivos de entorno, cuentas de servicio,
tokens, datos exportados, bases de datos, logs y capturas reales. Las plantillas
deben utilizar valores ficticios. Revisa también los metadatos de los commits.

`npm run check:publication` comprueba la lista de archivos y algunos patrones de
credenciales en el índice de Git. No detecta todos los secretos ni todos los datos
personales: siempre es necesaria la revisión del contenido y del historial.

Si se publica una credencial por accidente, revócala o rótala antes de limpiar el
historial. Eliminarla del último commit no la elimina de commits previos o copias.

La aplicación actual almacena sus datos en el navegador. Antes de incorporar
servicios remotos, implementar autenticación y reglas de autorización por agencia.
