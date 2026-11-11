# Cat Yard

A small desktop world where a cat lives on its own and you watch. It has needs, moods and a personality, but also wants: it collects small objects in a hidden stash, paints with its paws and slowly gets better, and keeps theories about the mysteries of the yard (the moon, ripples in the pond, sparks at dusk). You can talk to it, and an admin mode lets you change the world.

The whole yard is drawn in a dithered, low-resolution pixel style (ordered Bayer dithering, so the pattern holds still instead of shimmering), including the cat's paintings.

Two things connect the cat to the outside world, in the spirit of Pino's World: **offerings** you leave on a mat, and a **tablet** that shows it real pages from Wikipedia and lets it leave notes for you. The cat also **makes things** out of bark from the oak, **learns what it likes from how things make it feel**, and everything it does and thinks goes into a **History** you can read and export.

Built with Tauri v2 (Windows installer, tray icon, ~small and light) around a plain-JavaScript simulation. No bundler, no framework.

## Get the Windows installer

The installer is built by GitHub, not on your machine.

1. Create a GitHub repository and push this folder to it.
2. Open the repository's **Actions** tab, choose **Build Windows installer**, and press **Run workflow**. (Pushing a tag such as `v0.1.0` does the same.)
3. When it finishes (a first run takes about 10 minutes), open the run and download the **cat-yard-windows-installer** artifact. Inside is a `.exe` installer. It installs for the current user only and needs no admin rights.

The workflow runs the simulation tests first and stops if they fail.

## Try it in a browser without installing anything

```
npm run web
```

Then open <http://localhost:8765/src/index.html>. This is the same app. Saves go to the browser's local storage instead of a file. Any static file server works if you do not have Node (for example `python -m http.server 8765` from this folder).

## Living in the background

- Closing the window saves and tucks the cat into the system tray. It keeps living at very low cost (drawing stops completely while hidden). Left-click the tray icon to bring it back; right-click for **Save and quit**.
- You can turn the tray behaviour off in **Settings → Performance**, so closing really quits (it still saves first).
- When you were away, the world catches up on reopening (up to 3 hours' worth) and a summary says what the cat did.
- Frame rate drops when the window is not focused, and **Eco** mode caps it at 15 fps.

## Saving

Saves happen automatically every 3 minutes (configurable), whenever the window is hidden or closed, and whenever you type `/save`. Writes are atomic (temp file then rename) and the last 3 backups are kept; if the main save is ever corrupt, the newest good backup is loaded instead.

On Windows the files are in `%APPDATA%\com.catyard.app\saves\`.

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

When it wants to make something it does not know, it goes to the tablet and looks the topic up; the page it reads is what unlocks the recipe. If the tablet turns up nothing twice it works it out itself, and with no connection it does the same after a couple of days. **Twine can only come from you** (leave it on the mat, or use `/give twine`); it cannot be found in the yard. The **Cat** tab shows what it is carrying, what it knows how to make and what it has made.

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
npm install        # installs the Tauri CLI
npm test           # simulation, save, Claude-layer, offering, tablet and crafting/feelings/history tests (no network needed)
npm run dev        # desktop app with live files (needs Rust + the Tauri prerequisites)
npm run build      # local installer (Windows)
```

Layout: `src/sim/` is the DOM-free simulation (runs in Node and in the app; `offerings.js`, `tablet.js`, the network layer `web.js`, and the newer `feelings.js`, `craft.js`, `recipes.js`, `wishes.js` and `history.js` live there), `src/render.js`, `src/dither.js` and `src/draw_cat.js` draw the canvas, `src/ui.js` and `src/main.js` are the interface and app shell, and `src-tauri/` is the thin Rust wrapper (tray, window, file and HTTP plugins).

## Known limits

- The Windows build, tray, close-to-tray and installer were written without access to a Windows machine. The simulation, UI and save logic are tested in Node and a real browser; the desktop shell is only type-checked. Expect to fix small things on the first real run.
- The Claude layer was tested against a fake server, not the live API.
- The tablet was tested against a fake Wikipedia (in Node and in a real browser with the requests intercepted), not the live site. The first real run in the installed app is the first time the Tauri HTTP permission for Wikipedia is exercised.
- Crafting, wish notes, feelings and the history were tested in Node (including headless multi-day runs and a fake Wikipedia for recipe lookups) and clicked through in a real browser. The recipe lookups have never run against live Wikipedia, and the export file and its folder have only been exercised in the browser (as a download), not in the installed Windows app.
- Recipe pages are matched by title and keyword (for example a page whose title mentions "feeder"). If Wikipedia has no such page the cat works the recipe out itself.
- Pages and page titles come from Wikipedia's own text, which can contain anything; the filter is a word list, not moderation.
- The cat's world is a single yard with one cat. It is deliberately small.
