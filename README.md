# Cat Yard

A small world where a cat lives on its own and you watch. It has needs, moods and a personality, but also wants: it collects small objects in a hidden stash, paints with its paws and slowly gets better, and keeps theories about the mysteries of the yard (the moon, ripples in the pond, sparks at dusk). Each cat also has a **temperament** (Van Gogh, Hunter or Night owl), can occasionally catch a bird, and can make friends with a **frog** from the pond. You can talk to it, and an admin mode lets you change the world.

The whole yard is drawn in a dithered, low-resolution pixel style (ordered Bayer dithering, so the pattern holds still instead of shimmering), including the cat's paintings.

Two things connect the cat to the outside world, in the spirit of Pino's World: **offerings** you leave on a mat, and a **tablet** that shows it real pages from Wikipedia and lets it leave notes for you. The cat also **makes things** out of bark from the oak, **learns what it likes from how things make it feel**, and everything it does and thinks goes into a **History** you can read and export.

It is a plain-JavaScript simulation with no bundler and no framework, so it runs as a normal web page in any modern browser. An optional Tauri v2 wrapper turns the same files into a small Windows desktop app (see the end of this section).

## Play it in your browser (GitHub Pages)

GitHub hosts the game for you and gives it a web address. No installer, nothing to build.

1. Create a GitHub repository and upload this whole folder to it (keep the `.github/workflows` folder: it holds `pages.yml`).
2. In the repository open **Settings → Pages**, and under **Source** choose **GitHub Actions**. (You only do this once.)
3. Open the **Actions** tab. The **Publish the game (GitHub Pages)** workflow runs by itself on every push to `main` (or `master`); you can also start it with **Run workflow**. It takes about a minute.
4. When it is green, your game is at `https://YOUR-NAME.github.io/YOUR-REPOSITORY/`. The same link is shown on the workflow run.

To update the game later, change the files in the repository; the page republishes itself.

Browser notes:

- The cat lives while the tab is open, including in a background tab (browsers slow background tabs down, so it catches up when you come back). If you close the tab or the browser, the world is paused: the cat picks up exactly where it was, and nothing happens while you are away. (Settings > Performance > *While the app is closed* can switch this to "Let the cat live on", which catches up on up to 3 hours when you return and shows a summary of what it did.)
- The save lives in that browser's local storage. A different browser or device is a different (new) cat, and clearing site data erases it. **Settings → Saving → Download save file** writes a `.json` copy you can keep, and **Load a save file…** brings a cat back or moves it to another browser or computer. Loading a file first keeps the current cat as a save called `before-import` (`/load before-import` in admin mode restores it).
- Autosave works as on the desktop: every few minutes, whenever the tab is hidden or closed, and with `/save`. The last 3 backups are kept (one new backup at most every 10 minutes), and if the main save is ever unreadable the newest backup is loaded instead.
- If you use a Claude API key, it is stored in that browser and sent only to api.anthropic.com. The tablet only contacts en.wikipedia.org.

## Run it on your own computer

```
npm run web
```

Then open <http://localhost:8765/index.html>. Any static file server pointed at the `src` folder works if you do not have Node (for example `python -m http.server 8765` from inside `src`). Opening `index.html` directly from a folder does not work, because browsers block ES modules on `file://` pages.

## Optional: the Windows desktop app

The same game wrapped as a Windows app with a tray icon (closing the window tucks the cat into the tray; saves are real files). The installer is built by GitHub, not on your machine.

1. Push this folder to a GitHub repository.
2. Open the **Actions** tab, choose **Build Windows installer**, and press **Run workflow**. (Pushing a tag such as `v0.1.0` does the same.)
3. When it finishes (a first run takes about 10 minutes), open the run and download the **cat-yard-windows-installer** artifact. Inside is a `.exe` installer. It installs for the current user only and needs no admin rights.

That workflow runs the simulation tests first and stops if they fail. In the desktop app:

