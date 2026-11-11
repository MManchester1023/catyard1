// App shell: boot, main loop, saving, chat, and wiring the panels together.
import { createRenderer, LW, LH } from './render.js';
import { makeWorld, advance, catchUp, describe } from './sim/sim.js';
import { serialize, deserialize, catchUpFromSave } from './sim/save.js';
import { runCommand } from './sim/commands.js';
import { userSpeaks, offlineSays, systemSays } from './sim/chat.js';
import { Brain, DEFAULTS } from './sim/llm.js';
import { Net } from './sim/web.js';
import { leaveOffering } from './sim/offerings.js';
import { clockStr, dayOf } from './sim/world.js';
import { exportText, exportName } from './sim/history.js';
import { storage, isDesktop } from './storage.js';
import { h, buildNeeds, updateNeeds, renderCat, renderHistory, renderGallery, renderSettings, renderOutside, paintingModal, moodLabel } from './ui.js';

const $ = id => document.getElementById(id);
const T = window.__TAURI__;
let w, settings, brain, net, outsideUpdate = null, historyUpdate = null, renderer, where = '', adminMode = false, activeTab = 'chat';
let lastSave = Date.now(), saveChain = Promise.resolve(), lastDrive = performance.now(), lastDraw = 0, lastHud = 0, focused = true, histSt = { mode: 'today', kinds: new Set(['did', 'thought', 'event']), q: '', limit: 120 }, gallerySig = '';
let bubbleId = -1, bubbleUntil = 0, chatSig = '', pendingCat = false;

// ---------- settings ----------
const defaultSettings = () => Object.assign(JSON.parse(JSON.stringify(DEFAULTS)), { autosaveMin: 3, fps: 'normal', closeToTray: true, speed: 1 });
const persistSettings = () => storage.writeSettings(settings).catch(() => {});

// ---------- saving ----------
function saveNow(slot = 'main', quiet = false) {
  saveChain = saveChain.then(async () => {
    try { const ok = await storage.write(slot, serialize(w)); if (ok) { if (slot === 'main') lastSave = Date.now(); if (!quiet) toastSaved(slot); return true; } throw new Error('write failed'); }
    catch (e) { systemSays(w, 'Could not save: ' + (e && e.message ? e.message : e)); chatSig = ''; return false; }
  });
  return saveChain;
}
const toastSaved = slot => { $('savedAt').textContent = slot === 'main' ? 'Saved' : 'Saved as ' + slot; setTimeout(updateSavedLabel, 2500); };
function updateSavedLabel() { const s = Math.round((Date.now() - lastSave) / 1000); $('savedAt').textContent = s < 8 ? 'Saved' : s < 90 ? `Saved ${s}s ago` : `Saved ${Math.round(s / 60)}m ago`; }

async function loadSlot(slot, { catchup }) {
  let text = await storage.read(slot), from = 'save';
  if (!text) return null;
  let world; try { world = deserialize(text); } catch (e) { const bak = slot === 'main' ? await storage.readBackup(slot) : null; if (!bak) throw e; world = deserialize(bak); from = 'backup'; }
  const away = catchup ? catchUpFromSave(world) : null; return { world, away, from };
}

// ---------- the world loop ----------
function drive(dt) {
  lastDrive = performance.now();
  if (dt > 2) { if (!w.paused) catchUp(w, Math.min(dt, 3 * 3600)); } else advance(w, dt);
}
function frame(now) {
  requestAnimationFrame(frame);
  if (document.hidden) return;
  const interval = focused ? (settings.fps === 'eco' ? 66 : 33) : 125;
  if (now - lastDraw < interval - 2) return;
  const dt = (now - lastDraw) / 1000; lastDraw = now; drive(dt);
  renderer.draw(w, now / 1000);
  if (now - lastHud > 250) { lastHud = now; hud(now); }
}
// while the window is hidden or minimized, nothing is drawn and the world ticks on a slow timer
setInterval(() => { const now = performance.now(); if (now - lastDrive > 1500) { drive((now - lastDrive) / 1000); if (document.hidden) { brain.tick(w, false); } } }, 1000);
setInterval(() => { if (!document.hidden) brain.tick(w, focused); }, 1000);
setInterval(() => { if (w && net) net.tick(w).catch(() => {}); }, 1000);
setInterval(() => { if (Date.now() - lastSave > settings.autosaveMin * 60000) saveNow('main', true); }, 10000);
window.addEventListener('focus', () => (focused = true)); window.addEventListener('blur', () => (focused = false));
document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow('main', true); else { lastDraw = 0; } });
window.addEventListener('beforeunload', () => { try { storage.write('main', serialize(w)); } catch { /* best effort */ } });

