// Page registry and navigation. A page is a function that returns a DOM node; it is
// re-run from scratch whenever something changes (small data, so no diffing needed).

import { $, add, h } from './dom.js';
import { view } from './view-state.js';
import { tr } from '../i18n/i18n.js';

const pages = new Map();
const hooks = { beforeRender: () => {} };

export function registerPage(id, render) { pages.set(id, render); }
export function pageIds() { return [...pages.keys()]; }
export function onBeforeRender(fn) { hooks.beforeRender = fn; }

export function navigate(page, { focus = true } = {}) {
  if (!pages.has(page)) page = 'overview';
  view.page = page;
  if (location.hash.slice(1) !== page) history.replaceState(null, '', '#' + page);
  hooks.beforeRender();
  const root = $('#page');
  root.textContent = '';
  try { add(root, pages.get(page)()); }
  catch (e) { add(root, h('div', { class: 'banner critical' }, tr('This section could not be rendered: {0}', e.message))); console.error(e); }
  if (focus) $('#main').focus({ preventScroll: true });
}

// Redraw the current page (after a task decision, a note, a filter change…).
export function rerender() { navigate(view.page, { focus: false }); }
