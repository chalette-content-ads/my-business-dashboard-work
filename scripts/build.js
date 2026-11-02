// Builds the classroom file: ONE self-contained HTML page with the code, styles and
// practice workbooks inside it (no business records: it opens the viewer's own Excel). It opens by double-click (file://), needs no server and no
// internet. Its Content-Security-Policy allows one address only — Google's Gemini API,
// for "Analyse with Gemini" with the viewer's own key.
//
//   dist/business-dashboard-demo.html   the file to hand out / open in class
//   dist/site/index.html                the same page, ready for static hosting
//
// The source in src/ stays modular; esbuild only bundles it for this output.
// Run with `npm run build` (which packs data/ first).

import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { siteConfigFromEnv, siteConfigModule, describeSiteConfig } from './site-config.js';
import { GEMINI_HOST } from '../src/briefs/gemini.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = p => path.join(root, 'src', p);
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));

// config: the site settings (BUSINESS_NAME, START_WITH) — from the environment unless given.
export async function buildHtml(config = siteConfigFromEnv()) {
  const siteConfig = {
    name: 'site-config',
    setup(b) { b.onLoad({ filter: /[\\/]src[\\/]site-config\.js$/ }, () => ({ contents: siteConfigModule(config), loader: 'js' })); },
  };
  const result = await build({
    entryPoints: [src('main.js')],
    absWorkingDir: root, // the same file whatever folder the build is run from
    bundle: true,
    format: 'iife',
    write: false,
    charset: 'utf8',
    legalComments: 'eof', // keeps the MIT notice of the bundled Excel reader
    target: 'es2022', // any current Chrome, Edge, Firefox or Safari
    logLevel: 'silent',
    plugins: [siteConfig],
  });
  // Inline script safety: "</script" or "<!--" inside the code would end or confuse the tag.
  const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
  const css = readFileSync(src('style.css'), 'utf8');
  let html = readFileSync(src('index.html'), 'utf8');

  // The browser hashes exactly what sits between <script> and </script>, newline included.
  const scriptBody = `\n${js}`;
  const scriptHash = createHash('sha256').update(scriptBody, 'utf8').digest('base64');
  const csp = `default-src 'none'; script-src 'sha256-${scriptHash}'; style-src 'unsafe-inline'; img-src data:; connect-src ${GEMINI_HOST}; font-src 'none'; base-uri 'none'; form-action 'none'`;

  const replaceOnce = (pattern, value, what) => {
    if (!pattern.test(html)) throw new Error(`build: could not find ${what} in src/index.html`);
    html = html.replace(pattern, () => value);
  };
  replaceOnce(/<meta http-equiv="Content-Security-Policy" content="[^"]*">/, `<meta http-equiv="Content-Security-Policy" content="${csp}">`, 'the CSP meta tag');
  replaceOnce(/<link rel="stylesheet" href="style.css">/, `<style>\n${css}</style>`, 'the stylesheet link');
  replaceOnce(/<script type="module" src="main.js"><\/script>/, `<script>${scriptBody}</script>`, 'the module script tag');
  // The MIT licence asks for its notice in every copy, and this file is the copy people pass around.
  const license = readFileSync(path.join(root, 'LICENSE'), 'utf8').replace(/\r\n?/g, '\n').trim();
  if (license.includes('--')) throw new Error('build: LICENSE text cannot go inside an HTML comment');
  html = html.replace('<!doctype html>', `<!doctype html>\n<!-- Business Dashboard Starter ${pkg.version} · single-file build of src/ (scripts/build.js) · no built-in data: opens your own Excel · works offline -->\n<!--\n${license}\n-->`);
  return html;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let config;
  try { config = siteConfigFromEnv(); } catch (e) { console.error(e.message); process.exit(1); }
  console.log(describeSiteConfig(config));
  const html = await buildHtml(config);
  const out = path.join(root, 'dist', 'business-dashboard-demo.html');
  mkdirSync(path.join(root, 'dist', 'site'), { recursive: true });
  writeFileSync(out, html);
  writeFileSync(path.join(root, 'dist', 'site', 'index.html'), html);
  console.log(`Built ${path.relative(root, out)} (${Math.round(Buffer.byteLength(html) / 1024)} KB) and dist/site/index.html`);
  console.log('Open the demo by double-clicking dist/business-dashboard-demo.html.');
}
