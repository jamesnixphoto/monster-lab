# Monster Lab

Static site (GitHub Pages) for Grayson's Monster Brawl monster designs. No build step. Read BUILD-PLAN.md first.

- Data lives on the iPad in IndexedDB (`js/store.js` is the only storage module).
- `monsters.json` and `img/` are only the first-run import. After that, the iPad's copy is the truth.
- **On every deploy, change `VERSION` in `sw.js`.** That is what shows Grayson the "New version ready" banner. If you add a file the app needs offline, add it to `SHELL` in `sw.js`.
- If the shape of a stored monster changes: raise `DATA_VERSION` in `js/store.js` and add a migration in `MIGRATIONS`.
- UI writing rules: plain 10-year-old words, no praise, never change Grayson's words, no em dashes. See BUILD-PLAN.md.
- Test locally: `python3 -m http.server 8000`, then open http://localhost:8000
