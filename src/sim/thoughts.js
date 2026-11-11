// Offline voice: thoughts and chat replies built from what the cat actually knows and wants.
import { pick, clamp, an, ITEM_LABEL, ITEM_PLURAL } from './util.js';
import { hourOf, isNight, moonPhase, dayOf } from './world.js';
import { LEVEL_NAMES, levelOf, subjectLabel } from './art.js';
import { BLOG_THOUGHTS } from './blog.js';
import { coinActive } from './secrets.js';
import { isUpset, upsetVoice, upsetAbout, upsetReason } from './upset.js';
import { stashColors } from './quirk.js';
import { MYSTERY_INFO } from './mysteries.js';
import { starsInterest } from './stars.js';
import { memoryThought, regularLine, memoryReply } from './memory.js';
import { favourites } from './finds.js';
import { moodToday, habitLine, ensureChar } from './character.js';
import { intentActive } from './intent.js';
import { interestThought, interestReply, interestActive } from './interest.js';
import { random } from './rng.js';

const fmt = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => (v[k] != null ? v[k] : ''));
const vars = w => {
  const c = w.cat, q = c.quirk, n = w.stash.items.length, a = c.art;
  const top = Object.entries(stashColors(w)).sort((x, y) => y[1] - x[1])[0];
  return { frog: w.frog ? w.frog.name : 'the frog', item: ITEM_LABEL[q.item], items: ITEM_PLURAL[q.item], fav: q.favColor, n, name: c.name, level: LEVEL_NAMES[levelOf(a.xp)], top: top ? top[0] : q.favColor, best: Math.round(a.best * 100), human: 'the human' };
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
  gazeStars: ['One, two, three... I will never finish counting. That is the point.', 'They hold so still. How do they hold so still?', 'There are more up there tonight than last night. I checked.', 'Somebody put them all up there. Carefully.'],
  starsCurious: ['What ARE they? All of them. Up there.', 'I have been looking at the stars and the stars have not explained themselves.'],
  starsEnough: ['I have looked and looked. I need to know. The slab will know.', 'Looking is not enough any more. I need words.'],
  starWish: ['I asked a star, and the star kept its word.', 'Something shining in the grass. A star heard me.', 'I wished. It came true. I will not say what for.'],
  starSeen: ['A star fell. I had nothing left to ask. I asked it to wait.', 'I saw it fall. It was worth staying up for.'],
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
  easelDone: ['An easel. Mine. Now, where did I put the paint?', 'It stands up by itself. I am so proud.', 'A canvas. A real one. Move over, everyone.'],
  tableDone: ['A table. My things can be seen now.', 'No more hiding. A proper place for the collection.', 'I made a table. I am a cat who makes tables.'],
  wishWrite: ['I will leave the human a note. Politely.', 'Typing with one paw. This will take a while.'],
  wishGranted: ['The human listened. I did not expect that.', 'It came. I asked and it came.'],
  learned: ['Now I know how. That is better than having.', 'The slab explained it. I owe the slab.'],
  frogGo: ['{frog} is out. {frog} is always glad to see me. I think.', 'I will go and sit with {frog}. Nobody needs to know.', 'The pond has a friend in it. I forget how good that is.'],
  frogDone: ['Quiet company. The best kind.', 'I feel lighter. {frog} does that.', 'Same time tomorrow, {frog}.'],
  meetFrog: ['A frog. A friend. In the pond. All this time.', 'Not a ghost. Better than a ghost.'],
  birdCaught: ['A BIRD. I caught a bird. Nobody saw. Everybody should have seen.', 'I need nothing. For the first time, I need nothing.', 'I will remember this for the rest of my life.'],
  stalkHunter: ['Everything that moves is mine.', 'Low and quiet. Low and quiet. Low.', 'I have been waiting for this all day.', 'Yes. Come closer. Come closer.'],
  bed: ['This cushion is full of something. I will find out what.', 'Pull. Pull. It is holding on.', 'The cushion has secrets. They are fibres.'],
  string: ['String! It was in the bed all along.', 'A bit of the bed is mine now. Sorry, bed.', 'I understand the cushion now. It understands me less.'],
  loungeBeam: ['The sunbeam is exactly my size.', 'Warm patch. I do not need to explain myself.', 'Ten minutes. Maybe twelve.'],
  loungeBed: ['The cushion has been waiting for me.', 'Soft. Soft. Soft.', 'I am not asleep. I am resting my eyes.'],
  sawSparks: ['What are THOSE? Little lights. By the fence.', 'Something is glowing along the fence and nobody has said a word.'],
  peekUrge: ['What is behind the cabin? I have never looked.', 'There is a whole side of the cabin I have not seen.'],
  peekGo: ['Round the back. Nobody ever goes round the back.', 'Something about that corner of the yard...'],
  catTreeFound: ['A cat tree. For me. Nobody asked me but it is for me.', 'It was here the whole time. Behind the cabin. Waiting.'],
  catTreeMade: ['I built it. I am sitting in it. It holds.', 'A cat tree, made by a cat, for a cat.'],
  catTreeGo: ['Up. Higher than the post. Higher than anything.', 'My tree. My box. My top.'],
  oakCurious: ['The oak knows something. I can smell it.', 'There is something under the oak. Under. Not on.'],
  oakGo: ['Sniff. Sniff. Roots.', 'Something is under here. I am sure of it.'],
  oakSniff: ['Dirt. Bark. And something else.', 'Almost. The smell is almost a shape.'],
  coin: ['SHINY. It is the shiniest thing I have ever owned.', 'It was under the oak the whole time. I knew it. I knew it.', 'I am the happiest cat in the yard. Do not argue.'],
  moonWish: ['I asked, and the moon kept its word.', 'Something shining by the pond. The moon heard me.'],
  upset: ['I am not upset. I am simply not speaking to anyone.', 'Noted. All of it. Noted.', 'I will be over here. Not looking.'],
  'upset:wish': ['I wrote a note. A whole note. With paws.', 'The tablet is right there. Reading is free.', 'Ignored. By a person with thumbs.'],
  'upset:hungry': ['The bowl is empty. I want that on record.', 'I have been very patient. Nobody noticed.'],
  'upset:alone': ['Nobody is looking. Good. I did not want to be looked at.', 'I do not need anyone. I am just checking whether anyone is there.'],
  'upset:misses': ['It is not me. It is the mice. They cheat.', 'Three in a row. I need a minute.'],
  'upset:theft': ['Someone took what was mine. I will not forget.'],
  'notice:moon': ['It changes. Every night, a little different. Who is doing that?', 'The moon was thinner. I looked twice.'],
  'notice:ripples': ['The pond moved. Nobody touched it.', 'Something is down there. I felt it.'],
  'upset:words': ['That was unkind. I read it twice to be sure.'],
  sulk: ['I am not sulking. I am sitting facing the fence on purpose.', 'Do not look at me.', 'Fine. Fine.', 'I will come around. Eventually. Maybe.'],
  paintVg: ['Just one more. Then I will stop. I will not stop.', 'The canvas cannot wait. I cannot wait.', 'It will never look like what I see. That is why I must keep going.'],
};
// ---------- more of everything: extra lines for every act (merged into T), quirk voices (QT) and things on its mind (WONDER) ----------
const MORE = {
  eat: ['I chew thoughtfully. Everyone should.', 'Each piece is a small victory.', 'The bowl and I understand each other.', 'Do not rush a good meal.'],
  treat: ['This is not a treat. This is a promotion.', 'The universe provides, occasionally.'],
  prey: ['I earned this one.', 'Nobody else was going to do it.', 'A cat provides for herself. Or himself. Or whatever I am.'],
  drink: ['The water bowl never lies.', 'Slurp. Slurp. Refreshed.', 'Pond water is better. I will not say that out loud.'],
  sleep: ['The world can wait. It has not asked nicely.', 'Dreaming of a very large sunbeam.', 'Eyes shut. Tail on guard.', 'Naps are not lazy. Naps are strategy.'],
  groom: ['One cannot be seen like this.', 'Left paw. Right paw. Behind the ear. Repeat.', 'Cleanliness is next to catliness.'],
  yarn: ['It rolls away. I let it. For now.', 'The red one has wronged me before.', 'Bat, bat, pounce. That is the whole philosophy.', 'It is only string. It is also my whole afternoon.'],
  fly: ['It is not a bird. It is a plan to lose my dignity.', 'Almost. Almost. Gone.', 'Delicate wings, terrible decisions.'],
  post: ['Claws, meet post. You two get along.', 'This is maintenance. Not mischief.', 'The post has seen things.', 'Stretch. Pull. Bliss.'],
  stalk: ['Ears forward. Weight low.', 'I am a shadow with opinions.', 'Closer. Closer. Not yet.'],
  pounce: ['GOT YOU!', 'Now now now now now!'],
  explore: ['Follow the nose. The nose knows.', 'I will just check the whole yard. Again.', 'Has that rock always been there? Suspicious.', 'Somewhere in here there is a thing I have not yet looked at.', 'A corner I have not sniffed. Unacceptable.', 'There is a whole yard out there and I am in charge of it.', 'Something over there smells interesting. Or old.', 'Wandering is a kind of working.'],
  idle: ['I counted the fence posts. There are enough.', 'A leaf fell. I watched it fall. It was fine.', 'Time passes. I am here for it.', 'I have decided to be a statue for a while.', 'Is that a cloud, or a very distant sheep?', 'Everything is exactly where I left it.', 'The wind and I have an understanding.', 'I wonder what the humans are doing. Probably nothing as interesting as this.', 'Nothing to do. Doing it well.', 'Sitting is underrated.', 'I have been here a while. It is going fine.', 'The yard is quiet. I contain it.'],
  perch: ['From up here everything is smaller. Including problems.', 'I see all. Mostly leaves.', 'A good view is its own reward.'],
  beg: ['I would like it noted that the bowl is empty.', 'I am not asking. I am standing here meaningfully.', 'Any day now, human.'],
  shelter: ['I will wait this out. Dryly.', 'Rain is just the sky being dramatic.', 'The cabin and I are staying in.'],
  zoom: ['I HAVE NO CONTROL. THIS IS FUN.', 'Faster! Faster than what? Unknown!', 'My legs are making decisions without me.'],
  gift: ['I have brought you something. You are welcome.', 'Gift. For the humans. They will pretend to be disgusted.'],
  miss: ['The mouse had practice.', 'That did not count. I was warming up.', 'Next time. Always next time.'],
  collect: ['It will look so good next to the others.', 'Mine now. Sorry. Not sorry.', 'I knew it was there. I felt it.'],
  carry: ['Do not drop it. Do not drop it.', 'Precious cargo. I breathe through my nose.'],
  stash: ['It is not hoarding if it is art.', 'A little more and I will have a pattern.', 'Another one. The collection is blooming.', 'Good. Good. Mine.'],
  tidy: ['Rows. Or a ring. Or neither. I will know when I see it.', 'Perfection is a moving target.'],
  count: ['All present. All accounted for. All mine.', 'Counting is a form of love.'],
  paint: ['A paw full of colour is a paw well spent.', 'The painting knows what it wants to be.', 'Brush? I do not need a brush.', 'Make it feel like something.'],
  gaze: ['The moon is very round tonight. I am not.', 'Silent, silver, far. Like a cat.', 'If I stare hard enough it will say something.'],
  ripples: ['Something circles. Something hides.', 'The water just moved. Nobody moved it.'],
  sparks: ['They go out when I look. They come back when I blink.', 'Tiny, quick, impossible.'],
  glass: ['Anyone there? Hello? I can see the glow.', 'I sit here and the world looks back. Sometimes.', 'The glass is cold. The thought of you is warm.'],
  wantDone: ['Done. Crossed off. What next?', 'It feels good to finish a wanting.'],
  level: ['My paws have outgrown the old me.', 'Something clicked. Colours are louder.'],
  theft: ['Whoever it was, I know the smell.', 'My stash. MY stash.'],
  noStash: ['An empty place where treasures should be.'],
  offerGo: ['Something on the mat. For me? For me.', 'A visitor left something. I must investigate.', 'The mat has a new thing on it.'],
  tabletGo: ['The slab glows. The slab has answers.', 'Time to learn something I will pretend I knew.', 'I will ask the slab. It never judges.'],
  tree: ['Scritch. Bark. Anything.', 'The oak is generous, in tiny pieces.', 'Dig in, claws.'],
  bark: ['Bark! A fine piece.', 'That will do nicely.', 'The oak gives and the oak gives and the oak keeps giving, a little.'],
  craftGo: ['Time to make something real.', 'Workbench. Materials. Me.', 'Today I build.'],
  craftDone: ['Look at that. I made that.', 'Not bad for paws.', 'It exists because I decided it should.'],
  tableDone: ['A table of bark. The collection has a stage.'],
  wishWrite: ['Dear human. Please. Love, me.', 'One paw, one letter at a time.'],
  wishGranted: ['The human read my note. Wonders exist.'],
  learned: ['A small light turned on in my head.', 'Knowledge: acquired. Smugness: also acquired.'],
  frogGo: ['I wonder if {frog} has been waiting.', 'To the pond. To {frog}.'],
  frogDone: ['{frog} did not say anything. It was perfect.', 'Quiet, wet, good company.'],
  birdCaught: ['I am a legend. Quietly. For now.'],
  fishGo: ['Something flickers in the pond. I will wait.', 'Fish. Quiet, cold, delicious fish.', 'I have patience. I have a lot of patience. Mostly.', 'The pond has a secret. It is edible.'],
  fishCaught: ['A FISH. Right out of the water!', 'Nobody believes me. I have a fish.', 'The pond gave. I took. We are even.'],
  fishMiss: ['Splash. Nothing. The fish laughs.', 'So close I could taste it.', 'It slipped away. I am calm. I am not calm.'],
  fishGone: ['The fish has gone deep. Smart fish.', 'Another day, fish.'],
  listen: ['Ting. Ting. The wind is playing.', 'The chime is saying something. I almost understand.', 'Listening is half of everything.'],
  listenGo: ['I can hear the chime from here. Calling.', 'A little music before the next problem.', 'The chime wants company.'],
  washGo: ['I am a mess. Time to fix that.', 'A proper wash. A proper reason.', 'Water, then sun, then dignity.'],
  wash: ['Scrub, scrub. A new cat emerges.', 'This is the good kind of wet.'],
  matSee: ['{Aitem}, just lying there. That is useful.', 'A bird left {aitem}. I can build with that.', 'Building material, right there on the grass.'],
  matFound: ['A bird brought me something to build with. I did not even have to ask.', 'Good. One more for the pile.', 'Bark and twigs come from the sky too, apparently.'],
  twineFound: ['A bit of string. Excellent.', 'String is everything. String is a chime.', 'I could use this. I will use this.'],
  solved: ['I knew it. I always suspected.', 'The mystery is solved. The wonder remains.', 'Now I understand. Mostly.'],
};
// what each kind of cat sounds like for particular things
const QT = {
  techie: { tablet: ['The slab will tell me. It always does.', 'Slab first, thinking second.'], tabletGo: ['Stuck? Slab.', 'I am not confused. I am pre-researching.'], idle: ['I should check the slab. Just in case.', 'Somewhere out there a page is waiting.'], explore: ['Let me think. No. Let me look it up.'], learned: ['Another one for the slab. I mean for me.'], paint: ['I will look up how the greats did it. Later.'] },
  garfield: { eat: ['I am not hungry. I am preparing.', 'Second breakfast. Possibly third.', 'The bowl is the centre of the world.'], beg: ['This is a dietary emergency.', 'The bowl is a void. I am a hungry void.'], sleep: ['Lying down is a skill. I am a master.', 'No, I will not paint. I will lie here.', 'Horizontal. Perfect. Full.'], idle: ['Why do anything when you can do nothing, comfortably?', 'I could be productive. I could also be a loaf.'], paint: ['Art takes effort. I took a lot of effort. I am resting.'], yarn: ['I will play. Later. After the next nap.'], zoom: ['I regret this already.'] },
  builder: { craftGo: ['Can I fix it? Yes I can!', 'Measure twice. Scratch once.', 'Bark and twigs and a plan.'], craftDone: ['Another job well done.', 'Finished. Level, mostly. Sturdy, entirely.'], tree: ['Good bark. Strong bark.', 'Material. Always more material.'], bark: ['I knew you had it in you, oak.'], idle: ['What shall I build next?', 'There is always something to build.', 'My paws itch for a project.'], explore: ['Ideas are out there, waiting for lumber.'] },
  collector: { collect: ['Oh yes. YES. The collection needs it.', 'I need it. I need it. I need it.'], stash: ['Every piece has a story. This one: I found it.', 'A perfect addition.'], idle: ['I wonder what the stash is doing.', 'One more would do it. One more is never enough.'], explore: ['Somewhere out there is the perfect one.'] },
  hunter: { stalk: ['I was born for this.', 'Silent. Patient. Inevitable.'], explore: ['Where is it hiding? Something is always hiding.'], idle: ['I could be hunting. I am always hunting.'], zoom: ['Practice run!'], perch: ['Watching. Always watching. Waiting.'] },
  vangogh: { paint: ['It must be this colour. It simply must.', 'The brush is my heartbeat.', 'It will never be finished. That is the beauty.'], idle: ['The canvas is calling. I should answer.', 'Everything looks like a painting if you squint.'], gaze: ['Silver. I need silver.', 'The moon would make a magnificent painting.'], explore: ['Looking for something worth painting.'] },
  nightowl: { sleep: ['Finally. Morning is for the unprepared.', 'Rest now. The night is coming.'], gaze: ['Midnight. My favourite hour.', 'The moon and I keep the same hours.'], idle: ['It is much too bright. I will wait.', 'The day is just a long intro to the night.'], explore: ['The yard is better in the dark.'] },
};
for (const [k, arr] of Object.entries(MORE)) T[k] = (T[k] || []).concat(arr);
// the blog
const BLOG_T = {
  blog: BLOG_THOUGHTS,
  blogged: ['It is up. The whole internet could read it. The whole internet will not, but it could.', 'Posted. I feel lighter and slightly exposed.', 'A new post. My public awaits. It is possibly one person.', 'Writing it down made it more true.'],
  interestDone: ['That is enough of that. For now. I know more than most cats.', 'I have read all I can about it. I feel full and a little empty.', 'Done. Researched. Ask me anything. Please.'],
  blogRead: ['Somebody read it. Somebody actually read it.', 'A reader! I will have to write better.', 'They read my blog. I will act like it is nothing.'],
};
for (const [k, arr] of Object.entries(BLOG_T)) T[k] = (T[k] || []).concat(arr);
const WONDER = {
  interest: w => interestThought(w),
  wantA: w => { const x = w.cat.wants[0]; return x ? pick([`I really should ${x.text}.`, `Still want to ${x.text}.`, `Today might be the day I ${x.text}.`]) : null; },
  theory: w => { const ms = Object.entries(w.mysteries).filter(([, m]) => m.theory && !m.solved); if (!ms.length) return null; const [id, m] = pick(ms); return `${MYSTERY_INFO[id].name[0].toUpperCase() + MYSTERY_INFO[id].name.slice(1)}... ${m.theory}`; },
  quirk: w => (w.stash.items.length ? pick(['Do I have enough {items}? No. Never enough.', 'The {fav} ones are the best. I will not hear otherwise.', 'I wonder what the stash is doing right now.']) : pick(['A cat should own something small and perfect.', 'I wonder if the {item} is out there today.'])),
  art: w => (w.cat.art.count ? pick(['My last painting was almost good.', 'I am a {level}. That is not nothing.', 'Next canvas, I will try something braver.']) : 'My paws feel like they want to make something.'),
  temper: w => {
    const t = w.cat.temper;
    if (t === 'vangogh') return pick(['The canvas. I keep thinking about the canvas.', 'Yellow. I need more yellow.', 'Why does nothing look the way it feels?']);
    if (t === 'hunter') return pick(['Something rustled. Something is always about to rustle.', 'Every shadow is a mouse until proven otherwise.', 'My paws itch. Somewhere, a pounce is waiting.']);
    if (t === 'techie') return pick(['I could look it up. I will look it up.', 'There is a page about this. There is always a page.', 'Something is bothering me. Time for the slab.', 'Why guess when you can search?']);
    if (t === 'garfield') return pick(['Is it a good time for a snack? It is always a good time for a snack.', 'The best part of the day is the part where nothing is required of me.', 'I would paint. But there is a nap with my name on it.', 'Plan for today: lie down. Backup plan: lie down somewhere else.']);
    if (t === 'builder') return pick(['I could build something. I should build something.', 'That corner needs a structure.', 'How many twigs make a tower? Asking for a friend.', 'A good cat leaves the yard better than they found it.']);
    if (t === 'collector') return pick(['A treasure is out there. I can feel it in my whiskers.', 'My collection is incomplete. It always is.', 'What is the next one going to be? I cannot wait to find out.']);
    if (t === 'nightowl') return isNight(w) ? pick(['The night is young. So am I, mostly.', 'Everyone else is asleep. This is the good part.']) : pick(['Too bright. Wake me at dusk.', 'The sun is a lot, honestly.']);
    return null;
  },
  night: w => (isNight(w) ? pick(['The yard is different at night. Bigger.', 'Everything smells louder in the dark.']) : null),
  weather: w => (w.weather.rain > 0.3 ? pick(['Rain. The sky has opinions today.', 'The cabin is warm. The yard is wet. I know which I prefer.']) : w.weather.cloud > 0.65 ? pick(['Clouds. The sun is hiding. I understand.', 'Grey sky. Good for thinking.']) : !isNight(w) ? pick(['Sunshine. A beam would be nice about now.', 'The light is good today. Someone should paint it.']) : null),
  body: w => { const n = w.cat.needs; return n.hunger > 0.6 ? pick(['My stomach is composing a complaint.', 'Food is on my mind. It is always on my mind.']) : n.tired > 0.7 ? pick(['My eyelids have opinions.', 'A nap would solve this.']) : n.lonely > 0.6 ? pick(['It has been quiet for a while. The wrong kind of quiet.', 'I wonder if anyone is looking.']) : n.fun > 0.6 ? pick(['I could use a project.', 'The yarn is looking at me. I think.']) : null; },
  yard: w => { const l = []; if (w.table) l.push('The table is holding up beautifully.'); if (w.deco.chime) l.push('The chime is judging the wind.'); if (w.deco.feeder) l.push('Birds. By invitation. Civilised.'); if (w.catTree) l.push('The cat tree is back there, being perfect.'); if (w.cat.coinUntil > w.clock) l.push('I have a coin. I will not stop saying it. I have a coin.'); if (w.mysteries.moon.solved) l.push('On the next full moon I will ask for something good.'); if (w.frog) l.push(`Is ${w.frog.name} out? I wonder.`); return l.length ? pick(l) : null; },
};

