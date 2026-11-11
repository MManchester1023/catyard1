// Side-panel views. All text goes in through textContent, so nothing the cat (or the model) says can inject markup.
import { COLORS, COLOR_NAMES, ITEM_TYPES, ITEM_LABEL, ITEM_PLURAL, COAT_LABEL } from './sim/util.js';
import { levelOf, xpForLevel, LEVEL_NAMES, buildOps, drawPainting, subjectLabel } from './sim/art.js';
import { stashColors, TASTE_LABEL } from './sim/quirk.js';
import { MYSTERY_INFO } from './sim/mysteries.js';
import { describe } from './sim/sim.js';
import { ditherCanvas } from './dither.js';
import { dayOf, clockStr } from './sim/world.js';
import { topTastes, offerLabel, MAX_ON_MAT, NOTE_MAX } from './sim/offerings.js';
import { topFeelings } from './sim/feelings.js';
import { MATERIALS, MAT_LABEL, MAT_GIFT, matText } from './sim/util.js';
import { thingsSummary, timeline, daySummary, daysList, spentText, KINDS, KIND_IDS } from './sim/history.js';
import { wishLabel } from './sim/wishes.js';
import { INV_CAP } from './sim/craft.js';

export function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  if (props) for (const k of Object.keys(props)) { const v = props[k]; if (v == null || v === false) continue; if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v); }
  for (const kid of kids.flat()) if (kid != null && kid !== false) e.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return e;
}
const pct = v => Math.round(v * 100);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

export function moodLabel(w) {
  const c = w.cat, n = c.needs;
  if (c.pose === 'sleep' || c.pose === 'inside') return 'Asleep';
  if (n.wet > 0.6) return 'Soggy'; if (n.hunger > 0.78) return 'Hungry'; if (n.thirst > 0.85) return 'Thirsty'; if (n.tired > 0.85) return 'Exhausted';
  if (n.lonely > 0.75) return 'Lonely'; if (n.fun > 0.75) return 'Bored'; if (c.mood.joy > 0.65) return 'Happy'; if (n.create > 0.8) return 'Itching to paint';
  return n.hunger < 0.35 && n.fun < 0.45 ? 'Content' : 'Calm';
}

// ----- needs strip under the yard -----
const NEEDS = [['Hunger', 'hunger'], ['Thirst', 'thirst'], ['Tiredness', 'tired'], ['Boredom', 'fun'], ['Loneliness', 'lonely'], ['Creative urge', 'create']];
export function buildNeeds(el) { el.replaceChildren(...NEEDS.map(([label, k]) => h('div', { class: 'meter', 'data-k': k }, h('div', { class: 'row' }, h('span', { text: label }), h('span', { class: 'v' })), h('div', { class: 'bar' }, h('div', { class: 'fill' }))))); }
export function updateNeeds(el, w) { for (const m of el.children) { const v = w.cat.needs[m.dataset.k]; m.querySelector('.fill').style.width = pct(v) + '%'; m.querySelector('.v').textContent = pct(v) + '%'; m.classList.toggle('hot', v > 0.8 && m.dataset.k !== 'create'); } }

