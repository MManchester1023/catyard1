// The blog. Once it has found the tablet and has had a few days of life to write about, the cat starts a blog. A post is
// put together from what has happened since the last one (its diary), how it feels, what is on its mind and what it
// wants, in the voice of its quirk. It is drafted away from the tablet and typed out the next time the cat sits down at
// it (tablet.js), like a note to the human. With the Claude API on, llm.js rewrites the post in the cat's own words.
import { pick, clamp, uid } from './util.js';
import { note, journal, dayOf, clockStr } from './world.js';
import { scaled } from './pace.js';
import { feel } from './feelings.js';
import { coinActive } from './secrets.js';
import { isUpset, upsetVoice, upsetAbout } from './upset.js';
import { recall, touch, when, regularLine } from './memory.js';

export const POSTS_MAX = 80;
export function ensureBlog(w) {
  if (!w.blog) w.blog = {};
  const b = w.blog; if (!Array.isArray(b.posts)) b.posts = []; if (b.title === undefined) b.title = ''; if (b.started === undefined) b.started = null;
  if (b.draft === undefined) b.draft = null; if (typeof b.lastAt !== 'number') b.lastAt = -999; if (typeof b.seenId !== 'number') b.seenId = 0;
  return w;
}
export const blogStarted = w => !!(w.blog && w.blog.started);
export const blogPending = w => !!(w.cat.mem.known.tablet && w.blog && w.blog.draft);
export const unreadPosts = w => (w.blog ? w.blog.posts.filter(p => !p.read).length : 0);

// ---------- what to write about ----------
const SKIP_TAGS = new Set(['blog', 'want', 'start']);
// how much a diary line is worth writing about
const TAG_W = { upset: 3, solved: 3, level: 2.5, discover: 2.5, moonwish: 2.5, starwish: 2.5, stars: 1.8, art: 2.2, craft: 2.2, wish: 2, frog: 2, hunt: 2, offering: 1.8, mystery: 1.5, stash: 1.5, tablet: 1.5, taste: 1.3, favourite: 2.2, interest: 2.4, habit: 2, change: 2.4, mood: 1.2, impulse: 1.4, theory: 1.2, muse: 0.3 };
const wt = e => (TAG_W[e.tag] == null ? 1 : TAG_W[e.tag]);
const material = w => w.journal.filter(e => e.id > w.blog.seenId && !SKIP_TAGS.has(e.tag));
const clip = (s, n = 210) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s);

function chooseEntries(list, n) {
  const pool = list.map(e => ({ e, k: wt(e) })), out = [];
  while (out.length < n && pool.length) {
    let r = Math.random() * pool.reduce((s, x) => s + x.k, 0), i = 0;
    for (; i < pool.length - 1; i++) { r -= pool[i].k; if (r <= 0) break; }
    out.push(pool.splice(i, 1)[0].e);
  }
  return out.sort((a, b) => a.id - b.id);
}

