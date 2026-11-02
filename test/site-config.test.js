// Site settings: the GitHub repository variable BUSINESS_NAME, which names the dashboard
// without editing any file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { siteConfigFromEnv, siteConfigModule, BUSINESS_NAME_MAX } from '../scripts/site-config.js';
import { SITE_CONFIG } from '../src/site-config.js';
import { workbookProfile } from '../src/data/workbook.js';

test('without the variable the site keeps its default', () => {
  assert.deepEqual(siteConfigFromEnv({}), { businessName: '' });
  assert.deepEqual(siteConfigFromEnv({ BUSINESS_NAME: '  ', START_WITH: 'b2b' }), { businessName: '' }, 'START_WITH is no longer a setting and is ignored');
  assert.deepEqual({ ...SITE_CONFIG }, { businessName: '' }, 'the file in src/ holds the classroom default');
});

test('BUSINESS_NAME is tidied and limited in length', () => {
  assert.equal(siteConfigFromEnv({ BUSINESS_NAME: '  小明\t家具店\n ' }).businessName, '小明 家具店');
  assert.equal(siteConfigFromEnv({ BUSINESS_NAME: '字'.repeat(BUSINESS_NAME_MAX) }).businessName.length, BUSINESS_NAME_MAX);
  assert.throws(() => siteConfigFromEnv({ BUSINESS_NAME: '字'.repeat(BUSINESS_NAME_MAX + 1) }), /BUSINESS_NAME 太长了.*too long/s);
});

test('an API key pasted into the variable stops the build (variables are public)', () => {
  assert.throws(() => siteConfigFromEnv({ BUSINESS_NAME: 'AIzaSyD-this-is-not-a-real-key-123456789' }), /BUSINESS_NAME 看起来像 API 钥匙.*looks like an API key/s);
  assert.throws(() => siteConfigFromEnv({ BUSINESS_NAME: 'abcDEF1234567890abcDEF1234567890xyz' }), /looks like an API key/);
  assert.equal(siteConfigFromEnv({ BUSINESS_NAME: 'BetterSpace Office Solutions Sdn Bhd 2' }).businessName, 'BetterSpace Office Solutions Sdn Bhd 2', 'an ordinary long name is fine');
});

test('the settings module is plain data, safe for any name', async () => {
  const name = '小明 "家具" </script> <!-- 店';
  const text = siteConfigModule({ businessName: name });
  const mod = await import(`data:text/javascript,${encodeURIComponent(text)}`);
  assert.deepEqual({ ...mod.SITE_CONFIG }, { businessName: name });
  assert.ok(Object.isFrozen(mod.SITE_CONFIG));
});

test('BUSINESS_NAME names the dashboard; without it the file name does', () => {
  const named = workbookProfile('Sales 2026.xlsx', {}, '小明家具店').profile.business;
  assert.deepEqual([named.name, named.name_zh, named.short, named.short_zh], ['小明家具店', '小明家具店', '小明家具店', '小明家具店']);
  const unnamed = workbookProfile('Sales 2026.xlsx', {}, '').profile.business;
  assert.deepEqual([unnamed.name, unnamed.name_zh, unnamed.short, unnamed.short_zh], ['Sales 2026', 'Sales 2026', 'My Excel', '我的 Excel']);
  const empty = workbookProfile('', {}, '').profile.business;
  assert.deepEqual([empty.name, empty.name_zh], ['My Excel', '我的 Excel']);
});

test('the single-file build carries the setting inside its hashed script', async () => {
  const { buildHtml } = await import('../scripts/build.js');
  const html = await buildHtml({ businessName: '小明家具店' });
  const body = html.slice(html.indexOf('<script>') + '<script>'.length, html.lastIndexOf('</script>'));
  assert.ok(html.includes(`script-src 'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`), 'CSP hash still matches');
  assert.match(body, /"?businessName"?: ?"小明家具店"/);
  const plain = await buildHtml({ businessName: '' });
  assert.doesNotMatch(plain, /小明家具店/);
});
