import { h, t, add, modal, toast } from '../dom.js';
import { pageHead, scopeBar, statusChip } from '../components.js';
import { view, allTasks, isOpen, reportingDate, profile, label, saveDecision, aiMarks, savedAiPlan } from '../view-state.js';
import { openRecord } from '../drawers.js';
import { rerender } from '../router.js';
import { TASK_RULES } from '../../core/model.js';
import { formatDate, isIsoDate } from '../../core/dates.js';
import { dayNumber } from '../../data/scenarios.js';
import { tr, tl, intlLocale } from '../../i18n/i18n.js';

export function savedMessage() { return view.persistent ? tr('Saved in this browser') : tr('Saved for this visit only (this browser does not allow saving)'); }

function persist(task, patch) {
  if (saveDecision(task, patch)) { toast(savedMessage()); rerender(); }
  else toast(tr('Could not save in this browser. The change was not kept.'), { error: true, ms: 7000 });
}

export function renderTasks() {
  const root = h('div', {}, pageHead(tl('Tasks'), h('button', { class: 'btn primary small', onclick: () => editTask(null) }, tl('+ Add task'))), scopeBar({ period: false }));
  const tasks = allTasks();
  const marks = aiMarks();
  const rank = x => (isOpen(x) && marks?.top.get(x.task_key)?.rank) || 99;
  add(root, aiNotice(tasks, marks));
  const views = {
    open: isOpen,
    completed: x => x.status === 'completed',
    dismissed: x => x.status === 'dismissed',
    resolved: x => x.resolved && !['completed', 'dismissed'].includes(x.status),
  };
  const names = { open: tr('Open'), completed: tr('Completed'), dismissed: tr('Dismissed'), resolved: tr('Resolved by data') };
  const tabs = h('div', { class: 'pill-tabs', role: 'tablist' });
  const holder = h('div', { class: 'card' });
  const draw = () => {
    tabs.textContent = '';
    for (const k of Object.keys(views)) add(tabs, h('button', { class: view.taskView === k ? 'active' : '', role: 'tab', 'aria-selected': String(view.taskView === k), onclick: () => { view.taskView = k; draw(); } }, `${names[k]} (${tasks.filter(views[k]).length})`));
    holder.textContent = '';
    // The AI's top picks first (in its order), then by action date.
    const list = tasks.filter(views[view.taskView]).sort((a, b) => rank(a) - rank(b) || (a.action_date || '9999').localeCompare(b.action_date || '9999') || a.title.localeCompare(b.title));
    if (!list.length) add(holder, t('div', view.taskView === 'open' ? tr('No open tasks. You can add your own.') : tr('Nothing here.'), 'empty'));
    for (const x of list) add(holder, taskCard(x, isOpen(x) ? marks?.top.get(x.task_key) : null));
  };
  draw();
  add(root, h('p', { class: 'small muted' }, tr('Suggestions are worked out from the records of the selected day. Suggested dates and owners are proposals until you accept them. Recorded deadlines come from the records and are never changed here. Completing a task never changes a sale or payment.')), tabs, holder);
  return root;
}

// Above the list: what the latest Gemini analysis picked, or why its picks are not shown.
function aiNotice(tasks, marks) {
  const saved = savedAiPlan();
  if (!saved) return null;
  const link = h('a', { href: '#brief', class: 'nowrap' }, tl('AI analysis'), ' ›');
  if (!marks) return h('div', { class: 'banner info' }, h('p', { class: 'small' }, tr('The latest AI analysis was made from different data, so its picks are not shown here. Press "Analyse with Gemini" again to get new picks.'), ' ', link));
  const open = tasks.filter(x => isOpen(x) && marks.top.has(x.task_key)).length;
  return h('div', { class: 'banner info' },
    h('p', { class: 'small' }, h('span', { class: 'badge info' }, tr('Live AI')), ' ',
      open ? tr('{0} picked {1} task(s) to do first ({2}). They are at the top of the list, marked "AI pick". Check them before you accept: the AI can be wrong.', saved.model, open, fmtTime(saved.at)) : tr('The tasks the AI picked ({0}) are no longer open.', fmtTime(saved.at)),
      ' ', link));
}

export const fmtTime = iso => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(intlLocale(), { dateStyle: 'medium', timeStyle: 'short' }); };

