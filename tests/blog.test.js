// The blog: the cat starts one at the tablet once it has things to write about, posts now and then, and the human reading it matters.
import assert from 'node:assert/strict';
import { makeWorld, tick } from '../src/sim/sim.js';
import { start } from '../src/sim/acts.js';
import { ensureBlog, considerBlog, composePost, publishPost, markBlogRead, blogPending, blogStarted, unreadPosts, feelingNow, BLOG_THOUGHTS } from '../src/sim/blog.js';
import { canUseTablet } from '../src/sim/tablet.js';
import { journal, dayOf } from '../src/sim/world.js';
import { serialize, deserialize } from '../src/sim/save.js';
import { runCommand } from '../src/sim/commands.js';
import { exportText } from '../src/sim/history.js';
import { TEMPER_IDS } from '../src/sim/temper.js';
import { offlineReply } from '../src/sim/thoughts.js';
import { foundCatTree } from '../src/sim/secrets.js';

const ok = m => console.log('  ok ' + m);
const fresh = (temper = null) => { const w = makeWorld('Tess'); w.cat.temper = temper; w.cat.traits.curious = 0.5; w.cat.mem.known.tablet = 1; return w; };
const lives = (w, n = 7) => { for (let i = 0; i < n; i++) journal(w, `Entry ${i}: the yard did something and I noticed.`, i % 2 ? 'hunt' : 'craft'); };
const withRandom = (v, f) => { const r = Math.random; Math.random = () => v; try { return f(); } finally { Math.random = r; } };

// ---- gating: not before it knows the tablet, not before day 4, not without something to write about
{
  const w = fresh(); w.cat.mem.known.tablet = 0; w.clock = 5 * w.dayLen; lives(w);
  assert.equal(withRandom(0, () => considerBlog(w)), null, 'needs the tablet first');
  w.cat.mem.known.tablet = 1; w.clock = 1.5 * w.dayLen;
  assert.equal(withRandom(0, () => considerBlog(w)), null, 'too early in its life');
  w.clock = 5 * w.dayLen; const w2 = fresh(); w2.clock = 5 * w2.dayLen;
  assert.equal(withRandom(0, () => considerBlog(w2)), null, 'nothing to write about yet');
  const d = withRandom(0, () => considerBlog(w)); assert(d && w.blog.draft === d && !blogStarted(w), 'a first post is drafted, but the blog is not started until it is typed');
  assert(blogPending(w) && canUseTablet(w), 'a drafted post is a reason to use the tablet, even offline');
  assert.equal(withRandom(0, () => considerBlog(w)), null, 'one draft at a time');
  const t = fresh('techie'); t.clock = 2.2 * t.dayLen; lives(t); assert(withRandom(0, () => considerBlog(t)), 'a techie starts earlier');
  ok('gating: tablet, age, material, one draft at a time, techies start sooner');
}

// ---- the post itself: what happened, how it feels, what is on its mind, what it wants - in the voice of its quirk
{
  for (const t of [null, ...TEMPER_IDS]) {
    const w = fresh(t); w.clock = 5 * w.dayLen; lives(w); w.cat.wants.push({ kind: 'find', text: 'find a green button', strength: 0.9 }); w.cat.thought = 'I wonder about the moon.'; w.cat.thoughtAt = w.clock;
    const p = composePost(w);
    assert(p.title && p.body.length > 120 && p.body.includes('How I feel:') && p.body.includes('green button') && p.body.includes('wonder about the moon') && p.body.includes('Entry'), `${t}: has what happened, a feeling, a thought and a want`);
    assert(w.blog.title && p.body.includes(w.blog.title), `${t}: the first post welcomes readers to the blog by name`);
  }
  const a = fresh('garfield'), b = fresh('hunter'); a.clock = b.clock = 5 * a.dayLen; lives(a); lives(b); ensureBlog(a); ensureBlog(b);
  const titles = new Set(); for (let i = 0; i < 40; i++) { const x = fresh('garfield'); titles.add(composePost(x).title.length && x.blog.title); } assert([...titles].every(s => ['Lasagna Mondays', 'The Cushion Chronicles'].includes(s)), 'Garfield names his blog after food and naps');
  const w = fresh(); w.cat.upset = { why: 'The human ignored my note.', level: 0.6, until: w.clock + 500, since: w.clock };
  assert.equal(feelingNow(w).label, 'upset'); assert(feelingNow(w).text.includes('ignored my note'));
  w.cat.upset = null; w.cat.needs.hunger = 0.9; assert.equal(feelingNow(w).label, 'hungry');
  ok('posts: all seven quirks write one with what happened, a feeling, a thought and a want; blog names fit the quirk; feelings are honest');
}

