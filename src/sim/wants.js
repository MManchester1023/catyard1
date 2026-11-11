// Standing wants: things the cat is after over days, beyond hunger and sleep.
import { rnd, pick, uid, clamp, an, COLOR_NAMES } from './util.js';
import { note, journal, dayOf } from './world.js';
import { itemName, stashColors, quirkWord } from './quirk.js';
import { RECIPES, knows } from './recipes.js';
import { paceOf } from './pace.js';

export const MAX_WANTS = 3;
const MYST_TEXT = { moon: 'work out what the moon is', ripples: 'find out what lives in the pond', sparks: 'catch one of the dancing sparks', tree: 'find out what is hiding in the roots of the oak', stars: 'find out what the stars are' };

export function wantText(w, x) {
  const q = w.cat.quirk;
  switch (x.kind) {
    case 'find': return `find ${an(itemName(x.item, x.color))}`;
    case 'fill': return `have ${x.target} ${quirkWord(q)} in the stash`;
    case 'master': return `paint something I am proud of (${Math.round(x.target * 100)}+)`;
    case 'solve': return MYST_TEXT[x.mystery] || 'understand something strange';
    case 'attention': return 'hear from the human';
    case 'guard': return 'keep an eye on the stash';
    case 'lookup': return `find out what "${x.word}" is`;
    case 'craft': return `make ${an(RECIPES[x.recipe].name)}`;
    case 'learn': return RECIPES[x.recipe].learnText || `work out how to make ${an(RECIPES[x.recipe].name)}`;
    case 'catch': return `catch ${x.target} ${x.prey === 'bird' ? 'birds' : 'mice'}${x.progress ? ` (${x.progress} so far)` : ''}`;
  }
  return x.kind;
}
const has = (w, kind, key) => w.cat.wants.some(x => x.kind === kind && (key == null || x.key === key));
export const hasWant = has;

export function addWant(w, base) {
  const x = Object.assign({ id: uid(), born: w.clock, day: dayOf(w), strength: rnd(0.55, 0.9), progress: 0 }, base);
  x.text = wantText(w, x); w.cat.wants.push(x);
  note(w, `${w.cat.name} has a new want: ${x.text}.`, 'want');
  journal(w, `New want: I would like to ${x.text}.`, 'want');
  return x;
}

export function genWants(w) {
  const c = w.cat, q = c.quirk;
  if (c.wants.length >= MAX_WANTS) return;
  const cand = [];
  const have = stashColors(w);
  const missing = COLOR_NAMES.filter(col => col !== 'black' && !have[col]);
  if (w.stash.items.length >= 2 || w.stats.collected >= 1) {
    const col = have[q.favColor] ? pick(missing.length ? missing : [q.favColor]) : q.favColor;
    if (!has(w, 'find', q.item + col)) cand.push({ kind: 'find', key: q.item + col, item: q.item, color: col, w: 1.1 });
  }
  const n = w.stash.items.length;
  if (!has(w, 'fill')) cand.push({ kind: 'fill', target: n < 10 ? Math.max(5, Math.ceil((n + 1) / 5) * 5) : Math.ceil((n + 1) / 10) * 10, w: 0.8 });
  if (!has(w, 'master') && c.art.xp >= 0) cand.push({ kind: 'master', target: clamp(Math.max(0.4, c.art.best + 0.08), 0, 0.95), w: 0.9 });
  for (const id of Object.keys(w.mysteries)) { const m = w.mysteries[id]; if ((id === 'sparks' && !(m.seen || m.clues > 0)) || ((id === 'tree' || id === 'stars') && !m.interest)) continue; /* it cannot want to catch what it has not seen */ if (!m.solved && m.conf < 0.8 && !has(w, 'solve', id)) cand.push({ kind: 'solve', key: id, mystery: id, w: 1.0 }); }
  if (c.needs.lonely > 0.65 && !has(w, 'attention')) cand.push({ kind: 'attention', w: 1.4 });
  if (dayOf(w) >= 2) { // goals for the hunt
    if (!has(w, 'catch', 'mouse')) cand.push({ kind: 'catch', key: 'mouse', prey: 'mouse', target: 5, w: 0.8 + (c.temper === 'hunter' ? 0.6 : 0) });
    if (!has(w, 'catch', 'bird')) cand.push({ kind: 'catch', key: 'bird', prey: 'bird', target: 5, w: 0.7 + (c.temper === 'hunter' ? 0.6 : 0) });
  }
  if (c.needs.fear > 0.35 && !has(w, 'guard')) cand.push({ kind: 'guard', visits0: q.visits, w: 1.6 });
  for (const [id, r] of Object.entries(RECIPES)) {
    if (has(w, 'craft', id) || has(w, 'learn', id) || !r.can(w)) continue;
    const d = r.desire(w); if (d <= 0) continue;
    if (knows(w, id)) cand.push({ kind: 'craft', key: id, recipe: id, w: d }); else if (c.mem.known.tablet) cand.push({ kind: 'learn', key: id, recipe: id, w: d * 0.8 });
  }
  if (!cand.length) return;
  let r = Math.random() * cand.reduce((s, x) => s + x.w, 0);
  for (const x of cand) { r -= x.w; if (r <= 0) { const { w: _w, ...rest } = x; const made = addWant(w, rest); if (made.kind === 'find') w.pending.push({ at: w.clock + w.dayLen * rnd(0.2, 0.55), type: made.item, color: made.color }); return; } }
}

