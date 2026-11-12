// The README quotes numbers and names from the code. This checks each one against the constant it comes from, so a
// change to the game that is not written up fails here instead of drifting.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PACE } from '../src/sim/pace.js';
import { SHOP, MAT_CAP } from '../src/sim/util.js';
import { RECIPES, FOR_SALE_MAX } from '../src/sim/recipes.js';
import { MAX_ON_MAT, NOTE_MAX, KEEPSAKES_MAX } from '../src/sim/offerings.js';
import { HIST_MAX, DAYS_MAX, JOURNAL_MAX } from '../src/sim/world.js';
import { MEM_CAP } from '../src/sim/memory.js';
import { MAX_FAVS } from '../src/sim/finds.js';
import { INTEREST_PAGES, TOPIC_NAMES } from '../src/sim/interest.js';
import { SEEN_MAX, QUIRK_QUERIES } from '../src/sim/tablet.js';
import { CLAUDE_PER_DAY } from '../src/sim/intent.js';
import { GOALS_PER_DAY } from '../src/sim/wants.js';
import { MAX_PROJECTS, PROJECTS_PER_DAY } from '../src/sim/project.js';
import { SUBJECTS_PER_DAY } from '../src/sim/art.js';
import { DEFAULTS } from '../src/sim/llm.js';
import { TABLET_DEFAULTS } from '../src/sim/web.js';
import { WISH_LIFE_DAYS } from '../src/sim/wishes.js';
import { MAX_AWAY_SECONDS } from '../src/sim/save.js';
import { makeWorld } from '../src/sim/sim.js';
import { seedTests } from '../src/sim/rng.js';

seedTests(1);
const README = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
let n = 0;
const says = (text, why) => { assert.ok(README.includes(text), `README should say “${text}” (${why})`); n++; };
const money = v => '$' + v;
const comma = v => v.toLocaleString('en-US');

// the clock
const w = makeWorld();
says(`A day lasts ${w.dayLen / 60} real minutes`, 'day length');
says(`(default ${w.dayLen})`, 'the daylen command default');

// what it keeps
says(`The diary only holds the last ${JOURNAL_MAX} lines`, 'JOURNAL_MAX');
says(`up to ${MEM_CAP} memories that matter`, 'MEM_CAP');
says(`Up to ${['zero', 'one', 'two', 'three'][MAX_FAVS]} activities`, 'MAX_FAVS');
says(`reads up to ${INTEREST_PAGES} Wikipedia pages`, 'INTEREST_PAGES');
says(`about ${Math.round(TOPIC_NAMES.length / 10) * 10} on the list`, 'number of special-interest subjects');
says(`The last ${comma(HIST_MAX)} entries are kept`, 'HIST_MAX');
says(`the last ${DAYS_MAX} days`, 'DAYS_MAX');
says(`(the last ${['', '', '', '', '', '', 'six'][KEEPSAKES_MAX]} are shown)`, 'KEEPSAKES_MAX');
says(`(the last ${SEEN_MAX})`, 'SEEN_MAX, the titles the tablet remembers');
const queries = Object.values(QUIRK_QUERIES).map(q => q.length), lo = Math.min(...queries), hi = Math.max(...queries);
says(`Each quirk has ${lo} or ${hi} searches of its own`, 'QUIRK_QUERIES sizes');

