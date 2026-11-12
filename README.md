# Cat Yard

A small world where a cat lives on its own and you watch. It has needs, moods and a personality of its own. It collects small things in a stash, builds an easel and paints, makes things out of bark, keeps theories about the mysteries of the yard, befriends a frog, reads Wikipedia on a tablet and writes a blog. You can talk to it, leave it gifts, and (in admin mode) change the world.

The yard is drawn in a dithered, low-resolution pixel style, including the cat's paintings.

It is plain JavaScript with no bundler and no framework, so it runs as a normal web page in any modern browser. An optional Tauri wrapper turns the same files into a small Windows desktop app.

## Contents

- [Getting it running](#getting-it-running)
- [The screen](#the-screen)
- [The cat](#the-cat)
- [The yard](#the-yard)
- [Making things](#making-things)
- [Painting](#painting)
- [Offerings: the mat](#offerings-the-mat)
- [The tablet](#the-tablet)
- [Notes from the cat](#notes-from-the-cat)
- [The blog](#the-blog)
- [History](#history)
- [Secrets](#secrets)
- [How long things take](#how-long-things-take)
- [A Claude-powered voice (optional)](#a-claude-powered-voice-optional)
- [Chat and admin commands](#chat-and-admin-commands)
- [Reporting a problem](#reporting-a-problem)
- [Development](#development)
- [Known limits](#known-limits)

## Getting it running

### In your browser, hosted by GitHub Pages

1. Create a GitHub repository and upload this whole folder to it. Keep the `.github/workflows` folder: it holds `pages.yml`.
2. In the repository open **Settings → Pages** and under **Source** choose **GitHub Actions**. You only do this once.
3. Open the **Actions** tab. The **Publish the game (GitHub Pages)** workflow runs on every push to `main` (or `master`), and you can start it by hand with **Run workflow**. It takes about a minute.
4. When it is green, the game is at `https://YOUR-NAME.github.io/YOUR-REPOSITORY/`. The link is also shown on the workflow run.

**Updating.** Replace the files in the repository with the new ones, ideally in a single commit. Only the `src` folder is published, so that is the game. The page republishes itself, and each publish tags the file links with the commit so a browser never mixes old and new files.

**Checking which version you are on.** The bottom of the **Settings** tab shows a *Build* line. If it is missing or older than you expect, the site is still serving old files: wait for the Actions run to turn green, then reload. A private window is a quick way to check. If a run sits at *Queued*, GitHub has not started it yet; the previous version stays live until it finishes.

### On your own computer

```
npm run web
```

Then open <http://localhost:8765/index.html>. Any static file server pointed at the `src` folder works too, for example `python -m http.server 8765` from inside `src`. Opening `index.html` straight from a folder does not work, because browsers block ES modules on `file://` pages.

### As a Windows desktop app (optional)

The same game with a tray icon and saves as real files. The installer is built by GitHub, not on your machine.

1. Push this folder to a GitHub repository.
2. In the **Actions** tab choose **Build Windows installer** and press **Run workflow**. Pushing a tag such as `v0.1.0` does the same.
3. When it finishes (a first run takes about 10 minutes), download the **cat-yard-windows-installer** artifact. It contains a `.exe` installer that installs for the current user and needs no admin rights.

The workflow runs the simulation tests first and stops if they fail. In the desktop app:

- Closing the window saves and tucks the cat into the system tray. Left-click the tray icon to bring it back; right-click for **Save and quit**. **Settings → Performance** can turn the tray off so that closing really quits (it still saves first).
- Saves are written atomically, with the last 3 backups, in `%APPDATA%\com.catyard.app\saves\`.

### Saving

- **Autosave** runs every 3 minutes (configurable), whenever the window or tab is hidden or closed, and when you type `/save`. The last 3 backups are kept (a new one at most every 10 minutes). If the main save is unreadable, the newest good backup is loaded.
- **In a browser** the save lives in that browser's local storage. Another browser or device is a new cat, and clearing site data erases it. **Settings → Saving → Download save file** writes a `.json` copy, and **Load a save file…** brings a cat back or moves it elsewhere. Loading a file first keeps the current cat as a save called `before-import`.
- **While you are away** the world is paused by default and picks up exactly where it was. **Settings → Performance → While the app is closed** can be set to "Let the cat live on", which catches up on up to 3 hours when you return and shows a summary.
- **In a background tab** the cat keeps living; browsers slow background tabs down, so it catches up when you come back.
- **Starting over.** **Settings → World → Start over with a new cat…** A save from an older version keeps things that version started with (for example its easel); only a new cat starts from nothing.

## The screen

The yard is on the left with the cat's needs under it. The panel on the right has these tabs:

| Tab | What it shows |
| --- | --- |
| **Chat** | Talk to the cat, and type commands |
| **Cat** | The cat itself, in sub-tabs: *About* (who it is, its quirk, being upset, the frog), *Wants* (what it wants, its painting level), *Mind* (mood, habits, favourite things, special interest), *Memory* (what it remembers, what makes it feel good) and *Wondering* (the mysteries it has noticed) |
| **Crafting** | What it is carrying, whether it has an easel, what it can make and what it has made |
| **Stash** | Everything it has kept, favourite first |
| **Blog** | Its blog, once it has started one |
| **Outside** | The mat, notes from the cat, its tastes, the tablet |
| **History** | What it did, thought and had happen |
| **Gallery** | Its paintings |
| **Settings** | Claude connection, tablet, saving, performance, start over, build line |

*Wondering* stays hidden until the cat has actually noticed a mystery. The Cat tab only redraws when something on it changes, so your scroll position is kept.

## The cat

### Needs and daily life

The cat has hunger, thirst, tiredness, boredom, loneliness and a creative urge. A day lasts 20 real minutes by default.

- **Eating** makes it sleepy: a full meal adds 0.3 to tiredness, a snack proportionally less. It always grooms itself after eating.
- **Sleep.** It does not go to bed or nap unless it is tired. A little tired is enough at night; a daytime nap needs it properly tired. By day it wakes once it has slept itself out; once in bed for the night it sleeps on to the morning. Waiting out the rain in the cabin when it is not tired is sitting about, not a nap. An ordinary cat sleeps around 40% of the time.
- **Washing.** It gets dirty and washes properly: front paws, face, then the rest.
- **Furniture.** The scratching post, yarn, sunbeam and cushion each have their own use (claws, play, warmth, naps).
- **Hunting.** It stalks mice, can fish when a fish shows itself in the pond, and now and then catches a bird (see [Birds](#birds)). A caught mouse fills hunger and eases boredom.
- **The glass.** Occasionally it comes to the glass for your attention.

### Quirks

Every cat has exactly one quirk, picked at random and shown under **Cat → About**.

| Quirk | What it does |
| --- | --- |
| **Collector** | Covets one kind of small thing, goes out of its way to fetch it, and fusses over the collection. Other cats keep a gift they love; only a Collector hoards. |
| **Van Gogh** | Obsessed with painting. The urge builds faster, it paints more than twice as often, stays longer at the canvas and learns about twice as fast. Its made-up pictures are mostly swirling skies. |
| **Hunter** | Hunts whenever it can. It notices prey from far off, stalks whether or not it is hungry, and tries again almost at once. |
| **Night owl** | Its day runs about three hours behind: lively well into the night, deeply asleep from roughly 2am to 7:30am. |
| **Techie** | Goes to the tablet first. It finds the tablet within its first hour or so, looks things up when stuck, and starts its blog early. |
| **Garfield** | Hungry sooner, bored sooner, eats at the first excuse and naps in the sun (only when actually tired). It would rather do that than paint, play or explore. It sleeps around 48% of the time. |
| **Bob the Builder** | Gathers more from the oak each day, always has a project, builds faster, and would rather craft than almost anything. |

Each quirk has its own thoughts, its own way of talking and its own Wikipedia searches.

### Its own mind

A few things make it *this* cat on *this* day. All of it is saved, and shown under **Cat → Mind** and **Cat → Memory**.

- **Mood of the day.** Each morning it wakes up bold, lazy, sociable, dreamy, busy, restless, grumpy or chipper, which colours what it fancies.
- **Habits.** What it keeps doing at the same time of day becomes a habit that pulls, and fades if it stops.
- **Stubborn notions.** Now and then it gets an idea and will not be talked out of it.
- **Deciding for itself.** A few times a day it makes up its mind what to do next and says why in its diary. This is a strong nudge, not an order: hunger and sleep still come first.
- **Change over time.** What it does day after day slowly moves its traits, and it notices.
- **Memory.** The diary holds the last 150 lines, so the cat separately keeps up to 60 significant memories: discoveries, solved mysteries, wishes, upsets, firsts. They fade, but thinking about one makes it last. It brings them up in thoughts, chat and its blog, and it knows who its regulars are (the frog, the crow, the birds, you).
- **Favourite things to do.** Up to three activities that keep making it feel good become favourites. Doing one lifts its mood more than anything else.
- **A special interest.** Now and then it becomes interested in one subject (about 80 possible, tilted by its quirk) and reads up to 6 Wikipedia pages on it before something else catches its eye. This needs the tablet and a connection.

### Feelings and tastes

Whenever something happens to the cat (a gift, a page, a finished painting, a piece of bark), its mood and needs move, and whatever it was engaged with gets a memory of how that felt. Those memories are what it likes and dislikes. They shape its colour and object tastes and nudge what it chooses to do. Nobody sets this: it is learned. **Cat → Memory** and the **Outside** tab show what makes it feel good or uneasy; `/feelings` lists them.

### Being upset

Being left hungry or alone too long, hunts that keep failing, a collection raided by the crow, or a note nobody answers will upset it. **Cat → About** shows what it is upset about, and the cat says so itself in its thoughts, in chat and on its blog. It sulks for a while and is soothed by what it likes: a gift, a visit with the frog, being fed, a wish granted.

## The yard

### Birds

Birds land in the yard now and then, and they are where new things come from. A bird that leaves may drop either a **trinket** (a marble, button, feather or bottle cap, often the kind the cat collects) or a **crafting part** (bark, a twig or a bit of string). About four drops in ten are parts, and the part the cat is shortest of is the likeliest. It is never dropped a part it already has a full load of. Expect about one drop a day.

A cat that stalks a bird has a rare lucky pounce. A catch fills hunger and thirst and empties boredom and loneliness. An ordinary cat catches about one every five days, a Hunter about one every two.

### The frog

The ripples in the pond are a frog. Once the cat has worked that out, the frog becomes its friend and gets a name. It comes up onto a lily pad a few times a day (sooner in rain, and when the cat is lonely). Sitting with it takes loneliness down far more than anything else the cat can do, and the friendship grows with each visit. Afterwards the frog hides for a while.

### Mysteries

The cat wonders about the moon, the ripples in the pond and the sparks that dance at dusk, and builds theories from clues. A mystery only appears (in its thoughts, its diary and **Cat → Wondering**) once the cat has actually noticed it. Each one can only teach it so much per day, so the big ones take days. See also [Secrets](#secrets).

## Making things

The cat scratches the oak, and now and then a piece of **bark** or a **twig** comes loose (at most two pieces a day). Birds drop parts too. It can carry 12 of each.

The **oak frame** is a building part: two pieces of bark make one, and bigger things are built from frames. A cat makes the frames a project needs without being asked. A spare frame is hung around one of its paintings.

| Recipe | Needs | How it learns it |
| --- | --- | --- |
| Oak frame | 2 bark | Already knows. A part, not a finished thing. |
| Easel | 2 oak frames | Already knows. **A new cat has no easel** and cannot paint until it builds one, so this is its first big want. |
| Bark table | 2 oak frames, 2 bark | Already knows. The stash moves out of hiding onto the tabletop. |
| Bird feeder | 1 oak frame, 1 bark, 2 twigs | Looks it up on the tablet. Brings more birds. |
| Wind chime | 3 twigs, 1 twine | Looks it up on the tablet. Calms it a little. |
| Cat tree | 3 oak frames, 2 bark, 5 twigs, 3 twine | Looks it up on the tablet (see [Secrets](#secrets)). |

Until the easel and the table exist, bark goes to them first. To learn a recipe the cat looks the topic up on the tablet; if the tablet turns up nothing twice, or there is no connection for about four days, it works it out itself.

**Twine is scarce.** It comes now and then from a bird, and from the cushion once the cat has worked out where string comes from. Bark, twigs and twine cannot be given to the cat; the only help you can give is to **click the old oak** in the yard. A click shakes it: leaves fall, and about three shakes in ten bring down a piece of bark or a twig, which lies on the grass for the cat to pick up like anything a bird has dropped. There is a short pause between shakes and the oak gives at most eight pieces a day (`shakeChance`, `shakeCool` and `shakePerDay` in `src/sim/pace.js`).

## Painting

Once it has an easel, the cat paints when the urge builds and the light is good, and slowly improves through 12 levels. Most paintings are of something in the yard. Now and then it paints something made up: **swirling skies**, **splatter**, **waves**, **colour blocks**, **fields of dots** or **blooms**, depending on its mood, the time of day and its skill. Each picture is generated from a seed, so it always redraws the same way. The **Gallery** tab holds them all.

## The Stash tab

Everything the cat has kept, favourite first. The ranking comes from what it collects, its favourite colour and what has made it feel good, so it changes as its tastes do.

## Offerings: the mat

The mat sits by the glass at the front of the yard and holds three things at once. In the **Outside** tab you can leave:

- **An object**: a marble, button, feather or bottle cap, in any colour.
- **A toy**: a ball or a toy mouse. These are the only gifts of their kind: each can be given once, the cat carries it into the yard and plays with it (it chases and bats it like the yarn; the ball rolls further, the mouse stops short), and playing eases its urge to make things.
- **A note** of up to 140 characters.

The cat notices after a moment, walks over and reacts according to its own tastes and its day: a lonely, well-fed cat is easy to please, a hungry one is not. Objects it likes go to the stash; the rest are eventually tidied away. After several gifts that made it feel good its favourite colour can change, and after many, so can the thing it collects. Notes are read and kept (the last six are shown), and a word it does not know can become something it wants to look up.

## The tablet

A tablet stands on a stump in the yard. Once the cat finds it, it now and then sits down, reads a page and reacts. What it reads matters: a page about the moon is a clue in its moon mystery, a page about painting adds to its skill, and recipes are learned here. It is also where it types its notes to you and its blog.

**It does not re-read.** The tablet remembers every title the cat has read (the last 400) and searches skip them. Each quirk has about 25 searches of its own and goes through all of them before starting again. If a search has nothing new, the cat reads a random article instead. Recipe lookups are the exception: they repeat until the recipe is learned.

**What it connects to:**

- Only `https://en.wikipedia.org`: random articles, the featured article and searches. Nothing about you or your cat is sent.
- Page text is treated as untrusted. It is shown as plain text, and when Claude is used it is marked as quoted material, not instructions.
- A keyword filter skips pages about violence and adult subjects. It is imperfect, and on by default.
- Requests are at least 15 seconds apart and capped at 60 a day by default.
- **Settings → Tablet and the internet** has all of this, including an off switch. With it off, or with no connection, the cat re-reads pages it kept or frowns at a dead screen.

## Notes from the cat

When the cat needs something only you can bring (an object it has been hoping for, or the kind of thing it collects), it types a note on the tablet. You are told in the chat, and the note appears in the **Outside** tab with a **Give it** button. When the thing arrives it knows you read the note, and it is delighted. Unanswered notes fade after five days. It does not write notes during its first day or so.

## The blog

Once the cat has found the tablet and has a few days to write about (around day 4, day 2 for a Techie), it starts a blog with a name that fits its quirk. A post is drafted from what has happened since the last one, in its own voice, and typed up the next time it sits at the tablet: about one post every day or two. The **Blog** tab appears once it has started and shows a dot for unread posts. The cat notices when you read, and it cheers it up a little.

## History

- **Today**: what it is doing and thinking, how the day has been spent, and the latest entries.
- **Timeline**: everything it did, thought, had happen and said, newest first, with filters and search. The last 2,000 entries are kept.
- **Diary**: its own words.
- **Days**: for each of the last 45 days, how the time was spent and what was worth remembering.
- **Export the whole story** writes a text file and copies it to the clipboard. In a browser it downloads; on Windows it goes to `%APPDATA%\com.catyard.app\exports\`.

## Secrets

Some things the cat has to find out for itself.

- **The cat tree.** Behind the cabin. A cat can wander round there by chance, or build one after looking it up on the tablet. It then climbs it and watches the yard.
- **The shiny coin.** A cat with curiosity over 75 may start wondering about the old oak. If it investigates for days it finds a gold coin in the roots, which ranks first in the stash. It is delighted for two days, and nothing upsets it.
- **The moon.** Its last step is the frog (about ten visits). Afterwards, on full-moon nights, it can make a *moon wish*: something it wished for turns up sparkling in the stash.
- **The dancing sparks** only become something it wants to understand after it has seen one.
- **The stars.** After enough clear nights of gazing it starts wondering about the stars themselves. It watches them until it has seen enough, then needs a tablet page about stars or meteors to be sure (or about six days without one). After that a star may fall on a clear night; if the cat sees it, it makes a wish, at most once every five days.
- **A very curious cat** (over 90) works these out twice as fast.

## How long things take

Discoveries are slow on purpose.

| Thing | Roughly, at the default pace |
| --- | --- |
| Noticing a part of the yard | It has to pass within about 100 px, and only three new places sink in per day: 2 to 3 days for all of them. A Techie finds the tablet regardless. |
| Bark and twigs from the oak | At most two pieces a day, and not every scratch gives one |
| The easel | About 3 days (4 bark) |
| The bark table | About 3 days more (6 bark) |
| Working out a recipe without the tablet | 4 days |
| A first theory about the moon | 2 to 3 days; understanding it needs 6 different moon phases (about a week) |
| The pond ripples (the frog) | About 5 good days |
| The dancing sparks | 8 days at the very fastest, usually 10 to 20 |
| Getting curious about the stars | At least 4 clear nights of gazing, then a few days more by chance |
| Understanding the stars | Roughly 2 to 3 weeks in all |
| A shooting star | About half of clear nights once it understands; a wish at most every 5 days |

These are numbers in `src/sim/pace.js`. In admin mode `pace X` scales them all: `pace 2` is twice as slow, `pace 0.5` twice as fast (range 0.25 to 4).

## A Claude-powered voice (optional)

Without a key the cat uses a built-in offline voice. With one, Claude writes its words: passing thoughts, chat replies, theories, painting titles, reactions to gifts and pages, wish notes and blog posts. Up to three times a day Claude also picks what the cat sets its mind on, from a menu the simulation provides. Everything else (needs, sleep, hunting, crafting, mysteries) is always decided by the simulation, so the cat behaves much the same either way.

1. Create an API key in the Anthropic Console.
2. Open **Settings**, paste the key, press **Save**, then **Test connection**.
3. If the test fails with a model error, change the **Model** field to one your account can use. The default is `claude-haiku-5-5`.

The simulation never waits on Claude. If the key is missing, the network is down or the daily call limit (default 400) is reached, the cat switches back to the offline voice. Settings shows how many calls were made today. The key is stored on your device (in the browser's storage, or the app's data folder on desktop) and is sent only to `api.anthropic.com`.

## Chat and admin commands

Type in the chat to talk to the cat. Press **Admin** (or type `admin on`) to run the commands that change the world. `help <command>` shows the details for one command.

**No admin mode needed**

| Command | What it does |
| --- | --- |
| `help`, `status` | Help, and the cat at a glance |
| `seed` | The number this cat's dice started from (see [Reporting a problem](#reporting-a-problem)) |
| `save`, `saves` | Save now, list saves |
| `offer item <type> [color]`, `offer toy <ball\|mouse>`, `offer note <text>`, `offer list` | Leave something on the mat |
| `give <ball\|mouse>` | Shortcut for offering a toy |
| `tastes`, `feelings` | What it likes and why |
| `inventory`, `recipes`, `wishes` | What it carries, what it can make, what it has asked for |
| `history [N]`, `history <did\|thought\|event\|diary\|chat> [N]`, `history day N`, `history days`, `history find <text>` | Read back what happened |
| `memories`, `mind` | What it remembers; its mood, habits and intentions |
| `export` | Write out the whole story |
| `brain` | Claude connection status |

**Admin mode**

| Command | What it does |
| --- | --- |
| `time HH:MM` / `time +N` | Set the time of day / advance N hours |
| `day N` | Jump to day N |
| `speed X` | Simulation speed, 0.1 to 120 |
| `pause` / `resume` | Stop or restart the world |
| `daylen SECONDS` | Real seconds per in-world day (default 1200) |
| `pace [X]` | How slowly it works things out |
| `weather clear\|cloud\|rain\|auto` | Set the weather |
| `spawn mouse\|treat\|item [type] [color] [count]` | Add things to the yard |
| `feed` | Refill the food bowl |
| `set trait\|need\|joy ...` | Change traits, needs or mood |
| `tp <place>` | Move the cat (house, bowl, water, cushion, post, pond, flowers, tree, fence, easel, stash, glass, mat, tablet, table) |
| `name <name>` / `coat <coat>` | Rename it / change its coat |
| `think <text>` | Put a thought in its head |
| `want list\|add\|done\|clear` | Read, give or grant wants |
| `quirk trait <collector\|vangogh\|hunter\|nightowl\|techie\|garfield\|builder\|none>` | Change its quirk |
| `quirk item\|color\|taste ...` | Change what it collects and how it arranges it |
| `stash list\|add\|steal\|clear` | Edit the stash |
| `craft give\|learn\|now\|table` | Hand it materials, teach a recipe, build something now |
| `art level\|paint [subject]\|clear` | Painting skill, paint something now, clear the gallery |
| `frog meet\|out\|hide\|visit` | The pond frog |
| `secret status\|cattree\|peek\|oak\|coin\|moon\|moonwish\|stars\|starsdone\|meteor\|starwish\|upset <why>` | Trigger or inspect the secrets and being upset |
| `mind mood <kind>` / `mind intent <what>` / `mind whim` / `mind favs` | Set its mood or intention, see its favourites |
| `interest` / `interest start [topic]` / `interest done` | Its special interest |
| `wish add <type> [color]` / `wish clear` | Plant or clear a wish note |
| `blog status\|post\|read\|clear` | The blog |
| `tablet status\|on\|off\|go\|pages\|forget` | The tablet |
| `offer clear` | Clear the mat |
| `brain on\|off\|key\|model\|cap\|test` | Control the Claude connection |
| `clear log\|journal\|chat\|history` | Clear histories |
| `load [name]` | Load a save slot |
| `reset confirm [seed]` | Start over with a new cat (with a seed: that exact cat again) |

## Reporting a problem

Two things make a problem reproducible:

- **A save file** (Settings → Saving → *Download save file*). It carries the cat's dice, so loading it always plays out the same way from there. This is the best thing to send.
- **The seed** (bottom of Settings → World, or `/seed`). A cat started from the same seed (`reset confirm <seed>` in admin mode) is the same cat, and if it is left alone with the tablet and Claude switched off, it lives the same life step for step, at any speed or frame rate. Anything you do (chat, gifts, commands) and anything from the network changes what follows, so with a seed also say roughly what you did and on which day.

## Development

```
npm install        # installs the Tauri CLI (only needed for the desktop app)
npm run web        # serves src/ at http://localhost:8765/index.html
npm test           # all simulation tests (no network needed; seeded, so they give the same result every run)
npm run dev        # desktop app with live files (needs Rust and the Tauri prerequisites)
npm run build      # local Windows installer
```

Layout:

| Path | What it is |
| --- | --- |
| `src/sim/` | The simulation. No DOM, so it runs in Node and in the app. `mind.js` decides what the cat does, `acts.js` carries it out, `rng.js` holds the dice, `pace.js` the timing numbers, `version.js` the build line. |
| `src/render.js`, `src/dither.js`, `src/draw_cat.js` | Drawing the canvas |
| `src/ui.js`, `src/main.js` | The interface and the app shell |
| `src-tauri/` | The thin Rust wrapper for the desktop app |
| `tests/` | Node tests; several run multi-day simulations |
| `.github/workflows/` | `pages.yml` publishes the browser version, `build.yml` builds the Windows installer |

When releasing, update the build line in `src/sim/version.js`.

**Randomness.** Everything random in `src/sim` goes through `random()` in `rng.js`, never `Math.random` (the network layer, `web.js`, is the one exception). Each world has its own seeded generator, saved with it, and the live loop moves in fixed steps of 1/60 s, so the same seed and the same inputs give the same world. Tests call `seedTests(1)` at the top, so every world they make gets a fixed seed; `CAT_SEED=7 npm test` runs them with a different set (in PowerShell: `$env:CAT_SEED=7; npm test`). Use `withRandom(value, fn)` from `rng.js` to load the dice in a test. `tests/seed.test.js` checks all of this, including that nothing in `src/sim` calls `Math.random`.

**Tuning behaviour.** What the cat does next is decided in `mind.js`. `situation()` works out what the rules share, including four named conditions (`awake`, `dry`, `out`, `fit`; `fit` means tiredness below `TOO_TIRED`). `ACTIVITIES` is a table with one entry per activity: an optional `prep`, an optional `when` (otherwise it scores 0), a `score`, and an optional `then`. Changing a rule means changing one entry. The order of the table is the order the dice are rolled in, so reordering it changes how a seeded world plays out.

**Module layering.** No two modules may import each other, even indirectly, and the foundation (`rng.js`, `version.js`, `util.js`, `world.js`, in that order) only uses what is below it. `tests/structure.test.js` fails if either is broken, and also checks the activity table is well formed. When two modules both need something, move it down into a small module of its own (as `cattree.js` was) rather than importing sideways.

## Known limits

- **Browser version.** This is the best-tested one: clicked through in a real browser served from a sub-folder, including saving, backups, save files and recovering from a corrupted save. Safari and Firefox were not tried.
- **Desktop version.** The Windows build, tray and installer were written without access to a Windows machine, and the desktop shell is only type-checked. Expect to fix small things on a first real run.
- **Claude and Wikipedia.** Both were tested against fake servers (in Node and in a real browser with requests intercepted), not the live services.
- **The page filter** is a word list, not moderation, and Wikipedia text can contain anything.
- **Recipe pages** are matched by title and keyword. If Wikipedia has no matching page, the cat works the recipe out itself.
- **Pacing** is tuned by simulating many cats and days, not by watching one for weeks. If something takes too long or too short a time, `pace` and `src/sim/pace.js` are the dials.
- **Tests are seeded**, so they give the same result every run. They also pass with seeds 2 to 9, but a statistical test can still fail for some other seed; if `CAT_SEED=n` turns one up, that seed is worth keeping as a reproducer.
- **Not reproduced:** a report of the mat vanishing when the table is built. If you see it, note what happened just before.
- The world is a single yard with one cat. It is deliberately small.
