// Personal projects. The stock wants (find a button, catch five mice) come from the simulation. A project is different:
// with Claude connected, the cat thinks of something it wants to do or become over the next few days, in its own words
// ("paint the pond at every hour", "become the expert on moss"), says why, and says which everyday activity it mostly
// involves and how many times it means to do it. The simulation does the rest: the activity gets a pull while the
// project lasts, each time it sets about that activity counts, and when it has done it enough, the project is done.
// Offline there are no projects, only the stock wants.
import { uid } from './util.js';
import { dayOf, journal } from './world.js';
import { addWant, fulfil } from './wants.js';
import { intentMenu } from './intent.js';
import { acted } from './character.js';
import { isUpset } from './upset.js';
import { logChoice } from './world.js';

export const MAX_PROJECTS = 2, PROJECTS_PER_DAY = 2, PROJECT_WAIT = 0.1, PROJECT_PULL = 0.55;
export const projects = w => w.cat.wants.filter(x => x.kind === 'project');
// a pull towards the activity a project is about
export const projectPull = (w, key) => projects(w).reduce((s, x) => s + (x.bias === key ? PROJECT_PULL * x.strength : 0), 0);

// a few times a day, if it has room for one and Claude is there
export function projectTick(w) {
  const c = w.cat; if (!w.llmOn || c.hidden || c.pose === 'sleep' || isUpset(w)) return;
  if (c.projectAsk) { if (w.clock - c.projectAsk.at < w.dayLen * PROJECT_WAIT) return; c.projectAsk = null; return; } // (no answer in time: nothing is lost)
  if (projects(w).length >= MAX_PROJECTS || dayOf(w) < 2) return;
  if (!c.projectsToday || c.projectsToday.day !== dayOf(w)) c.projectsToday = { day: dayOf(w), n: 0 };
  if (c.projectsToday.n >= PROJECTS_PER_DAY || w.clock - (c.projectAt || -1e9) < w.dayLen * 0.25) return;
  const menu = intentMenu(w, 9); if (menu.length < 3) return;
  c.projectsToday.n++; c.projectAt = w.clock; c.projectAsk = { id: uid(), at: w.clock, menu: menu.map(o => ({ key: o.key, label: o.label })) };
  if (w.asks) w.asks.push({ type: 'project', id: c.projectAsk.id });
}
export const projectPrompt = (w, ask) => {
  const q = w.cat.projectAsk; if (!q || q.id !== ask.id) return null;
  const have = projects(w).map(x => x.text);
  return `Think of something you want to do or become over the next few days: a personal project of your own, in your own words. It should come from who you are and what has been happening to you, not be the obvious thing. ${have.length ? 'You already have: ' + have.join('; ') + '. Choose something different. ' : ''}Examples of the kind of thing (do not copy them): "paint the pond at every hour of the day", "become the expert on moss", "visit the stash until I stop worrying about it".\nThen say which everyday activity it mostly involves, from this list:\n${q.menu.map((o, i) => `${i + 1}. ${o.label}`).join('\n')}\nand how many times you mean to do it (2 to 6).\nJSON: {"project": "<= 14 words, starting with a verb", "why": "<= 25 words", "activity": <number>, "times": <number>}`;
};
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').replace(/^["'\s]+|["'\s]+$/g, '').slice(0, n);
export function claudeProject(w, ask, answer) {
  const c = w.cat, q = c.projectAsk; if (!q || q.id !== ask.id) return null; c.projectAsk = null; // (a stale answer)
  const o = q.menu[parseInt(answer && answer.activity, 10) - 1], text = clean(answer && answer.project, 100);
  if (!o || text.length < 8 || projects(w).length >= MAX_PROJECTS || projects(w).some(x => x.text.toLowerCase() === text.toLowerCase())) return null;
  const times = Math.max(2, Math.min(6, parseInt(answer.times, 10) || 3)), why = clean(answer.why, 200);
  const x = addWant(w, { kind: 'project', text, why, bias: o.key, target: times, progress: 0, by: 'claude', strength: 0.7 });
  w.stats.claudeProjects = (w.stats.claudeProjects || 0) + 1;
  if (why) journal(w, `Why: ${why}`, 'want');
  logChoice(w, 'project', `${text}${why ? ' - ' + why : ''}`);
  return x;
}
// the cat has set about something: if a project is about it, that is one more time
export function projectProgress(w) {
  const c = w.cat; if (!c.act) return;
  for (const x of projects(w)) if (acted(c.act, x.bias)) {
    x.progress = (x.progress || 0) + 1;
    if (x.progress >= x.target) fulfil(w, x, 'I did what I set out to do.'); else x.text = x.text; // (the text stays as it was written)
  }
}
