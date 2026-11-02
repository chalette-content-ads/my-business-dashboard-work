// Business Dashboard Starter — entry point. The dashboard shows the viewer's own Excel
// workbook (there is no built-in data); until one is opened, pages show how to open it.
// No sign-in, no server. The only network access is "Analyse with Gemini"
// (src/briefs/gemini.js), with the viewer's own key.

import { setLocale, tr, tl } from './i18n/i18n.js';
import { openStorage, createStateStore } from './storage/local-state.js';
import { view, scenario, isExcel } from './ui/view-state.js';
import { h, t } from './ui/dom.js';
import { registerPage, navigate, onBeforeRender } from './ui/router.js';
import { initShell, refreshShell } from './ui/shell.js';
import { renderOverview } from './ui/pages/overview.js';
import { renderSales } from './ui/pages/sales.js';
import { renderCustomers } from './ui/pages/customers.js';
import { renderPayments } from './ui/pages/payments.js';
import { renderStock } from './ui/pages/stock.js';
import { renderTasks } from './ui/pages/tasks.js';
import { renderCalendar } from './ui/pages/calendar.js';
import { renderBrief } from './ui/pages/brief.js';
import { renderAbout } from './ui/pages/about.js';
import { renderExcelStart, restoreWorkbook, pickExcel, forgetExcel, pendingMatch, renderMatchPage } from './ui/pages/excel.js';

// If the records fail their checks (for example after replacing the data), show the
// problems instead of figures that might be wrong. "My Excel" without a file shows
// the page for opening one.
function guarded(render) {
  return () => {
    if (pendingMatch()) return renderMatchPage();
    const s = scenario();
    if (!s) return renderExcelStart();
    if (s.ok) return render();
    const errors = s.issues.filter(i => i.level === 'error');
    const fix = isExcel()
      ? h('div', { class: 'row' }, t('p', tr('Fix the workbook in Excel, save it, and read it again. First problems:'), 'small'), h('button', { class: 'btn small primary', onclick: pickExcel }, tl('Read the Excel again…')), h('button', { class: 'btn small ghost', onclick: forgetExcel }, tl('Forget this file')))
      : t('p', tr('Fix the files in data/ and run npm run data. First problems:'), 'small');
    return h('div', {}, h('div', { class: 'banner critical' }, t('p', tr('The records for {0} failed their checks, so no figures are shown.', isExcel() ? s.source.fileName : s.key)), fix),
      h('ul', { class: 'small' }, ...errors.slice(0, 20).map(e => t('li', e.message))));
  };
}

function boot() {
  const { storage, persistent, reason } = openStorage();
  view.store = createStateStore(storage);
  view.persistent = persistent;
  view.storageReason = reason;
  const prefs = view.store.prefs();
  setLocale(prefs.locale || 'zh-CN');
  // Your own Excel, if one was opened here before (kept in this browser).
  try { restoreWorkbook(); } catch (e) { console.error(e); }
  view.day = 'day1';

  registerPage('overview', guarded(renderOverview));
  registerPage('sales', guarded(renderSales));
  registerPage('customers', guarded(renderCustomers));
  registerPage('payments', guarded(renderPayments));
  registerPage('stock', guarded(renderStock));
  registerPage('tasks', guarded(renderTasks));
  registerPage('calendar', guarded(renderCalendar));
  registerPage('brief', guarded(renderBrief));
  registerPage('about', renderAbout);

  initShell();
  onBeforeRender(refreshShell);
  window.addEventListener('hashchange', () => navigate(location.hash.slice(1) || 'overview'));
  navigate(location.hash.slice(1) || 'overview', { focus: false });
}

boot();
