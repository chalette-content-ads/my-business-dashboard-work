// Data and network boundaries: the app reads only its bundled training data, never the
// answer keys, and the single-file build stays self-contained. Its only network access is
// "Analyse with Gemini": src/briefs/gemini.js → Google's Gemini API, with the viewer's own key.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { collectDatasets, renderModule, OUTPUT } from '../scripts/pack-data.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
function files(dir, ext) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...files(full, ext));
    else if (ext.some(e => name.endsWith(e))) out.push(full);
  }
  return out;
}
// Our own code. The vendored Excel reader (src/vendor/) is library code, checked separately below.
const appSource = files(path.join(root, 'src'), ['.js', '.html', '.css']).filter(f => !f.endsWith('.generated.js') && !f.includes(`${path.sep}vendor${path.sep}`));
// XML namespace names inside SVG and Excel files look like web addresses but are never requested.
const NAMESPACES = /^http:\/\/(www\.w3\.org|schemas\.openxmlformats\.org|purl\.oclc\.org|schemas\.microsoft\.com)\//;

test('the packed layout module is up to date with data/', () => {
  assert.equal(readFileSync(OUTPUT, 'utf8'), renderModule(collectDatasets()), 'run `npm run data`');
});

test('the dashboard contains no records: only column layouts are packed, never the answer keys', () => {
  const packed = readFileSync(OUTPUT, 'utf8');
  assert.doesNotMatch(packed, /expected_metrics|august_order_value|story_sale_balance/);
  assert.doesNotMatch(packed, /BS-001|BC-001|RS-321|Demo Shopper|Sarah|as_of_date|BetterSpace/, 'no records, metadata, people or business text');
  assert.equal(existsSync(path.join(root, 'src/data/datasets.generated.js')), false, 'the training records are not bundled');
  for (const f of appSource) assert.doesNotMatch(readFileSync(f, 'utf8'), /datasets\.generated|DATASETS/, `${path.relative(root, f)} must not read training records`);
  assert.equal(files(path.join(root, 'data'), ['.json']).some(f => f.includes('expected_metrics')), false, 'answer keys live in test/expected only');
  for (const f of appSource) assert.doesNotMatch(readFileSync(f, 'utf8'), /expected_metrics/, `${path.relative(root, f)} must not read the answer keys`);
});

