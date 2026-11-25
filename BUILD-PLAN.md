# Monster Brawl: Monster Lab, build plan v1

## What this is

Monster Lab is a website where Grayson (10) designs monsters for Monster Brawl, the card game he and his dad James are making. Grayson is the creative director. He draws the monsters, answers quiz questions about them, and the site turns his answers into game cards.

What Grayson enjoys most is the quiz and answering questions about his monsters. The finished card matters less than the process. Build for that.

A first version already exists as a claude.ai page. Its code is in `reference/monster-lab-v1.html`. Treat it as the reference for screens, wording, card design and quiz logic. Rebuild it as a standalone site with the changes below.

## Who uses it, and where

- Grayson, on his iPad, in Safari, opened from a home-screen icon. He has an Apple Pencil.
- No logins. No Claude account on his iPad.
- James manages changes by asking Claude Code.

## Hosting and storage

- Static site in a GitHub repo, hosted on GitHub Pages. No server, no database, no build step unless one clearly helps.
- All of Grayson's data lives on the iPad: IndexedDB for monsters and images. localStorage is too small for images.
- Call `navigator.storage.persist()` on first run. The home-screen icon helps Safari keep the data.
- Make it an installable web app: a manifest, icons and a service worker, so it opens from the home screen like an app and works offline.
- **Updates:** when a new version is deployed, show a small banner: "New version ready. Tap to update." Never reload while he's in a quiz or drawing.
- **Backups:** a "Back up my monsters" button in a parent area. It exports one file (JSON plus images, as a .zip) through the iPad share sheet (`navigator.share` with files), so James can save it to Files or AirDrop it. "Restore from backup" imports that file. Restore replaces everything, so ask first and say that.
- Version the stored data. When the data shape changes, include a migration so nothing Grayson made is lost.
- An external server may come later. Keep storage behind one small module so it can be swapped out.

## First run: import his monsters

Load `monsters.json` and the images in `img/` into IndexedDB on first run. There are seven monsters: Magno, Werewolf, Jester, tidal wave, cyclops, Mimic, Echo.

- Keep Grayson's words exactly as typed. Do not fix capitals, spelling or punctuation ("tidal wave", "Rumble.", "Hypnotize.").
- Four drawings are marked MISSING in `monsters.json`: tidal-wave-1.jpg, cyclops-1.jpg, mimic-1.jpg, echo-1.jpg. James will add them to `img/`. Until then, show the card with an "Add the drawing" placeholder, not a broken image.
- Resize imported and uploaded images to 1600 px on the long side, JPEG quality about 0.85, before storing.

## Screens

### 1. Monsters (home)
- A grid of his cards, each with a pill: "Draft 3" or "Locked".
- "+ New monster" button.
- One line under the title: "Every monster starts at Draft 1 and gets better one draft at a time."

### 2. Monster page
- The big card, showing the latest draft.
- A row of draft thumbnails (Draft 1, Draft 2...) with notes. Tap one to show it on the card.
- **Buttons:** Start a quiz, Add a draft, Image prompt, Lock it (done) or Unlock for a new draft.
- **Rules check:** type is one of the 21, health matches rarity, exactly 3 moves, each move 60 to 300 damage, height present. Show Pass or Not yet.
- **"For Draft N+1, Grayson asked for":** the list of changes he wants in the next draft.
- **"Not decided yet":** fields still empty, plus free-text open items with a Done button.
- **Change log:** draft number, KEEP, CHANGE or ADD, the text, and who (Grayson or Dad).
- **Colors**, part by part, and his territory.

### 3. Quiz
Copy the flow from the reference file. The rules:
- One question per screen, with a progress bar.
- After each answer, show a green line reflecting exactly what he said: "Got it. Type: Stormy cloud." Add nothing and interpret nothing.
- Every question has "Not decided yet", except the intro and review screens.
- Ask only what's not decided yet. "Quiz with every question" asks everything.
- **Order:**
  1. Draft intro
  2. "Is my list right?", if the draft has a list of what's in it
  3. What do you like
  4. What should be different next draft
  5. Type
  6. Rarity
  7. Height
  8. Territory
  9. Move 1
  10. Move 2
  11. Move 3
  12. The one thing that makes it his
  13. Face
  14. Realistic or cartoony
  15. Colors
  16. Review and save
- **Move damage:** no number until he picks one. A slider plus −10, −1, +1 and +10 buttons. He can't go on until he's picked. The old version defaulted the slider to 60 and he left it there.
- **Colors (fix):** in v1, Grayson typed every part and every color into one box (see the cyclops and Echo data). Ask one part at a time instead: "Which part?" then "What color?" Then "Add another part" or "That's all." Show the parts already given colors.
- **Draft intro screen:** show his drafts in a row with arrows and a dashed "Draft N+1 ?" box at the end. Use this text as written:
  - "A draft is one try at a monster. You look at it, keep what you like, and say what should be different. That goes into the next draft."
  - "Changing something doesn't mean the last draft was bad. Every card in this game gets made this way."
