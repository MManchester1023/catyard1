// The tablet's connection to the real internet. The only place the app reads from is Wikipedia. The cat's
// requests wait in w.netq; this answers them one at a time, politely, within a daily limit. If anything goes
// wrong the request just fails and the cat shrugs. Page text is untrusted data: it is shown with textContent
// only and never treated as instructions.
import { ensureTablet, sweepNet } from './tablet.js';

const API = 'https://en.wikipedia.org/w/api.php';
const FEED = 'https://en.wikipedia.org/api/rest_v1/feed/featured/';
export const TABLET_DEFAULTS = { on: true, dailyCap: 60, safe: true, usage: { date: '', calls: 0 } };
const UA = 'CatYard/0.2 (hobby desktop toy)';
const MIN_GAP_MS = 15000, TIMEOUT_MS = 12000;
const today = () => new Date().toISOString().slice(0, 10);
const clip = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

// a light filter so the cat is not shown pages about violence or sexual content
const UNSAFE = /\b(rape[sd]?|rapist|sexual(?:ly)? (?:assault|abuse|violence)|child abuse|molest\w*|porn\w*|erotic\w*|nudity|fetish\w*|genocide|massacres?|suicide|self-harm|serial killers?|terroris[tm]\w*|holocaust|concentration camps?|nazi\w*|tortur\w*|beheading\w*|lynching\w*|school shooting|mass shooting|death toll|war crimes?)\b/i;
export const isSafe = text => !UNSAFE.test(text);

// tidy an extract: drop pronunciation brackets, cut at a sentence end
export function tidyExtract(text) {
  let t = clip(text, 1200).replace(/\s*\([^)]*(?:[^\x00-\x7f]|[/;])[^)]*\)/g, '').replace(/\s*\([^)]{0,3}\)/g, '').replace(/\s+([.,;])/g, '$1');
  if (t.length > 420) { const cut = t.slice(0, 420), i = cut.lastIndexOf('. '); t = i > 120 ? cut.slice(0, i + 1) : cut.slice(0, 417) + '...'; }
  return t;
}
const usable = p => p && p.title && p.extract && p.extract.length >= 60 && !/\b(may|can) (also )?refer to\b|disambiguation/i.test(p.extract.slice(0, 200)) && !/^(list|lists|index) of /i.test(p.title);

