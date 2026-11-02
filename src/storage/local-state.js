// Browser-local demo state. Everything the viewer changes (task decisions, calendar
// notes, the chosen day, language) is saved in this browser's localStorage, one key per
// business so B2C and B2B never share state. This is NOT a backup and NOT shared
// between devices, browsers or people. Clearing site data, private windows or a
// browser that blocks storage lose it; the app then keeps working in memory.
//
// Keys (all start with PREFIX so other pages on the same origin are left alone):
//   bd-starter.v1.prefs                 { locale }
//   bd-starter.v1.business.<businessId> { version, day, decisions: {task_key: row}, notes: {entry_id: row} }
//   bd-starter.v1.workbook              { version, fileName, loadedAt, sheets: {Customers: rows, …} }
//     — the viewer's own Excel ("My Excel"): the four sheets' cell values, kept so a
//       reload still shows it. Stored unencrypted in this browser; "Forget" removes it.
//       A workbook in another layout is stored already rewritten (matching.js), with
//       absent: [sheets it does not have] and matched: true.
//   bd-starter.v1.matching              { version, list: [{ signature, matching }] }
//     — how the viewer matched their workbooks' sheets, columns and words (the last five
//       layouts), reused when a workbook with the same sheets and columns is read again.
//       "Forget this file" removes them.
//   bd-starter.v1.gemini                { version, key }
//     — the viewer's own Gemini API key for "Analyse with Gemini", typed in by them and
//       kept only here (unencrypted, like a saved password in a notebook on this computer).
//       Sent only to Google with their own requests. "Delete key" removes it; Reset keeps it.
//   bd-starter.v1.ai.<businessId>       { version, at, model, where, basis, situation, top, watch, unanswered, problems, dropped }
//     — the latest Gemini analysis in its fixed shape (briefs/ai-prompt.js readAiPlan), so its
//       picks show in Tasks and the Calendar after a reload. `basis` is the fingerprint of the
//       records it was made from. Reset, "Forget this file" and "Remove AI suggestions" remove it.

export const PREFIX = 'bd-starter.v1';
export const STATE_VERSION = 1;
// Browsers allow about 5 MB per site; leave room for the rest of the state.
export const WORKBOOK_STORE_LIMIT = 3_500_000;
const DAYS = ['day1', 'day2'];

// Returns { storage, persistent, reason }. `persistent` is false when localStorage is
// missing or throws (blocked cookies/site data, some file:// setups, sandboxed frames).
export function openStorage(getStorage = () => globalThis.localStorage) {
  try {
    const s = getStorage();
    if (!s) return { storage: memoryStorage(), persistent: false, reason: 'unavailable' };
    const probe = `${PREFIX}.probe`;
    s.setItem(probe, '1');
    const ok = s.getItem(probe) === '1';
    s.removeItem(probe);
    if (!ok) return { storage: memoryStorage(), persistent: false, reason: 'unreadable' };
    return { storage: s, persistent: true, reason: '' };
  } catch (e) {
    return { storage: memoryStorage(), persistent: false, reason: e?.name || 'blocked' };
  }
}

export function memoryStorage() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: k => { m.delete(k); },
    key: i => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  };
}

const text = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const isoOrBlank = v => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
const STATUSES = ['suggested', 'accepted', 'completed', 'dismissed'];

// Stored values are treated as untrusted input: anything malformed is dropped.
function cleanDecision(key, d) {
  if (!d || typeof d !== 'object' || typeof key !== 'string' || !key) return null;
  return {
    task_key: key,
    status: STATUSES.includes(d.status) ? d.status : 'suggested',
    ...(Object.hasOwn(d, 'action_date') ? { action_date: isoOrBlank(d.action_date) } : {}),
    ...(Object.hasOwn(d, 'owner') ? { owner: text(d.owner, 80) } : {}),
    note: text(d.note, 1000),
    title: text(d.title, 200),
    detail: text(d.detail, 1000),
    snapshot_at_decision: DAYS.includes(d.snapshot_at_decision) ? d.snapshot_at_decision : '',
    updated_at: text(d.updated_at, 40),
  };
}

function cleanNote(id, n) {
  if (!n || typeof n !== 'object' || typeof id !== 'string' || !id) return null;
  const date = isoOrBlank(n.date);
  if (!date) return null;
  return { entry_id: id, date, title: text(n.title, 200), detail: text(n.detail, 1000), created_at: text(n.created_at, 40), updated_at: text(n.updated_at, 40) };
}

