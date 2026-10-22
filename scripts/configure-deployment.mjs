// Run only after a real HTTPS backend has been provisioned and verified.
import fs from 'node:fs';
const raw = process.env.MOX_API_ORIGIN;
if (!raw) throw new Error('Defina MOX_API_ORIGIN com a origem HTTPS da API implantada. Localhost não funciona na Vercel.');
const origin = new URL(raw);
if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash || /^(localhost|127\.|0\.|\[::1\])/.test(origin.hostname)) throw new Error('MOX_API_ORIGIN deve ser uma origem HTTPS pública, sem caminho, token ou credenciais.');
const config = {
  framework: 'vite', buildCommand: 'npm run build', outputDirectory: 'dist',
  rewrites: [
    { source: '/redecanais/:path*', destination: `${origin.origin}/:path*` },
    { source: '/((?!redecanais(?:/|$)).*)', destination: '/index.html' },
  ],
  headers: [{ source: '/(.*)', headers: [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  ] }],
};
fs.writeFileSync(new URL('../vercel.json', import.meta.url), JSON.stringify(config, null, 2)+'\n');
console.log('Configuração gerada. Valide autenticação, health, vídeo e Range no ambiente de preview antes de promover.');
