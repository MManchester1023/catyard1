// Acts: how each activity starts, moves the cat, and finishes.
import { rnd, ri, clamp, pick, dist, an, uid, GY0, FEATHER_COLORS } from './util.js';
import { spot, walk, randomOpenPoint, note, journal, hourOf, sunOf, beamOf, birdLeave, moonPos, moonPhase, clockStr, pushHist } from './world.js';
import { decide, interest, pickSleepSpot, unknownPlaces } from './mind.js';
import { itemName, chooseSite, addToStash, tidyStash, noticeTheft } from './quirk.js';
import { onEvent } from './wants.js';
import { clue, frogSighting } from './mysteries.js';
import { starsNote, starsClue, darkSky, meteorLure } from './stars.js';
import { pickSubject, paintWork, finishWork, subjectLabel } from './art.js';
import { thoughtFor } from './thoughts.js';
import { offerSpot, inspectOffer, finishOffer, offerLabel } from './offerings.js';
import { tabletTick, describeTablet } from './tablet.js';
import { scratchTree, scratchBed, collectDrop, finishCraft, startable, INV_CAP } from './craft.js';
import { RECIPES } from './recipes.js';
import { feel } from './feelings.js';
import { shiftOf, deepNightOf, birdChance } from './temper.js';
import { frogSpot, frogName, frogDrop, frogVisited } from './frog.js';
import { missedHunt, caughtSomething } from './upset.js';
import { CAT_TREE, catTreeSpot, foundCatTree } from './secrets.js';
import { enjoyAct, favStart, foundThing } from './finds.js';
import { noteAct } from './character.js';
import { intentFulfilled } from './intent.js';

export function think(w, key, extra) { const c = w.cat; c.thought = thoughtFor(w, key, extra); c.thoughtId++; c.thoughtAt = w.clock; }
export const INTERRUPT = new Set(['idle', 'explore', 'play']);
export function done(w) { const d = decide(w, null); start(w, d.type, d.opts); }
export function reconsider(w) { const c = w.cat, d = decide(w, c.act.type); if (d) start(w, d.type, d.opts); }

