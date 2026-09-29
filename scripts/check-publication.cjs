const { execFileSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' });
const allowed = new Set([
  '.gitignore', '.gitattributes', 'AGENTS.md', 'README.md', 'ROADMAP.md', 'SECURITY.md',
  'package.json', 'package-lock.json', 'app.js', 'styles.css', 'index.html', 'icon.svg',
  'firebase-app-compat.js', 'firebase-init.example.js', 'firebase.json', 'build.cjs',
  'verify.cjs', 'scripts/check-publication.cjs'
]);
const detectors = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['GitHub token', /(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/],
  ['provider API key', /\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}/],
  ['Google API key', /AIza[A-Za-z0-9_-]{35}/],
  ['service account', /"type"\s*:\s*"service_account"/],
  ['local user path', /[A-Z]:[\\/]Users[\\/][^\s'";]+/i],
  ['private email', /[A-Z0-9._%+-]+@(?:gmail|hotmail|outlook|yahoo)\.[A-Z]{2,}/i]
];
const files = git('ls-files', '-z').split('\0').filter(Boolean);
if (!files.length) throw new Error('Stage the reviewed source files before running this check.');
const issues = [];
for (const file of files) {
  if (!allowed.has(file)) issues.push(`${file}: file is not on the reviewed publication list`);
  const contents = git('show', `:${file}`);
  for (const [label, pattern] of detectors) {
    if (pattern.test(contents)) issues.push(`${file}: possible ${label}`);
  }
}
if (issues.length) {
  console.error(issues.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`PASS: ${files.length} staged files checked. Review the diff and outgoing history before publishing.`);
}
