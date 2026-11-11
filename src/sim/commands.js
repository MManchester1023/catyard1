// Admin commands for the chat box. Each returns { lines, action? }. Anything that touches disk or
// the network is returned as an `action` for the app shell to carry out.
import { clamp, rnd, ITEM_TYPES, ITEM_LABEL, COLOR_NAMES, COATS, PLACE_LABEL } from './util.js';
import { hourOf, dayOf, clockStr, spot, blocked, setWeather, spawnMouse, spawnItem, note } from './world.js';
import { stealFromStash, layoutStash, TASTES, TASTE_LABEL, quirkWord, stashColors } from './quirk.js';
import { levelOf, xpForLevel, LEVEL_NAMES } from './art.js';
import { start, done, describe, think } from './acts.js';
import { fulfil, wantText } from './wants.js';
import { catSays } from './chat.js';
import { leaveOffering, offerLabel, clearOffers, topTastes } from './offerings.js';
import { ensureTablet } from './tablet.js';
import { timeline, daySummary, daysList, spentText, thingsSummary, KINDS } from './history.js';
import { topFeelings } from './feelings.js';
import { wishLabel } from './wishes.js';
import { RECIPES, knows } from './recipes.js';
import { unlockRecipe, startable, INV_CAP } from './craft.js';
import { MATERIALS, matText } from './util.js';

const HELP = {
  status: 'status - the cat at a glance',
  time: 'time HH:MM | time +N (advance N hours)',
  day: 'day N - jump to day N, same time of day',
  speed: 'speed X - simulation speed, 0.1 to 120 (1 = normal)',
  pause: 'pause / resume - stop or restart the world',
  daylen: 'daylen SECONDS - real seconds per in-world day (default 1200)',
  weather: 'weather clear | cloud | rain | auto',
  spawn: 'spawn mouse | treat | item [type] [color] [count]',
  feed: 'feed - refill the food bowl',
  set: 'set trait <curious|bold|affection|lazy> <0-1>  |  set need <hunger|thirst|tired|fun|dirty|lonely|create|fear> <0-1>  |  set joy <0-1>',
  tp: 'tp <house|bowl|water|cushion|post|pond|flowers|tree|fence|easel|stash|glass|mat|tablet|table>',
  want: 'want list | want add <text> | want done <n> | want clear',
  quirk: 'quirk item <bottlecap|feather|button|marble> | quirk color <color> | quirk taste <pile|rows|ring|rainbow>',
  stash: 'stash list | stash add <type> <color> [n] | stash steal [n] | stash clear',
  art: 'art level <1-12> | art paint | art clear (delete the gallery)',
  think: 'think <text> - put a thought in the cat\'s head',
  name: 'name <new name>  |  coat <orange|grey|black|calico>',
  clear: 'clear log | clear journal | clear chat | clear history',
  brain: 'brain status | brain on | brain off | brain key <API key> | brain model <name> | brain cap <calls per day> | brain test',
  save: 'save [name] | load [name] | saves',
  offer: 'offer item <type> [color]  |  offer material <bark|twig|twine>  |  offer note <text>  |  offer list  |  offer clear   (leave something on the mat for the cat; works without admin mode)',
  tablet: 'tablet status | tablet on | tablet off | tablet go (send the cat to it) | tablet pages (what it has read) | tablet forget',
  tastes: 'tastes - what the cat likes right now',
  feelings: 'feelings - what has made the cat feel good, and what has not',
  history: 'history [N] | history day <N> | history <did|thought|event|diary|chat> [N] | history find <text>   (what the cat has done, thought and had happen; works without admin mode)',
  export: 'export - save the whole story (days, diary, timeline) as a text file you can read or keep',
  inventory: 'inventory - what the cat is carrying, the recipes it knows and what it has made',
  recipes: 'recipes - everything it can make, and what each needs',
  wishes: 'wishes - notes the cat has left you on the tablet',
  give: 'give <bark|twig|twine> - leave a bundle of material on the mat for the cat (same as offer material)',
  craft: 'craft give <bark|twig|twine> [n] | craft learn <recipe> | craft now <recipe> | craft table',
  wish: 'wish add <type> [color] | wish clear',
  reset: 'reset confirm - start over with a brand new cat',
  admin: 'admin on | admin off',
};
const OPEN = new Set(['help', 'status', 'save', 'saves', 'admin', 'brain', 'offer', 'tastes', 'feelings', 'history', 'export', 'inventory', 'recipes', 'wishes', 'give']);
const num = (s, lo, hi) => { const v = parseFloat(s); return Number.isFinite(v) ? clamp(v, lo, hi) : null; };
const bad = (usage) => ({ lines: ['Usage: ' + usage] });