const query = (extra) => `${API}?action=query&format=json&formatversion=2&origin=*&prop=extracts%7Cinfo&exintro=1&explaintext=1&exsentences=4&exlimit=1&inprop=url&redirects=1&${extra}`;
const fromPage = p => ({ title: clip(p.title, 90), extract: tidyExtract(p.extract), url: /^https:\/\/en\.wikipedia\.org\//.test(p.fullurl || '') ? p.fullurl : `https://en.wikipedia.org/wiki/${encodeURIComponent(String(p.title || '').replace(/ /g, '_'))}` });

// one request -> one page, or throws. get(url) returns parsed JSON.
export async function fetchPage(get, req, { safe = true, onCall = () => {} } = {}) {
  const check = p => { const pg = fromPage(p); if (safe && !isSafe(pg.title + ' ' + pg.extract)) return null; return pg; };
  if (req.kind === 'lookup') {
    const q = clip(req.q, 60).replace(/[^\p{L}\p{N} '-]/gu, ''); if (!q) throw new Error('nothing to look up');
    const skip = new Set((Array.isArray(req.skip) ? req.skip : []).map(x => String(x).toLowerCase())); // (pages it has already read)
    onCall(); const j = await get(query(`generator=search&gsrnamespace=0&gsrlimit=${skip.size || req.vary ? 10 : 1}&gsrsearch=${encodeURIComponent(q)}`));
    const found = ((j && j.query && j.query.pages) || []).slice().sort((a, b) => (a.index || 0) - (b.index || 0));
    // a general search (not a research subject) never gives up: when there is nothing new on that subject it reads something random instead
    const giveUp = msg => { if (req.fallback) return randomPage(get, check, onCall); throw new Error(msg); };
    if (!found.length) return giveUp('nothing found');
    const fresh = found.filter(x => !skip.has(String(x.title).toLowerCase()));
    if (!fresh.length) return giveUp('nothing more found');
    let sawUnsafe = false; const ok = [];
    for (const p of fresh) { if (!usable(p)) continue; const pg = check(p); if (pg) ok.push(pg); else sawUnsafe = true; if (ok.length >= (req.vary ? 3 : 1)) break; }
    if (ok.length) return req.vary ? ok[Math.floor(Math.random() * ok.length)] : ok[0]; // (a varied search picks among the first few new results, so the same words do not always give the same page)
    return giveUp(sawUnsafe ? 'filtered' : 'nothing readable');
  }
  if (req.kind === 'featured') {
    const d = new Date(), url = `${FEED}${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    onCall(); const j = await get(url);
    const cands = [j && j.tfa].concat(((j && j.mostread && j.mostread.articles) || []).slice(0, 8));
    for (const a of cands) {
      if (!a) continue; const p = { title: a.normalizedtitle || a.title, extract: a.extract, fullurl: a.content_urls && a.content_urls.desktop && a.content_urls.desktop.page };
      if (!usable(p)) continue; const pg = check(p); if (pg) return pg;
    }
    throw new Error('nothing readable today');
  }
  return randomPage(get, check, onCall);
}
async function randomPage(get, check, onCall) {
  for (let i = 0; i < 4; i++) {
    onCall(); const j = await get(query('generator=random&grnnamespace=0&grnlimit=1'));
    const p = j && j.query && j.query.pages && j.query.pages[0];
    if (usable(p)) { const pg = check(p); if (pg) return pg; }
  }
  throw new Error('nothing suitable turned up');
}

export class Net {
  constructor({ getSettings, saveSettings, http }) {
    this.get = getSettings; this.save = saveSettings; this.http = http || ((u, o) => fetch(u, o));
    this.busy = false; this.state = 'idle'; this.error = ''; this.lastAt = 0; this.onChange = null;
  }
  cfg() { const s = this.get(); s.tablet = Object.assign({}, TABLET_DEFAULTS, s.tablet); s.tablet.usage = Object.assign({ date: '', calls: 0 }, s.tablet.usage); return s.tablet; }
  usage() { const c = this.cfg(); if (c.usage.date !== today()) c.usage = { date: today(), calls: 0 }; return c.usage; }
  enabled() { const c = this.cfg(); return !!c.on && this.usage().calls < c.dailyCap; }
  label() {
    const c = this.cfg();
    if (!c.on) return 'Tablet web access is off. The cat can only re-read old pages.';
    if (this.usage().calls >= c.dailyCap) return 'Tablet daily limit reached. It will re-read old pages until tomorrow.';
    if (this.state === 'error') return 'Tablet could not load a page: ' + this.error;
    return this.busy ? 'Tablet is loading a page…' : `Tablet is online (Wikipedia). ${this.usage().calls}/${c.dailyCap} requests today.`;
  }
  _set(state, err = '') { this.state = state; this.error = err; if (this.onChange) this.onChange(); }

  _getJson(url) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    const desktop = typeof window !== 'undefined' && !!(window.__TAURI__ && window.__TAURI__.http);
    return this.http(url, { method: 'GET', signal: ctl.signal, headers: Object.assign({ accept: 'application/json' }, desktop ? { 'user-agent': UA } : {}) })
      .then(async res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .finally(() => clearTimeout(timer));
  }

  // called about once a second by the app. answers at most one request
  async tick(w) {
    ensureTablet(w); sweepNet(w);
    w.netOn = this.enabled();
    const req = w.netq.find(r => r.state === 'queued'); if (!req || this.busy) return;
    if (!this.enabled()) { req.state = 'error'; req.error = 'off'; return; }
    if (Date.now() - this.lastAt < MIN_GAP_MS) return;
    this.busy = true; req.state = 'busy'; this._set('busy');
    try {
      req.result = await fetchPage(u => this._getJson(u), req, { safe: this.cfg().safe !== false, onCall: () => { this.usage().calls++; this.save(); } });
      req.state = 'done'; this._set('idle');
    } catch (e) { req.state = 'error'; req.error = clip(e && e.message, 100); this._set('error', req.error); }
    finally { this.busy = false; this.lastAt = Date.now(); this.onChange && this.onChange(); }
  }
}