// ----- Cat tab -----
function meter(v) { return h('div', { class: 'bar' }, h('i', { style: `width:${pct(v)}%` })); }
export function renderCat(el, w) {
  const c = w.cat, q = c.quirk, a = c.art, lvl = levelOf(a.xp), next = xpForLevel(lvl + 1), cur = xpForLevel(lvl);
  const cols = Object.entries(stashColors(w)).sort((x, y) => y[1] - x[1]);
  const secs = [];
  secs.push(h('div', { class: 'sec' }, h('div', { class: 'big', text: c.name }), h('div', { class: 'muted', text: `${c.age}-year-old ${COAT_LABEL[c.coat]} · ${moodLabel(w)}` }), h('div', { class: 'small', text: describe(w) }),
    h('div', { style: 'margin-top:10px' }, ...[['Curious', 'curious'], ['Bold', 'bold'], ['Affectionate', 'affection'], ['Lazy', 'lazy']].map(([l, k]) => h('div', { class: 'trait' }, h('span', { text: l }), meter(c.traits[k]), h('span', { class: 'muted', text: pct(c.traits[k]) }))))));
  secs.push(h('div', { class: 'sec' }, h('h3', { text: 'Quirk: collector' }),
    h('div', { text: `Collects ${ITEM_PLURAL[q.item]}. Favourite color: ${q.favColor}.` }),
    h('div', { class: 'muted small', text: w.stash.site ? `${w.stash.items.length} in the stash, ${w.table ? 'kept on the bark table it made' : 'hidden ' + w.stash.site.label}, arranged as ${TASTE_LABEL[q.taste]}. Checked ${q.visits} time${q.visits === 1 ? '' : 's'}.` : 'No stash yet. It is still looking for the right spot.' }),
    cols.length ? h('div', { class: 'dots' }, ...cols.flatMap(([col, n]) => Array.from({ length: Math.min(n, 12) }, () => h('span', { class: 'dot', style: `background:${COLORS[col]}`, title: col })))) : null));
  const th = thingsSummary(w), fl = topFeelings(w, 5);
  secs.push(h('div', { class: 'sec' }, h('h3', { text: 'Making things' }),
    h('div', { class: 'mats' }, ...MATERIALS.map(m => h('div', { class: 'mat' + (c.inv[m] ? '' : ' none'), title: `${MAT_LABEL[m]}: it can carry ${INV_CAP}` }, h('b', { text: String(c.inv[m]) }), h('span', { text: m })))),
    h('div', { class: 'muted small', text: 'It scratches the oak for bark and twigs. Twine is the one thing it cannot find in the yard: leave some on the mat in the Outside tab.' }),
    h('div', { style: 'margin-top:8px' }, ...th.recipes.map(r => h('div', { class: 'kv' }, h('span', {}, cap(r.name), r.made ? h('span', { class: 'chip', text: 'made ' + r.made }) : null), h('span', { class: 'muted small', text: (r.known ? '' : 'needs the tablet · ') + r.cost })))),
    th.crafted.length ? h('div', { class: 'muted small', style: 'margin-top:6px', text: 'Made so far: ' + th.crafted.slice(0, 6).map(x => `${x.name} (day ${x.day})`).join(', ') }) : null));
  secs.push(h('div', { class: 'sec' }, h('h3', { text: 'What makes it feel good' }),
    fl.good.length || fl.bad.length ? [...fl.good.map(r => tasteRow(r.name, Math.min(1, r.score), null, r.label)), ...fl.bad.map(r => h('div', { class: 'kv' }, h('span', { text: r.name }), h('span', { class: 'chip bad', text: r.label })))] : h('div', { class: 'muted', text: 'Too early to tell. It learns what it likes from how things make it feel.' }),
    h('div', { class: 'muted small', style: 'margin-top:6px', text: 'Nobody told it what to like. These come from gifts, pages, paintings and what it has made.' })));
  secs.push(h('div', { class: 'sec' }, h('h3', { text: 'Wants' }),
    c.wants.length ? c.wants.map(x => h('div', { class: 'item' }, h('div', { text: cap(x.text) }), h('div', { class: 'muted small', text: `since day ${x.day}` }), meter(x.strength))) : h('div', { class: 'muted', text: 'Nothing right now.' }),
    h('div', { class: 'muted small', text: `${c.doneWants} fulfilled so far` })));
  secs.push(h('div', { class: 'sec' }, h('h3', { text: 'Wondering about' }), Object.entries(w.mysteries).map(([id, m]) => h('div', { class: 'item' },
    h('div', { text: cap(MYSTERY_INFO[id].name) + (m.solved ? ' (solved)' : '') }),
    m.theory ? h('div', { class: 'theory', text: '“' + m.theory + '”' }) : h('div', { class: 'muted small', text: m.clues ? `${Math.floor(m.clues)} clues so far, no theory yet.` : 'Has not noticed this yet.' }),
    m.theory && !m.solved ? h('div', { class: 'muted small', text: `Confidence ${pct(m.conf)}%` + (m.revised ? ` · changed its mind ${m.revised}×` : '') }) : null))));
  secs.push(h('div', { class: 'sec' }, h('h3', { text: 'Painting' }), h('div', { class: 'big', text: `Level ${lvl}: ${LEVEL_NAMES[lvl]}` }),
    lvl < 12 ? [meter((a.xp - cur) / (next - cur)), h('div', { class: 'muted small', text: `${Math.round(next - a.xp)} xp to ${LEVEL_NAMES[lvl + 1]}` })] : null,
    h('div', { class: 'muted small', style: 'margin-top:6px', text: `${a.count} painting${a.count === 1 ? '' : 's'}${a.count ? `, best ${pct(a.best)}/100` : ''}` })));
  el.replaceChildren(...secs);
}

