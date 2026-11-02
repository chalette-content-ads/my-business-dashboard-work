// Builds src/vendor/read-excel-file.js: the MIT-licensed read-excel-file library as
// one plain ES module, so the unbundled dev page, the tests and the single-file build
// all use the same Excel reader.
//
// The library normally unzips larger workbooks in a Web Worker. The page's security
// policy allows no workers (and needs none), so this build swaps that one step for
// the library's own synchronous unzip. Nothing else is changed.
//
// Usage: node scripts/vendor.js            (writes the file)
//        node scripts/vendor.js --check    (exit 1 if it is out of date)

import { build } from 'esbuild';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const VENDOR_OUTPUT = path.join(root, 'src/vendor/read-excel-file.js');

const syncUnzip = {
  name: 'read-excel-file-sync-unzip',
  setup(b) {
    // Only the universal unpacker's import is redirected, to a small wrapper that
    // returns the synchronous unzip result as a promise (the shape it expects).
    b.onResolve({ filter: /^\.\.\/zip\/unzipFromArrayBuffer\.js$/ }, args =>
      /unpackXlsxFileUniversal\.js$/.test(args.importer) ? { path: 'sync-unzip', namespace: 'sync-unzip', pluginData: { dir: path.join(args.resolveDir, '../zip') } } : undefined);
    // (The library's own unzipFromArrayBufferSync cannot be used: in 9.3.10 its shared
    // helper always expects a promise.) fflate's unzipSync with the same file filter:
    b.onLoad({ filter: /.*/, namespace: 'sync-unzip' }, args => ({
      contents: [
        "import { unzipSync } from 'fflate';",
        'export default function unzip(input, options = {}) {',
        '  return Promise.resolve().then(() => unzipSync(new Uint8Array(input), {',
        '    filter: file => (options.filter ? options.filter({ path: file.name }) : true),',
        '  }));',
        '}',
      ].join('\n'),
      resolveDir: args.pluginData.dir,
      loader: 'js',
    }));
  },
};

export async function buildVendor() {
  const pkg = JSON.parse(readFileSync(path.join(root, 'node_modules/read-excel-file/package.json'), 'utf8'));
  // Line endings normalised so the output is identical on Windows, macOS and Linux.
  const readLicense = p => readFileSync(path.join(root, p), 'utf8').replace(/\r\n?/g, '\n').trim();
  const license = readLicense('node_modules/read-excel-file/LICENSE');
  const fflateLicense = readLicense('node_modules/fflate/LICENSE');
  const result = await build({
    stdin: { contents: "export { default } from 'read-excel-file/universal';", resolveDir: root, loader: 'js' },
    bundle: true,
    format: 'esm',
    minify: true,
    write: false,
    target: 'es2022',
    legalComments: 'none',
    logLevel: 'silent',
    plugins: [syncUnzip],
  });
  const code = result.outputFiles[0].text;
  if (/new Worker/.test(code)) throw new Error('vendor: the Excel reader still contains a Web Worker');
  const banner = `/*! read-excel-file ${pkg.version} (${pkg.license}) and fflate (MIT), bundled by scripts/vendor.js — do not edit.\n${license}\n\n${fflateLicense}\n*/\n`;
  return banner + code;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const text = await buildVendor();
  if (process.argv.includes('--check')) {
    if (!existsSync(VENDOR_OUTPUT) || readFileSync(VENDOR_OUTPUT, 'utf8') !== text) { console.error('src/vendor/read-excel-file.js is out of date. Run: node scripts/vendor.js'); process.exit(1); }
    console.log('Vendored Excel reader is up to date.');
  } else {
    mkdirSync(path.dirname(VENDOR_OUTPUT), { recursive: true });
    writeFileSync(VENDOR_OUTPUT, text);
    console.log(`Wrote ${path.relative(root, VENDOR_OUTPUT)} (${Math.round(text.length / 1024)} KB)`);
  }
}