export function start(w, type, opts = {}) {
  const c = w.cat, o = w.o, n = c.needs, k = c.mem.known;
  enjoyAct(w, c.act); // (what it was doing until now: did it enjoy it?)
  const a = (c.act = Object.assign({ type, phase: 'go', t: 0, dur: 0, tx: c.x, ty: c.y, sf: 0 }, opts));
  if (type !== 'perch') c.z = 0;
  c.hidden = false; c.wig = false; c.pu = 0; if (type !== 'gift' && type !== 'stash') c.carry = null;
  const aim = id => { const s = spot(w, id); a.tx = s.x; a.ty = s.y; a.sf = s.face; };
  switch (type) {
    case 'idle': a.phase = 'do'; a.dur = a.sulk ? rnd(10, 22) : rnd(3, 8) * (0.7 + c.traits.lazy); a.stand = a.sulk ? false : Math.random() < 0.35; if (a.sulk) { const s = spot(w, 'fence'); a.tx = s.x; a.ty = s.y; a.phase = 'go'; think(w, 'sulk'); } else think(w, 'idle'); break;
    case 'explore': {
      const unk = unknownPlaces(w);
      if (unk.length && Math.random() < 0.55 + c.traits.curious * 0.4) { a.target = pick(unk); aim(a.target); }
      else { const p = randomOpenPoint(w); a.tx = p.x; a.ty = p.y; }
      a.spd = 62; a.dur = rnd(1.5, 4); think(w, 'explore'); break;
    }
    case 'zoom': a.pts = Array.from({ length: ri(4, 6) }, () => randomOpenPoint(w)); a.i = 0; a.phase = 'do'; c.zoomAt = w.clock; w.stats.zoomies++; note(w, `${c.name} got a sudden case of the zoomies.`, 'play'); think(w, 'zoom'); break;
    case 'eat':
      if (a.from === 'treat') { aim('bowl'); a.tx = a.treat.x; a.ty = a.treat.y; think(w, 'treat'); }
      else if (a.from === 'prey') { a.phase = 'do'; think(w, 'prey'); }
      else { aim('bowl'); think(w, 'eat'); }
      a.eaten = 0; break;
    case 'drink': {
      let from = 'water';
      if (k.pond) { const dw = dist(c, spot(w, 'water')), dp = dist(c, spot(w, 'pond')); if (dp < dw || Math.random() < 0.3 + c.traits.bold * 0.3) from = 'pond'; }
      a.from = from; aim(from); think(w, 'drink'); break;
    }
    case 'groom': a.phase = 'do'; a.dur = rnd(6, 12); c.groomNext = false; think(w, 'groom'); break;
    case 'sleep': {
      if (!a.spot) a.spot = pickSleepSpot(w, false);
      aim(a.spot); a.spd = 62;
      if (a.reason === 'rain') { a.dur = rnd(40, 90); think(w, 'shelter'); note(w, `${c.name} ducked into the cabin to wait out the rain.`, 'weather'); }
      else if (a.lounge) { a.dur = rnd(w.dayLen * 0.02, w.dayLen * 0.045); c.loungeAt = w.clock; think(w, a.spot === 'beam' ? 'loungeBeam' : 'loungeBed'); }
      else {
        const h = hourOf(w), sh = shiftOf(c), dark = sh ? deepNightOf(c, h) : sunOf(h) < 0.2, toDawn = ((5.3 + sh - h + 24) % 24) * (w.dayLen / 24);
        a.dur = dark ? clamp(toDawn * rnd(0.9, 1.05), 30, w.dayLen * 0.4) : rnd(w.dayLen * 0.03, w.dayLen * 0.08);
        think(w, 'sleep');
        const L = { house: dark ? 'went to bed in the cabin' : 'curled up in the cabin for a nap', beam: 'curled up in the sunbeam', cushion: 'took a nap on the cushion', flowers: 'dozed off in the flower bed' };
        note(w, `${c.name} ${L[a.spot]}.`, 'sleep');
      }
      break;
    }
    case 'play': {
      const kinds = [];
      if (k.yarn) kinds.push('yarn', 'yarn'); if (k.post) kinds.push('post'); if (k.tree) kinds.push('tree');
      if (k.flowers && w.flies.some(f => f.on)) kinds.push('fly', 'fly');
      a.kind = opts.kind || (kinds.length ? pick(kinds) : 'yarn');
      if (a.kind === 'post' || a.kind === 'tree') aim(a.kind); else if (a.kind === 'bed') aim('cushion'); else a.phase = 'do';
      if (a.kind === 'post') c.postAt = w.clock;
      a.dur = rnd(9, 16); a.swat = 0; think(w, a.kind); break;
    }
    case 'hunt': a.dur = 40; c.huntCool = 0; think(w, 'stalk'); break;
    case 'beg': aim('bowl'); c.begAt = w.clock; a.dur = 14; think(w, 'beg'); note(w, `The bowl is empty. ${c.name} is waiting nearby, looking tragic.`, 'food'); break;
    case 'perch': a.spot = (k.tree && (!k.fence || Math.random() < 0.55)) ? 'tree' : 'fence'; aim(a.spot); a.dur = rnd(14, 30); think(w, 'perch'); break;
    case 'gift': aim('house'); a.sf = 1; think(w, 'gift'); break;
    case 'collect': a.tx = a.item.x; a.ty = a.item.y; { const nm = itemName(a.item.type, a.item.color), A = an(nm); think(w, 'collect', { aitem: A, Aitem: A[0].toUpperCase() + A.slice(1) }); } break;
    case 'stash':
      chooseSite(w); aim('stash'); a.dur = rnd(5, 9);
      if (c.carry) think(w, 'carry'); else think(w, 'count');
      break;
    case 'paint': {
      aim('easel'); a.subject = opts.subject || pickSubject(w); a.work = paintWork(w, a.subject); a.dur = rnd(28, 44) * (c.temper === 'vangogh' ? 1.3 : 1);
      think(w, 'paint', { subject: subjectLabel(a.subject) }); break;
    }
    case 'gaze': {
      const mp = moonPos(w); if (!mp) a.stars = true; // (no moon up: it can only be the stars)
      const mx = a.stars ? rnd(120, 840) : mp.x, p = { x: clamp(mx, 70, 890), y: GY0 + 56 + rnd(0, 40) };
      a.tx = p.x; a.ty = p.y; a.moonX = a.stars ? mx + rnd(-140, 140) : mx; a.dur = rnd(20, 40) + (a.stars ? 8 : 0); a.nextClue = 5; think(w, a.stars ? 'gazeStars' : 'gaze');
      if (a.stars) meteorLure(w, a.dur); break;
    }
    case 'investigate':
      if (a.kind === 'ripples') { const s = spot(w, 'pondedge'); a.tx = s.x; a.ty = s.y; a.dur = rnd(12, 20); c.ripAt = w.clock; think(w, 'ripples'); } // a short look, then something else (it was 45 s, twice in a row)
      else if (a.kind === 'tree') { const s = spot(w, 'tree'); a.tx = s.x - 4; a.ty = s.y + 6; a.dur = rnd(16, 26); a.nextClue = 5; c.oakAt = w.clock; think(w, 'oakGo'); }
      else { a.tx = 690; a.ty = 548; a.dur = rnd(14, 22); a.swat = 0; think(w, 'sparks'); }
      break;
    case 'attention': aim('glass'); a.dur = rnd(10, 26); think(w, 'glass'); break;
    case 'offering': { const sp = offerSpot(w, a.offer); a.tx = sp.x; a.ty = sp.y; a.sf = sp.face; think(w, 'offerGo'); break; }
    case 'tablet': aim('tablet'); think(w, 'tabletGo'); break;
    case 'craft': aim('craft'); a.dur = rnd(10, 15) * (c.temper === 'builder' ? 0.7 : 1); think(w, 'craftGo'); break;
    case 'frog': { const f = frogSpot(w); a.tx = f.cx; a.ty = f.cy; a.dur = rnd(16, 24); a.nextBoop = rnd(3, 5); a.boopT = 0; think(w, 'frogGo'); break; }
    case 'fish': { const p = o.pond; a.tx = clamp(w.fish ? w.fish.x : p.x, p.x - p.rx * 0.6, p.x + p.rx * 0.6); a.ty = p.y + p.ry + 12; a.dur = rnd(16, 24); a.strikes = 0; c.fishAt = w.clock; think(w, 'fishGo'); break; }
    case 'listen': { a.tx = o.tree.x - 40; a.ty = o.tree.y + 24; a.dur = rnd(14, 22); c.listenAt = w.clock; think(w, 'listenGo'); break; }
    case 'peek': { a.tx = CAT_TREE.x + 14; a.ty = CAT_TREE.y + 6; a.sf = 1; a.dur = rnd(4, 6); think(w, 'peekGo'); break; }
    case 'cattree': { const s = catTreeSpot(); a.tx = s.x; a.ty = s.y; a.sf = 1; a.dur = rnd(18, 36); c.catTreeAt = w.clock; think(w, 'catTreeGo'); break; }
    case 'wash': { a.from = k.pond && Math.random() < 0.5 ? 'pond' : 'water'; aim(a.from); c.washAt = w.clock; think(w, 'washGo'); break; }
  }
  c.reeval = rnd(0.8, 1.4); noteAct(w); intentFulfilled(w); favStart(w);
  const dtxt = describe(w), ld = w.lastDid; // the history records what it set out to do
  if (!ld || ld.text !== dtxt || w.clock - ld.at > 60) { pushHist(w, 'did', dtxt); w.lastDid = { text: dtxt, at: w.clock }; }
}