- Closing the window saves and tucks the cat into the system tray. By default the world is paused while it sits there (Settings > Performance > *While the app is closed* can let it live on instead). Left-click the tray icon to bring it back; right-click for **Save and quit**.
- You can turn the tray behaviour off in **Settings → Performance**, so closing really quits (it still saves first).
- Saves are written atomically (temp file then rename) with the last 3 backups, in `%APPDATA%\com.catyard.app\saves\`.

## Saving (both versions)

Saves happen automatically every 3 minutes (configurable), whenever the window or tab is hidden or closed, and whenever you type `/save`. If the main save is ever corrupt, the newest good backup is loaded instead. Frame rate drops when the window is not focused, and **Eco** mode caps it at 15 fps.

## Giving the cat a Claude-powered mind (optional)

Without a key the cat uses a built-in offline voice built from what it actually knows and wants. With one, its thoughts, chat replies, theories and painting titles come from Claude.

1. Create an API key in the Anthropic Console.
2. Open **Settings**, paste the key, press **Save**, then **Test connection**.
3. If the test fails with a model error, change the **Model** field to a model your account can use. The default is `claude-haiku-5-5`.

The simulation never waits on Claude. If the key is missing, the network is down or the daily call limit (default 400) is reached, the cat just switches back to the offline voice. The key is stored in plain text in `settings.json` in the same app data folder and is only ever sent to `api.anthropic.com`.

## Offerings: the mat

The mat sits by the glass at the front of the yard. Open the **Outside** tab to leave an object (a marble, button, feather or bottle cap, in any colour) or a note of up to 140 characters. It holds three things at once.

- The cat notices after a moment, walks over, looks at it and reacts according to its own tastes. Objects it likes go to the stash; ones it does not are left on the mat and eventually tidied away.
- What it likes is not a fixed table (see *Feelings and tastes* below). A gift lands differently depending on the cat's day: a lonely, well-fed cat is easy to please, a hungry one is not. After several gifts that made it feel good, the favourite colour can change, and only after many can the thing it collects change. The **Outside** tab shows what it likes right now and how each offering was received.
- Besides objects and notes you can leave **materials**: bark, twigs and twine (see *Making things*).
- Notes are read, kept (the last six are shown) and their words are learned. A word it does not know can become something it wants to look up on the tablet.
- With a Claude key set, the cat's reaction to an offering is rewritten by Claude. Without one it uses its built-in lines. Offerings work either way.

Chat commands (no admin mode needed): `offer item <type> [color]`, `offer material <bark|twig|twine>` (or just `give <material>`), `offer note <text>`, `offer list`, `tastes`, `feelings`. `offer clear` needs admin mode.

## Quirks: Collector, Van Gogh, Hunter, Night owl, Techie, Garfield, Bob the Builder

Every cat has exactly one quirk, picked at random for a new cat and shown in the **Cat** tab under *Quirk*. Cats from an older save get one the first time they are loaded.

- **Collector**: covets one kind of small thing, goes out of its way to fetch it, hides the collection (or lays it out on its table) and fusses over it. Other cats keep a gift they love, but only a Collector hoards.
- **Van Gogh**: obsessed with painting. The urge to create builds faster, it paints more than twice as often (even when tired or hungry), stays longer at the canvas, learns the craft about twice as fast, and is never quite finished. Its made-up pictures are mostly swirling skies.
- **Hunter**: hunts whenever it can. It notices mice and birds from far off, stalks them whether or not it is hungry and tries again almost at once.
- **Night owl**: its day runs about three hours behind: lively well into the night, deeply asleep from roughly 2am to 7:30am.
- **Techie**: goes to the tablet first. When it cannot work something out it looks it up, searches for things that fit its interests, and starts its blog early.
- **Garfield**: hungry sooner, eats at the first excuse, naps in the sun and on the cushion, and would much rather do that than paint, play or explore.
- **Bob the Builder**: gathers more from the oak each day, always has a project, builds faster, and would rather craft than just about anything.

Each quirk has its own thoughts and its own way of talking in chat, and its own Wikipedia searches (a Van Gogh looks up Impressionism, a Hunter looks up lynxes, a Builder looks up beaver dams and so on). In admin mode `quirk trait <collector|vangogh|hunter|nightowl|techie|garfield|builder|none>` changes it.

## Birds

Birds land in the yard now and then. A cat that stalks one has a **rare** lucky pounce (a few percent per stalk, a little better for a skilled hunter). If it works, the bird is caught: hunger and thirst are filled, and boredom and loneliness are emptied. A feather drops, and it goes into the history. The odds are the same for every cat; the Hunter only gets more tries, so expect roughly one catch every ten or so days for an ordinary cat and one every few days for a Hunter. Mice work as before.

## The frog

The ripples in the pond are a frog. Once the cat has worked that mystery out (see *How long things take*), the frog becomes its friend and gets a name. It lives on a lily pad at the near edge of the pond, comes up a few times a day for a while and then goes back under (it comes up sooner in the rain and when the cat is lonely).

When the cat is lonely and the frog is out, it goes and sits with it. A visit takes **loneliness down a lot** (about 0.55 to 0.75 depending on how well they know each other), far more than anything else it can do for company, and the friendship grows with each visit. After a visit the frog hides for a while, so it cannot be used all day. The **Cat** tab shows the frog, whether it is out, how many visits there have been, and a bond meter. A cat whose pond mystery was already solved in an older save meets its frog the first time that save is loaded. `frog` in admin mode: `frog meet|out|hide|visit`.

## How long things take

Discoveries are slow on purpose, and each mystery can only teach the cat so much per day however busy it is, so the big ones take days.

| Thing | Roughly, at the default pace |
| --- | --- |
| A first theory about the moon | 2 to 3 days; understanding it needs 6 different moon phases (about a week) |
| The pond ripples (the frog) | about 5 good days, it can learn from the pond once a day |
| The dancing sparks | about 8 days at the very fastest, usually 10 to 20 (it can learn six things a day from them) |
| Bark and twigs from the oak | at most two pieces a day, and not every scratch gives one |
| Working out a recipe without the tablet | 4 days |
| Noticing a part of the yard (pond, tree, easel, tablet…) | it has to get within about 100 px of it, and only three new things sink in per day: about 2 to 3 days for all of them |
| The bark table | about 6 days (it has to find the oak first, then gets two pieces a day) |
| Getting curious about the stars | at least 4 clear nights of gazing, then a few days more by chance (usually day 4 to 9) |
| Understanding the stars | roughly 2 to 3 weeks in all: about 12 clues (three a day), then a page on the tablet (or 6 days without it) |
| A shooting star | on about half of clear nights once it understands; a wish at most every 5 days, and only if it is looking |

All of these are numbers in `src/sim/pace.js`. In admin mode `pace X` scales them all at once: `pace 2` is twice as slow, `pace 0.5` twice as fast, `pace 1` the default (range 0.25 to 4). It is saved with the cat, so a save made before this change simply starts at 1.

## Feelings and tastes

Whenever something happens to the cat (a gift, a page, a finished painting, a piece of bark, a visit to the stash, something it made), its mood and needs move: it may feel warm, thrilled, soothed, proud, uneasy or let down. Whatever it was engaged with gets a memory of how that felt, and those memories are what it likes and dislikes. They feed the colour and object tastes, and nudge what it chooses to do (a cat that finds painting rewarding paints a little more). It says so in its diary when a feeling has settled into a preference. The **Cat** and **Outside** tabs show what currently makes it feel good and what makes it uneasy; `/feelings` lists them. Nobody sets this: it is learned.

## Making things

The cat scratches the oak, and now and then a piece of **bark** or a **twig** comes loose. It can carry 12 of each. Pieces collect in a small pile (beside the table once there is one). What it can make:

| Recipe | Needs | How it learns it |
| --- | --- | --- |
| Bark table | 4 bark | Already knows. The stash moves out of hiding onto the tabletop. It builds this first: until it exists, bark is saved for it. |
| Bark frame | 2 bark, 1 twig | Already knows. Frames its best painting, which then stands on the table. |
| Bird feeder | 3 bark, 2 twigs | Looks it up on the tablet. Draws more birds. |
| Wind chime | 3 twigs, 1 twine | Looks it up on the tablet. Calms it a little. |

When it wants to make something it does not know, it goes to the tablet and looks the topic up; the page it reads is what unlocks the recipe. If the tablet turns up nothing twice it works it out itself, and with no connection it does the same after about four days. **Twine can only come from you** (leave it on the mat, or use `/give twine`); it cannot be found in the yard. The **Cat** tab shows what it is carrying, what it knows how to make and what it has made.

## The yard, washing and being upset

- **Furniture gets used.** The scratching post, the yarn, the sunbeam and the cushion all have their own reasons to be visited (sharpening claws, play, warming up, napping). The cushion is also where string comes from once the cat has worked out that its stuffing is held in by string (see *Making things*): it will pull some out of its bed when it needs it.
- **Washing.** It has a proper routine now: it gets dirty, and it washes (front paws, face, then the rest) instead of a quick lick.
- **It can get upset.** Being left hungry for too long, being alone for too long, a hunt that fails again and again, a collection raided by the crow, and a note on the tablet that nobody answers all upset it. The Cat tab shows *Upset* and why, it sulks and avoids things for a while, and it is soothed by what it likes: a gift on the mat, a visit with the frog, being fed, a wish granted.
- **Birds leave things.** Items turn up in the yard because a bird dropped them, not at random.
- **Hunting.** Every cat can catch a bird now (about one every five days for an ordinary cat, about one every two for a Hunter). It can also fish in the pond when a fish shows itself, and a caught mouse fills hunger and takes a bit off boredom. Wants like "catch 5 mice" or "catch 5 birds" come up.
- **The glass.** It comes to the glass for attention much less often than it used to.

## Its own mind

Beyond hunger, sleep and the rules in `mind.js`, a few things make it *this* cat on *this* day. All of it is saved with the cat, and the Cat tab shows it under *On its mind*, *Favourite things to do*, *Special interest* and *What it remembers*.

- **Deciding for itself.** A few times a day (about every fifth of a day, when it is not hungry, sleepy, upset or asleep) the cat makes up its mind what it wants to do next, and says why in its diary. The simulation works out what is possible right now; with Claude connected, Claude is shown that menu with the cat's mood, habits, memories and wants and picks one in the cat's voice (at most three times a day). With no Claude, or no answer in time, a built-in whim picks from the same ingredients. The pick is a strong nudge, not an order: hunger and sleep still come first. Whether it did what it set out to do is noted too.
- **Deeper memory.** The diary only holds the last 150 lines, so the cat keeps the significant things for itself (up to 60): big discoveries, solved mysteries, wishes, being upset, firsts of anything. They fade with the days but each time it thinks about one it lasts longer, so a few stay for good. It brings them up in its thoughts, in chat ("yesterday...", "remember when..."), on its blog and in what Claude is told. It also keeps count of who keeps turning up (the frog, the crow, the birds, the mice, you) so it can say they are regulars. It does not name individual visitors, only events.
- **More natural behaviour.** Four things nudge its choices without being rules. *Moods of the day*: each morning it wakes up bold, lazy, sociable, dreamy, busy, restless, grumpy or chipper (tilted by yesterday and the weather, not decided by them) and that colours what it fancies. *Habits and rituals*: what it keeps doing at the same time of day becomes a habit that pulls, and fades if it stops. *Stubborn impulses*: now and then it gets a notion and will not be talked out of it (the stubborner it is, the more often). *Change over time*: what it does day after day slowly moves its traits, and it notices ("I think I am getting bolder").
- **A special interest.** Now and then, for no reason it can explain, it becomes interested in one thing (octopuses, lighthouses, tea... about 80 subjects, tilted a little by its quirk). It goes after it on the tablet, page after page of Wikipedia on that subject (6 pages, or until there is nothing more), keeps what it learned, and talks, writes and wonders about it. Then something else catches its eye. Needs the tablet found and internet; without it, it just does not start one.
- **Favourites and finds.** What it comes across for itself (a button in the grass, a new corner of the yard) shapes what it likes as much as what it is given. And the things it *does* that keep making it feel good become **favourite things to do** (at most three, and they can change over time: sitting with the frog, painting, gazing at the sky...). Doing a favourite is a bigger boost than anything else: the mood lifts faster while it happens, it takes more off boredom and loneliness, it leaves a glow behind, and the cat goes for it whenever it can.

## Secrets

Some things the cat has to find out for itself, and the Cat tab hides them until it has:

- **The cat tree.** Behind the cabin. A cat can wander round there by chance (a few percent a day), or, once it has looked up cat trees on the tablet and gathered a lot of bark, twigs and twine, build one. It then climbs it, sits at the top and watches the yard.
- **The shiny coin.** A cat with curiosity over 75 may start wondering about the old oak. If it investigates for long enough (days, not minutes) it finds a gold coin in the roots. The coin goes in the stash (and ranks first), and the cat is *delighted* for two days: nothing upsets it.
- **A very curious cat** (over 90) works out the moon's secret and the oak's secret twice as fast.
- **The moon.** Its last step is the frog (about ten visits). Afterwards, on full-moon nights, the cat can make a *moon wish*: something it has wished for turns up and sparkles in the stash.
- **The dancing sparks** only become something it wants to understand after it has actually seen one.
- **The stars.** A cat that has spent enough nights gazing at the sky (four clear ones, then a little luck each sixth of a day; night owls are likelier) starts wondering about the stars themselves, not the moon. It then watches them on clear nights (a few clues a day) until it has watched enough, and needs the tablet to be sure: reading a page about stars or meteors is the last step, or, with no tablet, about six days of living with it. After that, **on a clear night a star may fall** (it is drawn crossing the sky). If the cat is awake and outside it sees it (always, if it went out to gaze), and it makes a wish: something it likes turns up glittering in the yard, or exactly what it had written to the human asking for. At most one wish every five days. A cat with curiosity over 90 works this out twice as fast too. Reading about the stars on the tablet can also start the wondering.

Admin: `secret status|cattree|peek|oak|coin|moon|moonwish|stars|starsdone|meteor|starwish|upset <why>`. The pond mystery is shorter than it was; the first meeting with the frog sets loneliness to zero.

## The Stash tab

A list of everything the cat has kept, favourite first. The ranking comes from what it collects, its favourite colour and what has made it feel good, so it changes as its tastes change.

## Painting: made-up pictures

Most paintings are of something in the yard (the pond, the oak, the moon, rain, the flower bed...). Now and then the cat paints something it made up instead, and the picture is generated from a seed, so it always redraws the same way: **swirling skies**, **splatter**, **waves**, **colour blocks**, **fields of dots** and **blooms**. Which style depends on its mood and the time of day (swirls at night, blooms when it is happy, waves when it is tired or raining, splatter when the urge to create is high) and on its skill: beginners only manage scribbles and splatter, the rest unlock as it improves, and the finer details arrive with level. The yard scenes also get extra things now (hills, a tree line, a fence, a lantern, the sun, stars, a flock of birds), different every time. Older paintings in a save are drawn exactly as they were. In admin mode `art paint <subject>` makes it paint one: moon, pond, oak, stash, sunbeam, rain, flowers, bird, yard, window, swirl, splatter, waves, blocks, dots or bloom.

## The blog

Once the cat has found the tablet and has a few days of life to write about (day 4 or so, day 2 for a Techie), it starts a blog. The name fits its quirk ("Lasagna Mondays", "Letters From the Easel", "Notes From the Tall Grass", "paw.log"...). A post is drafted from what has happened since the last one: a few things from its diary, how it feels, what is on its mind and what it wants, in the voice of its quirk. The next time it sits at the tablet it types it up (you will see it typing), and about one post every day or two follows.

The **Blog** tab appears once it has started. New posts are tagged *new* and the tab shows a dot until you have read them; the cat notices when you read, and it cheers it up a little. With the Claude connection on, each post is rewritten in the cat's own words from the same facts. The blog is included in `export`. Admin: `blog status|post|read|clear` (`blog post` makes it write one now).

## Notes from the cat

When the cat needs something only you can bring (twine for a chime it wants to make, an object it has been hoping for), it drafts a note, then goes to the tablet and types it out. You are told in the chat, and the note appears in the **Outside** tab with a **Give it** button that leaves the right thing on the mat. When what it asked for arrives it knows you read the note, and it is delighted. Notes nobody answers fade after five days. It does not write notes during its first day or so here. With a Claude key set, the wording of each note comes from Claude. `/wishes` lists them; `/wish add <type> [color]` (admin) plants one.

## History: what it did and thought

The **History** tab replaces the old Journal.

- **Today**: what it is doing and thinking now, how today has been spent so far, the day's highlights and the latest few entries.
- **Timeline**: everything it did (each thing it set out to do), thought, had happen and said, newest first, with filters and a search box. The last 2,000 entries are kept.
- **Diary**: its own words.
- **Days**: for each of the last 45 days, how the time was spent (sleeping, painting, on the tablet…) and the things worth remembering.
- **Export the whole story** writes a text file (the days, the diary, the timeline, its things, its notes to you) and copies it to the clipboard. On Windows the file goes to `%APPDATA%\com.catyard.app\exports\`; in a browser it downloads. `/export` does the same.

With *While the app is closed* set to "Let the cat live on" (it is "Pause the world" by default), the world catches up after you were away and the summary says what it gathered, made and wrote; the catch-up adds events and diary lines to the history but not every moment-to-moment step.

Chat commands (no admin mode needed): `history [N]`, `history <did|thought|event|diary|chat> [N]`, `history day N`, `history days`, `history find <text>`, `export`, `inventory`, `recipes`, `wishes`, `feelings`.

## The tablet

A tablet stands on a stump in the yard. Once the cat finds it, it now and then walks over, sits down and reads a page, then reacts to it. What it reads shapes what it wants next: an article about the moon is a clue in its moon mystery, one about ponds or fireflies likewise, a page about painting adds to its skill, and a word it wants to know gets looked up. It keeps its last 24 pages and a list of interests, which pick what it reads next.

**It does not keep reading the same things.** The tablet remembers the title of every page the cat has read (the last 400) and every search skips them: a search asks Wikipedia for the first ten results, drops the ones already read and picks one of the first few new ones at random, and if a search has nothing new left the cat reads a random article instead. Each quirk has about 25 searches of its own and goes through all of them before starting a round again; the words it picks up from the notes you write and the pages it reads are rotated so it does not look up the same word twice running. A special interest still reads page after page on its one subject, never the same page twice, and simply runs dry when there is nothing more. A word it specifically wants to know is looked up once, skipping what it has read; if Wikipedia has nothing new on it, it gives the want up. Recipe lookups are the exception: they keep going back until the cat has learned the recipe. It is also where it looks up how to make things, and where it types its notes to you. Writing a note works with no connection.

What this connects to, exactly:

- Only `https://en.wikipedia.org`. Random articles, the featured article of the day, and searches for words the cat is curious about. Nothing about you or your cat is sent. The desktop build's permissions (`capabilities/default.json` and the content security policy) allow that one host plus `api.anthropic.com`, and nothing else.
- Page text is untrusted. It is shown as plain text, never as markup, and when Claude is used it is marked in the prompt as quoted material, not instructions.
- A simple word filter skips pages about violence and adult subjects. It is a keyword list, so it is imperfect; it can be turned off but is on by default.
- Requests are slow and capped: at least 15 seconds apart and 60 a day by default. All of this is under **Settings → Tablet and the internet**, including an off switch. With it off, or with no connection, the cat re-reads pages it already kept, or frowns at a dead screen.
- The cat only waits a short while for a page, so a slow connection never stalls the world. Catching up after you were away makes no requests.