function taskCard(x, pick = null) {
  const rd = reportingDate();
  const overdue = x.action_date && x.action_date < rd && isOpen(x);
  const decidedOn = x.decided_at && x.stale ? view.store.business(view.businessId).decisions[x.task_key]?.snapshot_at_decision : '';
  const meta = h('div', { class: 'meta' },
    h('span', {}, statusChip(x.status),
      pick ? h('span', { class: 'status ai', title: tr('Picked by the latest AI analysis') }, tr('AI pick {0}', pick.rank)) : null,
      x.is_new ? h('span', { class: 'status new', title: tr('This suggestion first appears in the Day {0} data', dayNumber(view.day)) }, tr('new on Day {0}', dayNumber(view.day))) : null,
      decidedOn ? h('span', { class: 'status carried', title: tr('Your decision was made while viewing Day {0} and is kept. The suggestion text was recalculated from the current day\'s records; check it still applies.', dayNumber(decidedOn)) }, tr('decided on Day {0}', dayNumber(decidedOn))) : null,
      x.resolved ? h('span', { class: 'status resolved', title: tr('The condition that generated this suggestion no longer exists in the current data') }, tr('resolved by data')) : null),
    x.action_date ? h('span', {}, tr('Action: {0}{1}{2}', formatDate(x.action_date), overdue ? tr(' (past)') : '', x.status === 'suggested' ? tr(' (suggested)') : '')) : null,
    x.recorded_deadline ? h('span', {}, tr('Recorded deadline: {0}', formatDate(x.recorded_deadline))) : null,
    h('span', {}, `${label('owner', tr('Owner'))}${tr(': ')}${x.owner || tr('unassigned')}${x.status === 'suggested' && x.suggested_owner ? tr(' (suggested)') : ''}`),
    x.rule !== 'custom' ? h('span', {}, tr('Rule: {0}', tr(TASK_RULES[x.rule]?.title || x.rule))) : h('span', {}, tr('Your task')),
    x.record_id ? h('a', { href: '#', onclick: e => { e.preventDefault(); openRecord(x.record_type, x.record_id); } }, tr('Evidence: {0}', x.record_id)) : null);
  const btn = (lbl, status, cls = '') => h('button', { class: `btn small ${cls}`, onclick: () => persist(x, { status }) }, lbl);
  const row = h('div', { class: 'row' });
  if (!x.resolved) {
    if (x.status === 'suggested') add(row, btn(tl('Accept'), 'accepted', 'primary'));
    if (isOpen(x)) add(row, btn(tl('Complete'), 'completed'), btn(tl('Dismiss'), 'dismissed', 'ghost'));
    if (['completed', 'dismissed'].includes(x.status)) add(row, btn(tl('Reopen'), 'accepted', 'ghost'));
  } else if (['suggested', 'accepted'].includes(x.status)) add(row, btn(tl('Mark completed'), 'completed', 'ghost'));
  add(row, h('button', { class: 'btn small ghost', onclick: () => editTask(x) }, tl('Edit')));
  const why = pick && (pick.why || pick.how) ? h('div', { class: 'ai-pick' },
    pick.why ? h('div', {}, h('b', {}, tr('AI · why: ')), pick.why) : null,
    pick.how ? h('div', {}, h('b', {}, tr('AI · how: ')), pick.how) : null) : null;
  return h('div', { class: `task ${['completed', 'dismissed'].includes(x.status) ? 'done' : ''}${pick ? ' picked' : ''}` },
    h('div', {}, t('div', x.title, 'title'), t('div', x.reason, 'reason'), why, x.note ? h('div', { class: 'small' }, h('b', {}, tr('Note: ')), x.note) : null, meta),
    h('div', { class: 'actions' }, row));
}

// Add a task of your own, or change a task's action date, owner and note.
export function editTask(x) {
  const isNew = !x;
  const title = h('input', { type: 'text', value: x?.title || '', maxlength: 200, disabled: x && !x.custom });
  const detail = h('textarea', { maxlength: 1000 }); detail.value = x?.custom ? (x.reason || '') : '';
  const date = h('input', { type: 'date', value: x ? (x.action_date || x.suggested_date || reportingDate()) : reportingDate() });
  const owner = h('input', { type: 'text', value: x?.owner || '', maxlength: 80, list: 'owners' });
  const owners = h('datalist', { id: 'owners' }, ...(profile().business.team || []).map(o => h('option', { value: o })));
  const note = h('textarea', { maxlength: 1000 }); note.value = x?.note || '';
  const body = h('div', {},
    h('label', { class: 'field' }, t('span', tr('Title')), title),
    x && !x.custom ? null : h('label', { class: 'field' }, t('span', tr('Detail')), detail),
    x?.recorded_deadline ? h('p', { class: 'small muted' }, tr('Recorded deadline {0} comes from the records and cannot be edited here.', formatDate(x.recorded_deadline))) : null,
    h('label', { class: 'field' }, t('span', tr('Action date')), date),
    h('label', { class: 'field' }, t('span', label('owner', tr('Owner'))), owner, owners),
    h('label', { class: 'field' }, t('span', tr('Note')), note),
    x?.status === 'suggested' ? t('p', tr('Saving also accepts this suggestion, so it appears on the calendar.'), 'small muted') : null);
  modal(isNew ? tr('Add task') : tr('Edit task'), body, { actions: [{ label: tl('Save'), primary: true, onclick: () => {
    if (isNew && !title.value.trim()) { toast(tr('Give the task a title'), { error: true }); return true; }
    if (date.value && !isIsoDate(date.value)) { toast(tr('Invalid date'), { error: true }); return true; }
    const target = x || { task_key: `custom:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, custom: true, status: 'accepted', title: title.value.trim(), reason: detail.value.trim() };
    const status = target.custom ? (x?.status || 'accepted') : (target.status === 'suggested' ? 'accepted' : target.status);
    persist(target, { status, action_date: date.value, owner: owner.value.trim(), note: note.value.trim(), ...(target.custom ? { title: title.value.trim(), detail: detail.value.trim() } : {}) });
    return false;
  } }] });
}
