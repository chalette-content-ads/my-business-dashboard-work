// "Analyse with Gemini": the request sent to Google with the viewer's own key, how answers
// and errors are read, the number check on answers, and where the key is kept.
// No real request is made here: fetch is replaced by a stand-in.
import test from 'node:test';
import assert from 'node:assert/strict';
import { geminiRequest, answerText, askGemini, problemKind, looksLikeKey, GEMINI_HOST, GEMINI_MODELS } from '../src/briefs/gemini.js';
import { answerProblems, AI_PLAN_SCHEMA } from '../src/briefs/ai-prompt.js';
import { baselineBriefInput } from './support/training.js';
import { createStateStore, memoryStorage, PREFIX } from '../src/storage/local-state.js';
import { setLocale } from '../src/i18n/i18n.js';

setLocale('en');
const KEY = 'test-key-not-real-0000000000';
const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const answer = text => reply(200, { modelVersion: 'gemini-test', candidates: [{ content: { parts: [{ text: 'thinking…', thought: true }, { text }] } }] });

test('the request goes to the Gemini API with the key in a header, never in the address', () => {
  const { url, init } = geminiRequest(GEMINI_MODELS[0], KEY, 'hello');
  assert.equal(url, `${GEMINI_HOST}/v1beta/models/gemini-flash-latest:generateContent`);
  assert.ok(!url.includes(KEY));
  assert.equal(init.method, 'POST');
  assert.equal(init.headers['x-goog-api-key'], KEY);
  assert.deepEqual(JSON.parse(init.body).contents, [{ role: 'user', parts: [{ text: 'hello' }] }]);
});

test('answers are read without thinking parts or Markdown marks', async () => {
  assert.equal(answerText({ candidates: [{ content: { parts: [{ text: 'x', thought: true }, { text: '## Title\n**Bold** point' }] } }] }), 'Title\nBold point');
  const calls = [];
  const r = await askGemini({ prompt: 'p', key: KEY, fetchImpl: async (url, init) => { calls.push({ url, key: init.headers['x-goog-api-key'] }); return answer('Order value RM 25,650.'); } });
  assert.deepEqual(r, { ok: true, text: 'Order value RM 25,650.', model: 'gemini-test' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].key, KEY);
});

test('with a schema, Gemini is asked for the fixed JSON shape and the answer is kept as written', async () => {
  const body = JSON.parse(geminiRequest(GEMINI_MODELS[0], KEY, 'hello', AI_PLAN_SCHEMA).init.body);
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
  assert.deepEqual(body.generationConfig.responseSchema, AI_PLAN_SCHEMA);
  assert.equal(JSON.parse(geminiRequest(GEMINI_MODELS[0], KEY, 'hello').init.body).generationConfig.responseSchema, undefined);
  const json = '{"situation": "**RM 25,650**"}';
  assert.equal((await askGemini({ prompt: 'p', key: KEY, schema: AI_PLAN_SCHEMA, fetchImpl: async () => answer(json) })).text, json, 'not stripped');
  // A model that refuses the schema itself is asked once more without it…
  const bodies = [];
  const retried = await askGemini({ prompt: 'p', key: KEY, schema: AI_PLAN_SCHEMA, fetchImpl: async (url, init) => {
    bodies.push(JSON.parse(init.body));
    return bodies.length === 1 ? reply(400, { error: { status: 'INVALID_ARGUMENT', message: 'Invalid JSON payload received. Unknown name "responseSchema"' } }) : answer('plain text');
  } });
  assert.equal(retried.ok, true);
  assert.deepEqual(bodies.map(b => !!b.generationConfig.responseSchema), [true, false]);
  // …but a bad key is not.
  let calls = 0;
  const bad = await askGemini({ prompt: 'p', key: KEY, schema: AI_PLAN_SCHEMA, fetchImpl: async () => { calls++; return reply(400, { error: { status: 'INVALID_ARGUMENT', message: 'API key not valid.' } }); } });
  assert.equal(bad.kind, 'key');
  assert.equal(calls, 1);
});

test('problems are explained, and only model or quota problems try the next model', async () => {
  const invalid = { error: { code: 400, status: 'INVALID_ARGUMENT', message: 'API key not valid. Please pass a valid API key.', details: [{ reason: 'API_KEY_INVALID' }] } };
  let tried = [];
  const run = responses => askGemini({ prompt: 'p', key: KEY, fetchImpl: async url => { tried.push(url.match(/models\/([^:]+)/)[1]); return responses.shift(); } });
  assert.equal((await run([reply(400, invalid)])).kind, 'key');
  assert.deepEqual(tried, ['gemini-flash-latest'], 'a bad key is not retried');
  tried = [];
  const ok = await run([reply(429, { error: { status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded' } }), answer('fine')]);
  assert.equal(ok.ok, true, 'Flash out of quota → Flash-Lite answers');
  assert.deepEqual(tried, GEMINI_MODELS);
  tried = [];
  assert.equal((await run([reply(429, {}), reply(429, {})])).kind, 'quota');
  assert.equal((await run([reply(404, { error: { status: 'NOT_FOUND' } }), reply(503, {})])).kind, 'busy');
  assert.equal(problemKind(400, { error: { status: 'FAILED_PRECONDITION', message: 'User location is not supported for the API use.' } }), 'region');
  assert.equal(problemKind(403, { error: { status: 'PERMISSION_DENIED' } }), 'key');
  assert.equal((await askGemini({ prompt: 'p', key: KEY, fetchImpl: async () => { throw new TypeError('Failed to fetch'); } })).kind, 'network');
  const slow = (url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
  assert.equal((await askGemini({ prompt: 'p', key: KEY, fetchImpl: slow, timeoutMs: 20 })).kind, 'timeout');
  assert.equal((await askGemini({ prompt: 'p', key: KEY, fetchImpl: async () => reply(200, { promptFeedback: { blockReason: 'OTHER' } }) })).kind, 'blocked');
});

test('the number check flags figures that are not in the data', () => {
  const base = baselineBriefInput('betterspace-b2c', 'day1', 'en');
  const inputs = { scenario: base.scenario, previous: base.previous, tasks: base.tasks, calendar: base.calendar };
  assert.deepEqual(answerProblems('Order value this period is RM 25,650 (as of 2026年8月30日, 30 August 2026). Owner 2 should call.', inputs), []);
  const problems = answerProblems('Order value is RM 99,999 and sales grew 250.0%.', inputs);
  assert.ok(problems.some(p => /RM 99,999/.test(p)), problems.join('; '));
  assert.ok(problems.some(p => /250\.0%/.test(p)), problems.join('; '));
});

test('the key is kept only in this browser, and Reset keeps it', () => {
  const storage = memoryStorage();
  const store = createStateStore(storage);
  assert.equal(store.geminiKey(), '');
  assert.equal(looksLikeKey('not a key'), false);
  assert.equal(looksLikeKey(KEY), true);
  assert.equal(store.setGeminiKey(`  ${KEY} `), true);
  assert.equal(store.geminiKey(), KEY);
  assert.deepEqual(JSON.parse(storage.getItem(`${PREFIX}.gemini`)), { version: 1, key: KEY });
  store.resetAll();
  assert.equal(store.geminiKey(), KEY, 'Reset demo does not delete the key');
  storage.setItem(`${PREFIX}.gemini`, '{"key": 5}');
  assert.equal(store.geminiKey(), '', 'stored data is untrusted');
  store.setGeminiKey(KEY);
  store.forgetGeminiKey();
  assert.equal(store.geminiKey(), '');
  assert.equal(storage.getItem(`${PREFIX}.gemini`), null);
});