// ----- History tab: what the cat did, thought and had happen -----
// Built once (so typing in the search box is never interrupted); the list underneath is redrawn when something changes.
const KIND_MARK = { did: 'did', thought: 'thought', event: 'event', diary: 'diary', chat: 'chat' };
const barRow = (label, v) => h('div', { class: 'trait taste' }, h('span', { text: label }), meter(Math.min(1, v * 1.6)), h('span', { class: 'muted', text: pct(v) }));
const entryRow = e => h('div', { class: 'tl ' + e.k }, h('span', { class: 'when', text: `d${e.day} ${e.time}` }), h('span', { class: 'mark', text: KIND_MARK[e.k] || e.k }), h('span', { class: 'txt', text: e.text }));
function dayBlock(w, d, open) {
  const s = daySummary(w, d); if (!s) return null;
  const body = [h('div', { class: 'muted small', text: 'How the day was spent' }), ...s.spent.slice(0, 7).map(x => barRow(x.label, x.pct)), s.events.length ? h('div', { class: 'muted small', style: 'margin-top:8px', text: 'Worth remembering' }) : null,
    ...s.events.map(e => h('div', { class: 'tl event' }, h('span', { class: 'when', text: e.time }), h('span', { class: 'txt', text: e.text })))];
  return h('details', { class: 'daybox', open: open ? true : null }, h('summary', {}, h('b', { text: `Day ${d}${s.current ? ' (today)' : ''}` }), h('span', { class: 'muted small', text: ' ' + (spentText(s, 3) || 'nothing recorded') })), ...body);
}

export function renderHistory(el, w, st, ctx = {}) {
  st.mode = st.mode || 'today'; st.kinds = st.kinds || new Set(['did', 'thought', 'event']); st.q = st.q || ''; st.limit = st.limit || 120;
  const modes = [['today', 'Today'], ['timeline', 'Timeline'], ['diary', 'Diary'], ['days', 'Days']];
  const seg = h('div', { class: 'seg' }), controls = h('div', { class: 'hctl' }), body = h('div', { id: 'hist-body' });
  const search = h('input', { type: 'search', id: 'hist-q', placeholder: 'Search what it did and thought…', 'aria-label': 'Search the history', value: st.q });
  search.addEventListener('input', () => { st.q = search.value; st.limit = 120; st.sig = ''; update(); });
  const chips = h('div', { class: 'chips' });
  const paintChips = () => chips.replaceChildren(...KIND_IDS.map(k => h('button', { type: 'button', class: 'chipbtn', 'aria-pressed': String(st.kinds.has(k)), text: KINDS[k], onclick: () => { if (st.kinds.has(k)) st.kinds.delete(k); else st.kinds.add(k); paintChips(); st.sig = ''; update(); } })));
  const paintSeg = () => { seg.replaceChildren(...modes.map(([m, l]) => h('button', { type: 'button', 'aria-pressed': String(st.mode === m), text: l, onclick: () => { st.mode = m; st.sig = ''; paintSeg(); controls.hidden = m !== 'timeline'; update(); } }))); };
  paintChips(); paintSeg(); controls.hidden = st.mode !== 'timeline'; controls.append(search, chips);
  const exp = h('div', { class: 'row2', style: 'margin-top:14px' }, h('button', { class: 'btn', type: 'button', text: 'Export the whole story…', onclick: () => ctx.actions && ctx.actions.export && ctx.actions.export() }),
    h('span', { class: 'muted small', style: 'align-self:center', text: 'A text file with the days, diary and timeline.' }));
  el.replaceChildren(h('div', { class: 'row2 between' }, seg), controls, body, exp);

  function update() {
    const sig = [w.logId, st.mode, st.q, [...st.kinds].join(), st.limit, dayOf(w), st.mode === 'today' ? Math.floor(w.clock / 20) : 0].join('|');
    if (sig === st.sig) return; st.sig = sig;
    const c = w.cat;
    if (st.mode === 'today') {
      const s = daySummary(w, dayOf(w)), recent = timeline(w, { kinds: ['did', 'thought', 'event'], limit: 14 });
      body.replaceChildren(
        h('div', { class: 'sec' }, h('h3', { text: 'Right now' }), h('div', { text: describe(w) }), c.thought ? h('div', { class: 'theory', text: '“' + c.thought + '”' }) : null),
        h('div', { class: 'sec' }, h('h3', { text: `Day ${dayOf(w)} so far` }), s && s.spent.length ? s.spent.slice(0, 6).map(x => barRow(x.label, x.pct)) : h('div', { class: 'muted', text: 'Just started.' }),
          s && s.events.length ? [h('div', { class: 'muted small', style: 'margin:10px 0 4px', text: 'Worth remembering' }), ...s.events.slice(-8).reverse().map(e => h('div', { class: 'tl event' }, h('span', { class: 'when', text: e.time }), h('span', { class: 'txt', text: e.text })))] : null),
        h('div', { class: 'sec' }, h('h3', { text: 'Just now' }), ...(recent.length ? recent.map(entryRow) : [h('div', { class: 'muted', text: 'Nothing yet.' })])));
    } else if (st.mode === 'timeline') {
      const rows = timeline(w, { kinds: [...st.kinds], q: st.q, limit: st.limit });
      body.replaceChildren(...(rows.length ? rows.map(entryRow) : [h('div', { class: 'muted', text: st.kinds.size ? 'Nothing matches.' : 'Choose at least one kind of entry above.' })]),
        rows.length >= st.limit ? h('div', { class: 'row2', style: 'margin-top:8px' }, h('button', { class: 'btn', type: 'button', text: 'Show older', onclick: () => { st.limit += 150; st.sig = ''; update(); } })) : h('div', { class: 'muted small', style: 'margin-top:8px', text: `${w.hist.length} entries kept, the oldest from day ${w.hist.length ? w.hist[0].day : dayOf(w)}. Use Days for older summaries.` }));
    } else if (st.mode === 'diary') {
      const rows = w.journal.slice(0, 150).map(e => h('div', { class: 'entry' }, h('div', { class: 'meta' }, `Day ${e.day} · ${e.time}`, e.tag ? h('span', { class: 'chip', text: e.tag }) : null), h('div', { class: 'txt', text: e.text })));
      body.replaceChildren(...(rows.length ? rows : [h('div', { class: 'muted', text: 'Nothing yet.' })]));
    } else {
      const ds = daysList(w);
      body.replaceChildren(...(ds.length ? ds.map((d, i) => dayBlock(w, d, i === 0)) : [h('div', { class: 'muted', text: 'Nothing yet.' })]), h('div', { class: 'muted small', style: 'margin-top:8px', text: `Summaries of the last ${ds.length} day${ds.length === 1 ? '' : 's'} are kept (up to 45).` }));
    }
  }
  update(); return update;
}

