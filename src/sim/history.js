// Reading the history back: what the cat did, thought and had happen. The raw record is w.hist (a rolling timeline)
// and w.days (a short summary per day that outlives the timeline); this module only reads them.
import { dayOf, clockStr } from './world.js';
import { RECIPES, costText } from './recipes.js';
import { topFeelings } from './feelings.js';
import { wishLabel } from './wishes.js';
import { matText, MATERIALS } from './util.js';
import { levelOf, LEVEL_NAMES } from './art.js';

export const KINDS = {
  did: 'What it did',
  thought: 'What it thought',
  event: 'What happened',
  diary: 'Its diary',
  chat: 'What was said',
};
export const KIND_IDS = Object.keys(KINDS);

// what an act type is called when adding up the day
const ACT_LABEL = {
  sleep: 'sleeping', idle: 'sitting about', explore: 'exploring', eat: 'eating', drink: 'drinking', groom: 'grooming', play: 'playing', gather: 'gathering bark',
  hunt: 'hunting', perch: 'watching from up high', beg: 'asking for food', zoom: 'zoomies', gift: 'bringing gifts', collect: 'collecting', stash: 'tending the stash',
  paint: 'painting', gaze: 'gazing at the moon', investigate: 'investigating', attention: 'at the glass', offering: 'looking over offerings', tablet: 'on the tablet', craft: 'making things',
};

// the timeline, newest first. kinds: array of KIND_IDS (default all); q: text to look for; day: one day only
export function timeline(w, { kinds = null, q = '', day = null, limit = 200, before = null } = {}) {
  const want = kinds && kinds.length ? new Set(kinds) : null, needle = String(q || '').toLowerCase().trim();
  const out = [];
  for (let i = w.hist.length - 1; i >= 0 && out.length < limit; i--) {
    const e = w.hist[i];
    if (before != null && e.id >= before) continue;
    if (want && !want.has(e.k)) continue;
    if (day != null && e.day !== day) continue;
    if (needle && !e.text.toLowerCase().includes(needle)) continue;
    out.push(e);
  }
  return out;
}

// one day at a glance: how the time was spent, and the things worth remembering
export function daySummary(w, day) {
  const d = w.days && w.days[day]; if (!d) return null;
  const total = Object.values(d.secs).reduce((s, v) => s + v, 0) || 1;
  const spent = Object.entries(d.secs).map(([k, v]) => ({ key: k, label: ACT_LABEL[k] || k, pct: v / total, secs: v })).sort((a, b) => b.pct - a.pct);
  return { day, spent, top: spent.slice(0, 4), events: d.ev || [], current: day === dayOf(w) };
}
export const daysList = w => Object.keys(w.days || {}).map(Number).sort((a, b) => b - a);
export const spentText = (s, n = 4) => s.top.slice(0, n).map(x => `${x.label} ${Math.round(x.pct * 100)}%`).join(', ');

// the cat's things, for display and export
export function thingsSummary(w) {
  const c = w.cat;
  const mats = MATERIALS.filter(m => c.inv[m] > 0).map(m => matText(m, c.inv[m]));
  const recipes = Object.keys(RECIPES).map(id => ({ id, name: RECIPES[id].name, cost: costText(RECIPES[id].cost), known: !!RECIPES[id].preset || !!(c.recipes[id] && c.recipes[id].known), made: c.crafted.filter(x => x.recipe === id).length }));
  return { mats, recipes, table: !!w.table, crafted: c.crafted };
}

const pad = (s, n) => String(s).padEnd(n);
// everything in one plain-text file
export function exportText(w, { max = 600 } = {}) {
  const c = w.cat, L = [], now = new Date();
  L.push(`CAT YARD - the story of ${c.name}`, `Exported ${now.toISOString().slice(0, 16).replace('T', ' ')} (game day ${dayOf(w)}, ${clockStr(w)})`, '');
  L.push(`${c.name}, ${c.age}-year-old cat. Collects ${c.quirk.item}s; favourite colour ${c.quirk.favColor}. Paints at level ${levelOf(c.art.xp)} (${LEVEL_NAMES[levelOf(c.art.xp)]}), ${c.art.count} works so far.`);
  const f = topFeelings(w, 5);
  L.push(`Feels good about: ${f.good.map(r => `${r.name} (${r.label})`).join(', ') || 'nothing yet'}`);
  if (f.bad.length) L.push(`Uneasy about: ${f.bad.map(r => `${r.name} (${r.label})`).join(', ')}`);
  const th = thingsSummary(w);
  L.push('', 'THINGS', `Materials: ${th.mats.join(', ') || 'none'}`, `Table: ${th.table ? 'built' : 'not yet'}`);
  for (const r of th.recipes) L.push(`  ${r.name}: ${r.known ? 'knows how' : 'does not know how yet'}, ${r.cost}${r.made ? `, made ${r.made}` : ''}`);
  const wishes = c.wishes.filter(x => x.state !== 'draft');
  if (wishes.length) { L.push('', 'NOTES IT LEFT ON THE TABLET'); for (const x of wishes) L.push(`  day ${x.day} [${x.state}] ${wishLabel(x)}: "${x.text}"`); }
  L.push('', 'DAY BY DAY');
  for (const d of daysList(w).reverse()) {
    const s = daySummary(w, d); L.push(`Day ${d}: ${spentText(s, 5) || 'nothing recorded'}`);
    for (const e of s.events) L.push(`   ${e.time} ${e.text}`);
  }
  L.push('', 'DIARY (newest first)');
  for (const e of w.journal) L.push(`  d${e.day} ${e.time}  ${e.text}`);
  L.push('', `TIMELINE (last ${Math.min(max, w.hist.length)} entries, oldest first)`);
  const tag = { did: 'did', thought: 'thought', event: 'event', diary: 'diary', chat: 'chat' };
  for (const e of w.hist.slice(-max)) L.push(`  d${pad(e.day, 3)} ${e.time} ${pad(tag[e.k] || e.k, 7)} ${e.text}`);
  return L.join('\n') + '\n';
}
export const exportName = w => `cat-yard-${w.cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-day${dayOf(w)}.txt`;