export function describe(w) {
  const c = w.cat, a = c.act; if (!a) return '';
  switch (a.type) {
    case 'idle': return a.sulk ? 'Sulking' : 'Sitting and looking around';
    case 'explore': return a.target ? 'Investigating something new' : 'Exploring the yard';
    case 'zoom': return 'Zoomies';
    case 'eat': return a.from === 'treat' ? 'Hunting down a treat' : a.from === 'prey' ? 'Eating a catch' : 'Eating from the bowl';
    case 'drink': return a.from === 'pond' ? 'Drinking at the pond' : 'Drinking water';
    case 'groom': return 'Grooming';
    case 'sleep': return a.lounge ? (a.spot === 'beam' ? 'Lying in the sunbeam' : 'Lounging on the cushion') : a.reason === 'rain' ? 'Waiting out the rain in the cabin' : a.spot === 'house' ? 'Sleeping in the cabin' : a.spot === 'beam' ? 'Napping in the sunbeam' : a.spot === 'cushion' ? 'Napping on the cushion' : 'Dozing in the flower bed';
    case 'play': return a.kind === 'bed' ? (a.phase === 'go' ? 'Heading to the cushion' : 'Pulling at the cushion') : a.kind === 'yarn' ? 'Batting the yarn ball' : a.kind === 'fly' ? 'Chasing butterflies' : a.kind === 'tree' ? (a.gather ? 'Scratching the oak for bark' : 'Scratching the old oak') : 'Scratching the post';
    case 'hunt': return c.pose === 'pounce' ? 'Pouncing' : (a.prey && a.prey.kind === 'bird' ? 'Stalking a bird' : 'Stalking a mouse');
    case 'beg': return 'Waiting by the empty bowl';
    case 'perch': return a.spot === 'tree' ? 'Watching from the oak' : 'Watching from the fence';
    case 'gift': return 'Delivering a gift';
    case 'collect': return `Fetching ${an(itemName(a.item.type, a.item.color))}`;
    case 'stash': return a.visit ? 'Checking on the stash' : 'Hiding a treasure';
    case 'paint': return `Painting ${subjectLabel(a.subject)}`;
    case 'gaze': return a.stars ? 'Gazing at the stars' : 'Gazing at the moon';
    case 'investigate': return a.kind === 'ripples' ? 'Watching the pond' : a.kind === 'tree' ? 'Sniffing around the roots of the oak' : 'Chasing the sparks';
    case 'peek': return a.phase === 'go' ? 'Wondering what is behind the cabin' : 'Peering round the back of the cabin';
    case 'cattree': return a.phase === 'go' ? 'Heading for the cat tree' : a.phase === 'do' ? 'Sitting at the top of the cat tree' : 'Climbing the cat tree';
    case 'attention': return 'Sitting at the glass';
    case 'offering': return a.phase === 'go' ? 'Checking out something on the mat' : a.offer.kind === 'note' ? 'Reading a note' : `Inspecting ${offerLabel(a.offer)}`;
    case 'tablet': return describeTablet(a);
    case 'craft': return a.phase === 'go' ? 'Heading to the workbench' : `Making ${an(RECIPES[a.recipe].name)}`;
    case 'frog': return a.phase === 'go' ? `Going to see ${frogName(w)}` : `Sitting with ${frogName(w)} the frog`;
    case 'fish': return a.phase === 'go' ? 'Heading to the pond to fish' : 'Fishing at the pond';
    case 'listen': return a.phase === 'go' ? 'Going to listen to the chime' : 'Listening to the wind chime';
    case 'wash': return a.phase === 'go' ? 'Heading to wash' : a.phase === 'dry' ? 'Drying off' : 'Giving itself a proper wash';
  }
  return '';
}

// the rare lucky catch: the bird is gone, and for once the cat has everything it wanted
function catchBird(w, p) {
  const c = w.cat, n = c.needs;
  p.frozen = 0; p.state = 'away'; p.timer = rnd(60, 140); p.x = -40; p.z = 150;
  n.hunger = 0; n.thirst = 0; n.fun = 0; n.lonely = 0;
  c.mem.caught++; w.stats.birds = (w.stats.birds || 0) + 1;
  w.items.push({ id: uid(), type: 'feather', color: pick(FEATHER_COLORS), x: clamp(c.x + rnd(-12, 12), 30, 930), y: clamp(c.y + rnd(2, 8), GY0 + 20, 570), age: 0 });
  feel(w, ['act:hunt'], { joy: 0.35 }, 'thrilled'); caughtSomething(w); onEvent(w, 'caught', { prey: 'bird' });
  note(w, `${c.name} caught a bird! A feather drifted down. Hunger, thirst, boredom and loneliness are all gone.`, 'hunt');
  journal(w, `I caught a bird. A real one. I did not think I could. I do not need anything at all right now, which has never happened before.`, 'hunt');
  start(w, 'eat', { from: 'prey' }); think(w, 'birdCaught');
}