// ----- Gallery -----
export function paintInto(canvas, work, progress = 1) {
  canvas.width = 240; canvas.height = 180; const g = canvas.getContext('2d', { willReadFrequently: true }); g.clearRect(0, 0, 240, 180);
  g.fillStyle = '#f4efe4'; g.fillRect(0, 0, 240, 180);
  drawPainting(g, 240, 180, buildOps(work, 240, 180), progress);
  ditherCanvas(canvas);
}
export function renderGallery(el, w, open) {
  const works = w.cat.art.works;
  if (!works.length) { el.replaceChildren(h('div', { class: 'muted', text: `${w.cat.name} has not finished a painting yet. It will, once the urge builds and the light is good.` })); return; }
  const grid = h('div', { id: 'grid' }, ...works.map(wk => { const cv = h('canvas'); paintInto(cv, wk); return h('button', { class: 'frame', type: 'button', onclick: () => open(wk) }, cv, h('b', { text: wk.title }), h('small', { text: `Day ${wk.day} · ${LEVEL_NAMES[wk.level]} · ${pct(wk.score)}` })); }));
  el.replaceChildren(h('div', { class: 'muted small', style: 'margin-bottom:10px', text: `${works.length} on display` + (works.length < w.cat.art.count ? ` (${w.cat.art.count} painted)` : '') }), grid);
}
export function paintingModal(wk, close) {
  const cv = h('canvas'); paintInto(cv, wk);
  return [h('h2', { text: wk.title }), h('div', { class: 'muted', text: `Day ${wk.day}, ${wk.when.toLowerCase()} · ${subjectLabel(wk.subject)} · painted at level ${wk.level} (${LEVEL_NAMES[wk.level]}) · ${pct(wk.score)}/100` }), cv, h('div', { class: 'critique', text: '“' + wk.critique + '”' }), h('div', { class: 'row2', style: 'margin-top:14px' }, h('button', { class: 'btn primary', type: 'button', onclick: close, text: 'Close' }))];
}


// ----- Outside tab: offerings and the tablet -----
// The form is built once so typing is never interrupted; the lists below it are redrawn only when something changed.
const STATE_LABEL = { new: 'waiting', seen: 'being looked at', left: 'turned down' };
const TIER_LABEL = { delight: 'delighted', pleased: 'pleased', curious: 'curious', meh: 'unmoved' };
const swatch = c => h('span', { class: 'dot sw', style: `background:${COLORS[c] || '#888'}`, title: c });
function tasteRow(label, v, sw, feeling) { return h('div', { class: 'trait taste' }, h('span', {}, sw || null, label, feeling ? h('em', { class: 'muted small', text: ' · ' + feeling }) : null), meter(v), h('span', { class: 'muted', text: pct(v) })); }