for (const [t, arr] of Object.entries({
  techie: ['Published. Now to refresh the page and wait for traffic.', 'Another post. My analytics are a single cat.'],
  garfield: ['A blog post and a snack. A perfect day.', 'Posted. Now I have earned lunch.'],
  vangogh: ['I wrote it the way I paint: all at once, with feeling.', 'Words are just paint that does not drip.'],
  hunter: ['Posted. Short and sharp, like a pounce.', 'The post is out there now. Waiting. Like me.'],
  nightowl: ['Posted at the best hour. Naturally.', 'The night reads blogs. I have decided.'],
  builder: ['One more thing built. This one is made of words.', 'Post done. Level, mostly.'],
  collector: ['Another entry for the collection. Of posts.', 'Every post is kept. Every single one.'],
})) if (QT[t]) QT[t].blogged = arr;

const MEMORY_KINDS = new Set(['idle', 'explore', 'gaze', 'groom', 'sleep', 'perch', 'loungeBeam', 'loungeBed', 'wash', 'paint']);
export function thoughtFor(w, kind, extra = {}) {
  const v = Object.assign(vars(w), extra), c = w.cat;
  if (!extra.id && isUpset(w) && random() < 0.4) { const u = T['upset:' + w.cat.upset.hint]; const ab = upsetAbout(w); return u ? pick(u) : ab ? pick([`I am still upset about ${ab}.`, `${ab[0].toUpperCase() + ab.slice(1)}. I have not forgotten.`]) : `I am upset: ${upsetReason(w)}.`; } // (an upset cat says what it is upset about)
  if (!extra.id && MEMORY_KINDS.has(kind) && random() < 0.12) { const s = random() < 0.25 && regularLine(w) || memoryThought(w); if (s) return s; } // something from before comes back to it
  if (kind === 'idle' || kind === 'explore') {
    const r = random();
    if (r < 0.55) { const f = pick([WONDER.interest, WONDER.interest, WONDER.wantA, WONDER.theory, WONDER.quirk, WONDER.art, WONDER.night, WONDER.temper, WONDER.temper, WONDER.weather, WONDER.body, WONDER.yard]); const s = f(w); if (s) return fmt(s, v); }
    const fam = Object.entries(c.words).filter(([, n]) => n >= 3).map(([k]) => k);
    if (fam.length && r < 0.7) return `"${pick(fam)}"... the human keeps saying that.`;
  }
  const qb = QT[c.temper] && QT[c.temper][kind]; if (qb && !extra.id && random() < 0.4) return fmt(pick(qb), v); // (each kind of cat has its own way of putting it)
  const bank = (kind === 'stalk' && c.temper === 'hunter' ? T.stalkHunter : extra.id && T[kind + ':' + extra.id] ? T[kind + ':' + extra.id] : kind === 'paint' && c.temper === 'vangogh' && random() < 0.5 ? T.paintVg : T[kind]) || T.idle;
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
  else if (has(/special interest|obsess|into lately|researching|studying|interested in|what have you been (reading|looking up)|reading about/)) body = interestReply(w);
  else if (has(/going to do|plan(s|ning)?\b|what.*(want|mean|intend).*(to )?do|next\b.*(do|thing)|what are you up to|what.*on your mind.*do/)) body = intentActive(w) ? `I mean to ${c.intent.label}. ${c.intent.why}` : pick(['Nothing in particular. I am letting the day decide.', 'No plans. I will know when I know.']);
  else if (has(/favou?rite (thing|activity|game|spot|place|part)|best thing|what do you (like|love|enjoy)|like (to do|doing)|enjoy most|your favou?rite/) && !has(/colou?r|food|treat/)) { const f = favourites(w); body = f.length ? `${f[0].name[0].toUpperCase() + f[0].name.slice(1)}.${f[1] ? ` And ${f[1].name}.` : ''} Nothing else comes close. It makes the whole day better.` : pick(['I have not decided yet. I am still finding out what I like.', 'Ask me again in a few days. I am keeping notes.']); }
  else if (has(/remember|recall|yesterday|last time|the other day|what happened|memor|regulars?\b/)) body = memoryReply(w, text);
  else if (has(/personality|temperament|what are you like|about yourself|what kind of cat|your quirk/)) body = ({ vangogh: 'I am a painter first and a cat second.', hunter: 'I hunt. Whatever else I am, I am that.', nightowl: 'I do my best living after dark.', collector: `I collect things. A cat needs a hobby, and mine is ${v.items}.`, techie: 'I trust the slab. Ask me anything and I will look it up.', garfield: 'A cat of simple pleasures: food, naps, and a little more food.', builder: 'I build. If it can be fixed, I will fix it. If it cannot, I will build another.' })[c.temper] || 'I am a cat. That is plenty.';
  else if (has(/blog|do you write|writing/)) body = w.blog && w.blog.started ? `I write ${w.blog.title} on the tablet. ${w.blog.posts.length} post${w.blog.posts.length === 1 ? '' : 's'} so far.${w.blog.posts.some(x => !x.read) ? ' You have not read the latest one. I noticed.' : ' Thank you for reading it. I noticed that too.'}` : c.mem.known.tablet ? 'A blog? I have been thinking about it. I will start when I have enough to say.' : 'A blog is a kind of diary that other people can read. I would need a tablet.';
  else if (has(/cat tree|behind the (house|cabin)|climb/)) body = w.catTree ? pick(['The cat tree behind the cabin is mine. Do not tell the crows.', 'Up there I can see everything. I am very pleased with the cat tree.', 'The cat tree is the best thing in the yard. I will not discuss it further.']) : 'Behind the cabin? I have not looked properly. There might be something back there.';
  else if (has(/coin|shiny|gold|treasure hunt/)) body = coinActive(w) ? 'THE COIN. I have the coin. Nothing can go wrong today.' : w.stash.items.some(i => i.type === 'coin') ? 'I found a coin once. I have not stopped thinking about it.' : 'A coin? I do not have one. Yet. A cat can hope.';
  else if (has(/upset|angry|mad at|sulk|annoyed|cross with|are you sad/)) body = isUpset(w) ? upsetVoice(w) : pick(['No. I am fine. Mostly.', 'Not today. Ask me when something goes wrong.', 'I am not upset. I am just thinking loudly.']);
  else if (has(/bath|wash|clean|dirty|groom|lick/)) body = n.dirty > 0.6 ? 'I am a bit grubby. I will see to it. A cat does not rush hygiene.' : n.dirty < 0.2 ? 'I have just washed. I am spotless. Do not touch me.' : pick(['A cat is never dirty. A cat is temporarily untidy.', 'I wash when I decide to. That is the whole policy.']);
  else if (has(/fish|splash/)) body = w.stats.fish ? `I have caught ${w.stats.fish === 1 ? 'a fish' : w.stats.fish + ' fish'} from the pond. I do not want to talk about how wet I got.` : 'Something shiny moves in the pond sometimes. I am working on it.';
  else if (has(/weather|rain|sunny|cloud|storm|snow/)) body = w.weather.rain > 0.3 ? 'It is raining. I am watching from the cabin like a sensible cat.' : w.weather.cloud > 0.65 ? 'Clouds. The sun is hiding. I do not blame it.' : 'The sun is out. Everything is acceptable.';
  else if (has(/chime|feeder|wind/)) body = w.deco && (w.deco.chime || w.deco.feeder) ? [w.deco.chime ? 'The chime sings when the air moves. It is the best thing I have made.' : '', w.deco.feeder ? 'The feeder keeps the birds coming. They think they are the guests.' : ''].filter(Boolean).join(' ') : 'I have thought about making something that sings, or something that feeds the birds. I will need to look it up.';
  else if (starsInterest(w) && has(/shooting star|falling star|star wish|wish.*star|\bstars?\b|constellation/)) { const sm = w.mysteries.stars, k = w.stats.starWishes || 0; body = sm.solved ? (k ? pick([`A star fell while I was looking, and I asked, and it came. ${k === 1 ? 'Once' : k + ' times'} so far. I am not telling you what for.`, `The stars are suns, far off. And now and then a small one falls. I look every clear night. Waiting is the whole trick.`]) : 'The stars are suns, very far away. If one falls while I am looking, I may ask it for something. I am looking.') : (sm.theory ? `The stars? ${sm.theory} I am still working on it.` : `The stars. I have spent ${sm.nights || 0} nights on them and they have not explained themselves.`); }
  else if (has(/moon wish|wish.*moon|full moon/)) body = w.moonWishDay != null ? 'I made a wish on the full moon. I am not telling you what for.' : 'Under a full moon, with the right friend, something might happen. That is all I will say.';
  else if (has(/habit|routine|ritual|every (morning|day|night|evening)|same time/)) { const hs = ensureChar(c).habits; body = hs.length ? `${hs.map(habitLine).map(x => x[0].toUpperCase() + x.slice(1)).join('. ')}. I did not plan any of it. That is what makes it a ritual.` : pick(['Not yet. I am still deciding what my days are made of.', 'I do not have a routine yet. Give me a few more mornings.']); }
  else if (has(/how are you|how do you feel|you ok|you okay/)) body = (() => { const md = moodToday(w).label; return md !== 'steady' && n.hunger < 0.7 && n.tired < 0.75 && n.fun < 0.7 ? `${md[0].toUpperCase() + md.slice(1)} today. ${c.mood.joy > 0.6 ? 'In a good way.' : 'Make of that what you will.'}` : null; })() || (n.hunger > 0.7 ? 'Hungry. Terribly, tragically hungry.' : n.tired > 0.75 ? 'So sleepy. Talk quieter.' : n.fun > 0.7 ? 'Bored. Entertain me.' : c.mood.joy > 0.6 ? 'Good. Very good. Something is going right.' : 'Fine. Thinking about things.');
  else if (has(/stash|collect|treasure|hoard|bottle ?cap|feather|button|marble/)) body = w.stash.items.length ? `I have ${v.n}. The ${v.top} ones are my favourite. I keep them ${w.stash.site ? w.stash.site.label : 'somewhere safe'}. Do not tell anyone.` : `I do not have a stash yet. I am looking for ${an('' + v.fav + ' ' + v.item)}.`;
  else if (has(/paint|art|canvas|draw|picture|gallery/)) body = c.art.count ? `I have made ${c.art.count} painting${c.art.count === 1 ? '' : 's'}. My best was ${v.best} out of 100. I am a ${v.level}.` : 'I have not painted yet. The paint is looking at me.';
  else if (has(/moon|stars?|night sky/)) body = w.mysteries.moon.theory || 'The moon is up there. I am working on it.';
  else if (has(/table|bark|craft|make|build|workbench|oak|tree/)) body = w.table ? `I made the bark table myself. My things live on it now.${c.crafted.length > 1 ? ` I have made ${c.crafted.length} things so far.` : ''}` : (c.inv.bark ? `I have ${c.inv.bark} bark. Soon I will make a table.` : 'I scratch the oak for bark. One day it will be a table.');
  else if (has(/wish|want|need|please|give|notes?/) && (c.wishes || []).some(x => x.state === 'open')) { const o = c.wishes.find(x => x.state === 'open'); body = `I left you a note on the tablet. ${o.text}`; }
  else if (has(/pond|frog|fish|water/)) body = w.frog ? pick([`${w.frog.name} lives in the pond. We are friends. Do not tell anyone I said "friends".`, `${w.frog.name} is the best thing in the yard. Do not repeat that.`, `I go and sit with ${w.frog.name} when it is too quiet. ${w.frog.visits ? `${w.frog.visits} time${w.frog.visits === 1 ? '' : 's'} so far.` : ''}`]) : w.mysteries.ripples.theory || 'The pond is quiet. Too quiet.';
  else if (has(/firefl|spark|bug|glow/)) body = w.mysteries.sparks.theory || 'Little lights. Over the flowers. Ask me later.';
  else if (has(/hunt|bird|mouse|mice|prey|pounce/)) body = w.stats.birds ? `I have caught a bird. Once${w.stats.birds > 1 ? ' or twice' : ''}. It was the best day of my life.` : c.temper === 'hunter' ? 'I hunt. That is the whole truth. The birds are too quick. For now.' : c.mem.caught ? `I have caught ${c.mem.caught}. Not a bird. Birds are too quick.` : 'I have not caught anything yet. Birds are too quick.';
  else if (has(/treat|food|hungry|eat|snack/)) body = n.hunger > 0.5 ? 'Yes. Food. Say more.' : 'I could eat. I can always eat.';
  else if (has(/\bwant|wish|goal|dream/)) body = c.wants.length ? `I want to ${c.wants[0].text}.` : 'Nothing right now. That is strange.';
  else if (has(/bye|goodnight|good night|see you|gotta go/)) body = pick(['Go. I will be here. I am always here.', '*slow blink* Come back.']);
  else if (has(/thank/)) body = 'You are welcome. I did nothing, but you are welcome.';
  if (!body) return greet ? pick(['*blinks slowly* Hello.', 'Oh. You. Hello.', '*chirrups* You came back.']) : has(/\?/) ? pick(['Hm. I will think about it. Later.', 'I do not know. Ask the moon.', '*tilts head* I understand about half of that.']) : pick(['*tilts head*', 'Mrrp.', '*stares, ears twitching*', 'I am listening. Mostly.']);
  if (isUpset(w) && !has(/upset|angry|mad at|sulk|annoyed|cross with|are you sad/) && upsetAbout(w) && random() < 0.5) body += ' ' + pick([`I am still upset about ${upsetAbout(w)}.`, `You should know I am upset about ${upsetAbout(w)}.`]);
  return greet ? pick(['Hello.', 'Oh. You.']) + ' ' + body : body;
}