function blankBusiness() { return { version: STATE_VERSION, day: 'day1', decisions: {}, notes: {} }; }

const isCell = v => v === '' || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
function cleanWorkbook(w) {
  if (!w || typeof w !== 'object' || w.version !== 1 || typeof w.fileName !== 'string' || !w.sheets || typeof w.sheets !== 'object') return null;
  const sheets = {};
  for (const [name, rows] of Object.entries(w.sheets)) {
    if (!Array.isArray(rows) || !rows.every(r => Array.isArray(r) && r.every(isCell))) return null;
    sheets[name] = rows;
  }
  const absent = Array.isArray(w.absent) ? w.absent.filter(a => ['Customers', 'Payments', 'Stock'].includes(a)) : [];
  return { version: 1, fileName: w.fileName.slice(0, 200), loadedAt: text(w.loadedAt, 40), sheets, absent, matched: w.matched === true };
}

// A stored matching (see src/data/matching.js), checked field by field; null if unusable.
const isName = v => typeof v === 'string' && v.length <= 200;
const MATCHINGS_KEPT = 5;
function cleanMatchings(stored) {
  const list = stored && typeof stored === 'object' && stored.version === 1 && Array.isArray(stored.list) ? stored.list : [];
  return list.map(cleanMatching).filter(Boolean).slice(0, MATCHINGS_KEPT);
}
function cleanMatching(m) {
  if (!m || typeof m !== 'object' || typeof m.signature !== 'string' || !m.matching || typeof m.matching !== 'object') return null;
  const x = m.matching;
  const roles = {}, columns = {}, values = {};
  for (const role of ['Sales', 'Customers', 'Payments', 'Stock']) {
    roles[role] = isName(x.roles?.[role]) ? x.roles[role] : null;
    columns[role] = {};
    for (const [k, v] of Object.entries(x.columns?.[role] || {})) if (/^[a-z_]{1,40}$/.test(k) && isName(v)) columns[role][k] = v;
  }
  for (const [key, map] of Object.entries(x.values || {})) {
    if (!/^[A-Za-z]+\.[a-z_]+$/.test(key) || !map || typeof map !== 'object') continue;
    values[key] = {};
    for (const [v, meaning] of Object.entries(map)) if (isName(v) && typeof meaning === 'string' && meaning.length <= 20) values[key][v] = meaning;
  }
  return { signature: m.signature.slice(0, 20), matching: { version: 1, roles, columns, values, dateOrder: x.dateOrder === 'mdy' ? 'mdy' : 'dmy' } };
}

// A stored AI analysis, field by field; null if unusable.
const strings = (v, max, keep) => (Array.isArray(v) ? v.map(s => text(s, max)).filter(Boolean).slice(0, keep) : []);
function cleanAiPlan(p) {
  if (!p || typeof p !== 'object' || p.version !== 1 || typeof p.basis !== 'string' || !p.basis) return null;
  const top = (Array.isArray(p.top) ? p.top : []).map(x => ({ task_key: text(x?.task_key, 200), why: text(x?.why, 1000), how: text(x?.how, 1000) })).filter(x => x.task_key).slice(0, 3);
  const watch = (Array.isArray(p.watch) ? p.watch : []).map(x => ({ item_id: text(x?.item_id, 200), why: text(x?.why, 1000) })).filter(x => x.item_id).slice(0, 12);
  const dropped = Number.isInteger(p.dropped) && p.dropped > 0 ? Math.min(p.dropped, 99) : 0;
  return { version: 1, at: text(p.at, 40), model: text(p.model, 80), where: text(p.where, 200), basis: p.basis.slice(0, 40), situation: text(p.situation, 2000), top, watch, unanswered: strings(p.unanswered, 500, 10), problems: strings(p.problems, 200, 20), dropped };
}