Chat commands (admin mode): `tablet status|on|off|go|pages|forget`.

## Talking and admin mode

Type in the chat to talk to the cat. Press **Admin** (or type `admin on`) to run commands. `help`, `status`, `save`, `saves`, `admin`, `brain`, `offer`, `give`, `tastes`, `feelings`, `history`, `export`, `inventory`, `recipes` and `wishes` work without admin mode.

| Command | What it does |
| --- | --- |
| `status` | The cat at a glance |
| `time HH:MM` / `time +N` | Set the time of day / advance N hours |
| `day N` | Jump to day N |
| `speed X` | Simulation speed, 0.1 to 120 |
| `pause` / `resume` | Stop or restart the world |
| `daylen SECONDS` | Real seconds per in-world day (default 1200) |
| `weather clear\|cloud\|rain\|auto` | Set the weather |
| `spawn mouse\|treat\|item [type] [color] [count]` | Add things to the yard |
| `feed` | Refill the food bowl |
| `set trait\|need\|joy ...` | Change personality traits, needs or mood |
| `tp <place>` | Move the cat (house, bowl, water, cushion, post, pond, flowers, tree, fence, easel, stash, glass, mat, tablet, table) |
| `want list\|add\|done\|clear` | Read, give or grant wants |
| `quirk item\|color\|taste ...` | Change what it collects and how it arranges it |
| `quirk trait <collector\|vangogh\|hunter\|nightowl\|techie\|garfield\|builder\|none>` | Change its quirk |
| `frog [meet\|out\|hide\|visit]` | Bring in, show, hide or visit the pond frog |
| `pace [X]` | How slowly it works things out (1 default, 2 twice as slow, 0.25 to 4) |
| `stash list\|add\|steal\|clear` | Edit the stash |
| `art level\|paint [subject]\|clear` | Painting skill, make it paint something (including the made-up styles), gallery |
| `blog status\|post\|read\|clear` | The cat's blog |
| `secret status\|cattree\|peek\|oak\|coin\|moon\|moonwish\|stars\|starsdone\|meteor\|starwish\|upset` | Trigger or inspect the secrets and being upset |
| `mind` / `mind mood <kind>` / `mind intent <what>` / `mind whim` / `mind favs` | Its mood today, habits, what it has set its mind on, its favourite things |
| `memories` | What it remembers, how strongly, and who it counts as a regular |
| `interest` / `interest start [topic]` / `interest done` | Its special interest and what it has read about it |
| `think <text>` | Put a thought in its head |
| `name <name>` / `coat <coat>` | Rename it / change its coat |
| `clear log\|journal\|chat\|history` | Clear histories |
| `brain status\|on\|off\|key\|model\|cap\|test` | Control the Claude connection |
| `offer item\|material\|note\|list\|clear` / `give` / `tastes` / `feelings` | Leave something on the mat / see what the cat likes and why |
| `craft give\|learn\|now\|table` | Hand it materials, teach it a recipe, make it build something now |
| `wish add\|clear` | Plant or clear a wish note |
| `history …` / `export` / `inventory` / `recipes` / `wishes` | Read back what it did, thought, carries and asked for |
| `tablet status\|on\|off\|go\|pages\|forget` | Control and inspect the tablet |
| `save [name]` / `load [name]` / `saves` | Manual saves and slots |
| `reset confirm` | Start over with a new cat |

