// What saying something to the cat does to the cat, and the chat log.
import { clamp } from './util.js';
import { learnWords, offlineReply } from './thoughts.js';
import { onEvent } from './wants.js';
import { note, clockStr, dayOf, pushHist } from './world.js';
import { think } from './acts.js';

const clean = s => String(s || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400);

function push(w, from, text) { w.chat.push({ from, text, day: dayOf(w), time: clockStr(w) }); if (w.chat.length > 80) w.chat.shift(); if (from !== 'sys') pushHist(w, 'chat', (from === 'you' ? 'You: ' : `${w.cat.name}: `) + text, from); return w.chat[w.chat.length - 1]; }

// the human spoke: update the cat, return the offline reply (a fallback or the instant response)
export function userSpeaks(w, raw) {
  const text = clean(raw); if (!text) return null;
  const c = w.cat; push(w, 'you', text);
  learnWords(w, text);
  c.needs.lonely = clamp(c.needs.lonely - 0.8); c.bond = clamp(c.bond + 0.01 + c.traits.affection * 0.01);
  c.mood.joy = clamp(c.mood.joy + 0.05); c.attAt = w.clock; c.lastChat = w.clock; w.lastChatAt = Date.now();
  onEvent(w, 'chat');
  return text;
}
export function catSays(w, text) { const t = clean(text); if (!t) return; push(w, 'cat', t); w.cat.thought = t.length > 90 ? t.slice(0, 88) + '…' : t; w.cat.thoughtId++; w.lastThoughtId = w.cat.thoughtId; w.cat.thoughtAt = w.clock; }
export function offlineSays(w, text) { catSays(w, offlineReply(w, text)); }
export const systemSays = (w, text) => push(w, 'sys', clean(text));
