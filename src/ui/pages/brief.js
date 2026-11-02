// AI analysis: "Analyse with Gemini" asks Google's Gemini for a live analysis of the
// numbers as they are now, with the viewer's own API key (briefs/gemini.js — the app's
// only network access). The answer comes back in a fixed shape (ai-prompt.js), so its
// three top tasks and the calendar items it says to watch are marked in Tasks and the
// Calendar — only task keys and calendar ids that are in the data, and nothing is accepted
// for the viewer. The answer is labelled as live AI with its model and time, and its
// numbers are checked against the data before the viewer reads it. There is no fake
// typing effect, and nothing is sent until the viewer presses the button.

import { h, t, add, toast } from '../dom.js';
import { pageHead, scopeBar } from '../components.js';
import { view, allTasks, isOpen, businessName, scenario, previousScenario, calendarItems, savedAiPlan, isCurrentPlan, currentBasis } from '../view-state.js';
import { buildAiPrompt, answerProblems, readAiPlan, planText, dataBasis, AI_PLAN_SCHEMA } from '../../briefs/ai-prompt.js';
import { askGemini, looksLikeKey } from '../../briefs/gemini.js';
import { fmtTime } from './tasks.js';
import { formatDate } from '../../core/dates.js';
import { tr, tl, getLocale } from '../../i18n/i18n.js';

export function renderBrief() {
  const root = h('div', {}, pageHead(tl('AI analysis')), scopeBar({ period: false }));
  add(root, h('div', { class: 'banner info' },
    t('p', tr('Gemini can write an analysis of your numbers as they are now, including your task decisions and notes. The three tasks it says to do first and the dates it says to watch are then marked in Tasks and the Calendar. Nothing is sent anywhere unless you press "Analyse with Gemini" below.'))));
  add(root, geminiCard());
  return root;
}

// An answer that did not come in the fixed shape, per business and records, for this visit
// only (not saved, and not added to Tasks or the Calendar). Saving a plan replaces it.
const answers = new Map();
const answerKey = () => `${view.businessId}|${currentBasis()}`;

const PROBLEM_TEXT = {
  key: () => tr('Google did not accept this key. Copy the whole key again from AI Studio, then delete the saved key here and paste the new one.'),
  region: () => tr('Google says the Gemini API is not available where you are.'),
  quota: () => tr('Your free Gemini quota is used up for now. Wait a minute and try again, or try again tomorrow.'),
  busy: () => tr('Gemini is busy right now. Try again in a minute.'),
  model: () => tr('Google could not find a Gemini model for this key. Try again later.'),
  blocked: () => tr('Gemini returned no answer for this request. Try again, or hide the names and try again.'),
  network: () => tr('Could not reach Google. Check your internet connection. (The offline file can analyse only when this computer is online.)'),
  timeout: () => tr('Gemini took too long to answer. Try again.'),
  other: () => tr('Gemini could not answer this time. Try again later.'),
};

