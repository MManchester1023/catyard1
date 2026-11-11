// Offline voice: thoughts and chat replies built from what the cat actually knows and wants.
import { pick, clamp, an, ITEM_LABEL, ITEM_PLURAL } from './util.js';
import { hourOf, isNight, moonPhase, dayOf } from './world.js';
import { LEVEL_NAMES, levelOf, subjectLabel } from './art.js';
import { stashColors } from './quirk.js';
import { MYSTERY_INFO } from './mysteries.js';

const fmt = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => (v[k] != null ? v[k] : ''));
const vars = w => {
  const c = w.cat, q = c.quirk, n = w.stash.items.length, a = c.art;
  const top = Object.entries(stashColors(w)).sort((x, y) => y[1] - x[1])[0];
  return { item: ITEM_LABEL[q.item], items: ITEM_PLURAL[q.item], fav: q.favColor, n, name: c.name, level: LEVEL_NAMES[levelOf(a.xp)], top: top ? top[0] : q.favColor, best: Math.round(a.best * 100), human: 'the human' };
};

const T = {
  eat: ['Crunch. Crunch. Yes.', 'This is the good stuff.', 'Nobody look at me.', 'Food first. Philosophy later.'],
  treat: ['A treat! For me?', 'Free fish. I will not ask questions.'],
  prey: ['Hard work pays off.', 'Mine. All mine.'],
  drink: ['Cool and wet. Fine.', 'Water: a solved problem.'],
  sleep: ['Five more minutes.', 'Warm. Safe. Gone.', 'Zzz...'],
  groom: ['Must look perfect.', 'Dignity restored.', 'Behind the ear, again.'],
  yarn: ['It moved. It must pay.', 'Got you, little red menace.'],
  fly: ['Wings! Wings! Wings!', 'It is mocking me.'],
  post: ['Scritch scritch. Hello, claws.', 'This post owes me nothing.'],
  stalk: ["Don't move... don't breathe...", 'Locked on.', 'Slow. Slow. Slow.'],
  pounce: ['NOW!'],
  explore: ['What is over there?', 'New smell. Must investigate.', 'I wonder what is behind that.'],
  idle: ['Just vibing.', 'Observing the yard.', 'Tail check. Still attached.'],
  perch: ['Highest cat in the yard.', 'Bird TV is on.'],
  beg: ['The bowl is empty. A crisis.', 'Where is the human?'],
  shelter: ['Wet. Why is it wet.', 'Absolutely not going out there.'],
  zoom: ['THE ZOOMIES HAVE ME!', 'Cannot stop. Do not ask.'],
  gift: ['A gift for the humans.', 'I provide.'],
  miss: ['That one was fast.', 'I meant to do that.'],
  collect: ['{Aitem}! Mine.', 'Is that {aitem}? It is. It is.', 'Oh, you beautiful little thing.', 'I need it. I do not know why. I need it.'],
  carry: ['Careful... careful...', 'Almost home, little treasure.'],
  stash: ['Another one for the collection.', '{n} now. Is that enough? No.', 'The {top} ones go together. I think.', 'Nobody knows about this place but me.'],
  tidy: ['A little to the left.', 'Better. Almost right.', 'Order is a kind of love.'],
  count: ['One, two, three... still all here.', 'Checking. Always checking.'],
  paint: ['What does {subject} feel like in paint?', 'Left paw for color, right paw for doubt.', 'The canvas is waiting.', 'Do not rush it.'],
  gaze: ['It is so far away. How does it stay up?', 'Is it watching me back?', 'Still there. Good.'],
  ripples: ['Something moved down there.', 'The pond knows something.'],
  sparks: ['Little lights. Hold still...', 'If I am quick enough...'],
  glass: ['Hello? Is anyone out there?', 'I can see you, you know.', 'The big face is back. Probably.'],
  wantDone: ['I wanted that. And now I have it.', 'That is one thing off the list.'],
  level: ['My paws know more than they did yesterday.', 'Something shifted in how I see.'],
  theft: ['Someone took from me. I will remember.'],
  noStash: ['I could be collecting something. I should be collecting something.'],
  offerGo: ['Something new on the mat.', 'Someone was here. They left something.', 'What is that by the glass?'],
  tabletGo: ['What does the slab know today?', 'Time to see what the humans are saying.', 'The slab is calling.'],
  tree: ['The oak has been here longer than me. It can spare some.', 'Scritch. Scritch. Anything in there?'],
  bark: ['A piece came off. A gift from the oak.', 'Bark! Useful bark.', 'I did not know trees gave things back.'],
  craftGo: ['I have enough. Time to make something.', 'Paws are for making, not just scratching.', 'To the workbench.'],
  craftDone: ['I made that. Me. With paws.', 'It looks better than I expected.', 'Good. Now what else can I make?'],
  tableDone: ['A table. My things can be seen now.', 'No more hiding. A proper place for the collection.', 'I made a table. I am a cat who makes tables.'],
  wishWrite: ['I will leave the human a note. Politely.', 'Typing with one paw. This will take a while.'],
  wishGranted: ['The human listened. I did not expect that.', 'It came. I asked and it came.'],
  learned: ['Now I know how. That is better than having.', 'The slab explained it. I owe the slab.'],
};
const WONDER = {
  wantA: w => { const x = w.cat.wants[0]; return x ? pick([`I really should ${x.text}.`, `Still want to ${x.text}.`, `Today might be the day I ${x.text}.`]) : null; },
  theory: w => { const ms = Object.entries(w.mysteries).filter(([, m]) => m.theory && !m.solved); if (!ms.length) return null; const [id, m] = pick(ms); return `${MYSTERY_INFO[id].name[0].toUpperCase() + MYSTERY_INFO[id].name.slice(1)}... ${m.theory}`; },
  quirk: w => (w.stash.items.length ? pick(['Do I have enough {items}? No. Never enough.', 'The {fav} ones are the best. I will not hear otherwise.', 'I wonder what the stash is doing right now.']) : pick(['A cat should own something small and perfect.', 'I wonder if the {item} is out there today.'])),
  art: w => (w.cat.art.count ? pick(['My last painting was almost good.', 'I am a {level}. That is not nothing.', 'Next canvas, I will try something braver.']) : 'My paws feel like they want to make something.'),
  night: w => (isNight(w) ? pick(['The yard is different at night. Bigger.', 'Everything smells louder in the dark.']) : null),
};

