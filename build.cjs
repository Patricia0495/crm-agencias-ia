const fs = require('node:fs');
const path = require('node:path');
const output = path.join(__dirname, 'public');
fs.mkdirSync(output, { recursive: true });
for (const file of ['index.html', 'styles.css', 'app.js', 'icon.svg', 'firebase-init.js', 'firebase-app-compat.js']) {
  fs.copyFileSync(path.join(__dirname, file), path.join(output, file));
}
console.log('Publicación preparada: 6 archivos estáticos.');