// "Analyse with Gemini". Without a saved key: how to get one, and a field to paste it.
// With a key: what will be sent, the button, and the latest answer with its number check.
function geminiCard() {
  const card = h('div', { class: 'card ai-live' });
  const redraw = () => card.replaceWith(geminiCard());
  add(card, t('h3', tr('Analyse with Gemini (live AI)')));
  const key = view.store.geminiKey();
  const result = h('div', { class: 'ai-answer-slot' });
  const showResult = () => {
    result.textContent = '';
    const text = answers.get(answerKey()), plan = savedAiPlan();
    if (text) add(result, answerView(text, plan, redraw));
    else if (plan) add(result, planView(plan, redraw));
  };

  if (!key) {
    const input = h('input', { type: 'password', autocomplete: 'off', spellcheck: 'false', class: 'key-input', 'aria-label': tr('Gemini API key'), placeholder: tr('Paste your Gemini API key') });
    const status = h('p', { class: 'small', role: 'status', 'aria-live': 'polite' });
    const save = () => {
      const value = input.value.trim();
      if (!looksLikeKey(value)) { status.textContent = tr('That does not look like an API key. Copy the whole key from AI Studio and paste it here.'); return; }
      if (!view.store.setGeminiKey(value)) { status.textContent = tr('This browser does not allow saving, so the key cannot be kept here.'); return; }
      redraw();
    };
    add(card,
      t('p', tr('Gemini can write an analysis of the numbers on this page as they are now. You need your own free Gemini API key from Google AI Studio:'), 'small ink2'),
      h('ol', { class: 'small ink2' },
        t('li', tr('Open aistudio.google.com/apikey and sign in with a Google account.')),
        t('li', tr('Copy your key (if there is none, press Create API key).')),
        t('li', tr('Paste it here and press "Save key".'))),
      h('div', { class: 'row' }, input, h('button', { type: 'button', class: 'btn primary', onclick: save }, tl('Save key'))),
      status,
      t('p', tr('The key is kept only in this browser and is sent only to Google, with your own requests. Treat it like a password: never put it in GitHub (not even as a repository variable) and never share a screenshot of it.'), 'small muted'),
      result);
    showResult();
    return card;
  }

  let hide = true; // your own data: names hidden unless you untick
  const request = () => buildAiPrompt({ scenario: scenario(), previous: previousScenario(), tasks: allTasks(), calendar: calendarItems(), locale: getLocale(), hideNames: hide });
  const preview = h('pre', { class: 'facts ai-request' }, request());
  const status = h('p', { class: 'small', role: 'status', 'aria-live': 'polite' });
  const button = h('button', { type: 'button', class: 'btn primary', onclick: analyse }, tl('Analyse with Gemini'));

  async function analyse() {
    const prompt = request();
    preview.textContent = prompt;
    const inputs = { scenario: scenario(), previous: previousScenario(), tasks: allTasks(), calendar: calendarItems() };
    const where = businessName();
    button.disabled = true;
    status.textContent = tr('Waiting for Gemini… (usually 10–30 seconds)');
    const reply = await askGemini({ prompt, key: view.store.geminiKey(), schema: AI_PLAN_SCHEMA });
    button.disabled = false;
    if (!reply.ok) { status.textContent = PROBLEM_TEXT[reply.kind]?.() || PROBLEM_TEXT.other(); return; }
    status.textContent = '';
    const at = new Date().toISOString();
    const plan = readAiPlan(reply.text, inputs);
    if (plan && view.store.saveAiPlan(view.businessId, { ...plan, at, model: reply.model, where, basis: dataBasis(inputs.scenario), problems: answerProblems(planText(plan), inputs) })) answers.delete(answerKey());
    else answers.set(answerKey(), { text: plan ? planText(plan) : reply.text, model: reply.model, at, where, problems: answerProblems(plan ? planText(plan) : reply.text, inputs), unsaved: !!plan });
    showResult();
  }

  const last4 = key.slice(-4);
  add(card,
    h('div', { class: 'row small' }, t('span', tr('Your key is saved in this browser (ending …{0}).', last4), 'ink2'),
      h('button', { type: 'button', class: 'btn small ghost', onclick: () => { view.store.forgetGeminiKey(); answers.clear(); redraw(); } }, tl('Delete key'))),
    h('label', { class: 'small' }, h('input', { type: 'checkbox', checked: hide, onchange: e => { hide = e.target.checked; preview.textContent = request(); } }), ' ', tr('Replace customer and staff names with codes')),
    h('div', { class: 'row' }, button, status),
    h('div', { class: 'banner warning' }, t('p', tr('Pressing the button sends the text under "Show exactly what will be sent" to Google\'s Gemini. On the free plan Google may use it to improve its products, and asks you not to send personal or confidential information. Use practice data, or data you are allowed to share. Notes you typed are sent as written.'), 'small')),
    h('details', {}, h('summary', {}, tr('Show exactly what will be sent')), preview),
    result);
  showResult();
  return card;
}

const liveLabel = a => h('p', { class: 'small muted' }, h('span', { class: 'badge info' }, tr('Live AI')), ' ', tr('{0} · {1} · from the figures for {2}', a.model, fmtTime(a.at), a.where));

function numberCheck(problems) {
  return problems.length
    ? h('div', { class: 'banner warning' }, t('p', tr('Number check: these are not in your data — trust the dashboard, not the AI: {0}', problems.map(p => p.replace(/^(amount|percentage|date|month|number|unknown record) /, '')).slice(0, 12).join(', ')), 'small'))
    : h('div', { class: 'banner info' }, t('p', tr('Number check: every amount, date, count and record ID in this answer is in your data.'), 'small'));
}