export function thoughtFor(w, kind, extra = {}) {
  const v = Object.assign(vars(w), extra), c = w.cat;
  if (kind === 'idle' || kind === 'explore') {
    const r = Math.random();
    if (r < 0.55) { const f = pick([WONDER.wantA, WONDER.theory, WONDER.quirk, WONDER.art, WONDER.night]); const s = f(w); if (s) return fmt(s, v); }
    const fam = Object.entries(c.words).filter(([, n]) => n >= 3).map(([k]) => k);
    if (fam.length && r < 0.7) return `"${pick(fam)}"... the human keeps saying that.`;
  }
  const bank = T[kind] || T.idle;
  return fmt(pick(bank), v);
}

// ---------- chat ----------
const STOP = new Set('the a an and or but is are was be to of in on at it you i me my we this that for with so do does did not no yes your what how why who when where can will just'.split(' '));
export function learnWords(w, text) {
  for (const t of text.toLowerCase().match(/[a-z']{3,14}/g) || []) if (!STOP.has(t)) w.cat.words[t] = (w.cat.words[t] || 0) + 1;
  const keys = Object.keys(w.cat.words); if (keys.length > 200) { keys.sort((a, b) => w.cat.words[a] - w.cat.words[b]).slice(0, 80).forEach(k => delete w.cat.words[k]); }
}

export function offlineReply(w, text) {
  const t = text.toLowerCase(), c = w.cat, v = vars(w), n = c.needs;
  const has = re => re.test(t), greet = has(/\b(hi|hello|hey|yo|howdy)\b/);
  let body = null;
  if (has(/good (cat|kitty|girl|boy)|cute|pretty|love you|best cat|sweet/)) { body = pick(['*purrs loudly* I know.', 'I accept this praise.', '*headbutts the glass*']); c.mood.joy = clamp(c.mood.joy + 0.2); c.bond = clamp(c.bond + 0.02); }
  else if (has(/your name|who are you|what are you called/)) body = `I am ${c.name}. I live here. I am also a ${v.level}.`;
  else if (has(/how are you|how do you feel|you ok|you okay/)) body = n.hunger > 0.7 ? 'Hungry. Terribly, tragically hungry.' : n.tired > 0.75 ? 'So sleepy. Talk quieter.' : n.fun > 0.7 ? 'Bored. Entertain me.' : c.mood.joy > 0.6 ? 'Good. Very good. Something is going right.' : 'Fine. Thinking about things.';
  else if (has(/stash|collect|treasure|hoard|bottle ?cap|feather|button|marble/)) body = w.stash.items.length ? `I have ${v.n}. The ${v.top} ones are my favourite. I keep them ${w.stash.site ? w.stash.site.label : 'somewhere safe'}. Do not tell anyone.` : `I do not have a stash yet. I am looking for ${an('' + v.fav + ' ' + v.item)}.`;
  else if (has(/paint|art|canvas|draw|picture|gallery/)) body = c.art.count ? `I have made ${c.art.count} painting${c.art.count === 1 ? '' : 's'}. My best was ${v.best} out of 100. I am a ${v.level}.` : 'I have not painted yet. The paint is looking at me.';
  else if (has(/moon|stars?|night sky/)) body = w.mysteries.moon.theory || 'The moon is up there. I am working on it.';
  else if (has(/table|bark|craft|make|build|workbench|oak|tree/)) body = w.table ? `I made the bark table myself. My things live on it now.${c.crafted.length > 1 ? ` I have made ${c.crafted.length} things so far.` : ''}` : (c.inv.bark ? `I have ${c.inv.bark} bark. Soon I will make a table.` : 'I scratch the oak for bark. One day it will be a table.');
  else if (has(/wish|want|need|please|give|notes?/) && (c.wishes || []).some(x => x.state === 'open')) { const o = c.wishes.find(x => x.state === 'open'); body = `I left you a note on the tablet. ${o.text}`; }
  else if (has(/pond|frog|fish|water/)) body = w.mysteries.ripples.theory || 'The pond is quiet. Too quiet.';
  else if (has(/firefl|spark|bug|glow/)) body = w.mysteries.sparks.theory || 'Little lights. Over the flowers. Ask me later.';
  else if (has(/treat|food|hungry|eat|snack/)) body = n.hunger > 0.5 ? 'Yes. Food. Say more.' : 'I could eat. I can always eat.';
  else if (has(/\bwant|wish|goal|dream/)) body = c.wants.length ? `I want to ${c.wants[0].text}.` : 'Nothing right now. That is strange.';
  else if (has(/bye|goodnight|good night|see you|gotta go/)) body = pick(['Go. I will be here. I am always here.', '*slow blink* Come back.']);
  else if (has(/thank/)) body = 'You are welcome. I did nothing, but you are welcome.';
  if (!body) return greet ? pick(['*blinks slowly* Hello.', 'Oh. You. Hello.', '*chirrups* You came back.']) : has(/\?/) ? pick(['Hm. I will think about it. Later.', 'I do not know. Ask the moon.', '*tilts head* I understand about half of that.']) : pick(['*tilts head*', 'Mrrp.', '*stares, ears twitching*', 'I am listening. Mostly.']);
  return greet ? pick(['Hello.', 'Oh. You.']) + ' ' + body : body;
}
