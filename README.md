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
- [Money: selling paintings and the tablet shop](#money-selling-paintings-and-the-tablet-shop)
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
| **Cat** | The cat itself, in sub-tabs: *About* (who it is, what it likes right now, favourite things to do, what makes it feel good, special interest, being upset, the frog), *Wants* (what it wants, what Claude decided), *Mind* (mood and what it does to its choices, habits, quirk), *Memory* (what it remembers, and the whole history) and *Wondering* (the mysteries it has noticed) |
| **Crafting** | What it is carrying, what it could make, what it has built, and a collapsible list of what it has made |
| **Treasure** | Everything it has kept, favourite first |
| **Blog** | Its blog, once it has started one |
| **Tablet** | Sub-tabs: *Mat* (what you leave, notes from the cat), *Wikipedia* (what it has read), *Account* (money, shop, recent ledger) and *Gallery* (painting level, paintings for sale and sold with price and dates) |
| **Settings** | Claude connection, tablet, saving, performance, start over, build line |

*Wondering* stays hidden until the cat has actually noticed a mystery. The Cat tab only redraws when something on it changes, so your scroll position is kept.

## The cat

### Needs and daily life

The cat has hunger, thirst, tiredness, boredom, loneliness and a creative urge. A day lasts 20 real minutes by default.

- **Eating** makes it a little sleepy: a full meal adds 0.16 to its tiredness, and a snack less. It always grooms itself afterwards.
- **Sleep.** It only goes to bed or naps when it is tired. At night a little tiredness is enough, but a daytime nap needs it properly tired. In the day it wakes as soon as it has slept enough; once it is in bed for the night it sleeps until morning. Sitting in the cabin out of the rain is not a nap. An ordinary cat sleeps about 40% of the time.
- **Washing.** It gets dirty and washes properly: front paws, face, then the rest.
- **Furniture.** The scratching post, yarn, sunbeam and cushion each have their own use (claws, play, warmth, naps).
- **Hunting.** It stalks mice, can fish when a fish shows itself in the pond, and now and then catches a bird (see [Birds](#birds)). A caught mouse fills hunger and eases boredom.
- **The glass.** Occasionally it comes to the glass for your attention.

### Quirks

Every cat has exactly one quirk, picked at random and shown under **Cat → Mind**.

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

A few things make it *this* cat on *this* day. All of it is saved and shown under **Cat → Mind** and **Cat → Memory**.

- **Mood of the day.** Each morning it wakes up bold, lazy, sociable, dreamy, busy, restless, grumpy or chipper, which colours what it fancies.
- **Habits.** What it keeps doing at the same time of day becomes a habit that pulls, and fades if it stops.
- **Stubborn notions.** Now and then it gets an idea and will not be talked out of it.
- **Deciding for itself.** A few times a day it makes up its mind what to do next and says why in its diary. This is a strong nudge, not an order: hunger and sleep still come first.
- **Change over time.** What it does day after day slowly moves its traits, and it notices.
- **Memory.** The diary only holds the last 150 lines, so the cat also keeps up to 60 memories that matter: discoveries, solved mysteries, wishes, upsets and firsts. They fade, but thinking about one keeps it alive. The cat brings them up in its thoughts, in chat and on its blog, and it knows its regulars (the frog, the crow, the birds and you).
- **Favourite things to do.** Up to three activities that keep making it feel good become favourites. Doing one lifts its mood more than anything else.
- **Special interests.** Now and then it becomes fascinated by one subject (about 80 on the list, tilted by its quirk, or a subject Claude chooses) and reads up to 6 Wikipedia pages on it. Interests are permanent: it keeps a list, rests about half a day, and then often goes back to one it loved, reading further each time. This needs the tablet and a connection.

### Feelings and tastes

Whenever something happens to the cat (a gift, a page, a finished painting, a piece of bark), its mood and needs move, and whatever it was engaged with gets a memory of how that felt. Those memories are what it likes and dislikes. They shape its colour and object tastes and nudge what it chooses to do. Nobody sets this: it is learned. **Cat → About** shows what it likes right now and what makes it feel good; `feelings` lists them in the chat.

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

The **oak frame** is a building part: two pieces of bark make one, and bigger things are built from frames. A cat makes the frames a project needs without being asked, and also makes them for its paintings: a painting in a frame is **put up for sale** (see [Money](#money-selling-paintings-and-the-tablet-shop)). Only three framed paintings are out for sale at a time; it frames the best one it has not framed yet.

**Recipes are worked out, not handed over.** A new cat knows no recipes. It gathers bark and twigs for the thing it wants most (the easel first, then the table), and the moment it is carrying what a thing is made of, the recipe comes to it: "I am carrying four bark and three twigs, and it came to me what that is for: an easel." (A frame counts as the two bark inside it.) Until then the Crafting tab does not list it.

The easel and the table need nothing more. The feeder, the chime and the cat tree also have to be looked up on the tablet, so they need both the parts and the research. Twine cannot be scratched off the oak, so when only twine is missing the cat waits for some, and starts wondering where string comes from. Once a recipe is found, the Crafting tab shows each part with how many the cat has and how many it needs.

| Recipe | Needs | How it learns it |
| --- | --- | --- |
| Oak frame | 2 bark | Always knows. A part, not a finished thing. |
| Easel | 2 oak frames, 3 twigs | Found by carrying the parts. **A new cat has no easel** and cannot paint until it builds one, so this is its first big want. |
| Bark table | 2 bark, 4 twigs | Found by carrying the parts. The stash moves out of hiding onto the tabletop. |
| Bird feeder | 1 oak frame, 2 bark, 1 twig, 1 twine | Found by carrying the parts, then looked up on the tablet. Brings more birds. |
| Wind chime | 2 oak frames, 2 twigs, 1 twine | Found by carrying the parts, then looked up on the tablet. Calms it a little. |
| Cat tree | 3 oak frames, 2 bark, 5 twigs, 3 twine | Found by carrying the parts, then looked up on the tablet (see [Secrets](#secrets)). |

Until the easel and the table exist, bark goes to them first, and if it is only short of twigs the oak gives them up more readily. To learn a recipe the cat looks the topic up on the tablet (only a recipe it has already found). If the tablet turns up nothing twice, or there is no connection for about four days, it works the recipe out itself. An older save keeps every recipe it already knew or had built.

**Twine is scarce.** It comes now and then from a bird, and from the cushion once the cat has worked out where string comes from. You cannot give the cat bark, twigs or twine. The one way to help is to **click the old oak** in the yard. A click shakes it, and about nine shakes in twenty (45%) bring down a piece of bark or a twig, which lies on the grass for the cat to pick up like anything a bird has dropped. There is a short pause between shakes, and the oak gives at most eight pieces a day (`shakeChance`, `shakeCool` and `shakePerDay` in `src/sim/pace.js`).

## Painting

Once it has an easel, the cat paints when the urge builds and the light is good, and slowly improves through 12 levels. Most paintings are of something in the yard. Now and then it paints something made up: **swirling skies**, **splatter**, **waves**, **colour blocks**, **fields of dots** or **blooms**, depending on its mood, the time of day and its skill. Each picture is generated from a seed, so it always redraws the same way. **Tablet → Gallery** shows every painting: the ones for sale (with the asking price and the day they went up), the ones that sold (with the price and the day), and the ones not yet framed. The same page shows its painting level.

## The Treasure tab

Everything the cat has kept, favourite first. The ranking comes from what it collects, its favourite colour and what has made it feel good, so it changes as its tastes do.

## Money: selling paintings and the tablet shop

A painting the cat has framed is **for sale**. Now and then (on average every 1.1 days, `PACE.saleDays`) a buyer turns up and it sells, for $4 plus up to $46 for how good it is (`PACE.priceBase`, `PACE.priceScore`), give or take a fifth: a poor painting fetches a few dollars, a fine one around $40. The money goes into the cat's account, which you can see in the **Tablet** tab under Account (and with `account`). A painting is priced when it is put up for sale, and sold paintings stay in the Gallery with their price and dates. The money is for the game only.

When it has money it sits down at the tablet and uses the **shop**, which currently sells:

| | Price |
| --- | --- |
| Bark | $3 each |
| Twigs | $4 each |
| Twine | $6 each |
| A ball | $28 |
| A toy mouse | $20 |
| A sprig of catnip | $12 |
| A tin of tuna | $8 |

It buys the bark, twigs or twine it is short of for what it means to make first (twine too: it cannot scratch that off a tree), and otherwise a toy it does not have yet, saving up if it cannot afford it (a Hunter prefers the mouse). It has at most two orders at a time. An order takes about a third of a day (`PACE.orderDays`) and then turns up on the **offering mat** as a parcel, which the cat opens: materials go into its things and a toy goes out into the yard. If the mat is full the parcel waits. Each toy exists once, so a toy it has ordered cannot also be given to it. More things will be added to the shop later.

## Offerings: the mat

The mat sits by the glass at the front of the yard and holds three things at once. In the **Tablet** tab (Mat) you can leave:

- **An object**: a marble, button, feather or bottle cap, in any colour.
- **A treat**: catnip or tuna. They are used up the moment the cat has them, so unlike toys they can be given or bought again and again (one of each kind on the mat or on order at a time). Catnip makes it roll about and be silly, which eases boredom and the urge to make things; tuna fills its tummy. The cat buys catnip when it is restless, and tuna when it is hungry, before it saves up for a toy. You give them from the same list as toys (`give catnip`, `give tuna`).
- **A toy**: a ball or a toy mouse. Each toy exists once, whether you give it or the cat buys it itself at the tablet shop. The cat carries it into the yard and plays with it (it chases and bats it like the yarn; the ball rolls further, the mouse stops short), and playing eases its urge to make things.
- **A note** of up to 140 characters.

The cat notices after a moment, walks over and reacts according to its own tastes and its day: a lonely, well-fed cat is easy to please, a hungry one is not. Objects it likes go to the stash; the rest are eventually tidied away. After several gifts that made it feel good its favourite colour can change, and after many, so can the thing it collects. Notes are read and kept (the last six are shown), and a word it does not know can become something it wants to look up.

## The tablet

A tablet stands on a stump in the yard. Once the cat finds it, it now and then sits down, reads a page and reacts. What it reads matters: a page about the moon is a clue in its moon mystery, a page about painting adds to its skill, and recipes are learned here. It is also where it types its notes to you and its blog.

**It does not re-read.** The tablet remembers every title the cat has read (the last 400) and searches skip them. Each quirk has 28 or 29 searches of its own and goes through all of them before starting again. If a search has nothing new, the cat reads a random article instead. Recipe lookups are the exception: they repeat until the recipe is learned.

**What it connects to:**

- Only `https://en.wikipedia.org`: random articles, the featured article and searches. Nothing about you or your cat is sent.
- Page text is treated as untrusted. It is shown as plain text, and when Claude is used it is marked as quoted material, not instructions.
- A keyword filter skips pages about violence and adult subjects. It is imperfect, and on by default.
- Requests are at least 15 seconds apart and capped at 60 a day by default.
- **Settings → Tablet and the internet** has all of this, including an off switch. With it off, or with no connection, the cat re-reads pages it kept or frowns at a dead screen.

## Notes from the cat

When the cat needs something only you can bring (an object it has been hoping for, or the kind of thing it collects), it types you a note on the tablet. You are told in the chat, and the note appears under **Tablet → Mat** with a **Give it** button. When the thing arrives, the cat knows you read the note and is delighted. Unanswered notes fade after five days, and an unanswered note makes it a little sad. It does not write notes during its first day or so.

If it is held up for want of bark or twigs and cannot afford to buy them, it asks you to **shake the oak** instead. Click the tree in the yard and the oak drops what it asked for, which answers the note. These notes have no Give it button, nobody sulks if they go unanswered, and they fade after three days.

## The blog

Once the cat has found the tablet and has a few days to write about (around day 4, or day 2 for a Techie), it starts a blog with a name that suits its quirk. Each post is drafted from what has happened since the last one, in the cat's own voice, and typed up the next time it sits at the tablet: about one post every day or two. The **Blog** tab appears once the blog has started and shows a dot for unread posts. The cat notices when you read it, and that cheers it up a little.

## History

The whole history lives under **Cat → Memory**, below what the cat remembers.

- **Today**: what it is doing and thinking, how the day has been spent, and the latest entries.
- **Timeline**: everything it did, thought, had happen and said, newest first, with filters and search. The last 2,000 entries are kept.
- **Diary**: its own words.
- **Days**: for each of the last 45 days, how the time was spent and what was worth remembering.
- **Export the whole story** writes a text file and copies it to the clipboard. In a browser it downloads; on Windows it goes to `%APPDATA%\com.catyard.app\exports\`.

## Secrets

Some things the cat has to find out for itself.

- **The cat tree.** Behind the cabin. A cat can wander round there by chance, or build one after looking it up on the tablet. It then climbs it and watches the yard.
- **The shiny coin.** A cat with curiosity over 75 may start wondering about the old oak. If it investigates for days it finds a gold coin in the roots, which ranks first in the stash. It is delighted for two days, and nothing upsets it.
- **The moon.** Its last step is the frog (about nine visits). Afterwards, on full-moon nights, it can make a *moon wish*: something it wished for turns up sparkling in the stash.
- **The dancing sparks** only become something it wants to understand after it has seen one.
- **The stars.** After enough clear nights of gazing it starts wondering about the stars themselves. It watches them until it has seen enough, then needs a tablet page about stars or meteors to be sure (or about six days without one). After that a star may fall on a clear night; if the cat sees it, it makes a wish, at most once every five days.
- **A very curious cat** (over 90) works these out twice as fast.

## How long things take

Discoveries are slow on purpose.

| Thing | Roughly, at the default pace |
| --- | --- |
| Noticing a part of the yard | It has to pass within about 110 px, and only three new places sink in per day: 2 to 3 days for all of them. A Techie finds the tablet regardless, and the old oak (the biggest thing in the yard) is noticed from about 2.6 times as far and does not use up the day's three. |
| Bark and twigs from the oak | At most two pieces a day, and not every scratch gives one |
| The easel | About 2.7 days with no help (4 bark and 3 twigs; measured over 24 cats: median 2.7 days, between 2.3 and 3.7). Noticing the oak is what starts it, and a cat that is desperate to paint can take up to `urgeExtra` more pieces from the oak a day. Clicking the oak helps |
| The bark table | A few days more (2 bark and 4 twigs) |
| Working out a recipe without the tablet | 4 days |
| A first theory about the moon | 2 to 3 days; understanding it needs 6 different moon phases (about a week) |
| The pond ripples (the frog) | About 5 good days |
| The dancing sparks | 7 days at the very fastest, longer if the cat is busy elsewhere |
| Getting curious about the stars | At least 4 clear nights of gazing, then a few days more by chance |
| Understanding the stars | Roughly 2 to 3 weeks in all |
| A shooting star | About half of clear nights once it understands; a wish at most every 5 days |

These numbers live in `src/sim/pace.js`. In admin mode `pace X` scales them all: `pace 2` makes everything twice as slow and `pace 0.5` twice as fast (from 0.25 to 4).

## A Claude-powered voice (optional)

Without a key the cat uses a built-in offline voice. With one, Claude writes its words: passing thoughts, chat replies, theories, painting titles, reactions to gifts and pages, wish notes and blog posts. Claude also makes some of the cat's choices, each from a menu of what is actually possible, with a reason in the cat's own voice that goes in its diary:

- **What it sets its mind on** (up to 3 times a day): the next thing it wants to do.
- **Its goals** (up to 3 questions a day): which of the possible wants it works towards over the next few days.
- **Its own projects** (up to 2 a day, at most 2 at once): something it thinks of itself, in its own words ("watch the sky until it does something"), with a reason, the everyday activity it mostly involves and how many times it means to do it (2 to 6). The activity gets a pull while the project lasts, each time it sets about it counts, and when the count is reached the project is done. Projects only exist with Claude connected; offline there are the stock wants.
- **What it paints** (up to 2 a day): the subject of the next painting, used once and only if it is still possible (no moon in daytime).
- **Its special interests:** what it becomes fascinated by (a subject from the list, one it has loved before, or one Claude invents), why, and up to 4 specific things to look up about it on Wikipedia. Interests are permanent: it keeps a list of its passions and goes back to them, reading further each time and never rereading a page.
- **Notes you leave on the mat:** Claude says what it makes of the note, writes a reply in the chat, and, if the note asks for something it could do, may decide to do it.

Everything Claude decides is listed, with the reason, under **What Claude decided** on the cat's Wants tab (`brain status` counts them too), so you can see it working. When a call fails, the status line says why in plain words: key not accepted, model not found, rate limited, out of credit, or offline.

Every choice has an offline fallback (the ordinary weighted choice), a daily budget, and a wait of a tenth of a day. If Claude does not answer in time, the cat decides for itself. Needs, sleep, hunting, crafting and mysteries are always decided by the simulation, so the cat behaves much the same either way.

**What it costs.** Most calls are small. Everything except chat and blog posts gets a short version of the cat's state (about 270 tokens, under half of the full one); chat and blog posts get the full state. Passing thoughts default to one every 7 minutes (`museEvery`, 420 seconds), and the daily cap defaults to 250 calls. Settings and `brain status` show the calls and tokens used today. Prompt caching is not used, because the part of each call that never changes (about 600 tokens) is shorter than the smallest amount that can be cached.

1. Create an API key in the Anthropic Console.
2. Open **Settings**, paste the key, press **Save**, then **Test connection**.
3. If the test fails with a model error, change the **Model** field to one your account can use. The default is `claude-haiku-5-5`.

The simulation never waits on Claude. If the key is missing, the network is down or the daily limit (250 calls by default) is reached, the cat goes back to its offline voice. The key is stored on your device (in the browser's storage, or the app's data folder on desktop) and is only ever sent to `api.anthropic.com`.

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
| `account` (also `money`), `shop` | Its money, what is for sale, what is on its way and recent sales; what the shop sells. `account add <n>` (admin) adds money |
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

**Docs test.** `tests/docs.test.js` reads this README and checks every number and name it quotes (recipe costs, shop prices, caps, timings, tab names) against the constant in the code. If you change one of those, the test tells you which sentence to update.

**Balance test.** `tests/balance.test.js` runs the cat for 8 days under every temperament (and none), on two fixed seeds, and checks the everyday rhythm stays inside a band: sleep share, night-time wakefulness (night owl has its own band), hunts and meals per day (hunter has its own), no long stretches of near-starving or thirst, and that it still paints. The bands are measured values widened by about a third, a tripwire for tuning drift rather than a statement of ideals. If you change tuning on purpose and it trips, check it feels right, then move the band in the test. It takes a few seconds.

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
- **Tests are seeded**, so they give the same result every run. They also pass on seeds 1 to 5, 7 to 9, 11 and 12. Two seeds are known to trip a statistical test: `CAT_SEED=6` (the Van Gogh balance band, hungry too much of the time) and `CAT_SEED=10` (the night owl is up less after midnight than the test expects). If another seed turns one up, keep it as a reproducer.
- **Not reproduced:** a report of the mat vanishing when the table is built. If you see it, note what happened just before.
- The world is a single yard with one cat. It is deliberately small.