const disclaimer = () => t('p', tr('Written by AI: it can be wrong or miss context. It is not professional advice.'), 'small muted');

// Takes the saved analysis (and its picks in Tasks and the Calendar) out of this browser.
function removeButton(redraw) {
  const remove = () => { view.store.forgetAiPlan(view.businessId); answers.delete(answerKey()); toast(tr('The AI suggestions were removed from Tasks and the Calendar.')); redraw(); };
  return h('div', { class: 'row' },
    h('button', { type: 'button', class: 'btn small ghost', onclick: remove }, tl('Remove AI suggestions')));
}

// The saved analysis in its four parts, and where its picks went.
function planView(p, redraw) {
  const current = isCurrentPlan(p);
  const tasks = new Map(allTasks().map(x => [x.task_key, x]));
  const items = new Map(calendarItems({ withAi: current }).map(i => [i.id, i]));
  const section = (title, body) => h('div', { class: 'ai-section' }, t('h4', title), body);
  const placed = current
    ? h('div', { class: 'banner info' }, h('p', { class: 'small' },
      tr('Added to your dashboard: {0} task(s) at the top of Tasks, marked "AI pick", and {1} calendar item(s) marked AI. A suggested task is shown dashed on the calendar until you accept it.', p.top.filter(x => tasks.has(x.task_key) && isOpen(tasks.get(x.task_key))).length, [...items.values()].filter(i => i.ai_why !== undefined).length),
      ' ', h('a', { href: '#tasks', class: 'nowrap' }, tl('Tasks'), ' ›'), ' ', h('a', { href: '#calendar', class: 'nowrap' }, tl('Calendar'), ' ›')))
    : h('div', { class: 'banner warning' }, t('p', tr('This analysis was made from different data (the file has changed since), so its picks are not shown in Tasks or the Calendar. Press "Analyse with Gemini" again for new picks.'), 'small'));
  return h('div', { class: 'ai-answer' },
    liveLabel(p),
    placed,
    section(tr('The situation now'), t('p', p.situation || '—')),
    section(tr('The three things to do first'), p.top.length
      ? h('ol', {}, ...p.top.map(x => h('li', {}, t('b', tasks.get(x.task_key)?.title || x.task_key),
        x.why ? h('div', {}, h('span', { class: 'muted' }, tr('Why: ')), x.why) : null,
        x.how ? h('div', {}, h('span', { class: 'muted' }, tr('How: ')), x.how) : null)))
      : t('p', tr('The AI picked no task that is open in your data.'), 'muted')),
    section(tr('What to watch over the next two weeks'), p.watch.length
      ? h('ul', {}, ...p.watch.map(w => { const it = items.get(w.item_id); return h('li', {}, t('b', it ? `${formatDate(it.date)} · ${it.title}` : w.item_id), w.why ? ` — ${w.why}` : ''); }))
      : t('p', tr('The AI picked nothing from the calendar.'), 'muted')),
    section(tr('Questions this data cannot answer'), p.unanswered.length ? h('ul', {}, ...p.unanswered.map(q => t('li', q))) : t('p', '—', 'muted')),
    p.dropped ? t('p', tr('The AI also named {0} task key(s) or calendar id(s) that are not in your data; they were left out.', p.dropped), 'small muted') : null,
    numberCheck(p.problems),
    disclaimer(),
    removeButton(redraw));
}

// An answer that could not be used for Tasks and the Calendar: shown as text only. Any
// picks still shown there come from the saved earlier analysis, which can be removed here.
function answerView(a, plan, redraw) {
  const why = a.unsaved
    ? tr('This browser could not save the analysis, so its picks are not shown in Tasks or the Calendar.')
    : tr('This answer did not come in the expected form, so nothing was added to Tasks or the Calendar.');
  const earlier = isCurrentPlan(plan) && !a.unsaved;
  return h('div', { class: 'ai-answer' },
    liveLabel(a),
    h('div', { class: 'banner warning' }, t('p', earlier ? `${why} ${tr('The AI marks there are from the earlier analysis ({0}).', fmtTime(plan.at))}` : why, 'small')),
    h('div', { class: 'answer-text' }, a.text),
    numberCheck(a.problems),
    disclaimer(),
    plan ? removeButton(redraw) : null);
}