export function actTick(w, dt) {
  const c = w.cat, a = c.act, n = c.needs, o = w.o, q = c.quirk, k = c.mem.known;
  a.t += dt;
  const arrive = sp => a.t > 40 || walk(w, c, a.tx, a.ty, sp, dt);
  const toDo = () => { a.phase = 'do'; a.t = 0; if (a.sf) c.face = a.sf; };
  switch (a.type) {
    case 'idle': {
      if (a.sulk && a.phase === 'go') { c.pose = 'walk'; if (arrive(44)) { toDo(); c.face = c.x < 480 ? -1 : 1; } break; } // (the Sulk walks off, then sits facing the fence)
      c.pose = a.stand ? 'stand' : 'sit'; const t = a.sulk ? null : interest(w); if (t && Math.random() < dt * 2) c.face = t.x >= c.x ? 1 : -1; if (a.t > a.dur) done(w); break; }
    case 'explore':
      if (a.phase === 'go') { c.pose = 'walk'; if (arrive(a.spd)) toDo(); } else { c.pose = 'sit'; if (a.t > a.dur) done(w); }
      break;
    case 'zoom':
      c.pose = 'run'; n.fun = clamp(n.fun - dt * 0.15);
      if (a.t > 14 || a.i >= a.pts.length) { c.pose = 'stand'; done(w); break; }
      if (walk(w, c, a.pts[a.i].x, a.pts[a.i].y, 250, dt)) a.i++;
      break;
    case 'eat':
      if (a.phase === 'go') {
        c.pose = 'walk';
        if (a.from === 'treat') { if (!w.treats.includes(a.treat)) { done(w); break; } a.tx = a.treat.x; a.ty = a.treat.y; }
        if (arrive(a.from === 'treat' ? 95 : 70)) {
          if (a.from === 'treat') { const i = w.treats.indexOf(a.treat); if (i < 0) { done(w); break; } w.treats.splice(i, 1); n.hunger = clamp(n.hunger - 0.12); n.fun = clamp(n.fun - 0.2); w.stats.treats++; note(w, `${c.name} found a treat and gobbled it up.`, 'food'); }
          toDo();
        }
      } else {
        c.pose = 'eat'; let finished = false;
        if (a.from === 'bowl') {
          const amt = Math.min(o.bowl.food / 0.3, 0.11 * dt); n.hunger = clamp(n.hunger - amt); o.bowl.food = Math.max(0, o.bowl.food - amt * 0.3); a.eaten += amt;
          if (n.hunger < 0.06 || o.bowl.food <= 0.001 || a.t > 30) finished = true;
        } else if (a.from === 'prey') { n.hunger = clamp(n.hunger - 0.06 * dt); a.eaten += 0.06 * dt; if (a.t > 6) finished = true; }
        else if (a.t > 2.5) finished = true;
        if (finished) {
          if (a.from !== 'treat' && a.eaten > 0.12) { w.stats.meals++; c.mem.lastMeal = clockStr(w); note(w, a.from === 'bowl' ? `${c.name} ate at the bowl.` : `${c.name} finished off the catch.`, 'food'); }
          if (a.from === 'bowl' && o.bowl.food <= 0.001 && n.hunger > 0.3) note(w, 'The food bowl ran empty.', 'food');
          c.groomNext = Math.random() < 0.5; done(w);
        }
      }
      break;
    case 'drink':
      if (a.phase === 'go') { c.pose = 'walk'; if (arrive(70)) toDo(); }
      else { c.pose = 'drink'; n.thirst = clamp(n.thirst - 0.14 * dt); if (n.thirst < 0.05 || a.t > 9) done(w); }
      break;
    case 'groom': c.pose = 'groom'; n.dirty = clamp(n.dirty - 0.08 * dt); if (a.t > a.dur || n.dirty < 0.03) done(w); break;
    case 'sleep': {
      const inside = a.spot === 'house';
      if (a.phase === 'go') { c.pose = 'walk'; if (arrive(a.spd)) { if (inside) { a.phase = 'enter'; a.t = 0; c.face = 1; } else { toDo(); c.pose = 'sleep'; } } }
      else if (a.phase === 'enter') { c.pose = 'walk'; c.y -= 14 * dt; if (a.t > 0.9) { c.hidden = true; a.phase = 'do'; a.t = 0; } }
      else {
        c.pose = inside ? (a.reason === 'rain' && n.tired < 0.25 ? 'peek' : 'inside') : 'sleep';
        const wakeHungry = n.hunger > 0.93, wetOut = !inside && w.weather.rain > 0.5 && n.wet > 0.45;
        const rainOver = a.reason === 'rain' && w.weather.rain < 0.15 && a.t > 10;
        const mouse = !inside && w.mice.some(m => !m.dead && dist(m, c) < 90) && c.traits.bold > 0.3;
        if (a.t > a.dur || wakeHungry || wetOut || rainOver || mouse) {
          if (a.t > 15) { c.mem.nap[a.spot] = (c.mem.nap[a.spot] || 0) + 1; w.stats.naps++; }
          if (inside) { c.hidden = false; c.y = spot(w, 'house').y; if (a.t > w.dayLen * 0.05) note(w, `${c.name} woke up and stretched.`, 'sleep'); }
          c.pose = 'stand'; done(w);
        }
      }
      break;
    }
    case 'play': {
      if (a.kind === 'post' || a.kind === 'tree' || a.kind === 'bed') {
        if (a.phase === 'go') { c.pose = 'walk'; if (arrive(70)) toDo(); }
        else if (a.phase === 'pick') { c.pose = 'crouch'; if (a.t > 0.9) { collectDrop(w, a.drop.type); a.drop = null; think(w, a.kind === 'bed' ? 'string' : 'bark'); done(w); } }
        else {
          c.pose = 'scratch'; n.fun = clamp(n.fun - 0.05 * dt);
          if (a.t > Math.min(a.dur, 7)) {
            w.stats.scratch++;
            if (a.kind === 'tree' || a.kind === 'bed') { const d = a.kind === 'tree' ? scratchTree(w) : scratchBed(w); if (d) { a.drop = { type: d, x: c.x + 16, y: c.y + 6 }; a.phase = 'pick'; a.t = 0; break; } }
            else feel(w, ['act:post'], { joy: 0.02 }, 'content');
            done(w);
          }
        }
        break;
      }
      n.fun = clamp(n.fun - (a.kind === 'yarn' ? 0.055 : 0.1) * dt); // (the yarn is the long game)
      if (a.swat > 0) { a.swat -= dt; c.pose = 'swat'; break; }
      const tgt = a.kind === 'yarn' ? o.yarn : w.flies.filter(f => f.on).sort((p, r) => dist(p, c) - dist(r, c))[0];
      if (!tgt || a.t > a.dur) { c.pose = 'stand'; done(w); break; }
      const d = Math.hypot(tgt.x - c.x, tgt.y - c.y);
      if (d > 34) { c.pose = 'run'; walk(w, c, tgt.x, tgt.y + 2, a.kind === 'yarn' ? 105 : 125, dt); }
      else {
        a.swat = 0.32; c.pose = 'swat'; c.face = tgt.x >= c.x ? 1 : -1;
        if (a.kind === 'yarn') { const ang = rnd(-0.9, 0.9) + (c.x < 480 ? 0 : Math.PI), sp = rnd(130, 250); tgt.vx = Math.cos(ang) * sp; tgt.vy = Math.sin(ang) * sp * 0.45; }
        else { tgt.flee = 3.5; if (Math.random() < 0.08) note(w, `${c.name} nearly caught a butterfly.`, 'play'); }
      }
      break;
    }
    case 'hunt': {
      const p = a.prey;
      const gone = !p || p.dead || (p.kind === 'mouse' && (p.state === 'flee' || p.gone)) || (p.kind === 'bird' && p.state !== 'ground');
      const cool = v => (c.temper === 'hunter' ? v * 0.3 : v); // the Hunter is back at it almost at once
      if (gone && a.phase !== 'pounce') { c.pose = 'stand'; c.huntCool = cool(6); if (a.t > 1) note(w, `${c.name} lost track of the ${p && p.kind === 'bird' ? 'bird' : 'mouse'}.`, 'hunt'); done(w); break; }
      if (a.phase === 'go') {
        const d = dist(c, p);
        // once in a while a bird freezes instead of flying off, and then the pounce can land
        if (p.kind === 'bird' && !a.rolled && d < 235) { a.rolled = true; if (Math.random() < birdChance(c)) { a.lucky = true; p.frozen = 9; p.alert = 0; } }
        c.pose = d > 200 ? 'run' : 'crouch'; walk(w, c, p.x, p.y, d > 200 ? 115 : 48, dt);
        if (d < 64) { a.phase = 'wiggle'; a.t = 0; c.face = p.x >= c.x ? 1 : -1; }
        if (a.t > a.dur) { c.huntCool = cool(8); done(w); }
      } else if (a.phase === 'wiggle') {
        c.pose = 'crouch'; c.wig = true;
        if (a.t > 0.55) { a.phase = 'pounce'; a.t = 0; a.fx = c.x; a.fy = c.y; a.px = p.x + (p.vx || 0) * 0.25; a.py = p.y + (p.vy || 0) * 0.25; c.wig = false; think(w, 'pounce'); }
      } else {
        c.pose = 'pounce'; const u = clamp(a.t / 0.38); c.pu = u;
        c.x = a.fx + (a.px - a.fx) * u; c.y = clamp(a.fy + (a.py - a.fy) * u, GY0, 572); c.z = Math.sin(u * Math.PI) * 22;
        if (u >= 1) {
          c.z = 0; c.pu = 0;
          const dd = Math.hypot(p.x - c.x, p.y - c.y);
          if (p.kind === 'bird' && a.lucky && p.state === 'ground' && dd < 44) { catchBird(w, p); }
          else if (p.kind === 'mouse' && !p.dead && dd < 38 && Math.random() < c.skill + 0.25 + (c.temper === 'hunter' ? 0.12 : 0)) {
            p.dead = true; c.mem.caught++; w.stats.mice++; n.hunger = clamp(n.hunger - 0.3); n.fun = clamp(n.fun - 0.4); note(w, `${c.name} caught a mouse!`, 'hunt'); caughtSomething(w); onEvent(w, 'caught', { prey: 'mouse' });
            if (n.hunger < 0.35 && Math.random() < 0.6) { start(w, 'gift'); c.carry = { type: 'mouse' }; } else start(w, 'eat', { from: 'prey' });
          } else {
            if (p.kind === 'mouse') p.state = 'flee'; else birdLeave(p);
            c.mem.missed++; w.stats.misses++; c.huntCool = cool(8); think(w, 'miss'); missedHunt(w);
            note(w, p.kind === 'bird' ? `${c.name} leapt at a bird. It escaped by a whisker.` : `${c.name} missed the mouse. It darted for its hole.`, 'hunt');
            start(w, 'idle'); c.act.dur = 2;
          }
        }
      }
      break;
    }
    case 'beg': if (a.phase === 'go') { c.pose = 'walk'; if (arrive(70)) toDo(); } else { c.pose = 'sit'; if (o.bowl.food > 0.05 || a.t > a.dur) done(w); } break;
    case 'peek': {
      if (a.phase === 'go') { c.pose = 'walk'; if (arrive(66)) { toDo(); c.face = -1; } break; }
      c.pose = a.t < 2 ? 'crouch' : 'sit'; if (a.t > a.dur) { foundCatTree(w, 'found'); done(w); }
      break;
    }
    case 'cattree': {
      const tz = CAT_TREE.top;
      if (a.phase === 'go') { c.pose = 'walk'; if (arrive(70)) { a.phase = 'climb'; a.t = 0; c.face = 1; } }
      else if (a.phase === 'climb') { c.pose = 'climb'; c.z = Math.min(tz, c.z + 58 * dt); if (c.z >= tz) { a.phase = 'do'; a.t = 0; w.stats.catTreeSits = (w.stats.catTreeSits || 0) + 1; } }
      else if (a.phase === 'do') { c.pose = a.t > a.dur * 0.55 && n.tired > 0.45 ? 'sleep' : 'watch'; n.fun = clamp(n.fun - 0.03 * dt); n.fear = clamp(n.fear - 0.03 * dt); n.tired = clamp(n.tired - (c.pose === 'sleep' ? 0.004 : 0) * dt); const t = interest(w); if (t && c.pose === 'watch') c.face = t.x >= c.x ? 1 : -1; if (a.t > a.dur || w.weather.rain > 0.5) { a.phase = 'down'; a.t = 0; feel(w, ['act:cattree'], { joy: 0.06 }, 'content'); } }
      else { c.pose = 'climb'; c.z = Math.max(0, c.z - 58 * dt); if (c.z <= 0) { c.z = 0; c.pose = 'stand'; done(w); } }
      break;
    }
    case 'perch': {
      const tz = a.spot === 'tree' ? 96 : 58;
      if (a.phase === 'go') { c.pose = 'walk'; if (arrive(70)) { a.phase = 'climb'; a.t = 0; c.face = 1; } }
      else if (a.phase === 'climb') { c.pose = 'climb'; c.z = Math.min(tz, c.z + 58 * dt); if (c.z >= tz) { a.phase = 'do'; a.t = 0; } }
      else if (a.phase === 'do') { c.pose = 'watch'; n.fun = clamp(n.fun - 0.035 * dt); const t = interest(w); if (t) c.face = t.x >= c.x ? 1 : -1; if (a.t > a.dur || w.weather.rain > 0.5) { a.phase = 'down'; a.t = 0; } }
      else { c.pose = 'climb'; c.z = Math.max(0, c.z - 58 * dt); if (c.z <= 0) { c.z = 0; c.pose = 'stand'; done(w); } }
      break;
    }
    case 'gift':
      if (a.phase === 'go') { c.pose = 'walk'; c.carry = { type: 'mouse' }; if (arrive(70)) toDo(); }
      else { c.pose = 'sit'; c.carry = null; if (a.t > 1.8) { w.stats.gifts++; n.fun = clamp(n.fun - 0.2); note(w, `${c.name} left a gift by the cabin door.`, 'hunt'); done(w); } }
      break;

    // ----- the cat's own interests -----
    case 'collect': {
      const it = a.item;
      if (a.phase === 'go') {
        if (!w.items.includes(it)) { done(w); break; }
        const d = dist(c, it); c.pose = d > 160 ? 'run' : 'walk';
        if (walk(w, c, it.x, it.y, d > 160 ? 105 : 75, dt) || a.t > 40) { a.phase = 'grab'; a.t = 0; }
      } else {
        c.pose = 'crouch';
        if (a.t > 0.7) {
          if (w.items.includes(it)) {
            w.items = w.items.filter(x => x !== it);
            if (it.type === 'twine') { c.inv.twine = Math.min(INV_CAP, c.inv.twine + 1); w.stats.gathered++; note(w, `${c.name} picked up a bit of string.`, 'craft'); feel(w, ['act:collect', 'mat:twine'], { joy: 0.12 }, 'content'); think(w, 'twineFound'); done(w); }
            else { c.carry = { type: it.type, color: it.color }; w.stats.found++; foundThing(w, it); start(w, 'stash'); }
          } else done(w);
        }
      }
      break;
    }
    case 'stash': {
      if (a.phase === 'go') { c.pose = 'walk'; if (arrive(c.carry ? 78 : 66)) { toDo(); c.face = -1; } break; }
      c.pose = 'tend';
      if (c.carry) {
        if (a.t > 1.1 && !a.placed) { a.placed = true; const item = c.carry; c.carry = null; addToStash(w, item); onEvent(w, 'stashed', { item }); think(w, 'stash'); }
        if (a.t > 2.6) done(w);
      } else {
        if (!a.counted) { a.counted = true; feel(w, ['act:stash'], { fear: -0.06, joy: 0.02 }, 'soothed'); q.visits++; q.lastVisit = w.clock; noticeTheft(w); onEvent(w, 'stashVisit'); if (w.stash.items.length >= 3 && w.clock - q.lastTidy > w.dayLen * 0.35) { tidyStash(w); think(w, 'tidy'); } }
        if (a.t > a.dur) done(w);
      }
      break;
    }
    case 'paint': {
      if (a.phase === 'go') { c.pose = 'walk'; if (arrive(68)) { toDo(); c.face = 1; w.easel = { work: a.work, progress: 0 }; note(w, `${c.name} set up at the easel to paint ${subjectLabel(a.subject)}.`, 'art'); } break; }
      c.pose = 'paint'; w.easel.progress = clamp(a.t / a.dur);
      if (Math.random() < dt * 0.05) think(w, 'paint', { subject: subjectLabel(a.subject) });
      if (a.t >= a.dur || (w.weather.rain > 0.6 && a.t > a.dur * 0.6)) { w.easel.progress = 1; finishWork(w, a.work); c.pose = 'sit'; done(w); }
      break;
    }
    case 'gaze': {
      if (a.phase === 'go') { c.pose = 'walk'; if (arrive(62)) { toDo(); c.face = a.moonX >= c.x ? 1 : -1; } break; }
      c.pose = 'gaze'; const mp = moonPos(w);
      if (a.t >= a.nextClue) { a.nextClue += 5; if (a.stars) starsClue(w, 1); else clue(w, 'moon', 1, moonPhase(w)); starsNote(w); if (Math.random() < 0.3) think(w, a.stars ? 'gazeStars' : 'gaze'); }
      if (a.t > a.dur || (a.stars ? !darkSky(w) : !mp) || w.weather.cloud > 0.85 || w.weather.rain > 0.3 || n.hunger > 0.92) done(w);
      break;
    }
    case 'investigate': {
      if (a.phase === 'go') { c.pose = 'walk'; if (arrive(66)) { toDo(); c.face = 1; } break; }
      if (a.kind === 'tree') {
        c.pose = a.t % 9 < 5 ? 'crouch' : 'sit'; if (a.t > a.nextClue) { a.nextClue += rnd(5, 7); clue(w, 'tree', 1); if (Math.random() < 0.4) think(w, 'oakSniff'); }
        if (a.t > a.dur || w.mysteries.tree.solved) done(w);
      } else if (a.kind === 'ripples') {
        c.pose = 'crouch'; if (w.rippleT > 14 && !w.ripple) w.rippleT = rnd(5, 14); // the pond stirs when someone is watching
        if (w.ripple && w.ripple !== a.last) {
          a.last = w.ripple; clue(w, 'ripples', 1);
          if (w.ripple.frog && frogSighting(w)) { done(w); break; }
          think(w, 'ripples');
        }
        if (a.t > a.dur) done(w);
      } else {
        const tg = w.sparks.filter(s => s.on).sort((p, r) => dist(p, c) - dist(r, c))[0];
        if (!tg || a.t > a.dur) { c.pose = 'stand'; done(w); break; }
        if (a.swat > 0) { a.swat -= dt; c.pose = 'swat'; break; }
        const d = Math.hypot(tg.x - c.x, tg.y - c.y);
        if (d > 34) { c.pose = 'run'; walk(w, c, tg.x, tg.y + 6, 80, dt); }
        else { a.swat = 0.4; c.pose = 'swat'; c.face = tg.x >= c.x ? 1 : -1; clue(w, 'sparks', 0.5); tg.x += rnd(-60, 60); tg.y += rnd(-20, 20); }
      }
      break;
    }
    case 'attention': {
      if (a.phase === 'go') { c.pose = 'walk'; if (arrive(66)) toDo(); break; }
      c.pose = 'front'; n.lonely = clamp(n.lonely - 0.025 * dt); c.mood.joy = clamp(c.mood.joy + 0.004 * dt);
      if (a.t > a.dur || n.lonely < 0.08) { c.attAt = w.clock; done(w); }
      break;
    }
    case 'offering': {
      const off = a.offer;
      if (!w.offers.includes(off)) { done(w); break; }
      if (a.phase === 'go') { c.pose = 'walk'; if (arrive(72)) { toDo(); c.face = 1; inspectOffer(w, off); a.dur = off.kind === 'note' ? 5.5 : 2.6; } break; }
      c.pose = off.kind === 'note' ? 'sit' : 'crouch';
      if (a.t > a.dur) { if (finishOffer(w, off)) { c.carry = { type: off.type, color: off.color }; start(w, 'stash'); } else done(w); }
      break;
    }
    case 'tablet': tabletTick(w, a, dt, { arrive, finish: () => done(w) }); break;
    case 'frog': {
      const f = w.frog; if (!f || !f.out) { c.pose = 'stand'; done(w); break; }
      if (a.phase === 'go') { c.pose = 'walk'; if (arrive(70)) { toDo(); c.face = 1; } break; }
      n.lonely = clamp(n.lonely - frogDrop(f) / a.dur * dt); c.mood.joy = clamp(c.mood.joy + 0.004 * dt);
      a.nextBoop -= dt; if (a.nextBoop <= 0) { a.boopT = 0.45; a.nextBoop = rnd(4, 7); f.hop = 1; }
      c.pose = a.boopT > 0 ? 'swat' : 'sit'; if (a.boopT > 0) a.boopT -= dt;
      if (a.t > a.dur) { frogVisited(w); c.pose = 'sit'; think(w, 'frogDone'); done(w); }
      break;
    }
    case 'fish': {
      const f = w.fish, p = o.pond;
      if (a.phase === 'go') { if (f && !f.spooked) a.tx = clamp(f.x, p.x - p.rx * 0.6, p.x + p.rx * 0.6); c.pose = 'walk'; if (!f || f.spooked) { c.pose = 'stand'; done(w); break; } if (arrive(72)) { toDo(); a.nextStrike = rnd(3, 6); } break; }
      if (a.phase === 'do') {
        if (!f || f.spooked || a.t > a.dur) { c.pose = 'stand'; if (!f && a.t > 1) think(w, 'fishGone'); done(w); break; }
        c.pose = 'crouch'; c.wig = a.t > a.nextStrike - 1; c.face = f.x >= c.x ? 1 : -1;
        const tx = clamp(f.x, p.x - p.rx * 0.6, p.x + p.rx * 0.6); c.x += clamp(tx - c.x, -26 * dt, 26 * dt);
        if (a.t > a.nextStrike) { a.phase = 'strike'; a.t = 0; c.wig = false; }
        break;
      }
      if (a.phase === 'strike') {
        c.pose = 'swat'; c.face = f && f.x >= c.x ? 1 : -1;
        if (a.t > 0.45) {
          a.strikes++; w.fx.push({ x: f ? f.x : c.x, y: f ? f.y : p.y, t: 0 });
          if (f && Math.abs(f.x - c.x) < 46 && Math.random() < 0.22 + c.skill * 0.3 + (c.temper === 'hunter' ? 0.12 : 0)) {
            w.fish = null; w.stats.fish = (w.stats.fish || 0) + 1; c.mem.caught++;
            n.hunger = clamp(n.hunger - 0.75); n.thirst = clamp(n.thirst - 0.15); n.fun = clamp(n.fun - 0.3); n.wet = clamp(n.wet + 0.1);
            feel(w, ['act:fish'], { joy: 0.3 }, 'thrilled');
            note(w, `${c.name} caught a fish from the pond!`, 'hunt');
            journal(w, 'There was a fish. I did not know the pond had a fish. I know now, and so does my stomach.', 'hunt');
            start(w, 'eat', { from: 'prey' }); think(w, 'fishCaught'); break;
          }
          if (f) { f.spooked = true; f.spookT = f.t; }
          n.wet = clamp(n.wet + 0.08); c.mem.missed++; w.stats.misses++;
          note(w, `${c.name} swiped at a fish and got a faceful of pond.`, 'hunt'); think(w, 'fishMiss');
          c.pose = 'stand'; done(w);
        }
      }
      break;
    }
    case 'listen': {
      if (a.phase === 'go') { c.pose = 'walk'; if (arrive(66)) { toDo(); c.face = 1; } break; }
      c.pose = a.t > a.dur * 0.7 ? 'sit' : 'gaze'; n.fun = clamp(n.fun - 0.045 * dt); c.mood.joy = clamp(c.mood.joy + 0.006 * dt); n.fear = clamp(n.fear - 0.01 * dt);
      if (Math.random() < dt * 0.07) think(w, 'listen');
      if (a.t > a.dur || n.fun < 0.04 || !w.deco.chime) { feel(w, ['act:listen', 'craft:chime'], { joy: 0.06, fun: -0.05 }, 'soothed'); done(w); }
      break;
    }
    case 'wash': {
      if (a.phase === 'go') { c.pose = 'walk'; if (arrive(70)) { toDo(); a.phase = 'splash'; } break; }
      if (a.phase === 'splash') { c.pose = a.t < 1.6 ? 'drink' : 'swat'; n.thirst = clamp(n.thirst - 0.03 * dt); if (a.t > 2.6) { a.phase = 'scrub'; a.t = 0; } break; }
      if (a.phase === 'scrub') { c.pose = 'groom'; n.dirty = clamp(n.dirty - 0.11 * dt); if (a.t > 10 || n.dirty < 0.03) { a.phase = beamOf(w).on && k.beam ? 'dry' : 'shake'; a.t = 0; if (a.phase === 'dry') { const b = spot(w, 'beam'); a.tx = b.x; a.ty = b.y; } } break; }
      if (a.phase === 'dry') {
        const bm = beamOf(w); if (!bm.on) { a.phase = 'shake'; a.t = 0; break; } // the sun went in
        a.tx = bm.x; a.ty = bm.y; // the patch of sun moves, so follow it; but do not walk after it for ever (it may be somewhere the cat cannot stand)
        if (dist(c, { x: a.tx, y: a.ty }) > 14 && a.t < 8) { c.pose = 'walk'; walk(w, c, a.tx, a.ty, 62, dt); break; }
        c.pose = 'sit'; n.wet = clamp(n.wet - 0.08 * dt); if (a.t > 17 || n.wet < 0.03) a.phase = 'shake', a.t = 0; break;
      }
      c.pose = 'stand'; if (a.t > 1.4) { n.dirty = 0; c.mood.joy = clamp(c.mood.joy + 0.08); feel(w, ['act:wash'], { joy: 0.05 }, 'content'); note(w, `${c.name} had a proper wash and looks very pleased about it.`, 'groom'); c.groomNext = false; done(w); }
      break;
    }
    case 'craft': {
      if (a.phase === 'go') { c.pose = 'walk'; if (arrive(68)) { toDo(); c.face = 1; } break; }
      c.pose = 'tend';
      if (!startable(w, a.recipe)) { c.pose = 'stand'; done(w); break; }
      if (a.t >= a.dur) { finishCraft(w, a.recipe); c.pose = 'sit'; done(w); }
      break;
    }
  }
}