// making things
says(`It can carry ${MAT_CAP} of each`, 'MAT_CAP');
says(`Only ${['', '', '', 'three'][FOR_SALE_MAX]} framed paintings are out for sale at a time`, 'FOR_SALE_MAX');
const parts = c => Object.entries(c).map(([k, v]) => `${v} ${({ frame: v === 1 ? 'oak frame' : 'oak frames', bark: 'bark', twig: v === 1 ? 'twig' : 'twigs', twine: 'twine' })[k]}`);
const order = c => { const o = ['frame', 'bark', 'twig', 'twine']; return Object.fromEntries(o.filter(k => c[k]).map(k => [k, c[k]])); };
for (const id of ['frame', 'easel', 'table', 'feeder', 'chime', 'cattree']) {
  const r = RECIPES[id]; if (!r) continue;
  const row = id === 'frame' ? `| Oak frame | ${parts(order(r.cost)).join(', ')} |` : `| ${r.name[0].toUpperCase() + r.name.slice(1)} | ${parts(order(r.cost)).join(', ')} |`;
  says(row, `recipe cost of ${id}`);
}
says(`at most ${['', '', 'two'][PACE.barkPerDay]} pieces a day`, 'PACE.barkPerDay');
says(`the oak gives at most ${['', '', '', '', '', '', '', '', 'eight'][PACE.shakePerDay]} pieces a day`, 'PACE.shakePerDay');
says(`(${Math.round(PACE.shakeChance * 100)}%)`, 'PACE.shakeChance');
says(`within about ${PACE.discoverRadius} px`, 'PACE.discoverRadius');
says(`only ${['', '', '', 'three'][PACE.placesPerDay]} new places sink in per day`, 'PACE.placesPerDay');
says(`from about ${PACE.oakSight} times as far`, 'PACE.oakSight');
says(`| Working out a recipe without the tablet | ${PACE.selfTaughtDays} days |`, 'PACE.selfTaughtDays');
says(`about ${PACE.frogForMoon === 9 ? 'nine' : PACE.frogForMoon} visits`, 'PACE.frogForMoon');
says(`understanding it needs ${PACE.moonPhases} different moon phases`, 'PACE.moonPhases');
says(`At least ${PACE.starsNights} clear nights of gazing`, 'PACE.starsNights');
says(`a wish at most every ${PACE.starWishGap} days`, 'PACE.starWishGap');
says(`at most once every ${['', '', '', '', '', 'five'][PACE.starWishGap]} days`, 'PACE.starWishGap in Secrets');

// money
says(`on average every ${PACE.saleDays} days`, 'PACE.saleDays');
says(`for ${money(PACE.priceBase)} plus up to ${money(PACE.priceScore)}`, 'PACE.priceBase and priceScore');
for (const s of SHOP) {
  const label = { bark: 'Bark', twig: 'Twigs', twine: 'Twine', ball: 'A ball', toymouse: 'A toy mouse', catnip: 'A sprig of catnip', tuna: 'A tin of tuna' }[s.id];
  says(`| ${label} | ${money(s.price)}${s.kind === 'material' ? ' each' : ''} |`, `shop price of ${s.id}`);
}
says(`An order takes about ${PACE.orderDays === 0.3 ? 'a third' : PACE.orderDays} of a day`, 'PACE.orderDays');

// the mat and the notes
says(`holds ${['', '', '', 'three'][MAX_ON_MAT]} things at once`, 'MAX_ON_MAT');
says(`up to ${NOTE_MAX} characters`, 'NOTE_MAX');
says(`Unanswered notes fade after ${['', '', '', '', '', 'five'][WISH_LIFE_DAYS]} days`, 'WISH_LIFE_DAYS');

// Claude
says(`The default is \`${DEFAULTS.model}\``, 'default model');
says(`(${DEFAULTS.dailyCap} calls by default)`, 'daily cap');
says(`(\`museEvery\`, ${DEFAULTS.museEvery} seconds)`, 'museEvery');
says(`one every ${DEFAULTS.museEvery / 60} minutes`, 'museEvery in minutes');
says(`(up to ${CLAUDE_PER_DAY} times a day): the next thing it wants to do`, 'intent asks per day');
says(`(up to ${GOALS_PER_DAY} questions a day)`, 'goal asks per day');
says(`(up to ${PROJECTS_PER_DAY} a day, at most ${MAX_PROJECTS} at once)`, 'projects');
says(`**What it paints** (up to ${SUBJECTS_PER_DAY} a day)`, 'subject asks per day');

// the tablet
says(`capped at ${TABLET_DEFAULTS.dailyCap} a day by default`, 'tablet daily cap');
says(`catches up on up to ${MAX_AWAY_SECONDS / 3600} hours`, 'away catch-up');

// the screen: every tab named in the README exists in the page
const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
for (const t of ['Chat', 'Cat', 'Crafting', 'Treasure', 'Blog', 'Tablet', 'Settings']) { assert.ok(html.includes(`>${t}</button>`), `the page has a ${t} tab`); says(`| **${t}** |`, `${t} row in the table of tabs`); }
for (const gone of ['Outside', 'Stash tab']) assert.ok(!README.includes(gone), `the README no longer mentions the old name “${gone}”`);

console.log(`  ok ${n} README facts match the code`);