export function runCommand(w, line, ctx = {}) {
  const parts = (line.trim().replace(/^\//, '').match(/"[^"]*"|\S+/g) || []).map(s => s.replace(/^"|"$/g, ''));
  const cmd = (parts.shift() || '').toLowerCase(), a = parts, c = w.cat, L = t => ({ lines: [].concat(t) });
  if (!cmd) return L('Type help for a list of commands.');
  if (!ctx.admin && !OPEN.has(cmd)) return L('Admin mode is off. Type /admin on first.');
  switch (cmd) {
    case 'help': return a[0] && HELP[a[0].toLowerCase()] ? L(HELP[a[0].toLowerCase()]) : L(['Commands: ' + Object.keys(HELP).join(', '), 'Try help <command> for details.']);
    case 'admin': if (a[0] === 'on') return { lines: ['Admin mode on.'], action: { type: 'admin', on: true } }; if (a[0] === 'off') return { lines: ['Admin mode off.'], action: { type: 'admin', on: false } }; return bad(HELP.admin);
    case 'status': {
      const n = c.needs, m = w.mysteries;
      return L([`${c.name}: ${describe(w)}. Day ${dayOf(w)}, ${clockStr(w)}, ${w.weather.type}.`,
        `hunger ${pct(n.hunger)}  thirst ${pct(n.thirst)}  tired ${pct(n.tired)}  fun ${pct(n.fun)}  lonely ${pct(n.lonely)}  create ${pct(n.create)}`,
        `traits: curious ${pct(c.traits.curious)}, bold ${pct(c.traits.bold)}, affection ${pct(c.traits.affection)}, lazy ${pct(c.traits.lazy)}`,
        `stash: ${w.stash.items.length} items${w.stash.site ? ' at ' + w.stash.site.label : ''} | art: level ${levelOf(c.art.xp)} ${LEVEL_NAMES[levelOf(c.art.xp)]}, ${c.art.count} works`,
        `wants: ${c.wants.map(x => x.text).join('; ') || 'none'}`, `mysteries: ${Object.entries(m).map(([k, v]) => `${k} ${v.solved ? 'solved' : v.theory ? Math.round(v.conf * 100) + '%' : 'no theory'}`).join(', ')}`]);
    }
    case 'time': {
      if (!a[0]) return bad(HELP.time);
      let target;
      if (a[0].startsWith('+')) { const hrs = num(a[0].slice(1), 0, 240); if (hrs == null) return bad(HELP.time); w.clock += hrs / 24 * w.dayLen; return L(`It is now ${clockStr(w)}, day ${dayOf(w)}.`); }
      const m = a[0].match(/^(\d{1,2})(?::(\d{2}))?$/); if (!m) return bad(HELP.time);
      target = (+m[1] + (+m[2] || 0) / 60) % 24; const cur = hourOf(w); let d = target - cur; if (d < 0) d += 24;
      w.clock += d / 24 * w.dayLen; return L(`It is now ${clockStr(w)}, day ${dayOf(w)}.`);
    }
    case 'day': { const d = num(a[0], 1, 9999); if (d == null) return bad(HELP.day); w.clock = (d - 1) * w.dayLen + (w.clock % w.dayLen); return L(`Day ${dayOf(w)}, ${clockStr(w)}.`); }
    case 'speed': { const v = num(a[0], 0.1, 120); if (v == null) return bad(HELP.speed); w.speed = v; return L(`Speed set to ${v}x.`); }
    case 'pause': w.paused = true; return L('World paused.');
    case 'resume': w.paused = false; return L('World running.');
    case 'daylen': { const v = num(a[0], 60, 86400); if (v == null) return bad(HELP.daylen); const f = (w.clock % w.dayLen) / w.dayLen, d = dayOf(w); w.dayLen = Math.round(v); w.clock = (d - 1 + f) * w.dayLen; return L(`A day is now ${w.dayLen} real seconds long (${(w.dayLen / 60).toFixed(1)} minutes).`); }
    case 'weather': { if (!['clear', 'cloud', 'rain', 'auto'].includes(a[0])) return bad(HELP.weather); setWeather(w, a[0]); return L(`Weather: ${a[0]}.`); }
    case 'spawn': {
      if (a[0] === 'mouse') { spawnMouse(w); return L('A mouse appeared.'); }
      if (a[0] === 'treat') { const p = { x: rnd(300, 700), y: rnd(300, 540) }; if (!blocked(w, p.x, p.y)) { w.treats.push({ x: p.x, y: p.y, age: 0 }); note(w, 'A treat appeared in the yard.', 'food'); return L('A treat appeared.'); } return L('Try again.'); }
      if (a[0] === 'item') {
        const type = ITEM_TYPES.includes(a[1]) ? a[1] : undefined, color = COLOR_NAMES.includes(a[2]) ? a[2] : undefined, k = Math.round(num(a[3], 1, 6) || 1); let made = 0;
        for (let i = 0; i < k; i++) if (spawnItem(w, type, color)) made++; return L(`Dropped ${made} item${made === 1 ? '' : 's'} in the yard.`);
      }
      return bad(HELP.spawn);
    }
    case 'feed': w.o.bowl.food = 1; note(w, 'You refilled the food bowl.', 'food'); return L('Bowl refilled.');
    case 'set': {
      if (a[0] === 'joy') { const v = num(a[1], 0, 1); if (v == null) return bad(HELP.set); c.mood.joy = v; return L(`joy = ${v}`); }
      const grp = a[0] === 'trait' ? c.traits : a[0] === 'need' ? c.needs : null, v = num(a[2], 0, 1);
      if (!grp || !(a[1] in grp) || v == null) return bad(HELP.set);
      grp[a[1]] = v; return L(`${a[0]} ${a[1]} = ${v}`);
    }
    case 'tp': {
      const id = (a[0] || '').toLowerCase(); if (!PLACE_LABEL[id] && id !== 'stash') return bad(HELP.tp);
      if (id === 'stash' && !w.stash.site) return L('There is no stash yet.');
      if (id === 'table' && !w.table) return L('There is no table yet.');
      const s = spot(w, id); c.x = s.x; c.y = s.y; c.z = 0; c.hidden = false; done(w); return L(`${c.name} is now at ${PLACE_LABEL[id]}.`);
    }
    case 'want': {
      const sub = a.shift();
      if (sub === 'list') return L(c.wants.length ? c.wants.map((x, i) => `${i + 1}. ${x.text} (${pct(x.strength)})`) : 'No wants right now.');
      if (sub === 'add') { const t = a.join(' ').trim(); if (!t) return bad(HELP.want); c.wants.push({ id: 'w' + Date.now(), kind: 'custom', text: t, strength: 0.8, born: w.clock, day: dayOf(w), progress: 0 }); note(w, `${c.name} has a new want: ${t}.`, 'want'); return L('Want added.'); }
      if (sub === 'done') { const x = c.wants[(+a[0] || 0) - 1]; if (!x) return bad(HELP.want); fulfil(w, x, 'Granted.'); return L('Granted.'); }
      if (sub === 'clear') { c.wants = []; return L('Wants cleared.'); }
      return bad(HELP.want);
    }
    case 'quirk': {
      const q = c.quirk;
      if (a[0] === 'item' && ITEM_TYPES.includes(a[1])) { q.item = a[1]; c.tastes.type[a[1]] = Math.max(c.tastes.type[a[1]], topTastes(w, 'type', 1)[0][1] + 0.15); return L(`${c.name} now collects ${quirkWord(q)}.`); }
      if (a[0] === 'color' && COLOR_NAMES.includes(a[1])) { q.favColor = a[1]; c.tastes.color[a[1]] = Math.min(1, Math.max(c.tastes.color[a[1]], topTastes(w, 'color', 1)[0][1] + 0.15)); return L(`Favourite color: ${a[1]}.`); }
      if (a[0] === 'taste' && TASTES.includes(a[1])) { q.taste = a[1]; q.tasteSince = dayOf(w); layoutStash(w); return L(`The stash is now arranged as ${TASTE_LABEL[a[1]]}.`); }
      return bad(HELP.quirk);
    }
    case 'stash': {
      if (a[0] === 'list') { const cs = stashColors(w); return L(w.stash.items.length ? [`${w.stash.items.length} items at ${w.stash.site ? w.stash.site.label : '?'}`, Object.entries(cs).map(([k, v]) => `${k} x${v}`).join(', ')] : 'The stash is empty.'); }
      if (a[0] === 'steal') { const lost = stealFromStash(w, Math.round(num(a[1], 1, 50) || 1)); return L(lost.length ? `Took ${lost.length}. ${c.name} will notice at the next visit.` : 'The stash is empty.'); }
      if (a[0] === 'add') { const type = a[1], color = a[2]; if (!ITEM_TYPES.includes(type) || !COLOR_NAMES.includes(color)) return bad(HELP.stash); const k = Math.round(num(a[3], 1, 30) || 1); if (!w.stash.site) return L('There is no stash yet. Let the cat start one first.'); for (let i = 0; i < k; i++) w.stash.items.push({ id: Math.random().toString(36).slice(2, 8), type, color, ox: 0, oy: 0, rot: 0 }); w.stash.known = w.stash.items.length; layoutStash(w); return L(`Added ${k}.`); }
      if (a[0] === 'clear') { w.stash.items = []; w.stash.known = 0; return L('Stash emptied.'); }
      return bad(HELP.stash);
    }
    case 'art': {
      if (a[0] === 'level') { const l = Math.round(num(a[1], 1, 12) || 0); if (!l) return bad(HELP.art); c.art.xp = xpForLevel(l); return L(`Painting level ${l}: ${LEVEL_NAMES[l]}.`); }
      if (a[0] === 'paint') { start(w, 'paint'); return L(`${c.name} is heading to the easel.`); }
      if (a[0] === 'clear') { c.art.works = []; c.art.count = 0; c.art.best = 0; c.art.hung = null; w.easel = null; return L('Gallery cleared. Skill level kept.'); }
      return bad(HELP.art);
    }
    case 'think': { const t = a.join(' ').trim(); if (!t) return bad(HELP.think); catSays(w, t); return L('Thought planted.'); }
    case 'name': { const t = a.join(' ').trim().slice(0, 20); if (!t) return bad(HELP.name); c.name = t; return L(`The cat is now called ${t}.`); }
    case 'coat': { if (!COATS.includes(a[0])) return bad(HELP.name); c.coat = a[0]; return L(`Coat: ${a[0]}.`); }
    case 'clear': { if (a[0] === 'log') w.log = []; else if (a[0] === 'journal') w.journal = []; else if (a[0] === 'chat') w.chat = []; else if (a[0] === 'history') { w.hist = []; w.days = {}; } else return bad(HELP.clear); return L(`${a[0]} cleared.`); }
    case 'offer': {
      const sub = (a.shift() || '').toLowerCase();
      if (sub === 'item') { const type = a[0] ? a[0].toLowerCase() : undefined, color = a[1] ? a[1].toLowerCase() : undefined; const r = leaveOffering(w, { kind: 'item', type, color }); return L(r.ok ? `Left ${offerLabel(r.offer)} on the mat.` : r.error); }
      if (sub === 'material') { const r = leaveOffering(w, { kind: 'material', type: (a[0] || '').toLowerCase() }); return L(r.ok ? `Left ${offerLabel(r.offer)} on the mat.` : r.error); }
      if (sub === 'note') { const r = leaveOffering(w, { kind: 'note', text: a.join(' ') }); return L(r.ok ? 'Left a note on the mat.' : r.error); }
      if (sub === 'list') return L(w.offers.length ? w.offers.map(o => `${o.slot + 1}. ${offerLabel(o)} (${o.state})`) : 'The mat is empty.');
      if (sub === 'clear') { if (!ctx.admin) return L('Admin mode is off. Type /admin on first.'); return L(`Cleared ${clearOffers(w)} from the mat.`); }
      return bad(HELP.offer);
    }
    case 'tastes': { const col = topTastes(w, 'color', 4).map(([k, v]) => `${k} ${pct(v)}`).join(', '), ty = topTastes(w, 'type', 4).map(([k, v]) => `${ITEM_LABEL[k]} ${pct(v)}`).join(', '); return L([`colours: ${col}`, `things: ${ty}`, `favourite colour: ${c.quirk.favColor}; collects ${quirkWord(c.quirk)}`]); }
    case 'tablet': {
      const sub = (a[0] || 'status').toLowerCase();
      if (sub === 'go') { ensureTablet(w); c.mem.known.tablet = 1; start(w, 'tablet'); return L(`${c.name} is heading to the tablet.`); }
      if (sub === 'pages') { ensureTablet(w); return L(w.tablet.pages.length ? w.tablet.pages.slice(0, 10).map(p => `Day ${p.day}: ${p.title}`) : 'It has not read anything yet.'); }
      if (sub === 'forget') { ensureTablet(w); w.tablet.pages = []; w.tablet.interests = {}; return L('The tablet history is cleared.'); }
      if (sub === 'status' || sub === 'on' || sub === 'off') return { lines: [], action: { type: 'tablet', args: [sub] } };
      return bad(HELP.tablet);
    }
    case 'give': { const r = leaveOffering(w, { kind: 'material', type: (a[0] || '').toLowerCase() }); return L(r.ok ? `Left ${offerLabel(r.offer)} on the mat.` : r.error); }
    case 'feelings': {
      const t = topFeelings(w, 6);
      return L([`feels good about: ${t.good.map(r => `${r.name} (${r.label}, ${pct(r.score)})`).join(', ') || 'nothing in particular yet'}`, `uneasy about: ${t.bad.map(r => `${r.name} (${r.label})`).join(', ') || 'nothing'}`, 'Tastes are learned from how things made it feel.']);
    }
    case 'inventory': {
      const t = thingsSummary(w);
      return L([`carrying: ${t.mats.join(', ') || 'nothing'} (it can hold ${INV_CAP} of each)`, `table: ${t.table ? 'built, the stash lives on it' : 'not built yet'}`, `made so far: ${t.crafted.length ? t.crafted.slice(0, 6).map(x => x.name).join(', ') : 'nothing'}`]);
    }
    case 'recipes': return L(thingsSummary(w).recipes.map(r => `${r.name}: ${r.known ? 'knows how' : 'has to look it up on the tablet'} - needs ${r.cost}${r.made ? ` (made ${r.made})` : ''}`));
    case 'wishes': { const ws = c.wishes.filter(x => x.state !== 'draft'); return L(ws.length ? ws.slice(0, 10).map(x => `day ${x.day} [${x.state}] ${wishLabel(x)}: "${x.text}"`) : 'It has not left any notes yet.'); }
    case 'wish': {
      if (a[0] === 'clear') { c.wishes = []; return L('Wishes cleared.'); }
      if (a[0] === 'add') {
        const type = (a[1] || '').toLowerCase(), color = (a[2] || '').toLowerCase();
        if (!ITEM_TYPES.includes(type) || (color && !COLOR_NAMES.includes(color))) return bad(HELP.wish);
        const x = { id: 'wx' + Date.now(), state: 'draft', day: dayOf(w), seen: false, kind: 'item', type, color: color || null, why: 'favourite', text: `I would like ${color ? color + ' ' : ''}${ITEM_LABEL[type]}, please.` };
        c.wishes.unshift(x); c.lastWishAt = w.clock; return L('A wish is drafted. The cat will write it up at the tablet.');
      }
      return bad(HELP.wish);
    }
    case 'craft': {
      const sub = (a.shift() || '').toLowerCase();
      if (sub === 'give') { const m = (a[0] || '').toLowerCase(); if (!MATERIALS.includes(m)) return bad(HELP.craft); const k = Math.round(num(a[1], 1, INV_CAP) || 1); c.inv[m] = Math.min(INV_CAP, c.inv[m] + k); return L(`${c.name} now has ${matText(m, c.inv[m])}.`); }
      if (sub === 'learn') { const id = (a[0] || '').toLowerCase(); if (!RECIPES[id]) return bad(HELP.craft); return L(unlockRecipe(w, id, '', 'itself') ? `${c.name} now knows how to make a ${RECIPES[id].name}.` : 'It already knew.'); }
      if (sub === 'now' || sub === 'table') {
        const id = sub === 'table' ? 'table' : (a[0] || '').toLowerCase(); if (!RECIPES[id]) return bad(HELP.craft);
        for (const [m, n] of Object.entries(RECIPES[id].cost)) c.inv[m] = Math.max(c.inv[m], n);
        if (!knows(w, id)) unlockRecipe(w, id, '', 'itself');
        if (!startable(w, id)) return L('That cannot be made right now (it may already exist).');
        c.mem.known.tree = 1; start(w, 'craft', { recipe: id }); return L(`${c.name} is heading to the workbench to make a ${RECIPES[id].name}.`);
      }
      return bad(HELP.craft);
    }
    case 'history': case 'export': {
      if (cmd === 'export') return { lines: ['Writing the story out...'], action: { type: 'export' } };
      const sub = (a[0] || '').toLowerCase(), fmt = e => `d${e.day} ${e.time} ${e.k === 'did' ? '·' : e.k === 'thought' ? '"' : e.k === 'diary' ? '*' : e.k === 'chat' ? '>' : '-'} ${e.text}`;
      if (sub === 'day') { const d = Math.round(num(a[1], 1, 99999) || dayOf(w)), s = daySummary(w, d); if (!s) return L(`No summary kept for day ${d}.`); return L([`Day ${d}: ${spentText(s, 5)}`].concat(s.events.map(e => `  ${e.time} ${e.text}`))); }
      if (sub === 'days') return L(daysList(w).slice(0, 10).map(d => `Day ${d}: ${spentText(daySummary(w, d), 3)}`));
      if (sub === 'find') { const q = a.slice(1).join(' '); if (!q) return bad(HELP.history); const r = timeline(w, { q, limit: 15 }); return L(r.length ? r.map(fmt) : `Nothing about "${q}".`); }
      const kind = KINDS[sub] ? sub : null, n = Math.round(num(kind ? a[1] : a[0], 1, 60) || 15), r = timeline(w, { kinds: kind ? [kind] : null, limit: n });
      return L(r.length ? r.reverse().map(fmt) : 'Nothing recorded yet.');
    }
    case 'brain': return { lines: [], action: { type: 'brain', args: a } };
    case 'save': return { lines: ['Saving...'], action: { type: 'save', slot: a[0] || 'main' } };
    case 'load': return { lines: ['Loading...'], action: { type: 'load', slot: a[0] || 'main' } };
    case 'saves': return { lines: [], action: { type: 'saves' } };
    case 'reset': return a[0] === 'confirm' ? { lines: ['Starting over with a new cat.'], action: { type: 'reset' } } : L('This deletes the current cat. Type "reset confirm" to do it.');
  }
  return L(`Unknown command "${cmd}". Type help.`);
}
const pct = v => Math.round(v * 100) + '%';