const GEMINI = 'https://generativelanguage.googleapis.com';
const GEMINI_MODULE = path.join('src', 'briefs', 'gemini.js');
test('the app connects only to Gemini, only from gemini.js, and holds no keys', () => {
  const forbidden = [/XMLHttpRequest/, /WebSocket/, /EventSource/, /sendBeacon/, /\bimport\s*\(/, /navigator\.serviceWorker/, /<link[^>]+href="https?:/, /<script[^>]+src="https?:/, /api[_-]?key\s*[:=]/i, /Bearer /, /AIza[0-9A-Za-z_-]{20,}/];
  for (const f of appSource) {
    const text = readFileSync(f, 'utf8');
    const rel = path.relative(root, f);
    // The translation dictionary is text, not code: it is only checked for web addresses.
    if (!f.endsWith(path.join('i18n', 'zh.js'))) for (const re of forbidden) assert.doesNotMatch(text, re, `${rel} matches ${re}`);
    if (!f.endsWith(GEMINI_MODULE)) assert.doesNotMatch(text, /\bfetch\s*\(/, `${rel}: only src/briefs/gemini.js may make requests`);
    // gemini.js names the Gemini API; index.html allows it in its Content-Security-Policy. Nothing else.
    const allowed = f.endsWith(GEMINI_MODULE) || f.endsWith(path.join('src', 'index.html')) ? [GEMINI] : [];
    const urls = (text.match(/https?:\/\/[^\s'"`)<;]+/g) || []).filter(u => u !== 'http://www.w3.org/2000/svg' && !allowed.includes(u));
    assert.deepEqual(urls, [], `${rel} contains web addresses`);
  }
  const gemini = readFileSync(path.join(root, GEMINI_MODULE), 'utf8');
  assert.match(gemini, /export const GEMINI_HOST = 'https:\/\/generativelanguage\.googleapis\.com';/);
  assert.match(gemini, /'x-goog-api-key': key/, 'the key travels in a request header');
  assert.doesNotMatch(gemini, /[?&]key=/, 'never in the web address');
});

test('the vendored Excel reader makes no network requests and starts no workers', () => {
  const text = readFileSync(path.join(root, 'src/vendor/read-excel-file.js'), 'utf8');
  for (const re of [/fetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /sendBeacon/, /new Worker/, /importScripts/, /eval\s*\(/, /new Function\s*\(/]) assert.doesNotMatch(text, re);
  const urls = (text.match(/https?:\/\/[^\s'"`)<]+/g) || []).filter(u => !NAMESPACES.test(u));
  assert.deepEqual(urls, [], 'only XML namespace names');
  assert.match(text, /^\/\*! read-excel-file 9\.3\.10 \(MIT\)/, 'licence notice kept');
});

test('the development page allows only the Gemini API in its Content-Security-Policy', () => {
  const html = readFileSync(path.join(root, 'src/index.html'), 'utf8');
  assert.match(html, /Content-Security-Policy" content="default-src 'none';[^"]*connect-src https:\/\/generativelanguage\.googleapis\.com;/);
  assert.doesNotMatch(html, /fonts\.googleapis|fonts\.gstatic/);
});

test('the single-file build is self-contained, works offline and holds no business records', async t => {
  let buildHtml;
  try { ({ buildHtml } = await import('../scripts/build.js')); } catch (e) { assert.fail(`esbuild is needed for this test — run npm install first (${e.message})`); }
  const html = await buildHtml();
  assert.match(html, /<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-[A-Za-z0-9+/=]+'; style-src 'unsafe-inline'; img-src data:; connect-src https:\/\/generativelanguage\.googleapis\.com; font-src 'none';/);
  assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+rel="stylesheet"|type="module"/, 'no external or module scripts, no stylesheet links');
  assert.equal((html.match(/<script>/g) || []).length, 1, 'exactly one inline script');
  // The CSP hash must match the script exactly, or the browser refuses to run it.
  const body = html.slice(html.indexOf('<script>') + '<script>'.length, html.lastIndexOf('</script>'));
  const hash = createHash('sha256').update(body, 'utf8').digest('base64');
  assert.ok(html.includes(`script-src 'sha256-${hash}'`), 'CSP hash matches the inline script');
  const urls = (html.match(/https?:\/\/[^\s'"`)<;]+/g) || []).filter(u => !NAMESPACES.test(u) && u !== GEMINI);
  assert.deepEqual(urls, [], 'no web addresses in the build other than the Gemini API (XML namespace names aside)');
  assert.doesNotMatch(html, /AIza[0-9A-Za-z_-]{20,}/, 'no API key in the build');
  assert.doesNotMatch(html, /new Worker|importScripts/, 'no Web Workers (the CSP would block them)');
  assert.doesNotMatch(html, /BS-001,BC-001,2026-08-20|RS-321|Demo Shopper/, 'no training records inside the file');
  assert.match(html, /no built-in data/);
  assert.match(html, /MIT License\s+Copyright \(c\) 2026 Infinite New Media/, 'the licence notice travels with the file');
  assert.doesNotMatch(html, /expected_metrics|august_order_value/);
  // A note, not a failure: editing src/ without rebuilding is normal while developing.
  const built = path.join(root, 'dist/business-dashboard-demo.html');
  if (existsSync(built) && readFileSync(built, 'utf8') !== html) t.diagnostic('dist/business-dashboard-demo.html is older than src/ — run `npm run build` before handing it out.');
});