export function createStateStore(storage) {
  const businessKey = id => `${PREFIX}.business.${id}`;
  const aiKey = id => `${PREFIX}.ai.${id}`;
  const prefsKey = `${PREFIX}.prefs`;
  const read = key => { try { return JSON.parse(storage.getItem(key) || 'null'); } catch { return null; } };
  const write = (key, value) => { try { storage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };

  function business(id) {
    const raw = read(businessKey(id));
    if (!raw || typeof raw !== 'object' || raw.version !== STATE_VERSION) return blankBusiness();
    const out = blankBusiness();
    out.day = DAYS.includes(raw.day) ? raw.day : 'day1';
    for (const [k, d] of Object.entries(raw.decisions || {})) { const c = cleanDecision(k, d); if (c) out.decisions[k] = c; }
    for (const [k, n] of Object.entries(raw.notes || {})) { const c = cleanNote(k, n); if (c) out.notes[k] = c; }
    return out;
  }
  const update = (id, fn) => { const s = business(id); fn(s); return write(businessKey(id), s); };

  return {
    prefs() { const p = read(prefsKey); return p && typeof p === 'object' ? { locale: text(p.locale, 10) } : { locale: '' }; },
    setPrefs(patch) { return write(prefsKey, { ...this.prefs(), ...patch }); },
    business,
    day(id) { return business(id).day; },
    setDay(id, day) { if (!DAYS.includes(day)) throw new Error(`Unknown day "${day}"`); return update(id, s => { s.day = day; }); },
    decisions(id) { return Object.values(business(id).decisions); },
    saveDecision(id, row) { const c = cleanDecision(row.task_key, row); if (!c) return false; return update(id, s => { s.decisions[c.task_key] = c; }); },
    notes(id) { return Object.values(business(id).notes); },
    saveNote(id, note) { const c = cleanNote(note.entry_id, note); if (!c) return false; return update(id, s => { s.notes[c.entry_id] = c; }); },
    deleteNote(id, entryId) { return update(id, s => { delete s.notes[entryId]; }); },
    // "My Excel". saveWorkbook returns 'saved', 'too_large' (kept for this visit only) or 'failed'.
    workbook() { return cleanWorkbook(read(`${PREFIX}.workbook`)); },
    saveWorkbook({ fileName, loadedAt, sheets, absent = [], matched = false }) {
      const json = JSON.stringify({ version: 1, fileName, loadedAt, sheets, absent, matched });
      if (json.length > WORKBOOK_STORE_LIMIT) { try { storage.removeItem(`${PREFIX}.workbook`); } catch { /* ignore */ } return 'too_large'; }
      try { storage.setItem(`${PREFIX}.workbook`, json); return 'saved'; } catch { return 'failed'; }
    },
    // How the viewer matched a workbook with this layout signature (null when none is kept).
    matching(signature) { return cleanMatchings(read(`${PREFIX}.matching`)).find(m => m.signature === signature)?.matching || null; },
    // Every kept matching, most recent first (for a layout that changed a little: matching.js closestMatching).
    matchings() { return cleanMatchings(read(`${PREFIX}.matching`)).map(m => m.matching); },
    setMatching(signature, matching) {
      const others = cleanMatchings(read(`${PREFIX}.matching`)).filter(m => m.signature !== signature);
      return write(`${PREFIX}.matching`, { version: 1, list: [{ signature, matching }, ...others].slice(0, MATCHINGS_KEPT) });
    },
    // Forgetting the file also clears its task decisions, notes, AI analysis and matching.
    forgetWorkbook(id) { try { storage.removeItem(`${PREFIX}.workbook`); storage.removeItem(businessKey(id)); storage.removeItem(aiKey(id)); storage.removeItem(`${PREFIX}.matching`); return true; } catch { return false; } },
    // The latest Gemini analysis in its fixed shape (null when none is kept).
    aiPlan(id) { return cleanAiPlan(read(aiKey(id))); },
    saveAiPlan(id, plan) { const c = cleanAiPlan({ ...plan, version: 1 }); return c ? write(aiKey(id), c) : false; },
    forgetAiPlan(id) { try { storage.removeItem(aiKey(id)); return true; } catch { return false; } },
    // The viewer's own Gemini API key ('' when none).
    geminiKey() { const g = read(`${PREFIX}.gemini`); return g && typeof g === 'object' && g.version === 1 && typeof g.key === 'string' ? g.key.trim().slice(0, 200) : ''; },
    setGeminiKey(key) { return write(`${PREFIX}.gemini`, { version: 1, key: String(key).trim() }); },
    forgetGeminiKey() { try { storage.removeItem(`${PREFIX}.gemini`); return true; } catch { return false; } },
    // Reset = back to the baseline: Day 1, no decisions, no notes, no AI analysis. The language choice is kept.
    resetBusiness(id) { try { storage.removeItem(businessKey(id)); storage.removeItem(aiKey(id)); return true; } catch { return false; } },
    resetAll() {
      try {
        const keys = [];
        for (let i = 0; i < storage.length; i++) { const k = storage.key(i); if (k && (k.startsWith(`${PREFIX}.business.`) || k.startsWith(`${PREFIX}.ai.`))) keys.push(k); }
        for (const k of keys) storage.removeItem(k);
        return true;
      } catch { return false; }
    },
  };
}