`help <command>` shows the details for one command.

## Development

```
npm install        # installs the Tauri CLI (only needed for the desktop app)
npm run web        # serves src/ at http://localhost:8765/index.html for the browser version
npm test           # simulation, save, Claude-layer, offering, tablet, crafting/feelings/history, quirk/frog/pacing, secrets, painting, blog, memory, favourites, character, intent, special-interest, stars and search-variety tests (no network needed)
npm run dev        # desktop app with live files (needs Rust + the Tauri prerequisites)
npm run build      # local installer (Windows)
```

Layout: `src/sim/` is the DOM-free simulation (runs in Node and in the app; `offerings.js`, `tablet.js`, the network layer `web.js`, and the newer `feelings.js`, `craft.js`, `recipes.js`, `wishes.js` and `history.js`, `upset.js`, `secrets.js`, `pace.js` and `blog.js` live there), `src/render.js`, `src/dither.js` and `src/draw_cat.js` draw the canvas, `src/ui.js` and `src/main.js` are the interface and app shell, and `src-tauri/` is the thin Rust wrapper (tray, window, file and HTTP plugins).

## Known limits

- The browser version is the best-tested one: it was clicked through in a real browser served from a sub-folder (as GitHub Pages does), including saving, backups, downloading and loading a save file, and recovering from a corrupted save. It has not been run on the live github.io site, and Safari and Firefox were not tried.
- Pausing while the window is closed to the tray (desktop) is written but not tested on a real desktop; the browser version is tested.
- The Windows build, tray, close-to-tray and installer were written without access to a Windows machine. The simulation, UI and save logic are tested in Node and a real browser; the desktop shell is only type-checked. Expect to fix small things on the first real run.
- The Claude layer was tested against a fake server, not the live API.
- The tablet was tested against a fake Wikipedia (in Node and in a real browser with the requests intercepted), not the live site. In the browser version the live Wikipedia and Claude requests rely on those services allowing requests from web pages (Wikipedia's API does when asked with `origin=*`, and the Claude API does with the browser-access header the app sends); that has not been confirmed against the live services. In the installed app, the first real run is the first time the Tauri HTTP permission for Wikipedia is exercised.
- Crafting, wish notes, feelings and the history were tested in Node (including headless multi-day runs and a fake Wikipedia for recipe lookups) and clicked through in a real browser. The recipe lookups have never run against live Wikipedia, and the export file and its folder have only been exercised in the browser (as a download), not in the installed Windows app.
- Recipe pages are matched by title and keyword (for example a page whose title mentions "feeder"). If Wikipedia has no such page the cat works the recipe out itself.
- Pages and page titles come from Wikipedia's own text, which can contain anything; the filter is a word list, not moderation.
- Temperaments, the bird catch, the frog and the slower pacing were measured in Node over many simulated cats and days (for example the Van Gogh spends about 12 to 16% of its time painting, the Hunter makes about five times as many stalks, the night owl is awake between midnight and 3am about two thirds of the time) and clicked through in a real browser, but the pacing numbers are tuned by simulation, not by watching a cat for weeks. If something takes too long or too short a time, `pace` and the numbers in `src/sim/pace.js` are the dials.
- The secrets, being upset, made-up paintings, fish and the blog were tested in Node (including two-week runs for every quirk, checking for stuck or invalid states) and clicked through in a real browser. The blog's Claude rewrite was tested against the fake server only.
- Reported once and **not reproduced**: the mat vanishing when the table is built. It stays put in every run here (Node and browser), so if you still see it, note what you did just before and where on screen it was.
- The cat's world is a single yard with one cat. It is deliberately small.