// ---- the cat goes to the tablet, types it, and it appears on the blog
{
  const w = fresh(); w.clock = 5 * w.dayLen; lives(w); withRandom(0, () => considerBlog(w)); const draft = w.blog.draft, c = w.cat;
  start(w, 'tablet'); assert.equal(c.act.type, 'tablet');
  let sawBlogPhase = false; for (let i = 0; i < 1800 && !w.blog.started; i++) { c.reeval = 1e9; tick(w, 0.1); if (c.act.type === 'tablet' && c.act.phase === 'blog') sawBlogPhase = true; }
  assert(sawBlogPhase, 'it sat down and typed'); assert(blogStarted(w) && w.blog.posts.length === 1 && w.blog.posts[0] === draft && !w.blog.draft, 'the post is published and the draft is gone');
  assert.equal(draft.n, 1); assert(draft.day === dayOf(w) && !draft.read);
  assert(w.journal.some(e => e.tag === 'blog' && e.text.includes('started a blog')), 'the diary says so');
  assert(w.chat.some(m => m.from === 'sys' && /blog/i.test(m.text)), 'the human is told about the new blog');
  assert(w.asks.some(a => a.type === 'blog' && a.id === draft.id), 'the Claude rewrite is queued when the API is on');
  assert.equal(unreadPosts(w), 1);
  // the human reads it: the cat notices and feels it
  const bond = c.bond, lonely = c.needs.lonely = 0.6; assert.equal(markBlogRead(w), 1); assert(c.needs.lonely < lonely && c.bond > bond && unreadPosts(w) === 0 && c.thoughtHint === 'blogRead');
  assert.equal(markBlogRead(w), 0, 'reading again does nothing');
  ok('the cat types the post at the tablet; the blog starts; the human is told; being read cheers it up');
}

// ---- later posts: spaced out, cover only what is new, capped
{
  const w = fresh(); w.clock = 5 * w.dayLen; lives(w); withRandom(0, () => considerBlog(w)); publishPost(w, w.blog.draft);
  assert.equal(withRandom(0, () => considerBlog(w)), null, 'not straight away');
  w.clock += w.dayLen; assert.equal(withRandom(0, () => considerBlog(w)), null, 'nothing new to say');
  lives(w, 4); const d = withRandom(0, () => considerBlog(w)); assert(d, 'with a day gone and news, it drafts another'); assert(!d.body.includes('Entry 0:') || d.body.indexOf('Entry') > 0);
  publishPost(w, d); assert.equal(w.blog.posts.length, 2); assert.equal(w.blog.posts[0].n, 2, 'newest first');
  for (let i = 0; i < 100; i++) { w.blog.draft = composePost(w); publishPost(w, w.blog.draft); } assert(w.blog.posts.length <= 80, 'old posts fall off at 80');
  ok('later posts: spaced out, only about what is new, capped at 80');
}