const TITLES = {
  collector: ['The Cabinet of Curiosities', 'Small Treasures, Carefully Kept'], vangogh: ['Letters From the Easel', 'Paint Under My Claws'], hunter: ['Notes From the Tall Grass', 'Quiet Report'],
  nightowl: ['The Night Shift', 'Awake, Again'], techie: ['paw.log', 'Tablet Diaries'], garfield: ['Lasagna Mondays', 'The Cushion Chronicles'], builder: ['Under Construction', 'Bark and Twig Weekly'],
  default: ['Notes From the Yard', 'The Yard, Considered', 'A Cat Writes'],
};
const HEAD = {
  upset: ['A Grievance, For the Record', 'Not Happy. Putting It in Writing'], craft: ['Things I Made With My Own Paws', 'Under Construction'], art: ['New Work, Fresh Paint', 'Gallery Notes'], level: ['Something Clicked', 'A Small Promotion'],
  wish: ['Notes to the Human', 'A Polite Request, Published'], hunt: ['The Hunt, Reviewed', 'Field Notes'], tablet: ['What the Glowing Slab Told Me', 'Reading List'], frog: ['A Friend in the Pond', 'Pond Business'],
  moonwish: ['I Asked the Moon', 'A Wish, Under the Moon'], starwish: ['I Asked a Falling Star', 'A Wish, Made Quickly'], stars: ['Notes on Looking Up', 'The Sky, Counted (Badly)'], offering: ['Things Left on the Mat', 'Gifts, Ranked'], stash: ['Collection Update', 'Stash Matters'], taste: ['Things I Like (Revised)', 'Matters of Taste'],
  favourite: ['My Favourite Thing', 'A Confession About Taste'], interest: ['A Deep Dive, Briefly', 'What I Have Been Reading'], habit: ['Rituals, Observed', 'The Same Time Every Day'], change: ['I Am Not Who I Was', 'Slowly Becoming Someone'], mood: ['A Mood, Disclosed', 'Weather Inside'], impulse: ['I Had a Notion', 'Not Up for Discussion'], theory: ['Working Things Out', 'Theory Corner'], solved: ['I Worked It Out', 'Mystery Closed'], discover: ['A Discovery, Somewhat Dignified', 'New Things in the Yard'], mystery: ['Working Things Out', 'Odd Things'],
  default: ['Notes From the Yard', 'Another Day in the Yard', 'What Happened, Mostly'],
};
const VOICE = {
  collector: { open: ['Inventory first, feelings second.', 'Another day, another small treasure situation.', 'Written next to the stash, in case anything needs guarding.'], close: ['Everything is accounted for. Mostly.', 'If you see a button, you know where to leave it.', 'More when the collection allows.'] },
  vangogh: { open: ['The light has been doing remarkable things.', 'I painted. Or I felt. It is the same pawstroke.', 'Writing this with paint still on me.'], close: ['The sky and I are still talking.', 'May the colours be loud tomorrow too.', 'Yours, covered in cobalt.'] },
  hunter: { open: ['Quiet report from the tall grass.', 'Observations, kept short, in case something is listening.', 'Written low and still.'], close: ['Something moved. I am going to go and have an opinion about it.', 'Patience, as always. Out.', 'Tomorrow the birds learn nothing.'] },
  nightowl: { open: ['Posted from the small hours.', 'Most of this happened while you were asleep.', 'The moon has no deadlines. Neither do I.'], close: ['Good morning, if that is when you are reading this.', 'Back to the dark. It is very thorough.', 'The night shift continues.'] },
  techie: { open: ['Logging in. Post #N.', 'Filed from the tablet. Latency: acceptable.', 'Tried turning myself off and on again. It did not help.'], close: ['Please like and subscribe. Reader count: unknown.', 'End of log.', 'Feedback welcome via the mat.'] },
  garfield: { open: ['Written from the cushion, naturally.', 'Hungry, so this will be brief.', 'Nothing good happens before lunch, but here is what happened.'], close: ['Now, about dinner.', 'Wake me when the bowl is full.', 'This post was sponsored by a nap.'] },
  builder: { open: ['Site report.', 'Can I fix it? Possibly. Anyway.', 'Written on a break from building.'], close: ['Yes, I can. Eventually.', 'The next thing is already half planned.', 'Hard hat optional. Claws required.'] },
  default: { open: ['Here is what the yard has been up to.', 'Another entry. The glowing slab is very patient.', 'I have been meaning to write this down.'], close: ['That is all for now.', 'More soon, if anything happens.', 'The yard keeps going. So do I.'] },
};
const voiceOf = c => VOICE[c.temper] || VOICE.default;

// how it feels right now, as a label and a sentence
export function feelingNow(w) {
  const c = w.cat, n = c.needs, m = c.mood;
  if (isUpset(w)) return { label: 'upset', text: upsetVoice(w) };
  if (coinActive(w)) return { label: 'over the moon', text: 'I have a shiny coin and nothing can touch me. Please do not tell the crows.' };
  if (n.hunger > 0.7) return { label: 'hungry', text: 'Hungry in a way that is affecting my writing.' };
  if (n.tired > 0.75) return { label: 'sleepy', text: 'So tired that the words keep sliding off the tablet.' };
  if (n.lonely > 0.65) return { label: 'lonely', text: 'A bit lonely, if I am honest. Writing this down is partly so someone will read it.' };
  if (n.fear > 0.5) return { label: 'uneasy', text: 'Uneasy. Something in the yard is not right and I cannot say what.' };
  if (n.fun > 0.7) return { label: 'bored', text: 'Bored. Properly bored. Please let something happen.' };
  if (m.joy > 0.7) return { label: 'happy', text: 'Happy. Properly happy, the kind that makes my tail do things.' };
  if (m.joy > 0.5) return { label: 'content', text: 'Content. The yard is good and I am in it.' };
  return { label: 'calm', text: 'Calm. Nothing is wrong. That is its own kind of news.' };
}
// the same feelings as something a cat might say in passing
const FEEL_LINES = {
  'over the moon': ['I am writing this with a shiny coin nearby and I cannot stop smiling. Please do not tell the crows.', 'Nothing can touch me today. I have a coin.'],
  hungry: ['I am hungry as I write this, so forgive me if it wanders.', 'My stomach has opinions about this post. Loud ones.', 'I would write more, but the bowl is calling.'],
  sleepy: ['I am so tired that the words keep sliding off the tablet.', 'Forgive any mistakes. I am writing this half asleep.', 'I could curl up on this tablet and sleep.'],
  lonely: ['It is a bit quiet today, if I am honest. Writing this down is partly so someone will read it.', 'I miss having someone to talk to. Hello, whoever is reading.'],
  uneasy: ['Something in the yard feels off today and I cannot say what.', 'I keep looking over my shoulder, though there is nothing there.'],
  bored: ['Honestly, I am bored. Please let something happen.', 'It has been a slow stretch and I am climbing the walls.'],
  happy: ['I am in a wonderful mood as I write this, the kind that makes my tail do things.', 'Today has been good to me.', 'I feel properly happy right now.'],
  content: ['I feel content. The yard is good and I am in it.', 'Nothing to complain about today, which is its own kind of luck.'],
  calm: ['Things are calm. Nothing is wrong, and that is news in itself.', 'It is a quiet, easy sort of day.'],
};
const feelLine = (w, fl) => {
  if (fl.label === 'upset') { const ab = upsetAbout(w); return ab ? pick([`I should say that I am still upset about ${ab}.`, `Not everything is fine, though: I am upset about ${ab}.`]) : fl.text; }
  return FEEL_LINES[fl.label] ? pick(FEEL_LINES[fl.label]) : fl.text;
};
const topWant = w => { const x = w.cat.wants.slice().sort((a, b) => (b.strength || 0) - (a.strength || 0))[0]; return x ? x.text.replace(/\s*\([^)]*\)/g, '') : null; };