export function fulfil(w, x, how) {
  const c = w.cat; c.wants = c.wants.filter(y => y !== x); c.doneWants++; w.stats.wants++;
  c.needs.fun = clamp(c.needs.fun - 0.25); c.mood.joy = clamp(c.mood.joy + 0.5);
  note(w, `${c.name} got what it wanted: ${x.text}. ${how || ''}`.trim(), 'want');
  journal(w, `Wanted: ${x.text}. Done. ${how || ''}`.trim(), 'want');
  c.thoughtHint = 'wantDone';
}

// progress hooks, called by the acts
export function onEvent(w, type, d = {}) {
  const c = w.cat;
  for (const x of [...c.wants]) {
    if (type === 'stashed') {
      if (x.kind === 'find' && d.item.type === x.item && d.item.color === x.color) fulfil(w, x, `It is in the stash now.`);
      else if (x.kind === 'fill' && w.stash.items.length >= x.target) fulfil(w, x, `${w.stash.items.length} and counting.`);
    } else if (type === 'painted' && x.kind === 'master' && d.work.score >= x.target) fulfil(w, x, `"${d.work.title}" is the best yet.`);
    else if (type === 'mystery' && x.kind === 'solve' && x.mystery === d.id && (d.solved || d.conf >= 0.8)) fulfil(w, x, d.solved ? 'Mystery solved.' : 'I have a theory I trust.');
    else if (type === 'caught' && x.kind === 'catch' && x.prey === d.prey) { x.progress = (x.progress || 0) + 1; if (x.progress >= x.target) fulfil(w, x, `That is ${x.target}.`); else x.text = wantText(w, x); }
    else if (type === 'chat' && x.kind === 'attention') fulfil(w, x, 'The human spoke to me.');
    else if (type === 'offering' && x.kind === 'attention') fulfil(w, x, 'The human left me something.');
    else if (type === 'lookup' && x.kind === 'lookup' && d.word === x.word) fulfil(w, x, `It is "${d.title}".`);
    else if (type === 'built' && x.kind === 'craft' && x.recipe === d.id) fulfil(w, x, 'It is made.');
    else if (type === 'learned' && x.kind === 'learn' && x.recipe === d.id) { fulfil(w, x, 'Now I know how.'); if (!has(w, 'craft', d.id) && !RECIPES[d.id].knowledge) addWant(w, { kind: 'craft', key: d.id, recipe: d.id }); }
    else if (type === 'stashVisit' && x.kind === 'guard' && w.cat.quirk.visits - x.visits0 >= 3) { c.needs.fear = clamp(c.needs.fear - 0.5); fulfil(w, x, 'Everything is still there.'); }
  }
}

// frustration grows; very old wants fade
export function wantsTick(w, dtDays) {
  const c = w.cat;
  for (const x of [...c.wants]) {
    x.strength = clamp(x.strength + dtDays * 0.06, 0, 1);
    if (dayOf(w) - x.day >= (x.kind === 'craft' || x.kind === 'learn' ? 9 * Math.max(1, paceOf(w)) : x.kind === 'catch' ? (x.prey === 'bird' ? 14 : 8) : 4) && x.kind !== 'guard') {
      c.wants = c.wants.filter(y => y !== x);
      journal(w, `I have stopped wanting to ${x.text}. For now.`, 'want');
      note(w, `${c.name} gave up on wanting to ${x.text}.`, 'want');
    }
  }
}

// total pull of wants whose kinds are in the list
export function wantPull(w, kinds) { return w.cat.wants.reduce((s, x) => s + (kinds.includes(x.kind) ? x.strength : 0), 0); }
