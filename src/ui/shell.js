// The frame around every page: the ribbon, the top bar with the language choice, the
// file bar (your Excel file, read again, forget, clear decisions) and the menu.

import { $, h, t, add, modal, toast } from './dom.js';
import { view, scenario, openTasks, labelTl, businessName, defaultFilters, absent } from './view-state.js';
import { navigate, rerender } from './router.js';
import { bilingual } from './components.js';
import { icon } from './icons.js';
import { pickExcel, forgetExcel, restoreWorkbook } from './pages/excel.js';
import { formatDate } from '../core/dates.js';
import { setLocale, getLocale, tr, tl } from '../i18n/i18n.js';
import { PREFIX } from '../storage/local-state.js';

// Menu entries: page id → English name (translated with tl, or the business's own label).
const NAV = [
  ['overview', () => tl('Overview')],
  ['sales', () => labelTl('sales', 'Sales')],
  ['customers', () => labelTl('customers', 'Customers')],
  ['payments', () => labelTl('payments', 'Payments')],
  ['stock', () => labelTl('stock', 'Stock')],
  ['tasks', () => tl('Tasks')],
  ['calendar', () => tl('Calendar')],
  ['brief', () => tl('AI analysis')],
  ['about', () => tl('About this dashboard')],
];

// Pages that show one sheet: hidden when the workbook does not have it.
const PAGE_SHEET = { customers: 'Customers', payments: 'Payments', stock: 'Stock' };

export function initShell() {
  const nav = $('#nav');
  for (const [id] of NAV) add(nav, h('a', { href: `#${id}`, 'data-page': id }, icon(id), h('span', { class: 'nav-label' }), id === 'tasks' ? h('span', { class: 'count', id: 'nav-tasks-count' }) : null));
  add(nav, h('div', { class: 'sidenav-foot small muted' }, icon('lock'), h('span', { id: 'nav-foot' })));
  // Small screens: the menu slides over the page; a backdrop click, a link or Escape closes it.
  const backdrop = h('div', { class: 'nav-backdrop', hidden: true });
  document.body.append(backdrop);
  const setMenu = open => { nav.classList.toggle('open', open); backdrop.hidden = !open; $('#menu-toggle').setAttribute('aria-expanded', String(open)); if (open) nav.querySelector('a.active, a')?.focus(); };
  $('#menu-toggle').addEventListener('click', () => setMenu(!nav.classList.contains('open')));
  backdrop.addEventListener('click', () => setMenu(false));
  nav.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('open')) { setMenu(false); $('#menu-toggle').focus(); } });
  const lang = $('#lang-select');
  lang.addEventListener('change', () => { setLocale(lang.value); view.store.setPrefs({ locale: getLocale() }); rerender(); });
  // Another tab of this demo changed the saved state: show the same thing here.
  window.addEventListener('storage', e => {
    if (e.key !== null && !e.key.startsWith(PREFIX)) return;
    if (e.key === null || e.key === `${PREFIX}.workbook`) restoreWorkbook();
    rerender();
  });
}

// Runs before every page render so the frame always matches the state.
export function refreshShell() {
  document.title = tr('{0} · Business dashboard', businessName());
  $('#lang-select').value = getLocale();
  $('#menu-toggle').setAttribute('aria-label', tr('Menu'));
  $('#nav').setAttribute('aria-label', tr('Sections'));
  $('#business-name').textContent = businessName();
  renderRibbon();
  renderScenarioBar();
  for (const a of $('#nav').querySelectorAll('a[data-page]')) {
    const entry = NAV.find(([id]) => id === a.dataset.page);
    const lbl = a.querySelector('.nav-label'); lbl.textContent = ''; add(lbl, ...bilingual(entry[1]()));
    a.classList.toggle('active', a.dataset.page === view.page);
    a.hidden = !!PAGE_SHEET[a.dataset.page] && absent(PAGE_SHEET[a.dataset.page]);
    if (a.dataset.page === view.page) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
  const open = scenario()?.ok ? openTasks().length : 0;
  $('#nav-tasks-count').textContent = open ? String(open) : '';
  $('#nav-foot').textContent = tr('Your own Excel · no sign-in · stays in this browser unless you use Gemini');
  renderBanner();
}

function renderRibbon() {
  const r = $('#ribbon'); r.textContent = '';
  add(r, h('strong', {}, tr('Your own Excel')), ' · ', tr('Read on this computer only; nothing is uploaded.'), ' ',
    view.persistent ? tr('Your changes are saved only in this browser.') : tr('Your changes are not saved in this browser.'), ' ',
    h('a', { href: '#about' }, tr('About this dashboard')));
}

function renderScenarioBar() {
  const bar = $('#scenario-bar'); bar.textContent = '';
  const s = scenario();
  if (!s) { add(bar, h('button', { class: 'btn primary small', onclick: pickExcel }, tl('Choose an Excel file…'))); return; }
  add(bar, h('span', { class: 'scn-file', title: tr('Read {0}', new Date(s.source.loadedAt).toLocaleString()) }, icon('file'), t('span', s.source.fileName)),
    h('button', { class: 'btn small', onclick: pickExcel }, tl('Read the Excel again…')),
    h('button', { class: 'btn ghost small', onclick: forgetExcel }, tl('Forget this file')),
    s.source.matched ? h('button', { class: 'btn ghost small', onclick: () => pickExcel({ rematch: true }) }, tl('Change the matching…')) : null,
    h('button', { class: 'btn ghost small scn-reset', onclick: openResetDialog }, tl('Clear decisions and notes…')),
    s.reportingDate ? h('span', { class: 'scn-note' }, tr('Reporting date {0} (latest date in the file)', formatDate(s.reportingDate))) : null);
}

function renderBanner() {
  const b = $('#banner'); b.textContent = ''; b.hidden = true; b.className = 'banner';
  if (!view.persistent) {
    b.hidden = false; b.classList.add('warning');
    add(b, tr('This browser does not allow the page to save anything ({0}). The dashboard still works, but changes are lost when you close or reload the page.', view.storageReason || tr('blocked')));
    return;
  }
  // Say what the file lacks or where records do not line up.
  const warnings = scenario()?.ok ? scenario().issues.filter(i => i.level === 'warning') : [];
  if (warnings.length) {
    b.hidden = false; b.classList.add('info');
    add(b, h('b', {}, tr('Notes about your file: ')), warnings.slice(0, 3).map(w => w.message).join(' '), warnings.length > 3 ? tr(' (+{0} more)', warnings.length - 3) : '');
  }
}

// Clears the task decisions, calendar notes and AI analysis for your file in this browser. The file,
// the language and the Gemini key are kept.
export function openResetDialog() {
  const body = h('div', {},
    t('p', tr('This clears your task decisions, calendar notes and AI suggestions in this browser, so every suggestion is open again. Your Excel file, the language and your Gemini key are kept.')),
    t('p', tr('This only affects this browser.'), 'small muted'));
  modal(tr('Clear decisions and notes'), body, { actions: [
    { label: tl('Clear decisions and notes'), danger: true, onclick: () => {
      if (!view.store.resetBusiness(view.businessId)) { toast(tr('Could not clear the saved state in this browser.'), { error: true }); return; }
      view.filters = defaultFilters(); view.calMonth = ''; view.calDay = ''; view.taskView = 'open';
      toast(tr('Your task decisions and notes have been cleared.'));
      navigate('overview');
    } },
  ] });
}