export function renderOutside(el, w, ctx) {
  const { actions } = ctx, kinds = { item: 'An object', material: 'Materials', note: 'A note' }; let kind = 'item';
  const type = h('select', { id: 'of-type', 'aria-label': 'Kind of object' }, h('option', { value: '', text: 'Any kind' }), ...ITEM_TYPES.map(t => h('option', { value: t, text: cap(ITEM_LABEL[t]) })));
  const color = h('select', { id: 'of-color', 'aria-label': 'Colour' }, h('option', { value: '', text: 'Any colour' }), ...COLOR_NAMES.map(c => h('option', { value: c, text: cap(c) })));
  const text = h('textarea', { id: 'of-note', rows: '3', maxlength: String(NOTE_MAX), placeholder: 'A few words for the cat…', 'aria-label': 'Note' });
  const mat = h('select', { id: 'of-mat-type', 'aria-label': 'Material' }, ...MATERIALS.map(m => h('option', { value: m, text: cap(matText(m, MAT_GIFT[m])) })));
  const matRow = h('div', { class: 'field' }, mat, h('div', { class: 'muted small', text: 'It can find bark and twigs on the oak. Twine it cannot find anywhere, so it can only come from you.' }));
  const itemRow = h('div', { class: 'row2' }, type, color), noteRow = h('div', { class: 'field' }, text, h('div', { class: 'muted small', text: `Up to ${NOTE_MAX} characters. The cat reads it, keeps it, and may look up a word it does not know.` }));
  const msg = h('div', { class: 'status', id: 'of-msg', 'aria-live': 'polite' });
  const seg = h('div', { class: 'seg' });
  const paintSeg = () => { seg.replaceChildren(...Object.entries(kinds).map(([k, l]) => h('button', { type: 'button', 'aria-pressed': String(kind === k), text: l, onclick: () => { kind = k; paintSeg(); itemRow.hidden = k !== 'item'; matRow.hidden = k !== 'material'; noteRow.hidden = k !== 'note'; } }))); };
  paintSeg(); noteRow.hidden = true; matRow.hidden = true;
  const leave = () => {
    const r = actions.leave(kind === 'note' ? { kind: 'note', text: text.value } : kind === 'material' ? { kind: 'material', type: mat.value } : { kind: 'item', type: type.value || undefined, color: color.value || undefined });
    msg.textContent = r.ok ? 'Left on the mat. It will notice in a moment.' : r.error; msg.className = 'status ' + (r.ok ? 'ok' : 'bad'); if (r.ok && kind === 'note') text.value = ''; update();
  };
  const dyn = { wishes: h('div', { id: 'of-wishes' }), feel: h('div', { id: 'of-feel' }), mat: h('div', { id: 'of-mat' }), tastes: h('div', { id: 'of-tastes' }), hist: h('div', { id: 'of-hist' }), keeps: h('div', { id: 'of-keeps' }), tablet: h('div', { id: 'of-tablet' }) };
  el.replaceChildren(
    h('div', { class: 'sec' }, h('h3', { text: 'Leave something on the mat' }),
      h('p', { class: 'muted small', text: `The mat is by the glass at the front of the yard. It holds ${MAX_ON_MAT} things. What the cat is given slowly changes what it likes.` }),
      seg, itemRow, matRow, noteRow, h('div', { class: 'row2', style: 'margin-top:8px' }, h('button', { class: 'btn primary', type: 'button', text: 'Leave it on the mat', onclick: leave })), msg, dyn.mat),
    h('div', { class: 'sec' }, h('h3', { text: 'Notes from the cat' }), dyn.wishes),
    h('div', { class: 'sec' }, h('h3', { text: 'What it likes right now' }), dyn.tastes, dyn.feel),
    h('div', { class: 'sec' }, h('h3', { text: 'How it took your offerings' }), dyn.hist, dyn.keeps),
    h('div', { class: 'sec' }, h('h3', { text: 'The tablet' }), dyn.tablet));
  let sig = '';
  function update() {
    const c = w.cat, t = w.tablet || { pages: [], interests: {} }, net = ctx.net;
    if (msg.classList.contains('bad') && w.offers.length < MAX_ON_MAT) { msg.textContent = ''; msg.className = 'status'; } // the "mat is full" notice goes away once there is room
    const next = JSON.stringify([w.offers, c.tastes && [topTastes(w, 'color', 4), topTastes(w, 'type', 4)], c.offerHist.map(x => [x.id, x.text]), c.keepsakes, c.wishes.map(x => [x.id, x.state, x.text]), topFeelings(w, 4), t.pages.map(p => [p.id, p.reaction]), Object.keys(t.interests).length, net && net.label(), c.quirk.favColor, c.quirk.item]);
    if (next === sig) return; sig = next;
    dyn.mat.replaceChildren(...(w.offers.length ? [h('div', { class: 'muted small', text: 'On the mat now:' }), ...w.offers.map(o => h('div', { class: 'kv' }, h('span', {}, o.kind === 'item' ? swatch(o.color) : null, cap(offerLabel(o))), h('span', { class: 'muted', text: STATE_LABEL[o.state] || o.state })))] : [h('div', { class: 'muted small', style: 'margin-top:8px', text: 'The mat is empty.' })]));
    dyn.tastes.replaceChildren(h('div', { class: 'small', text: `Favourite colour: ${c.quirk.favColor}. Collects ${ITEM_PLURAL[c.quirk.item]}.` }),
      h('div', { class: 'muted small', style: 'margin:8px 0 4px', text: 'Colours' }), ...topTastes(w, 'color', 4).map(([k, v]) => tasteRow(k, v, swatch(k))),
      h('div', { class: 'muted small', style: 'margin:8px 0 4px', text: 'Things' }), ...topTastes(w, 'type', 4).map(([k, v]) => tasteRow(ITEM_LABEL[k], v)));
    const openW = c.wishes.filter(x => x.state === 'open'), pastW = c.wishes.filter(x => x.state === 'granted' || x.state === 'faded').slice(0, 4);
    dyn.wishes.replaceChildren(
      h('div', { class: 'muted small', text: c.mem.known.tablet ? 'When it wants something only you can bring, it writes you a note on the tablet. Leave what it asks for on the mat and it will know you read it.' : 'Once it finds the tablet it can leave you notes here.' }),
      ...(openW.length ? openW.map(x => h('div', { class: 'wish' }, h('div', { class: 'theory', text: '“' + x.text + '”' }), h('div', { class: 'row2 between' }, h('span', { class: 'muted small', text: `Day ${x.written ? x.written.day : x.day} · asks for ${wishLabel(x)}` }), h('button', { class: 'btn primary', type: 'button', text: 'Give it', onclick: () => { const r = actions.leave(x.kind === 'material' ? { kind: 'material', type: x.type } : { kind: 'item', type: x.type, color: x.color || undefined }); msg.textContent = r.ok ? 'Left on the mat. It will notice in a moment.' : r.error; msg.className = 'status ' + (r.ok ? 'ok' : 'bad'); update(); } })))) : [h('div', { class: 'muted', style: 'margin-top:6px', text: 'No notes waiting.' })]),
      ...pastW.map(x => h('div', { class: 'kv' }, h('span', { class: 'small', text: wishLabel(x) }), h('span', { class: 'chip', text: x.state === 'granted' ? 'granted' : 'faded' }))));
    const fl = topFeelings(w, 4);
    dyn.feel.replaceChildren(h('div', { class: 'muted small', style: 'margin:10px 0 4px', text: 'What has made it feel good (learned, not set)' }), ...(fl.good.length ? fl.good.map(r => tasteRow(r.name, Math.min(1, r.score), null, r.label)) : [h('div', { class: 'muted small', text: 'Nothing yet.' })]), ...(fl.bad.length ? [h('div', { class: 'muted small', style: 'margin:8px 0 2px', text: 'Uneasy about: ' + fl.bad.map(r => r.name).join(', ') })] : []));
    dyn.hist.replaceChildren(...(c.offerHist.length ? c.offerHist.slice(0, 8).map(x => h('div', { class: 'entry' }, h('div', { class: 'meta' }, `Day ${x.day} · ${x.time}`, h('span', { class: 'chip', text: x.kind === 'note' ? 'note' : TIER_LABEL[x.tier] })), h('div', { class: 'small', text: cap(x.label) }), h('div', { class: 'txt', text: '“' + x.text + '”' }))) : [h('div', { class: 'muted small', text: 'Nothing has been left yet.' })]));
    dyn.keeps.replaceChildren(...(c.keepsakes.length ? [h('div', { class: 'muted small', style: 'margin-top:12px', text: 'Notes it kept:' }), ...c.keepsakes.map(k => h('div', { class: 'theory', text: '“' + k.text + '”' }))] : []));
    const ready = !!c.mem.known.tablet;
    dyn.tablet.replaceChildren(
      h('div', { class: 'status ' + (net && net.state === 'error' ? 'bad' : net && net.enabled() ? 'ok' : ''), text: net ? net.label() : '' }),
      h('div', { class: 'muted small', text: ready ? `It has used it ${t.uses} time${t.uses === 1 ? '' : 's'}. Everything it reads comes from Wikipedia and is shown only as text.` : 'It has not found the tablet by the stump yet. It will, or send it there with /tablet go.' }),
      Object.keys(t.interests).length ? h('div', { class: 'dots', style: 'gap:5px' }, ...Object.entries(t.interests).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => h('span', { class: 'chip', text: k + (v > 1 ? ' ×' + v : '') }))) : null,
      ...(t.pages.length ? t.pages.slice(0, 6).map(p => h('div', { class: 'entry' }, h('div', { class: 'meta' }, `Day ${p.day} · ${p.time}`, p.seen > 1 ? h('span', { class: 'chip', text: 'read ' + p.seen + '×' }) : null), h('div', { class: 'small', style: 'font-weight:600', text: p.title }), h('div', { class: 'muted small', text: p.extract.length > 180 ? p.extract.slice(0, 177) + '...' : p.extract }), p.reaction ? h('div', { class: 'txt', text: '“' + p.reaction + '”' }) : null)) : []));
  }
  update(); return update;
}