- Saving writes his answers to the monster and adds log entries.

### 4. Add a draft: three ways
Three big buttons, each with short numbered steps on screen:
- **Draw it here:** opens the drawing pad (section 5).
- **Take a photo:** "Lay the drawing flat on a table. Fill the screen with the paper. Tap the white button. Tap Use Photo."
- **Pick a picture:** "If you drew it in Procreate: tap the wrench, then Share, then JPEG, then Save Image. Come back here, tap Pick a picture, and choose it." Plus: "From Freeform: take a screenshot of your drawing, then pick the screenshot."

Then a short note field ("What's this draft?"). When a draft is added, log each "For the next draft" item as asked for in this draft, then clear the list.

### 5. Drawing pad (new)
For basic drawings with his Apple Pencil. No Procreate-level tools.
- A 3:4 canvas, white background. Make it as big as the screen allows.
- **Pencil and touch:** use pointer events with pen pressure for line width. While the pencil is touching, ignore finger touches, so his palm doesn't draw.
- **Tools:**
  - About 12 color swatches, including colors he uses a lot: black, gray, purple, indigo, dark blue, sky blue, red, orange, golden yellow, green, brown, pink, white. Plus "More colors."
  - Three brush sizes.
  - Eraser.
  - Undo and redo, at least 30 steps.
  - "Start over," which asks first.
- **Saving:**
  - "Save as Draft N" saves a PNG as the next draft.
  - Keep an unsaved drawing if he leaves the screen, and offer "Keep drawing" when he comes back.
- **Optional, not in v1:** drawing on top of the last draft as a see-through layer. List it as a later idea and don't build it.

### 6. Card design
Use the card from the reference file. The picture fills the card, the rarity color is the frame, and the info sits in slim overlays:
- **Top:** name, with type and height in small type.
- **Bottom left:** three slim move strips, each with the damage number and then the move name. A stripe in the rarity color runs down the left edge.
- **Bottom:** a heart with the health number on the left, and the rarity word in a pill in the rarity color on the right.
- **Draft stamp:** "Draft N" at the lower right until the monster is locked.
- **Size:** 5:7. The picture covers the card.
- **Rarity colors:**
  - Common: green
  - Uncommon: blue
  - Rare: purple
  - Legendary: golden yellow
  - Mythical: red
  - Extreme: red and purple, split diagonally
  - Divine: orange

### 7. Image prompt
For Dad. Builds an image prompt from the monster's answers, with a Copy button. Use the saved prompt if the monster has one for the current draft (Magno does). The prompt has four parts:
1. **STYLE BLOCK:** the text below, plus "This monster is: realistic/cartoony".
2. **SUBJECT:** 50 to 80 words. Show the word count.
3. **COMPOSITION:** 25 words or fewer. Show the word count.
4. **AVOID:** each "No X" paired with "do Y instead."

Add the "For the next draft" items as changes. Remind him to upload the latest draft as the reference image.

### 8. Rules page
The Rules-Sheet below, written in kid words, plus one short example round. Read-only.

### 9. Lock
Asks first: "Locked means Grayson says it's done. The card loses its draft stamp. You can unlock later for a new draft." Show any rules not passed yet.

### 10. Parent area
Behind a simple grown-up check, like "Hold this button for 3 seconds." Contains Back up, Restore and Image prompt settings. Not a password.

## Help and instructions (everywhere)

Grayson should understand every screen without asking.
- **"?" buttons:** one on every screen, opening short help for that screen.
- **First-time cards:** shown the first time he opens the drawing pad, the add-draft screen and the card. Dismissable.
- **Card help:** the "?" labels each part of the card: health, moves, damage, type, height, rarity color, draft stamp.
- **Read aloud:** a speaker button on each help card reads it with `speechSynthesis`.
- **How to write help:**
  - Numbered steps, one action per line, three or four lines max.
  - His words, not tech words: "the share button," not "export."

## Writing rules for everything on screen

- Short, plain sentences a 10-year-old uses. No baby talk.
- No praise, no cheerleading. "Got it." is enough.
- Don't change or correct his ideas. Show his words exactly.
- No em dashes.
- Avoid these words: leverage, unlock, elevate, delve, dive into, robust, seamless, tapestry, journey, game changer, level up, transform, curated, crafted, moments, magic.

## Look and feel

Keep the reference file's dark "monster lab" look:
- Deep violet-black background with a voltage-yellow accent.
- Bungee for headings and Atkinson Hyperlegible for body text, loaded from Google Fonts with fallbacks.
- Big tap targets, at least 44 px, because he uses his fingers and a pencil.
- Works in portrait and landscape on iPad.

## Game rules (locked; source: Rules-Sheet)