// ---- chat: the cat can talk about the new things
{
  const w = fresh('garfield'); w.clock = 5 * w.dayLen; lives(w);
  assert(/would need a tablet|thinking about it/.test(offlineReply(w, 'do you have a blog?')), 'before the blog it only thinks about it');
  withRandom(0, () => considerBlog(w)); publishPost(w, w.blog.draft);
  const r = offlineReply(w, 'how is your blog going'); assert(r.includes(w.blog.title) && /1 post/.test(r) && /not read/.test(r), 'it knows its blog, and that nobody has read it'); markBlogRead(w); assert(/Thank you for reading/.test(offlineReply(w, 'blog?')));
  const said = new Set(TEMPER_IDS.map(t => { const x = fresh(t); return offlineReply(x, 'tell me about your personality'); })); assert.equal(said.size, TEMPER_IDS.length, 'each quirk describes itself differently');
  const a = offlineReply(w, 'tell me about the cat tree'); foundCatTree(w, 'made'); assert.notEqual(offlineReply(w, 'tell me about the cat tree').slice(0, 20), a.slice(0, 20), 'it talks differently once it has the cat tree');
  w.cat.upset = { why: 'You forgot my dinner.', level: 0.6, until: w.clock + 99, since: w.clock }; assert(offlineReply(w, 'are you upset with me?').includes('forgot my dinner'));
  w.cat.upset = null; for (const q of ['do you like coins', 'did you wash', 'caught any fish', 'what is the weather like', 'do you like the wind chime', 'tell me about the full moon']) assert(offlineReply(w, q).length > 10, q);
  ok('chat: blog, cat tree, upset, coin, washing, fish, weather, chime and moon all get an answer, and each quirk describes itself');
}

// ---- save, export, command, and a long simulated life
{
  const w = fresh(); w.clock = 5 * w.dayLen; lives(w); withRandom(0, () => considerBlog(w)); publishPost(w, w.blog.draft); w.blog.draft = composePost(w);
  const w2 = deserialize(serialize(w)); assert.equal(w2.blog.title, w.blog.title); assert.equal(w2.blog.posts.length, 1); assert(w2.blog.draft && w2.blog.draft.id === w.blog.draft.id, 'a half-written draft survives');
  const old = JSON.parse(serialize(w)); delete old.w.blog; const w3 = deserialize(JSON.stringify(old)); assert(w3.blog && Array.isArray(w3.blog.posts) && !blogStarted(w3), 'saves from before the blog get an empty one');
  assert(exportText(w).includes(`THE BLOG: "${w.blog.title}"`) && exportText(w).includes('Hello, Yard'), 'the export includes the blog');
  const run = l => runCommand(w3, l, { admin: true }).lines.join(' ');
  assert(/not started/.test(run('blog status'))); assert(/heading to the tablet/.test(run('blog post')) && w3.cat.act.type === 'tablet' && w3.blog.draft);
  for (let i = 0; i < 1800 && !w3.blog.started; i++) { w3.cat.reeval = 1e9; tick(w3, 0.1); } assert(blogStarted(w3)); assert(/post/.test(run('blog status'))); assert(/Blog deleted/.test(run('blog clear')) && !blogStarted(w3));
  ok('save/load (including a draft and old saves), export, admin command');
}
{
  // three simulated weeks of an ordinary life: it should start a blog on its own and write a handful of posts, never hundreds
  const w = fresh(); w.cat.traits.curious = 0.5; let t = 0; w.netOn = false; w.cat.mem.known.tablet = 1; w.tablet = w.tablet || {}; w.tablet.pages = [1, 2, 3, 4].map(i => ({ id: 'p' + i, title: 'Page ' + i, extract: 'x', day: 1 }));
  for (let i = 0; i < 21 * 1200 * 10 && t < 21 * w.dayLen; i++, t += 0.1) { tick(w, 0.1); if (w.cat.needs.hunger > 0.9) w.cat.needs.hunger = 0.2; }
  const n = w.blog.posts.length; assert(n >= 1 && n <= 24, `it blogged ${n} times in three weeks`); assert(w.blog.posts.every(p => p.body && Number.isFinite(p.day)), 'posts are well-formed');
  ok(`three simulated weeks: it started a blog on its own and wrote ${n} posts`);
}
console.log('ALL OK');