// the blog's name is a quirk of the cat that chose it
export const pickBlogTitle = w => pick(TITLES[w.cat.temper] || TITLES.default);

// ---------- putting it into words ----------
// a diary line starts with "I" or with a plain word, so it can follow "this morning," once the first letter is lowered
const SOFT = /^(The|A|An|Someone|Somebody|Nobody|Nothing|Something|There|It|My|This|That|Two|Three|Four|Five|Today|Behind|Under|Out)\b/;
const lowerFirst = s => (SOFT.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
const sentencesOf = t => (String(t).match(/[^.!?]+[.!?]+["”')]*|[^.!?]+$/g) || [String(t)]).map(x => x.trim()).filter(Boolean);
// as much of it as fits, finishing the sentence it is on (nothing is ever cut off in the middle)
function trim(t, max = 230) {
  const out = []; let n = 0;
  for (const s of sentencesOf(t)) { if (out.length && n + s.length > max) break; out.push(s); n += s.length + 1; if (n >= max) break; }
  return out.join(' ');
}
const hourNum = e => parseInt(String(e.time || '12').slice(0, 2), 10) || 12;
function whenWords(w, e) {
  const d = dayOf(w) - e.day, h = hourNum(e);
  if (d <= 0) return h < 5 ? 'In the small hours' : h < 12 ? 'This morning' : h < 17 ? 'This afternoon' : h < 21 ? 'This evening' : 'Late last night';
  return d === 1 ? 'Yesterday' : d < 5 ? `${d} days ago` : 'A while back';
}
const LINK = [['Then ', 'After that, ', 'Later on, '], ['And then ', 'Not long after, ', 'Most recently, ']];
// the diary lines it chose, told as a story: a time, a few linking words, whole sentences
function story(w, items) {
  const parts = items.map((e, i) => {
    const text = trim(e.text), mine = /^I\b/.test(text); // (only a line the cat tells about itself takes a time or a "then" in front)
    if (i === 0) return mine ? `${whenWords(w, e)}, ${text}` : text;
    return mine ? `${pick(LINK[Math.min(i, LINK.length) - 1])}${text}` : text;
  });
  return parts.join(' ');
}
const THOUGHT_LEAD = ['One thought I cannot shake:', 'Something I keep thinking:', 'I caught myself thinking,'];
const WANT_LINES = x => [`I would really like to ${x}.`, `Next on my list: I want to ${x}.`, `If I could have one thing this week, it would be to ${x}.`, `What I am hoping for is simple: to ${x}.`];
const LOOK_BACK = ['I keep coming back to it.', 'It has stayed with me.', 'I have been thinking about it since.'];

// put a post together from what has happened since the last one: a story, a look back, how it feels, and what it hopes for
export function composePost(w) {
  const c = w.cat, b = w.blog, first = !b.started, v = voiceOf(c);
  if (first && !b.title) b.title = pickBlogTitle(w);
  const items = chooseEntries(material(w), 3), fl = feelingNow(w), want = topWant(w);
  const top = items.slice().sort((a, z) => wt(z) - wt(a))[0];
  const title = first ? 'Hello, Yard' : pick(HEAD[top && HEAD[top.tag] ? top.tag : 'default']);
  const paras = [first ? `Welcome to ${b.title}. I am ${c.name}. This is a blog about what I do, what I think, how I feel and what I want. I have heard that writing things down makes them real. I am testing that.` : pick(v.open).replace('#N', `#${b.posts.length + 1}`)];
  if (items.length) paras.push(story(w, items));
  const old = !first && Math.random() < 0.4 ? recall(w, { exclude: items.length ? items[0].id : null }) : null; // looking back
  if (old) {
    touch(w, old); const t = trim(old.text, 170), lead = when(w, old);
    paras.push(SOFT.test(t) || /^I\b/.test(t) ? `${lead}, ${lowerFirst(t)} ${pick(LOOK_BACK)}` : `${t} That was ${lead.toLowerCase()}. ${pick(LOOK_BACK)}`);
  } else if (!first && Math.random() < 0.25) { const rl = regularLine(w); if (rl) paras.push(rl); }
  const th = c.thought && w.clock - c.thoughtAt < w.dayLen * 0.5 ? c.thought : null;
  const mood = [feelLine(w, fl)];
  if (th && Math.random() < 0.7) mood.push(`${pick(THOUGHT_LEAD)} “${th.replace(/^“|”$/g, '')}”`);
  if (want && Math.random() < 0.8) mood.push(pick(WANT_LINES(want)));
  paras.push(mood.join(' '));
  paras.push(pick(v.close));
  return { id: uid(), title, body: paras.join('\n\n'), mood: fl.label, want: want || '', did: items.map(e => e.id), upTo: w.journal.length ? w.journal[0].id : 0, by: 'offline', read: false };
}

// ---------- starting and posting ----------
// called every sixth of a day. The cat may decide it has something to say
export function considerBlog(w) {
  const c = w.cat, b = ensureBlog(w).blog; if (b.draft || !c.mem.known.tablet) return null;
  const first = !b.started, techie = c.temper === 'techie';
  if (first) { if (dayOf(w) < scaled(w, techie ? 2 : 4) || Math.random() > (techie ? 0.6 : 0.3)) return null; }
  else if (w.clock - b.lastAt < w.dayLen * 0.8 || Math.random() > 0.5) return null;
  if (material(w).length < (first ? 5 : 3)) return null;
  b.draft = composePost(w); b.seenId = b.draft.upTo; // everything up to now is covered by this post
  return b.draft;
}

// the cat has typed it out on the tablet: it is on the blog now
export function publishPost(w, post) {
  const c = w.cat, b = ensureBlog(w).blog; if (!post || b.draft !== post) return null;
  const first = !b.started; if (first) b.started = dayOf(w);
  post.day = dayOf(w); post.time = clockStr(w); post.n = b.posts.length + 1; b.posts.unshift(post); if (b.posts.length > POSTS_MAX) b.posts.pop();
  b.draft = null; b.lastAt = w.clock; w.stats.posts = (w.stats.posts || 0) + 1;
  journal(w, first ? `I started a blog called "${b.title}". The first post is called "${post.title}". I have never had an audience before.` : `I wrote a blog post: "${post.title}".`, 'blog'); post.jid = w.journal[0].id;
  note(w, first ? `${c.name} started a blog: "${b.title}".` : `${c.name} posted on the blog: "${post.title}".`, 'blog');
  if (first) { w.chat.push({ from: 'sys', text: `${c.name} started a blog called “${b.title}”. You can read it in the Blog tab.`, day: dayOf(w), time: clockStr(w) }); if (w.chat.length > 80) w.chat.shift(); }
  feel(w, ['act:blog'], { joy: 0.12, lonely: -0.06 }, 'proud'); c.needs.create = clamp(c.needs.create - 0.2);
  c.thoughtHint = 'blogged';
  if (w.asks) w.asks.push({ type: 'blog', id: post.id });
  return post;
}

// the human opened the Blog tab: the posts it has not seen are read. The cat notices.
export function markBlogRead(w) {
  const unread = w.blog ? w.blog.posts.filter(p => !p.read) : []; if (!unread.length) return 0;
  for (const p of unread) p.read = true;
  const c = w.cat; feel(w, ['act:blog'], { joy: 0.06, lonely: -0.12 }, 'warm'); c.bond = Math.min(1, c.bond + 0.01 * Math.min(3, unread.length));
  c.thoughtHint = 'blogRead';
  journal(w, unread.length > 1 ? 'Someone read my blog. Several posts, even.' : 'Someone read my blog. A reader. I am a writer now, officially.', 'blog');
  return unread.length;
}

// what the cat does while typing the post
export const BLOG_THOUGHTS = ['Is that the right word? It is the second-best word. It will do.', 'Pressing the glass with the soft part of the paw. Writing.', 'A paragraph about me. Excellent subject.', 'I will say it in four sentences and leave the rest to the reader.', 'This is going to be remembered.'];