// ---------- HUD ----------
function hud(now) {
  const c = w.cat; $('catname').textContent = c.name; $('activity').textContent = `${describe(w)} · ${moodLabel(w)}`;
  $('clock').textContent = `Day ${dayOf(w)} · ${clockStr(w)} · ${cap(w.weather.type)}`;
  $('pause').textContent = w.paused ? 'Resume' : 'Pause'; if ($('speed').value !== String(w.speed) && !$('speed').matches(':focus')) { const o = [...$('speed').options].find(x => +x.value === w.speed); if (o) $('speed').value = o.value; }
  updateNeeds($('needs'), w); updateSavedLabel(); bubble(now);
  if (activeTab === 'cat') renderCat($('tab-cat'), w);
  else if (activeTab === 'outside') { if (outsideUpdate) outsideUpdate(); }
  else if (activeTab === 'history') { if (historyUpdate) historyUpdate(); }
  else if (activeTab === 'gallery') { const sig = w.cat.art.count + ':' + w.cat.art.works.map(x => x.title).join('|').length; if (sig !== gallerySig) { gallerySig = sig; renderGallery($('tab-gallery'), w, openWork); } }
  renderChat();
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

function bubble(now) {
  const c = w.cat, b = $('bubble');
  if (c.thoughtId !== bubbleId) { bubbleId = c.thoughtId; bubbleUntil = now + Math.min(9000, 3200 + c.thought.length * 70); b.textContent = c.thought; }
  const show = c.thought && now < bubbleUntil && !document.hidden; b.hidden = !show; if (!show) return;
  const cv = $('view'), s = cv.clientWidth / LW, p = renderer.persp(c.y), x = c.hidden ? w.o.house.x : c.x, y = c.hidden ? 250 : c.y - c.z - 52 * p;
  b.style.left = Math.max(80, Math.min(cv.clientWidth - 80, cv.offsetLeft + x * s)) + 'px'; b.style.top = Math.max(40, cv.offsetTop + y * s) + 'px';
}

// ---------- chat ----------
function renderChat() {
  const log = $('chatlog'), last = w.chat[w.chat.length - 1], sig = w.chat.length + '|' + (last ? last.text : '') + '|' + pendingCat;
  if (sig === chatSig) return; chatSig = sig;
  const near = log.scrollHeight - log.scrollTop - log.clientHeight < 60;
  log.replaceChildren(...w.chat.map(m => h('div', { class: 'msg ' + m.from, text: m.text })), ...(pendingCat ? [h('div', { class: 'msg cat typing', text: `${w.cat.name} is thinking…` })] : []));
  if (near || w.chat.length < 3) log.scrollTop = log.scrollHeight;
}
function sys(...lines) { for (const l of lines.flat()) if (l) systemSays(w, l); chatSig = ''; renderChat(); }

async function submit(raw) {
  const text = raw.trim(); if (!text) return;
  if (adminMode || text.startsWith('/')) return command(text);
  const t = userSpeaks(w, text); if (!t) return; renderChat();
  if (brain.enabled()) {
    pendingCat = true; renderChat(); const ok = await brain.chat(w, t); pendingCat = false;
    if (!ok) { offlineSays(w, t); if (brain.state === 'error') sys(`(Claude did not answer: ${brain.error}. Using the offline voice.)`); }
  } else offlineSays(w, t);
  chatSig = ''; renderChat();
}

async function command(text) {
  const shown = /^\/?brain\s+key\b/i.test(text) ? '> /brain key ••••••••' : '> ' + text; sys(shown);
  const r = runCommand(w, text, { admin: adminMode });
  sys(r.lines);
  if (r.action) await act(r.action);
}

async function act(a) {
  switch (a.type) {
    case 'admin': setAdmin(a.on); break;
    case 'save': { const ok = await saveNow(a.slot, true); sys(ok ? `Saved${a.slot === 'main' ? '' : ' as "' + a.slot + '"'}.` : ''); break; }
    case 'load': { try { const r = await loadSlot(a.slot, { catchup: false }); if (!r) sys(`No save called "${a.slot}".`); else { swapWorld(r.world); sys(`Loaded "${a.slot}".`); } } catch (e) { sys('Could not load: ' + e.message); } break; }
    case 'saves': { const l = await storage.list(); sys(l.length ? 'Saves: ' + l.join(', ') : 'No saves yet.'); break; }
    case 'reset': swapWorld(makeWorld()); sys('A new cat has moved in. Say hello.'); saveNow('main', true); break;
    case 'brain': brainCmd(a.args); break;
    case 'tablet': tabletCmd(a.args[0]); break;
    case 'export': await exportStory(); break;
  }
}
function brainCmd(a) {
  const sub = (a[0] || 'status').toLowerCase();
  if (sub === 'status') return sys(brain.label(), `Model: ${settings.model}. Daily cap: ${settings.dailyCap}. ${brain.usage().calls} used today.`);
  if (sub === 'on' || sub === 'off') { settings.on = sub === 'on'; persistSettings(); return sys('Claude ' + sub + '.'); }
  if (sub === 'key') { if (!a[1]) return sys('Usage: brain key <API key>'); settings.apiKey = a[1]; persistSettings(); return sys('Key saved. Try "brain test".'); }
  if (sub === 'model') { if (!a[1]) return sys('Usage: brain model <model name>'); settings.model = a[1]; persistSettings(); return sys('Model set to ' + a[1] + '.'); }
  if (sub === 'cap') { const n = parseInt(a[1], 10); if (!(n >= 10)) return sys('Usage: brain cap <number, at least 10>'); settings.dailyCap = n; persistSettings(); return sys('Daily cap: ' + n + '.'); }
  if (sub === 'test') { sys('Testing…'); return brain.test().then(r => sys(r.message)); }
  sys('Usage: brain status | on | off | key <k> | model <m> | cap <n> | test');
}

function tabletCmd(sub) {
  const c = net.cfg();
  if (sub === 'on' || sub === 'off') { c.on = sub === 'on'; persistSettings(); net.tick(w).catch(() => {}); return sys('Tablet web access ' + sub + '.'); }
  sys(net.label(), `Daily limit: ${c.dailyCap}. Safe filter: ${c.safe !== false ? 'on' : 'off'}. Only en.wikipedia.org is contacted.`);
}

function setAdmin(on) { adminMode = on; $('adminToggle').setAttribute('aria-pressed', String(on)); $('chatform').classList.toggle('admin', on); $('chatin').placeholder = on ? 'Admin command (try help)' : `Say something to ${w.cat.name}…`; }

function swapWorld(nw) { w = nw; w.speed = settings.speed || w.speed || 1; chatSig = ''; histSt = { mode: histSt.mode, kinds: histSt.kinds, q: '', limit: 120 }; historyUpdate = null; bubbleId = -1; brain.lastMuse = Date.now(); outsideUpdate = null; if (net) net.tick(w).catch(() => {}); if (activeTab === 'outside') queueMicrotask(() => showTab('outside')); $('chatin').placeholder = adminMode ? 'Admin command (try help)' : `Say something to ${w.cat.name}…`; }

// ---------- exporting the story ----------
async function exportStory() {
  const text = exportText(w), name = exportName(w);
  let where = '';
  try { where = await storage.writeExport(name, text); } catch (e) { where = ''; sys('Could not write the file: ' + (e && e.message ? e.message : e)); }
  let copied = false; try { await navigator.clipboard.writeText(text); copied = true; } catch { /* the clipboard is optional */ }
  if (where) sys(`Wrote the story to ${where}${copied ? ' and copied it to the clipboard' : ''}.`); else if (copied) sys('Copied the story to the clipboard.');
  showModal(h('h2', { text: 'The story so far' }), h('p', { class: 'muted', text: where ? `Saved as ${where}.` : 'The file could not be written here.' }),
    h('textarea', { id: 'export-text', readonly: true, rows: '12', style: 'width:100%;font:12px/1.4 ui-monospace,Consolas,monospace' }, text.slice(0, 20000)),
    h('div', { class: 'row2', style: 'margin-top:10px' }, h('button', { class: 'btn primary', type: 'button', text: copied ? 'Copied' : 'Copy to clipboard', onclick: async (ev) => { try { await navigator.clipboard.writeText(text); ev.target.textContent = 'Copied'; } catch { const t = $('export-text'); t.select(); ev.target.textContent = 'Press Ctrl+C'; } } }), h('button', { class: 'btn', type: 'button', text: 'Close', onclick: closeModal })));
}

// ---------- modal and gallery ----------
function showModal(...kids) { $('modalbox').replaceChildren(...kids.flat()); $('modal').hidden = false; $('modalbox').querySelector('button')?.focus(); }
const closeModal = () => { $('modal').hidden = true; };
const openWork = wk => showModal(paintingModal(wk, closeModal));
function awayModal(a) {
  const mins = Math.round(a.awayRealSeconds / 60), t = mins < 60 ? `${mins} minutes` : `${Math.floor(mins / 60)} h ${mins % 60} min`;
  showModal(h('h2', { text: `While you were away` }), h('div', { class: 'muted', text: `${w.cat.name} lived on for ${t}${a.capped ? ' (the catch-up is capped at 3 hours)' : ''}.` }),
    a.lines.length || a.wonder.length ? h('ul', {}, ...a.lines.map(l => h('li', { text: cap(w.cat.name) === '' ? l : `${w.cat.name} ${l}.` })), ...a.wonder.map(l => h('li', { text: l }))) : h('p', { text: 'Mostly napped, ate, and looked at the yard.' }),
    h('div', { class: 'row2' }, h('button', { class: 'btn primary', type: 'button', onclick: closeModal, text: 'Say hello' })));
}
function resetModal() {
  showModal(h('h2', { text: 'Start over?' }), h('p', { text: `This replaces ${w.cat.name}, the stash, the gallery and the journal with a new cat. The old save is overwritten at the next save.` }),
    h('div', { class: 'row2' }, h('button', { class: 'btn danger', type: 'button', text: 'Yes, start over', onclick: () => { closeModal(); act({ type: 'reset' }); } }), h('button', { class: 'btn', type: 'button', text: 'Keep my cat', onclick: closeModal })));
}

// ---------- tabs ----------
function showTab(name) {
  activeTab = name;
  for (const b of document.querySelectorAll('#tabs button')) b.setAttribute('aria-selected', String(b.dataset.tab === name));
  for (const id of ['chat', 'cat', 'outside', 'history', 'gallery', 'settings']) $('tab-' + id).hidden = id !== name;
  histSt.sig = ''; gallerySig = '';
  if (name === 'cat') renderCat($('tab-cat'), w);
  if (name === 'history') historyUpdate = renderHistory($('tab-history'), w, histSt, { actions: { export: exportStory } });
  if (name === 'outside') outsideUpdate = renderOutside($('tab-outside'), w, { net, actions: { leave: spec => leaveOffering(w, spec) } });
  if (name === 'settings') renderSettings($('tab-settings'), { settings, brain, net, where, w, actions: { saveSettings: persistSettings, saveNow: () => saveNow('main'), loadSaved: reloadLast, reset: resetModal } });
  if (name === 'chat') { chatSig = ''; renderChat(); $('chatin').focus(); }
  hud(performance.now());
}
async function reloadLast() { try { const r = await loadSlot('main', { catchup: false }); if (r) { swapWorld(r.world); sys('Reloaded the last save.'); } else sys('No save found.'); } catch (e) { sys('Could not load: ' + e.message); } }

// ---------- boot ----------
function fit() {
  const col = $('stagecol'), cv = $('view'), narrow = window.innerWidth <= 860;
  const aw = col.clientWidth - 22, ah = narrow ? 1e5 : col.clientHeight - $('top').offsetHeight - $('needs').offsetHeight - 44; if (aw < 100 || ah < 100) return;
  const cw = Math.floor(Math.min(aw, ah * LW / LH)); if (cw === cv.clientWidth && cv.style.width) return;
  cv.style.width = cw + 'px'; cv.style.height = Math.round(cw * LH / LW) + 'px'; $('stage').style.height = cv.style.height; renderer.resize(cw);
}

async function boot() {
  settings = Object.assign(defaultSettings(), await storage.readSettings() || {}); settings.usage = Object.assign({ date: '', calls: 0 }, settings.usage);
  brain = new Brain({ getSettings: () => settings, saveSettings: persistSettings, http: storage.http }); brain.onChange = () => { chatSig = ''; };
  net = new Net({ getSettings: () => settings, saveSettings: persistSettings, http: storage.http }); net.cfg();
  where = await storage.where().catch(() => '');
  buildNeeds($('needs'));
  renderer = createRenderer($('view')); new ResizeObserver(() => requestAnimationFrame(fit)).observe($('stagecol')); fit();
  let away = null, fresh = false, note = '';
  try { const r = await loadSlot('main', { catchup: true }); if (r) { w = r.world; away = r.away; if (r.from === 'backup') note = 'The main save was unreadable, so the newest backup was loaded.'; } }
  catch (e) { note = 'Could not read the save (' + e.message + '). Starting with a new cat.'; }
  if (!w) { w = makeWorld(); fresh = true; }
  w.speed = settings.speed || 1; $('speed').value = String(w.speed);
  net.tick(w).catch(() => {}); setAdmin(false); bindEvents();
  if (fresh) sys(`${w.cat.name} has moved into the yard.`, 'Say hello. Type /help for commands, or turn on Admin to change the world.');
  else if (!w.chat.length) sys(`Welcome back. ${w.cat.name} is ${describe(w).toLowerCase()}.`);
  if (note) sys(note);
  showTab('chat'); requestAnimationFrame(frame);
  if (away) awayModal(away);
  if (isDesktop) desktopHooks();
  window.__cat = { get w() { return w; }, get brain() { return brain; }, get net() { return net; }, get settings() { return settings; }, saveNow, submit };
}

function bindEvents() {
  $('chatform').addEventListener('submit', e => { e.preventDefault(); const v = $('chatin').value; $('chatin').value = ''; submit(v); });
  $('adminToggle').addEventListener('click', () => { setAdmin(!adminMode); sys(adminMode ? 'Admin mode on. Type commands (help lists them).' : 'Admin mode off.'); $('chatin').focus(); });
  for (const b of document.querySelectorAll('#tabs button')) b.addEventListener('click', () => showTab(b.dataset.tab));
  $('pause').addEventListener('click', () => { w.paused = !w.paused; });
  $('speed').addEventListener('change', () => { w.speed = +$('speed').value; settings.speed = w.speed; persistSettings(); });
  $('saveBtn').addEventListener('click', () => saveNow('main'));
  $('modal').addEventListener('click', e => { if (e.target === $('modal')) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveNow('main'); } });
}

// close button: save, then hide to the tray (or quit, per setting). The tray menu can quit for real.
async function desktopHooks() {
  try {
    const win = T.window.getCurrentWindow();
    await win.onCloseRequested(async ev => { ev.preventDefault(); await saveNow('main', true); if (settings.closeToTray) await win.hide(); else await win.destroy(); });
    if (T.event && T.event.listen) await T.event.listen('quit-requested', async () => { await saveNow('main', true); await win.destroy(); });
  } catch (e) { sys('Desktop hooks unavailable: ' + (e && e.message ? e.message : e)); }
}

boot().catch(e => { document.body.prepend(h('pre', { style: 'padding:20px;color:#c0452f;white-space:pre-wrap', text: 'Cat Yard failed to start:\n' + (e && e.stack ? e.stack : e) })); });