```
THE GAME
Monster Brawl is a fun card trading and card fighting game. Monsters battle each other.

PLAYERS AND TIME
2 to 4 players. One game takes 5 to 10 minutes and has 20 rounds.
- 2 players: one against one.
- 3 players: everyone fights everyone. Each player picks one other player's monster to hit.
- 4 players: two teams of 2. Each player picks one monster on the other team to hit.

WHAT YOU NEED
Your 20-card deck and pen and paper to keep track of health. You pick your 20 cards from your own collection.

CARDS
Monster cards only. Each card shows:
- Top: the name, with the type name and the monster's height next to it
- Middle: the picture
- Left side: 3 moves, each with a name and its damage (60 to 300)
- Bottom: the health, with the rarity word next to it
- Background: the rarity color
- Border: thin and simple

RARITIES (color, health, shop price)
Common: green, 500, 100 tokens
Uncommon: blue, 600, 200 tokens
Rare: purple, 700, 300 tokens
Legendary: golden yellow, 800, 400 tokens
Mythical: red, 900, 500 tokens
Extreme: red and purple, 1,000, 600 tokens
Divine: orange, 1,100, 700 tokens
Rarer monsters are harder to get. Each move's damage is set on its own card, not by rarity.

TYPES (21)
Fire, wind, poison, ghost (also called shadow), ice, food, water, ground, plant, plasma, alien, celestial, angel, stormy cloud, bone, glitch, music, swamp, sand, time, crystal.
Each type has its own territory in the pocket dimension.
Type advantages: a type does 10% more damage to the type it beats.
- Water beats fire
- Fire beats ice
- Fire beats swamp
- Sand beats ice
- Alien beats stormy cloud
- Ghost beats poison

SETUP
Shuffle your 20-card deck. Your starting hand is 5 cards.

ROUND
1. Draw 1 card at the start of each round, until your deck runs out.
2. Both players choose a card in secret and reveal at the same time.
3. The monsters fight. Each time, both players pick one of their monster's moves in secret, reveal together, and both monsters hit at the same time. You can't use the same move twice in a row.
4. Keep going until a monster reaches zero health. That monster is knocked out. A knockout puts the other player one step closer to winning.
5. If both monsters reach zero in the same hit, both are knocked out, and each player gets one step closer to winning.
6. After the round, every monster goes to the discard pile, knocked out or not.

WINNING
After round 20, the player who knocked out more of the other player's monsters wins.
- 3 players: the player who knocked out the most monsters wins.
- 4 players: add up each team's knockouts. The team with more wins.

TIES
If the players are tied after round 20, play a bonus round. Each player brings back one card and picks any monster from their pile. The two monsters fight. The monster that knocks out the other wins.
If both monsters are knocked out or neither is, play a second bonus round. Each player shows one more card, and the card with the most health wins. No rock-paper-scissors.

TOKENS, THE SHOP, AND TRADING
Players win 20 tokens for winning a game. Players buy cards in the shop with tokens, and they can trade cards with other people.

NOT DECIDED
Tie rules for 3-player and 4-player games.
```

Card-design note: the v1 card puts the picture over the whole card, so the rarity color is the frame, not the background. Grayson hasn't confirmed changing the "Background" line yet. Build the frame version and leave the Rules-Sheet text alone.

## Style Block (locked; pasted at the top of every image prompt)

```
Finished in color. Each monster is realistic or cartoony, and the designer picks which one. Cartoony monsters get a thin black cartoon outline. Keep the same shapes and details as the original drawing, with color added and a little shading. Monsters can be any color, and each monster uses the colors the designer picks for it. The overall feel is half dark, half bright. Monsters look scary-ish.
```

## Not in v1 (next, in this order)

1. A battle screen for 2 players, using the rules above: secret picks, reveal together, health tracking, no same move twice in a row, knockouts, 20 rounds, ties.
2. Printable cards.
3. An external server for syncing between devices.

## Known data items (don't fix on your own; list them for James)

- **Werewolf:** has two "For the next draft" items that say the same thing, and two color entries that repeat the earlier colors.
- **Magno:** Dad still needs to confirm move damage 136, 200, 169.
- **Four missing drawings:** tidal wave, cyclops, Mimic, Echo.

## Done means

Test in iPad Safari, or in desktop Safari at iPad size, before calling it done:
- [ ] Add to Home Screen works, it opens full screen, and it works with Wi-Fi off.
- [ ] First run imports all 7 monsters. Their words match `monsters.json` exactly.
- [ ] A full quiz on a new monster saves, and the card updates.
- [ ] Draw a picture with pencil pressure. The palm doesn't draw. Undo works. Save makes Draft 1.
- [ ] Take a photo, and pick a picture. Both make a new draft.
- [ ] Close and reopen the app. Everything is still there.
- [ ] Back up, then restore on a clean browser, gets everything back, images included.
- [ ] A new deploy shows the update banner and doesn't lose data.
- [ ] Every screen has a "?" with help, and the speaker reads it.
