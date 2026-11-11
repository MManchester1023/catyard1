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

- The cat lives while the tab is open, including in a background tab (browsers slow background tabs down, so it catches up when you come back). If you close the tab, it catches up on up to 3 hours when you return, and a summary says what it did.
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

- Closing the window saves and tucks the cat into the system tray. It keeps living at very low cost (drawing stops completely while hidden). Left-click the tray icon to bring it back; right-click for **Save and quit**.
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

## Temperament: Van Gogh, Hunter, Night owl

Every cat has one temperament, picked at random for a new cat and shown in the **Cat** tab under *Quirk*. It is separate from the collector quirk (what it keeps in the stash).

- **Van Gogh**: obsessed with painting. The urge to create builds faster and it starts painting at a much lower urge, even when tired or hungry; it paints more than twice as often, stays longer at the canvas, and is never quite finished with a picture. It still sleeps and eats.
- **Hunter**: hunts whenever it can. It notices mice and birds from much farther away, stalks them whether or not it is hungry, tries again almost at once, and more mice are allowed in the yard for it.
- **Night owl**: stays up late. Its whole day runs about three hours behind: lively well into the night, deeply asleep from roughly 2am to 7:30am.

Cats from an older save get a random temperament the first time they are loaded. In admin mode `quirk trait <vangogh|hunter|nightowl|none>` changes it.

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

## Notes from the cat

When the cat needs something only you can bring (twine for a chime it wants to make, an object it has been hoping for), it drafts a note, then goes to the tablet and types it out. You are told in the chat, and the note appears in the **Outside** tab with a **Give it** button that leaves the right thing on the mat. When what it asked for arrives it knows you read the note, and it is delighted. Notes nobody answers fade after five days. It does not write notes during its first day or so here. With a Claude key set, the wording of each note comes from Claude. `/wishes` lists them; `/wish add <type> [color]` (admin) plants one.

## History: what it did and thought

The **History** tab replaces the old Journal.

- **Today**: what it is doing and thinking now, how today has been spent so far, the day's highlights and the latest few entries.
- **Timeline**: everything it did (each thing it set out to do), thought, had happen and said, newest first, with filters and a search box. The last 2,000 entries are kept.
- **Diary**: its own words.
- **Days**: for each of the last 45 days, how the time was spent (sleeping, painting, on the tablet…) and the things worth remembering.
- **Export the whole story** writes a text file (the days, the diary, the timeline, its things, its notes to you) and copies it to the clipboard. On Windows the file goes to `%APPDATA%\com.catyard.app\exports\`; in a browser it downloads. `/export` does the same.

While the app was closed the world catches up, and the summary says what it gathered, made and wrote; the catch-up adds events and diary lines to the history but not every moment-to-moment step.

Chat commands (no admin mode needed): `history [N]`, `history <did|thought|event|diary|chat> [N]`, `history day N`, `history days`, `history find <text>`, `export`, `inventory`, `recipes`, `wishes`, `feelings`.

## The tablet

A tablet stands on a stump in the yard. Once the cat finds it, it now and then walks over, sits down and reads a page, then reacts to it. What it reads shapes what it wants next: an article about the moon is a clue in its moon mystery, one about ponds or fireflies likewise, a page about painting adds to its skill, and a word it wants to know gets looked up. It keeps its last 24 pages and a list of interests, which pick what it reads next. It is also where it looks up how to make things, and where it types its notes to you. Writing a note works with no connection.

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
| `quirk trait <vangogh\|hunter\|nightowl\|none>` | Change its temperament |
| `frog [meet\|out\|hide\|visit]` | Bring in, show, hide or visit the pond frog |
| `pace [X]` | How slowly it works things out (1 default, 2 twice as slow, 0.25 to 4) |
| `stash list\|add\|steal\|clear` | Edit the stash |
| `art level\|paint\|clear` | Painting skill and gallery |
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
npm test           # simulation, save, Claude-layer, offering, tablet, crafting/feelings/history and temperament/frog/pacing tests (no network needed)
npm run dev        # desktop app with live files (needs Rust + the Tauri prerequisites)
npm run build      # local installer (Windows)
```

Layout: `src/sim/` is the DOM-free simulation (runs in Node and in the app; `offerings.js`, `tablet.js`, the network layer `web.js`, and the newer `feelings.js`, `craft.js`, `recipes.js`, `wishes.js` and `history.js` live there), `src/render.js`, `src/dither.js` and `src/draw_cat.js` draw the canvas, `src/ui.js` and `src/main.js` are the interface and app shell, and `src-tauri/` is the thin Rust wrapper (tray, window, file and HTTP plugins).

## Known limits

- The browser version is the best-tested one: it was clicked through in a real browser served from a sub-folder (as GitHub Pages does), including saving, backups, downloading and loading a save file, and recovering from a corrupted save. It has not been run on the live github.io site, and Safari and Firefox were not tried.
- The Windows build, tray, close-to-tray and installer were written without access to a Windows machine. The simulation, UI and save logic are tested in Node and a real browser; the desktop shell is only type-checked. Expect to fix small things on the first real run.
- The Claude layer was tested against a fake server, not the live API.
- The tablet was tested against a fake Wikipedia (in Node and in a real browser with the requests intercepted), not the live site. In the browser version the live Wikipedia and Claude requests rely on those services allowing requests from web pages (Wikipedia's API does when asked with `origin=*`, and the Claude API does with the browser-access header the app sends); that has not been confirmed against the live services. In the installed app, the first real run is the first time the Tauri HTTP permission for Wikipedia is exercised.
- Crafting, wish notes, feelings and the history were tested in Node (including headless multi-day runs and a fake Wikipedia for recipe lookups) and clicked through in a real browser. The recipe lookups have never run against live Wikipedia, and the export file and its folder have only been exercised in the browser (as a download), not in the installed Windows app.
- Recipe pages are matched by title and keyword (for example a page whose title mentions "feeder"). If Wikipedia has no such page the cat works the recipe out itself.
- Pages and page titles come from Wikipedia's own text, which can contain anything; the filter is a word list, not moderation.
- Temperaments, the bird catch, the frog and the slower pacing were measured in Node over many simulated cats and days (for example the Van Gogh spends about 12 to 16% of its time painting, the Hunter makes about five times as many stalks, the night owl is awake between midnight and 3am about two thirds of the time) and clicked through in a real browser, but the pacing numbers are tuned by simulation, not by watching a cat for weeks. If something takes too long or too short a time, `pace` and the numbers in `src/sim/pace.js` are the dials.
- The cat's world is a single yard with one cat. It is deliberately small.