// ----- Settings -----
export function renderSettings(el, ctx) {
  const { settings: s, brain, net, where, actions } = ctx, st = h('div', { class: 'status', id: 'brainstatus' });
  const field = (id, label, input) => h('div', { class: 'field' }, h('label', { for: id, text: label }), input);
  const key = h('input', { id: 'set-key', type: 'password', placeholder: s.apiKey ? '•••••••• (saved)' : 'sk-ant-…', autocomplete: 'off', spellcheck: 'false' });
  const model = h('input', { id: 'set-model', value: s.model, spellcheck: 'false' });
  const on = h('input', { id: 'set-on', type: 'checkbox', checked: s.on ? true : null });
  const capI = h('input', { id: 'set-cap', type: 'number', min: '10', max: '5000', value: String(s.dailyCap) });
  const every = h('input', { id: 'set-every', type: 'number', min: '30', max: '3600', value: String(s.museEvery) });
  const save = () => { if (key.value.trim()) { s.apiKey = key.value.trim(); key.value = ''; key.placeholder = '•••••••• (saved)'; } s.model = model.value.trim() || s.model; s.on = on.checked; s.dailyCap = Math.max(10, +capI.value || s.dailyCap); s.museEvery = Math.max(30, +every.value || s.museEvery); actions.saveSettings(); refresh(); };
  const refresh = () => { st.textContent = brain.label(); st.className = 'status ' + (brain.state === 'error' ? 'bad' : brain.enabled() ? 'ok' : ''); };
  refresh();
  const auto = h('select', { id: 'set-auto' }, ...[[1, 'every minute'], [3, 'every 3 minutes'], [10, 'every 10 minutes']].map(([v, l]) => h('option', { value: String(v), selected: s.autosaveMin === v ? true : null, text: l })));
  auto.addEventListener('change', () => { s.autosaveMin = +auto.value; actions.saveSettings(); });
  const eco = h('select', { id: 'set-eco' }, ...[['normal', 'Normal (30 fps while focused)'], ['eco', 'Eco (15 fps, quieter on battery)']].map(([v, l]) => h('option', { value: v, selected: s.fps === v ? true : null, text: l })));
  eco.addEventListener('change', () => { s.fps = eco.value; actions.saveSettings(); });
  const tray = h('input', { id: 'set-tray', type: 'checkbox', checked: s.closeToTray !== false ? true : null });
  tray.addEventListener('change', () => { s.closeToTray = tray.checked; actions.saveSettings(); });
  const desktop = typeof window !== 'undefined' && !!window.__TAURI__;
  const pick = h('input', { id: 'set-import', type: 'file', accept: '.json,application/json', style: 'display:none', 'aria-label': 'Choose a save file' });
  pick.addEventListener('change', async () => { const f = pick.files && pick.files[0]; if (!f) return; try { actions.importSave(await f.text(), f.name); } catch { /* unreadable file: nothing to do */ } pick.value = ''; });
  const tc = net ? net.cfg() : null, nst = h('div', { class: 'status', id: 'netstatus' });
  const tOn = h('input', { id: 'set-tab-on', type: 'checkbox', checked: tc && tc.on ? true : null }), tSafe = h('input', { id: 'set-tab-safe', type: 'checkbox', checked: tc && tc.safe !== false ? true : null }), tCap = h('input', { id: 'set-tab-cap', type: 'number', min: '5', max: '500', value: String(tc ? tc.dailyCap : 60) });
  const nRefresh = () => { if (!net) return; nst.textContent = net.label(); nst.className = 'status ' + (net.state === 'error' ? 'bad' : net.enabled() ? 'ok' : ''); };
  const nSave = () => { if (!net) return; const c = net.cfg(); c.on = tOn.checked; c.safe = tSafe.checked; c.dailyCap = Math.max(5, Math.min(500, +tCap.value || c.dailyCap)); actions.saveSettings(); nRefresh(); };
  for (const i of [tOn, tSafe, tCap]) i.addEventListener('change', nSave); nRefresh();
  el.replaceChildren(
    h('div', { class: 'sec' }, h('h3', { text: 'Claude connection' }),
      h('p', { class: 'muted small', text: 'Optional. With an API key, the cat’s thoughts, chat replies, theories and painting titles come from Claude. Without one it uses its built-in offline voice. Your key is stored only ' + (desktop ? 'in this app’s data folder' : 'in this browser (anyone who can use this browser profile could find it)') + ' and is sent only to api.anthropic.com.' }),
      field('set-key', 'API key', key), field('set-model', 'Model', model),
      h('div', { class: 'field' }, h('label', { for: 'set-on', class: 'check' }, on, ' Use Claude when a key is set')),
      field('set-cap', 'Daily call limit', capI), field('set-every', 'Seconds between idle thoughts', every),
      h('div', { class: 'row2' }, h('button', { class: 'btn primary', type: 'button', onclick: save, text: 'Save' }), h('button', { class: 'btn', type: 'button', text: 'Test connection', onclick: async () => { save(); st.textContent = 'Testing…'; const r = await brain.test(); st.textContent = r.message; st.className = 'status ' + (r.ok ? 'ok' : 'bad'); } })), st),
    h('div', { class: 'sec' }, h('h3', { text: 'Tablet and the internet' }),
      h('p', { class: 'muted small', text: 'The tablet lets the cat read real pages. The only site it ever contacts is en.wikipedia.org (random articles, today’s featured article, and things the cat looks up). Nothing about you is sent, page text is shown as plain text and never run, and it works within a daily request limit. With it off, the cat only re-reads pages it already kept.' }),
      h('div', { class: 'field' }, h('label', { for: 'set-tab-on', class: 'check' }, tOn, ' Let the tablet go online')),
      h('div', { class: 'field' }, h('label', { for: 'set-tab-safe', class: 'check' }, tSafe, ' Skip pages about violence or adult subjects'), h('div', { class: 'muted small', text: 'A simple word filter, so it will miss some things. Leave it on.' })),
      field('set-tab-cap', 'Requests per day', tCap), nst),
    h('div', { class: 'sec' }, h('h3', { text: 'Saving' }),
      field('set-auto', 'Autosave', auto),
      h('div', { class: 'muted small', text: 'The game also saves when you close or hide the window, and with /save in the chat. The last 3 backups are kept.' }),
      h('div', { class: 'muted small', style: 'margin:6px 0 10px', text: 'Saved in: ' + where }),
      desktop ? null : h('div', { class: 'muted small', style: 'margin:0 0 10px', text: 'The cat lives in this browser’s storage. Clearing site data, or opening the page in another browser, means a different (or no) cat, so download a save file now and then. A save file also moves the cat to another browser or computer.' }),
      h('div', { class: 'row2' }, h('button', { class: 'btn', type: 'button', onclick: actions.saveNow, text: 'Save now' }), h('button', { class: 'btn', type: 'button', onclick: actions.loadSaved, text: 'Reload last save' })),
      h('div', { class: 'row2', style: 'margin-top:8px' }, h('button', { class: 'btn', type: 'button', id: 'set-export', onclick: actions.exportSave, text: 'Download save file' }), h('button', { class: 'btn', type: 'button', id: 'set-import-btn', onclick: () => pick.click(), text: 'Load a save file…' }), pick)),
    h('div', { class: 'sec' }, h('h3', { text: 'Performance' }), field('set-eco', 'Frame rate', eco), h('div', { class: 'muted small', text: desktop ? 'When the window is minimized or hidden, drawing stops entirely and the cat keeps living on a slow timer.' : 'The cat keeps living while this tab is open, even in the background (browsers slow background tabs down, so it catches up when you come back). If you close the tab, it catches up on up to 3 hours when you return.' }),
      desktop ? h('div', { class: 'field', style: 'margin-top:12px' }, h('label', { for: 'set-tray', class: 'check' }, tray, ' Closing the window keeps the cat running in the tray'), h('div', { class: 'muted small', text: 'It saves first either way. Use the tray icon’s “Save and quit” to really exit.' })) : null),
    h('div', { class: 'sec' }, h('h3', { text: 'World' }), h('div', { class: 'muted small', text: `Day ${dayOf(ctx.w)} · one day lasts ${(ctx.w.dayLen / 60).toFixed(0)} real minutes. Change it with /daylen in admin mode.` }),
      h('div', { class: 'row2', style: 'margin-top:10px' }, h('button', { class: 'btn danger', type: 'button', onclick: actions.reset, text: 'Start over with a new cat…' }))));
}
