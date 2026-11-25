import * as S from "./store.js";
import { TYPES, ADV, RAR, STYLE_BLOCK, SWATCHES, COLOR_WORDS, HELP, TIPS } from "./data.js";
import { resizeToJpeg } from "./imaging.js";
import { makeZip, readZip } from "./zip.js";
import { Pad } from "./draw.js";

/* ---------- state ---------- */
let monsters = [], loaded = false, loadFail = null;
let quiz = null, ov = null, viewDraft = {};
let tips = {}, styleBlock = STYLE_BLOCK, lastBackup = null;
let holdOk = false;
let pad = null, padId = null, wipTimer = null;
let tool = { color: "#111111", size: 12, eraser: false };
let waiting = null, updating = false;
const urls = new Map(); // image id -> object URL

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const rar = name => RAR.find(r => r[0] === name);
const cur = m => (m.drafts || [])[(m.drafts || []).length - 1];
const getM = id => monsters.find(m => m.id === id);
const imgSrc = d => (d && d.imgId && urls.get(d.imgId)) || null;
const missingLast = m => { const d = cur(m); return !!d && !d.imgId; };
const nextN = m => (missingLast(m) ? cur(m).n : (m.drafts || []).length + 1);
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "monster";
const wc = s => s.trim().split(/\s+/).filter(Boolean).length;

function toast(msg) {
  const t = $("toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 4000);
}
function route() {
  const h = location.hash.slice(1);
  for (const v of ["monster", "draft", "draw", "quiz"]) if (h.startsWith(v + "-")) return { v, id: h.slice(v.length + 1) };
  if (h === "rules") return { v: "rules" };
  if (h === "parent") return { v: "parent" };
  return { v: "roster" };
}
function go(hash) {
  if (location.hash === "#" + hash) render(); else location.hash = hash;
}

/* ---------- images ---------- */
async function addImage(blob) {
  const id = "img-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await S.putImage(id, blob);
  urls.set(id, URL.createObjectURL(blob));
  return id;
}
async function loadUrls() {
  for (const u of urls.values()) URL.revokeObjectURL(u);
  urls.clear();
  for (const m of monsters) for (const d of m.drafts || []) {
    if (d.imgId && !urls.has(d.imgId)) { const b = await S.getImage(d.imgId); if (b) urls.set(d.imgId, URL.createObjectURL(b)); }
  }
}

/* ---------- card ---------- */
function card(m, fs, d) {
  d = d || cur(m);
  const r = rar(m.rarity); const cls = r ? "r-" + r[0].toLowerCase() : "r-none";
  const mv = [0, 1, 2].map(i => (m.moves || [])[i] || {});
  const meta = [m.type || "Type ?", m.height || "Height ?"].map(esc).join(" · ");
  const stamp = m.status === "locked" ? "" : `<div class="c-stamp">${d ? "Draft " + d.n : "No draft yet"}</div>`;
  const src = imgSrc(d);
  return `<div class="card ${cls}" style="font-size:${fs}px" role="img" aria-label="${esc(m.name)} card"><div class="c-frame">
  ${src ? `<img src="${esc(src)}" alt="${esc(m.name)}, draft ${d.n}">` : `<div class="empty">Add the drawing</div>`}
  <div class="c-top"><span class="c-name">${esc(m.name)}</span><span class="c-meta">${meta}</span></div>${stamp}
  <div class="c-moves">${mv.map(x => `<div class="c-move"><span class="num">${x.dmg || "?"}</span><b>${esc(x.name || "Move ?")}</b></div>`).join("")}</div>
  <div class="c-bot"><span class="c-hp num"><i aria-hidden="true">♥</i>${r ? r[3].toLocaleString() : "?"}</span><span class="c-rar">${r ? esc(r[0]) : "Rarity ?"}</span></div></div></div>`;
}

/* ---------- rules check ---------- */
function checks(m) {
  const mv = (m.moves || []).filter(x => x && x.name);
  const badD = (m.moves || []).filter(x => x && x.name && !(x.dmg >= 60 && x.dmg <= 300));
  return [
    ["Type is one of the 21", TYPES.includes(m.type), m.type || "not decided"],
    ["Health matches the rarity", !!rar(m.rarity), rar(m.rarity) ? `${m.rarity}, ${rar(m.rarity)[3]}` : "rarity not decided"],
    ["Exactly 3 moves", mv.length === 3, `${mv.length} of 3`],
    ["Damage 60 to 300", mv.length > 0 && badD.length === 0, badD.length ? badD.map(x => x.name).join(", ") + " out of range" : mv.length ? "all in range" : "no moves yet"],
    ["Height on the card", !!m.height, m.height || "not decided"]
  ];
}
function gaps(m) {
  const g = [];
  if (!m.type) g.push("Type"); if (!m.rarity) g.push("Rarity"); if (!m.height) g.push("Height"); if (!m.territory) g.push("Territory");
  [0, 1, 2].forEach(i => { const x = (m.moves || [])[i]; if (!x || !x.name || !x.dmg) g.push("Move " + (i + 1)); });
  if (!m.signature) g.push("The one thing that makes it his"); if (!m.expression) g.push("Face"); if (!m.look) g.push("Realistic or cartoony");
  return g;
}

/* ---------- help ---------- */
const speechOK = "speechSynthesis" in window;
function speak(text) {
  if (!speechOK) return;
  if (speechSynthesis.speaking) { speechSynthesis.cancel(); return; }
  const u = new SpeechSynthesisUtterance(text); u.rate = 0.95; speechSynthesis.speak(u);
}
function helpText(h) {
  return [h.title + "."].concat(h.steps.map((s, i) => `${i + 1}. ${s}`), (h.legend || []).map(l => `${l[0]}. ${l[1]}`)).join(" ");
}
const speakBtn = (kind, key) => speechOK ? `<button class="btn speak" data-act="speak" data-kind="${kind}" data-key="${key}" aria-label="Read this out loud">🔊 Read to me</button>` : "";
function tipCard(key) {
  if (tips[key]) return "";
  const t = TIPS[key];
  return `<div class="panel tip"><h3>${esc(t.title)}</h3><ol class="steps">${t.steps.map(s => `<li>${esc(s)}</li>`).join("")}</ol>
  <div class="row" style="margin-top:12px">${speakBtn("tip", key)}<button class="btn primary" data-act="dismisstip" data-key="${key}">Got it</button></div></div>`;
}
function helpKey() {
  const r = route();
  return { roster: "roster", monster: "monster", quiz: quiz && r.v === "quiz" ? "quiz" : "monster", draft: "adddraft", draw: "draw", rules: "rules", parent: "parent" }[r.v] || "roster";
}

/* ---------- views ---------- */
function render() {
  const r = route();
  if (pad && r.v !== "draw") leavePad();
  if (r.v !== "parent") holdOk = false;
  $("tab-roster").classList.toggle("on", r.v !== "rules" && r.v !== "parent");
  $("tab-rules").classList.toggle("on", r.v === "rules");
  $("tab-parent").classList.toggle("on", r.v === "parent");
  const app = $("app");
  // Never rebuild the drawing pad while he is drawing.
  if (loaded && pad && r.v === "draw" && padId === r.id) { renderOv(); updateBanner(); return; }
  if (!loaded) {
    app.innerHTML = loadFail
      ? `<div class="center"><h2>The lab did not open</h2><p class="muted">${esc(loadFail.message || String(loadFail))}</p><button class="btn primary" onclick="location.reload()">Try again</button></div>`
      : `<p class="center muted">Opening the lab...</p>`;
    renderOv(); updateBanner(); return;
  }
  const m = r.id ? getM(r.id) : null;
  if (r.v === "quiz" && quiz && m) app.innerHTML = quizView();
  else if (r.v === "rules") app.innerHTML = rulesView();
  else if (r.v === "parent") app.innerHTML = parentView();
  else if (r.v === "draft" && m) app.innerHTML = draftView(m);
  else if (r.v === "draw" && m) app.innerHTML = drawView(m);
  else if ((r.v === "monster" || r.v === "quiz") && m) app.innerHTML = monsterView(m);
  else app.innerHTML = rosterView();
  renderOv();
  if (r.v === "draw" && m) mountPad(m);
  if (r.v === "parent" && holdOk) fillStorage();
  updateBanner();
}

function rosterView() {
  const list = [...monsters].sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name));
  return `<div class="rhead"><div><h1>Grayson's monsters</h1><p class="muted">Every monster starts at Draft 1 and gets better one draft at a time.</p></div>
  <button class="btn primary" data-act="new">+ New monster</button></div>
  <div class="grid">${list.map(m => `<button class="tile" data-act="open" data-id="${esc(m.id)}">${card(m, 13.5)}<div class="meta"><b>${esc(m.name)}</b><span class="pill ${m.status === "locked" ? "locked" : "draft"}">${m.status === "locked" ? "Locked" : "Draft " + ((m.drafts || []).length || 0)}</span></div></button>`).join("")}
  <button class="newtile" data-act="new"><b>+ New monster</b><span>Start with his drawing</span></button></div>`;
}

function monsterView(m) {
  const ds = m.drafts || []; const sel = viewDraft[m.id] != null ? ds.find(d => d.n === viewDraft[m.id]) : cur(m);
  const ck = checks(m); const g = gaps(m);
  const log = (m.log || []).slice().reverse();
  const locked = m.status === "locked";
  const addLabel = missingLast(m) ? "Add the drawing" : "Add a draft";
  return `<div class="mhead"><button class="back" data-act="home">All monsters</button></div>
  <div class="mhead"><h1>${esc(m.name)}</h1><span class="pill ${locked ? "locked" : "draft"}">${locked ? "Locked" : "Draft " + (ds.length || 0)}</span></div>
  ${tipCard("card")}
  <div class="mgrid">
   <div class="cardcol">
    <div class="cardwrap">${card(m, 17, sel)}<button class="helpbtn" data-act="help" data-key="card" aria-label="What is on the card">?</button></div>
    <div class="row">
     ${quiz && quiz.id === m.id ? `<button class="btn primary" data-act="resumequiz" data-id="${esc(m.id)}">Keep going with the quiz</button>` : `<button class="btn primary" data-act="quiz" data-id="${esc(m.id)}" ${ds.length ? "" : "disabled"}>Start a quiz</button>`}
     <button class="btn" data-act="adddraft" data-id="${esc(m.id)}">${addLabel}</button>
    </div>
    <div class="row">
     <button class="btn" data-act="prompt" data-id="${esc(m.id)}" ${ds.length ? "" : "disabled"}>Image prompt</button>
     ${locked ? `<button class="btn" data-act="unlock" data-id="${esc(m.id)}">Unlock for a new draft</button>` : `<button class="btn" data-act="lock" data-id="${esc(m.id)}">Lock it (done)</button>`}
    </div>
    <div class="row"><button class="btn ghost small" data-act="quizall" data-id="${esc(m.id)}" ${ds.length ? "" : "disabled"}>Quiz with every question</button></div>
   </div>
   <div class="side">
    <section class="panel"><h3>Drafts</h3>
     <div class="drafts">${ds.map(d => `<button class="dthumb ${sel && sel.n === d.n ? "on" : ""}" data-act="seldraft" data-id="${esc(m.id)}" data-n="${d.n}">${imgSrc(d) ? `<img src="${esc(imgSrc(d))}" alt="Draft ${d.n}">` : `<div class="noimg">Add the drawing</div>`}<b>Draft ${d.n}</b><small>${esc(d.note || "")}</small></button>`).join("")}
      <button class="dadd" data-act="adddraft" data-id="${esc(m.id)}"><b style="font-size:26px">+</b>${missingLast(m) ? "Add the drawing" : "Add Draft " + (ds.length + 1)}</button></div>
     ${(m.next || []).length ? `<p class="muted" style="margin:12px 0 4px">For Draft ${ds.length + 1}, Grayson asked for:</p><ul class="list">${m.next.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
    </section>
    <section class="panel"><h3>Rules check</h3><ul class="checks">${ck.map(([l, ok, d]) => `<li><span>${l}<br><small class="muted">${esc(d)}</small></span><span class="pill ${ok ? "pass" : "miss"}">${ok ? "Pass" : "Not yet"}</span></li>`).join("")}</ul></section>
    <section class="panel"><h3>Not decided yet</h3>
     ${g.length || (m.open || []).length ? `<ul class="open">${g.map(x => `<li><span>${esc(x)}</span><span class="muted" style="font-size:13px">the quiz asks this</span></li>`).join("")}${(m.open || []).map((x, i) => `<li><span>${esc(x)}</span><button class="btn small ghost" data-act="closeopen" data-id="${esc(m.id)}" data-i="${i}">Done</button></li>`).join("")}</ul>` : `<p class="muted">Everything is decided.</p>`}
    </section>
    <section class="panel"><details ${log.length ? "" : "open"}><summary>Change log (${log.length})</summary>
     ${log.length ? `<div class="tablewrap" style="margin-top:12px"><table class="log">${log.map(e => `<tr><td>Draft ${esc(e.draft)}</td><td><span class="tag ${esc(e.kind)}">${esc(e.kind)}</span></td><td>${esc(e.text)}</td><td class="muted">${esc(e.who)}</td></tr>`).join("")}</table></div>` : `<p class="muted">Nothing logged yet.</p>`}
    </details></section>
    <section class="panel"><details><summary>Colors (${(m.colors || []).length})</summary>
     ${(m.colors || []).length ? `<ul class="list colorlist" style="margin-top:10px">${m.colors.map(c => `<li><b>${esc(c.part)}:</b> ${esc(c.color)}</li>`).join("")}</ul>` : `<p class="muted">No colors picked yet.</p>`}
     ${m.territory ? `<p style="margin-top:12px"><b>Territory:</b> ${esc(m.territory)}</p>` : ""}
    </details></section>
   </div></div>`;
}

function rulesView() {
  const beats = t => ADV.filter(a => a[0] === t).map(a => a[1]);
  return `<h1 style="margin-bottom:6px">Monster Brawl rules</h1><p class="muted" style="margin-top:0">You can only read this page.</p>
  <div class="mgrid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">
  <section class="panel"><h3 style="color:var(--accent);margin-bottom:10px">The game</h3><ul class="list"><li>Monster Brawl is a card trading and card fighting game. Monsters battle each other.</li><li>2 to 4 players. A game takes 5 to 10 minutes and has 20 rounds.</li><li>2 players: one against one.</li><li>3 players: everyone fights everyone. Each player picks one other player's monster to hit.</li><li>4 players: two teams of 2. Each player picks one monster on the other team to hit.</li></ul></section>
  <section class="panel"><h3 style="color:var(--accent);margin-bottom:10px">What you need</h3><ul class="list"><li>Your 20-card deck. You pick your 20 cards from your own collection.</li><li>Pen and paper to keep track of health.</li></ul></section>
  <section class="panel"><h3 style="color:var(--accent);margin-bottom:10px">What a card shows</h3><ul class="list"><li>Top: the name, with the type and the height next to it</li><li>Middle: the picture</li><li>Left side: 3 moves, each with a name and its damage (60 to 300)</li><li>Bottom: the health, with the rarity word next to it</li><li>Background: the rarity color</li><li>Border: thin and simple</li></ul></section>
  <section class="panel"><h3 style="color:var(--accent);margin-bottom:10px">Rarities</h3><div class="tablewrap"><table class="rtable"><tr><th>Rarity</th><th>Health</th><th>Shop price</th></tr>${RAR.map(r => `<tr><td><span class="sw" style="background:${r[2]}"></span>${r[0]}</td><td class="num">${r[3].toLocaleString()}</td><td class="num">${r[4]} tokens</td></tr>`).join("")}</table></div><p class="hint">Rarer monsters are harder to get. Each move's damage is set on its own card, not by rarity.</p></section>
  <section class="panel"><h3 style="color:var(--accent);margin-bottom:10px">Types (21)</h3><div class="chips">${TYPES.map(t => `<span class="pill">${t}${beats(t).length ? " · beats " + beats(t).join(", ").toLowerCase() : ""}</span>`).join("")}</div><p class="hint">Ghost is also called shadow. Each type has its own territory in the pocket dimension. A type does 10% more damage to the type it beats.</p></section>
  <section class="panel"><h3 style="color:var(--accent);margin-bottom:10px">Setting up</h3><ul class="list"><li>Shuffle your 20-card deck.</li><li>Your starting hand is 5 cards.</li></ul></section>
  <section class="panel"><h3 style="color:var(--accent);margin-bottom:10px">One round</h3><ol class="list"><li>Draw 1 card at the start of each round, until your deck runs out.</li><li>Both players pick a card in secret. Then you show them at the same time.</li><li>The monsters fight. Both players pick one of their monster's moves in secret, show them together, and both monsters hit at the same time. You can't use the same move twice in a row.</li><li>Keep going until a monster gets to zero health. That monster is knocked out. A knockout puts the other player one step closer to winning.</li><li>If both monsters get to zero in the same hit, both are knocked out. Each player gets one step closer to winning.</li><li>After the round, every monster goes to the discard pile, knocked out or not.</li></ol></section>
  <section class="panel"><h3 style="color:var(--accent);margin-bottom:10px">Winning</h3><ul class="list"><li>After round 20, the player who knocked out more of the other player's monsters wins.</li><li>3 players: the player who knocked out the most monsters wins.</li><li>4 players: add up each team's knockouts. The team with more wins.</li></ul></section>
  <section class="panel"><h3 style="color:var(--accent);margin-bottom:10px">Ties</h3><ul class="list"><li>If you are tied after round 20, play a bonus round. Each player brings back one card and picks any monster from their pile. The two monsters fight. The monster that knocks out the other wins.</li><li>If both monsters are knocked out, or neither is, play a second bonus round. Each player shows one more card. The card with the most health wins. No rock-paper-scissors.</li></ul></section>
  <section class="panel"><h3 style="color:var(--accent);margin-bottom:10px">Tokens and the shop</h3><ul class="list"><li>You win 20 tokens for winning a game.</li><li>You buy cards in the shop with tokens.</li><li>You can trade cards with other people.</li></ul></section>
  <section class="panel"><h3 style="color:var(--accent);margin-bottom:10px">Not decided yet</h3><ul class="list"><li>What happens in a tie in 3-player and 4-player games.</li></ul></section>
  <section class="panel" style="grid-column:1/-1"><h3 style="color:var(--accent);margin-bottom:10px">An example round (2 players)</h3><ol class="list"><li>Sam and Mia each draw 1 card.</li><li>Each picks a monster in secret. They show them together. Sam shows a Water monster with 600 health. Mia shows a Fire monster with 700 health.</li><li>Now each picks a move in secret and shows it. Sam's move hits for 200. Water beats fire, so it does 10% more: 220. Mia's move hits for 150.</li><li>Both hit at the same time. Mia's monster has 700 − 220 = 480 health left. Sam's monster has 600 − 150 = 450 left.</li><li>They keep picking moves. Nobody can use the same move twice in a row.</li><li>When one monster gets to zero, it is knocked out. The other player is one step closer to winning.</li><li>The round is over. Both monsters go to the discard pile.</li></ol></section>
  </div>`;
}

/* ---------- add a draft ---------- */
function draftView(m) {
  const n = nextN(m); const fill = missingLast(m);
  const title = fill ? `Add the drawing for Draft ${n} of ${esc(m.name)}` : `Add Draft ${n} of ${esc(m.name)}`;
  return `<div class="mhead"><button class="back" data-act="tomonster" data-id="${esc(m.id)}">Back to ${esc(m.name)}</button></div>
  <h1>${title}</h1>
  ${tipCard("adddraft")}
  <div class="ways">
   <section class="panel way"><button class="bigbtn" data-act="godraw" data-id="${esc(m.id)}">Draw it here</button>
    <ol class="steps"><li>Tap Draw it here.</li><li>Draw with your pencil.</li><li>Tap Save.</li></ol></section>
   <section class="panel way"><label class="bigbtn">Take a photo<input class="sr" type="file" accept="image/*" capture="environment" data-file="photo" data-id="${esc(m.id)}"></label>
    <ol class="steps"><li>Lay the drawing flat on a table.</li><li>Fill the screen with the paper.</li><li>Tap the white button.</li><li>Tap Use Photo.</li></ol></section>
   <section class="panel way"><label class="bigbtn">Pick a picture<input class="sr" type="file" accept="image/*" data-file="pick" data-id="${esc(m.id)}"></label>
    <ol class="steps"><li>From Procreate: tap the wrench, then Share, then JPEG, then Save Image. Come back here, tap Pick a picture, and choose it.</li><li>From Freeform: take a screenshot of your drawing, then pick the screenshot.</li></ol></section>
  </div>`;
}

/* ---------- drawing pad ---------- */
function drawView(m) {
  const n = nextN(m);
  return `<div class="padbar"><button class="back" data-act="tomonster" data-id="${esc(m.id)}">Back</button><b>Draft ${n} of ${esc(m.name)}</b><span class="grow"></span>
   <button class="btn primary" data-act="psave" data-id="${esc(m.id)}">Save as Draft ${n}</button></div>
  ${tipCard("draw")}
  <div class="padgrid"><div class="tools">
   <div class="toolrow" role="group" aria-label="Colors">${SWATCHES.map(([nm, c]) => `<button class="swatch" data-act="pcolor" data-c="${c}" style="background:${c}" aria-label="${nm}"></button>`).join("")}<label class="swatch more" aria-label="More colors">+<input type="color" id="pmore" value="#ff00aa"></label></div>
   <div class="toolrow" role="group" aria-label="Brush sizes">${[["Small", 5, 6], ["Medium", 12, 12], ["Large", 28, 22]].map(([nm, s, px]) => `<button class="sizebtn" data-act="psize" data-s="${s}" aria-label="${nm} brush"><i style="width:${px}px;height:${px}px"></i></button>`).join("")}<button class="btn" id="p-eraser" data-act="peraser">Eraser</button></div>
   <div class="toolrow"><button class="btn" id="p-undo" data-act="pundo" disabled>Undo</button><button class="btn" id="p-redo" data-act="predo" disabled>Redo</button><button class="btn danger" data-act="pclear">Start over</button></div>
  </div>
  <div class="canvaswrap"><canvas id="pad" width="1200" height="1600" aria-label="Drawing pad"></canvas></div></div>`;
}
async function mountPad(m) {
  const canvas = $("pad"); if (!canvas) return;
  pad = new Pad(canvas, () => { syncPad(); scheduleWip(); });
  padId = m.id;
  pad.color = tool.color; pad.size = tool.size; pad.eraser = tool.eraser;
  syncTools(); syncPad();
  const wip = await S.getMeta("wip:" + m.id);
  if (wip && pad && padId === m.id && pad.isEmpty) { ov = { k: "keepdraw", id: m.id, blob: wip }; renderOv(); }
}
function syncTools() {
  document.querySelectorAll('[data-act="pcolor"]').forEach(b => b.classList.toggle("on", !tool.eraser && b.dataset.c === tool.color));
  document.querySelectorAll('[data-act="psize"]').forEach(b => b.classList.toggle("on", +b.dataset.s === tool.size));
  const e = $("p-eraser"); if (e) e.classList.toggle("on", tool.eraser);
}
function syncPad() {
  if (!pad) return;
  const u = $("p-undo"), r = $("p-redo");
  if (u) u.disabled = !pad.canUndo; if (r) r.disabled = !pad.canRedo;
}
function scheduleWip() { clearTimeout(wipTimer); wipTimer = setTimeout(saveWip, 900); }
async function saveWip() {
  if (!pad || pad.discard) return;
  if (pad.isEmpty) { await S.delMeta("wip:" + padId); return; }
  const b = await pad.toBlob(); if (b) await S.setMeta("wip:" + padId, b);
}
function leavePad() {
  const p = pad, id = padId; pad = null; clearTimeout(wipTimer);
  if (!p) return;
  (async () => {
    try {
      if (p.discard || p.isEmpty) await S.delMeta("wip:" + id);
      else { const b = await p.toBlob(); if (b) await S.setMeta("wip:" + id, b); }
    } catch (_) {}
    p.destroy();
  })();
}

/* ---------- grown-up area ---------- */
function parentView() {
  if (!holdOk) return `<div class="center"><h1>Grown-ups only</h1><p class="muted">Hold the button for 3 seconds.</p><button class="btn primary hold" id="hold"><i></i><span>Hold for 3 seconds</span></button></div>`;
  return `<div class="parent"><h1 style="margin-bottom:18px">Grown-ups</h1>
  <section class="panel"><h3>Back up my monsters</h3><p class="muted" style="margin-top:0">Saves every monster, draft and picture in one zip file. Use the share button to save it to Files or send it by AirDrop. ${lastBackup ? "Last backup: " + esc(new Date(lastBackup).toLocaleString()) + "." : "No backup yet on this iPad."}</p>
   <div class="row"><button class="btn primary" data-act="backup">Back up my monsters</button>
   <label class="btn">Restore from backup<input class="sr" type="file" accept=".zip,application/zip" id="f-restore"></label></div>
   <p class="hint">Restore replaces everything on this iPad with the backup. It asks first.</p></section>
  <section class="panel"><h3>Image prompt settings</h3><p class="muted" style="margin-top:0">This text goes at the top of every image prompt. It is locked in the game design, so only change it after a design session.</p>
   <textarea id="f-style" aria-label="Style block">${esc(styleBlock)}</textarea>
   <div class="row" style="margin-top:10px"><button class="btn primary" data-act="savestyle">Save this text</button><button class="btn" data-act="resetstyle">Put the locked text back</button></div></section>
  <section class="panel"><h3>Storage</h3><p id="sinfo" class="muted" style="margin:0">Checking...</p></section>
  <section class="panel"><h3>Data to check</h3><ul class="list"><li>Werewolf has two "For the next draft" items that say the same thing, and two color entries that repeat the earlier colors.</li><li>Magno: Dad still needs to confirm move damage 136, 200, 169.</li><li>Four drawings are missing: tidal wave, cyclops, Mimic, Echo. Add them to the img folder, or open each monster and tap Add the drawing.</li></ul></section>
  <section class="panel"><h3>Later ideas</h3><ul class="list"><li>A battle screen for 2 players.</li><li>Printable cards.</li><li>A server to sync between devices.</li><li>Drawing on top of the last draft as a see-through layer.</li></ul></section></div>`;
}
async function fillStorage() {
  const i = await S.storageInfo(); const el = $("sinfo"); if (!el) return;
  const mb = n => n == null ? "?" : (n / 1048576).toFixed(1) + " MB";
  el.textContent = `Safari ${i.persisted ? "will keep" : "has not promised to keep"} this data. Using ${mb(i.usage)} of ${mb(i.quota)}.${i.persisted ? "" : " Opening Monster Lab from the home-screen icon helps."}`;
}
function startHold(h) {
  const bar = h.querySelector("i"); const t0 = performance.now(); let stop = false;
  const end = () => { stop = true; bar.style.width = "0"; removeEventListener("pointerup", end); removeEventListener("pointercancel", end); };
  addEventListener("pointerup", end); addEventListener("pointercancel", end);
  (function tick() {
    if (stop) return;
    const p = Math.min(1, (performance.now() - t0) / 3000);
    bar.style.width = p * 100 + "%";
    if (p >= 1) { end(); holdOk = true; render(); return; }
    requestAnimationFrame(tick);
  })();
}

/* ---------- quiz ---------- */
function startQuiz(m, all) {
  const s = [{ k: "intro" }];
  if (m.seen && !m.seen.checked && (m.seen.items || []).length) s.push({ k: "intake" });
  s.push({ k: "like" }, { k: "change" });
  if (all || !m.type) s.push({ k: "type" });
  if (all || !m.rarity) s.push({ k: "rarity" });
  if (all || !m.height) s.push({ k: "height" });
  if (all || !m.territory) s.push({ k: "territory" });
  [0, 1, 2].forEach(i => { const x = (m.moves || [])[i]; if (all || !x || !x.name || !x.dmg) s.push({ k: "move", i }); });
  if (all || !m.signature) s.push({ k: "signature" });
  if (all || !m.expression) s.push({ k: "expression" });
  if (all || !m.look) s.push({ k: "look" });
  s.push({ k: "color" }, { k: "review" });
  quiz = { id: m.id, steps: s, i: 0, a: {}, t: {}, reflect: "" };
  loadT();
  go("quiz-" + m.id);
  window.scrollTo(0, 0);
}
const key = st => (st.k === "move" ? "move" + st.i : st.k);
function loadT() {
  const st = quiz.steps[quiz.i]; const prev = quiz.a[key(st)];
  quiz.t = prev && !prev.skip ? clone(prev) : {};
  const m = getM(quiz.id);
  if (st.k === "move" && !prev) { const x = (m.moves || [])[st.i] || {}; quiz.t = { name: x.name || "", dmg: x.dmg || null }; }
  if (st.k === "height" && !prev) quiz.t = { text: m.height || "" };
  if (st.k === "territory" && !prev) quiz.t = { text: m.territory || "" };
  if (st.k === "color") quiz.t = { list: prev && !prev.skip ? clone(prev.list) : [], stage: prev && !prev.skip ? "more" : "part", part: "", color: "" };
}
function quizView() {
  const m = getM(quiz.id); const st = quiz.steps[quiz.i]; const t = quiz.t; const total = quiz.steps.length - 1; const d = cur(m);
  const pct = Math.round(quiz.i / total * 100);
  let q = "", body = "", skip = "Not decided yet", next = "Next";
  if (st.k === "intro") {
    skip = ""; next = "Let's go";
    q = `${esc(m.name)}: Draft ${d.n}`;
    const ds = m.drafts || [];
    body = `<div class="dstrip">${ds.map((x, i) => `${i ? '<span class="arrow" aria-hidden="true">→</span>' : ""}<figure class="${x.n === d.n ? "on" : ""}">${imgSrc(x) ? `<img src="${esc(imgSrc(x))}" alt="Draft ${x.n}">` : `<div class="ph">Add the drawing</div>`}<figcaption>Draft ${x.n}</figcaption></figure>`).join("")}<span class="arrow" aria-hidden="true">→</span><figure><div class="ph dash">?</div><figcaption>Draft ${d.n + 1}</figcaption></figure></div>
    <div class="say"><p>A draft is one try at a monster. You look at it, keep what you like, and say what should be different. That goes into the next draft.</p>
    <p>Changing something doesn't mean the last draft was bad. Every card in this game gets made this way.</p>
    <p class="muted">You're the creative director. Tap "Not decided yet" on anything you want to think about.</p></div>`;
  }
  if (st.k === "intake") {
    q = `Here's what I see in Draft ${d.n}. Tap anything that's wrong.`;
    t.wrong = t.wrong || [];
    body = `<div class="chips">${m.seen.items.map((x, i) => `<button class="chip ${t.wrong.includes(i) ? "wrong" : ""}" data-act="tw" data-i="${i}" aria-pressed="${t.wrong.includes(i)}">${esc(x)}</button>`).join("")}</div>
    <div class="field"><label for="f-miss">Anything I missed? (you can leave this empty)</label><textarea id="f-miss" data-bind="missing">${esc(t.missing || "")}</textarea></div>
    <p class="hint">Nothing wrong? Just tap Next.</p>`;
  }
  if (st.k === "like") {
    q = `What do you like in Draft ${d.n}?`; t.sel = t.sel || [];
    const parts = m.parts || [];
    body = `${parts.length ? `<div class="chips">${parts.map(x => `<button class="chip ${t.sel.includes(x) ? "on" : ""}" data-act="tsel" data-v="${esc(x)}" aria-pressed="${t.sel.includes(x)}">${esc(x)}</button>`).join("")}</div><p class="hint">Pick as many as you want.</p>` : ""}
    <div class="field"><label for="f-like">${parts.length ? "Something else" : "Tell me what you like"}</label><input id="f-like" data-bind="text" value="${esc(t.text || "")}" placeholder="Type it here"></div>`;
  }
  if (st.k === "change") {
    q = `What should be different in Draft ${d.n + 1}?`;
    body = `<div class="chips"><button class="chip ${t.nothing ? "on" : ""}" data-act="tnothing" aria-pressed="${!!t.nothing}">Nothing. Keep it like this.</button></div>
    <div class="field"><label for="f-chg">Or tell me what to change</label><textarea id="f-chg" data-bind="text" placeholder="Bigger wings, different colors, a new part...">${esc(t.text || "")}</textarea></div>`;
  }
  if (st.k === "type") {
    q = `What type is ${esc(m.name)}?`;
    const beats = ADV.filter(a => a[0] === t.v).map(a => a[1]), lose = ADV.filter(a => a[1] === t.v).map(a => a[0]);
    body = `<div class="cgrid">${TYPES.map(x => `<button class="chip ${t.v === x ? "on" : ""}" data-act="tv" data-v="${esc(x)}" aria-pressed="${t.v === x}">${x}</button>`).join("")}</div>
    ${t.v ? `<p class="hint">${esc(t.v)}${beats.length ? " beats " + beats.join(", ").toLowerCase() + "." : " doesn't beat any type yet."}${lose.length ? " " + lose.join(", ") + " beats it." : ""}</p>` : ""}`;
  }
  if (st.k === "rarity") {
    q = `How rare is ${esc(m.name)}?`;
    body = `<div class="cgrid">${RAR.map(r => `<button class="chip ${t.v === r[0] ? "on" : ""}" data-act="tv" data-v="${r[0]}" aria-pressed="${t.v === r[0]}"><span class="sw" style="background:${r[2]}"></span>${r[0]}<br><small class="muted num">${r[3].toLocaleString()} health</small></button>`).join("")}</div>`;
  }
  if (st.k === "height") { q = `How tall is ${esc(m.name)}?`; body = `<div class="field"><label for="f-h">It goes on the card next to the name</label><input id="f-h" data-bind="text" value="${esc(t.text || "")}" placeholder="13 ft"></div>`; }
  if (st.k === "territory") { q = `Where is ${esc(m.name)}'s territory in the pocket dimension?`; body = `<div class="field"><label for="f-t">Describe the place</label><textarea id="f-t" data-bind="text">${esc(t.text || "")}</textarea></div>`; }
  if (st.k === "move") {
    q = `Move ${st.i + 1} of 3. What's it called, and how hard does it hit?`;
    body = `<div class="field"><label for="f-mn">Move name</label><input id="f-mn" data-bind="name" value="${esc(t.name || "")}" placeholder="Move name"></div>
    <div class="field"><label for="f-md">Damage, 60 to 300. Pick a number.</label><div class="dmg ${t.dmg ? "" : "unset"}" id="dmgbox"><input type="range" id="f-md" min="60" max="300" step="1" value="${t.dmg || 180}" data-bind="dmg" aria-label="Damage"><output id="o-md" class="num">${t.dmg || "?"}</output></div>
    <div class="row dmgbtns" style="margin-top:8px"><button class="btn small" data-act="dmgstep" data-d="-10">−10</button><button class="btn small" data-act="dmgstep" data-d="-1">−1</button><button class="btn small" data-act="dmgstep" data-d="1">+1</button><button class="btn small" data-act="dmgstep" data-d="10">+10</button></div></div>
    <p class="hint">Slide or tap the buttons until the number is right. You can't go on until you pick one.</p>`;
  }
  if (st.k === "signature") {
    q = `What's the one thing that makes ${esc(m.name)} yours?`; const parts = m.parts || [];
    body = `${parts.length ? `<div class="chips">${parts.map(x => `<button class="chip ${t.v === x ? "on" : ""}" data-act="tv" data-v="${esc(x)}" aria-pressed="${t.v === x}">${esc(x)}</button>`).join("")}</div>` : ""}
    <div class="field"><label for="f-sig">${parts.length ? "Something else" : "Tell me"}</label><input id="f-sig" data-bind="text" value="${esc(t.text || "")}" placeholder="Type it here"></div>`;
  }
  if (st.k === "expression") {
    q = `What's ${esc(m.name)}'s face like?`;
    body = `<div class="chips">${["Angry", "Sneaky", "Hungry", "Creepy smile"].map(x => `<button class="chip ${t.v === x ? "on" : ""}" data-act="tv" data-v="${x}" aria-pressed="${t.v === x}">${x}</button>`).join("")}</div>
    <div class="field"><label for="f-ex">Something else</label><input id="f-ex" data-bind="text" value="${esc(t.text || "")}" placeholder="Type it here"></div>`;
  }
  if (st.k === "look") {
    q = `Is ${esc(m.name)} realistic or cartoony?`;
    body = `<div class="chips">${["Realistic", "Cartoony"].map(x => `<button class="chip ${t.v === x ? "on" : ""}" data-act="tv" data-v="${x}" aria-pressed="${t.v === x}" style="font-size:20px;padding:16px 22px">${x}</button>`).join("")}</div>`;
  }
  if (st.k === "color") {
    const had = (m.colors || []);
    const sofar = (had.length || t.list.length) ? `<div class="sofar"><b>Parts that have colors</b><ul>${had.map(c => `<li>${esc(c.part)}: ${esc(c.color)}</li>`).join("")}${t.list.map(c => `<li>${esc(c.part)}: ${esc(c.color)} (new)</li>`).join("")}</ul></div>` : "";
    if (t.stage === "part") {
      q = t.list.length ? "Which part is next?" : "Which part do you want to give a color?";
      const done = new Set([...had.map(c => c.part), ...t.list.map(c => c.part)]);
      const parts = (m.parts || []).filter(p => !done.has(p));
      body = `${parts.length ? `<div class="chips">${parts.map(x => `<button class="chip ${t.part === x ? "on" : ""}" data-act="cpart" data-v="${esc(x)}">${esc(x)}</button>`).join("")}</div>` : ""}
      <div class="field"><label for="f-cp">${parts.length ? "Or type a part" : "Type the part"}</label><input id="f-cp" data-bind="part" value="${esc(t.part || "")}" placeholder="Solar panels"></div>${sofar}`;
      skip = t.list.length ? "That's all" : "Not decided yet";
    } else if (t.stage === "color") {
      q = `What color is the ${esc(t.part)}?`;
      body = `<div class="chips colorchips">${COLOR_WORDS.map(([n, c]) => `<button class="chip" data-act="cword" data-v="${n}"><span class="sw" style="background:${c}"></span>${n}</button>`).join("")}</div>
      <div class="field"><label for="f-cc">Or type the color</label><input id="f-cc" data-bind="color" value="${esc(t.color || "")}" placeholder="Black and silver"></div>${sofar}`;
    } else {
      skip = ""; next = "That's all";
      q = "Add another part?";
      body = `${sofar}<div class="row" style="margin-top:16px"><button class="btn" data-act="coloradd">Add another part</button></div>`;
    }
  }
  if (st.k === "review") {
    skip = ""; next = `Save to ${esc(m.name)}'s page`;
    q = `Here's what you decided`;
    const lines = quiz.steps.filter(s => !["intro", "review"].includes(s.k)).map(s => reflectFor(s, quiz.a[key(s)])).filter(Boolean);
    body = `<ul class="list review">${lines.map(l => `<li>${esc(l)}</li>`).join("")}</ul><p class="hint">Want to fix something? Tap Back.</p>`;
  }
  return `<div class="quiz">
   <div class="qtop"><span>${esc(m.name)} · Draft ${d.n}</span><span>${st.k === "intro" ? "Start" : st.k === "review" ? "Check it" : `Question ${quiz.i} of ${total - 1}`}</span></div>
   <div class="bar" aria-hidden="true"><i style="width:${pct}%"></i></div>
   ${quiz.reflect ? `<div class="reflect" role="status">${esc(quiz.reflect)}</div>` : ""}
   <h2 class="q">${q}</h2>${body}
   <div class="err" id="qerr" role="alert"></div>
   <div class="qnav"><div class="row"><button class="btn ghost" data-act="qback">${quiz.i ? "Back" : "Exit"}</button>${quiz.i ? `<button class="btn ghost small" data-act="qexit">Stop the quiz</button>` : ""}</div>
   <div class="row">${skip ? `<button class="btn" data-act="qskip">${skip}</button>` : ""}<button class="btn primary" data-act="qnext">${next}</button></div></div></div>`;
}
function answerFor(st, t) {
  const s = x => (x || "").trim();
  switch (st.k) {
    case "intro": return {};
    case "intake": return { wrong: (t.wrong || []).map(i => getM(quiz.id).seen.items[i]), missing: s(t.missing) };
    case "like": { const v = [...(t.sel || [])]; if (s(t.text)) v.push(s(t.text)); return v.length ? { v } : "Pick something you like, or tap Not decided yet."; }
    case "change": if (t.nothing) return { nothing: true }; return s(t.text) ? { text: s(t.text) } : 'Tap "Nothing", or type what to change.';
    case "type": case "rarity": case "look": return t.v ? { v: t.v } : "Pick one, or tap Not decided yet.";
    case "height": case "territory": return s(t.text) ? { text: s(t.text) } : "Type an answer, or tap Not decided yet.";
    case "move": if (!s(t.name)) return "Give the move a name."; if (!t.dmg) return "Pick the damage. Slide or tap the buttons."; return { name: s(t.name), dmg: Math.round(t.dmg) };
    case "signature": case "expression": { const v = s(t.text) || t.v; return v ? { v } : "Pick one, or type it."; }
  }
}
function reflectFor(st, a) {
  if (!a) return ""; if (a.skip) return label(st) + ": not decided yet.";
  switch (st.k) {
    case "intake": return a.wrong.length || a.missing ? `Wrong on my list: ${a.wrong.join(", ") || "nothing"}.${a.missing ? " Missed: " + a.missing + "." : ""}` : "My list was right.";
    case "like": return "You like: " + a.v.join(", ") + ".";
    case "change": return a.nothing ? "Nothing to change." : "Next draft: " + a.text;
    case "type": return "Type: " + a.v + ".";
    case "rarity": return `Rarity: ${a.v}, ${rar(a.v)[3].toLocaleString()} health.`;
    case "height": return "Height: " + a.text;
    case "territory": return "Territory: " + a.text;
    case "move": return `Move ${st.i + 1}: ${a.name}, ${a.dmg} damage.`;
    case "signature": return "What makes it yours: " + a.v;
    case "expression": return "Face: " + a.v;
    case "look": return "Style: " + a.v + ".";
    case "color": return "Colors: " + a.list.map(c => `${c.part}: ${c.color}`).join("; ") + ".";
  }
  return "";
}
function label(st) { return { intake: "My list", like: "What you like", change: "Next draft", type: "Type", rarity: "Rarity", height: "Height", territory: "Territory", signature: "What makes it yours", expression: "Face", look: "Realistic or cartoony", color: "Colors" }[st.k] || ("Move " + (st.i + 1)); }

async function saveQuiz() {
  const m = clone(getM(quiz.id)); const d = cur(m).n; const who = "Grayson";
  m.log = m.log || []; m.colors = m.colors || []; m.moves = m.moves || [{}, {}, {}]; m.next = m.next || []; m.parts = m.parts || [];
  const L = (kind, text) => m.log.push({ draft: d, kind, text, who });
  for (const st of quiz.steps) {
    const a = quiz.a[key(st)]; if (!a || a.skip) continue;
    switch (st.k) {
      case "intake": a.wrong.forEach(w => L("CHANGE", `Marked wrong on the list: ${w}`)); if (a.missing) L("ADD", `Missed on the list: ${a.missing}`);
        m.seen.checked = true; m.parts = m.parts.filter(p => !a.wrong.includes(p)); if (a.missing) m.parts.push(a.missing); break;
      case "like": L("KEEP", "Likes: " + a.v.join(", ")); break;
      case "change": if (a.nothing) L("KEEP", `Nothing to change in Draft ${d}`); else { L("CHANGE", `For the next draft: ${a.text}`); m.next.push(a.text); } break;
      case "type": L(m.type ? "CHANGE" : "ADD", "Type: " + a.v); m.type = a.v; break;
      case "rarity": L(m.rarity ? "CHANGE" : "ADD", `Rarity: ${a.v}, ${rar(a.v)[3]} health`); m.rarity = a.v; break;
      case "height": L(m.height ? "CHANGE" : "ADD", "Height: " + a.text); m.height = a.text; break;
      case "territory": L(m.territory ? "CHANGE" : "ADD", "Territory: " + a.text); m.territory = a.text; break;
      case "move": L(m.moves[st.i] && m.moves[st.i].name ? "CHANGE" : "ADD", `Move ${st.i + 1}: ${a.name}, ${a.dmg}`); m.moves[st.i] = { name: a.name, dmg: a.dmg }; break;
      case "signature": L(m.signature ? "CHANGE" : "ADD", "What makes it his: " + a.v); m.signature = a.v; break;
      case "expression": L(m.expression ? "CHANGE" : "ADD", "Face: " + a.v); m.expression = a.v; break;
      case "look": L(m.look ? "CHANGE" : "ADD", "Style: " + a.v); m.look = a.v; break;
      case "color": for (const c of a.list) {
        const i = m.colors.findIndex(x => x.part.toLowerCase() === c.part.toLowerCase());
        L(i >= 0 ? "CHANGE" : "ADD", `Color: ${c.part}, ${c.color}`);
        if (i >= 0) m.colors[i].color = c.color; else m.colors.push({ part: c.part, color: c.color });
      } break;
    }
  }
  if (await save(m)) { const id = quiz.id; quiz = null; viewDraft[id] = null; toast(`Saved to ${m.name}'s page.`); go("monster-" + id); window.scrollTo(0, 0); }
}

/* ---------- image prompt ---------- */
function buildPrompt(m) {
  const d = cur(m);
  if (m.prompt && d && m.prompt.forDraft === d.n) return m.prompt;
  const look = (m.look || "cartoony").toLowerCase();
  const parts = [`${m.name}${m.expression ? ", " + m.expression : ""}.`];
  if (m.signature) parts.push(`Signature feature: "${m.signature}".`);
  (m.colors || []).forEach(c => parts.push(`${c.part}: ${c.color}.`));
  const avoid = [
    look === "realistic" ? "No cartoon outline. Instead, do realistic with shading." : "No glossy 3D render. Instead, do a thin black outline with a little shading.",
    "No new parts or reshaped parts. Instead, keep the drawing's shapes and details.",
    "No card border, text or numbers. Instead, do the monster picture only."
  ];
  return { version: "Built from his answers", subject: parts.join(" "), composition: "3:4 portrait. Full body, centered, front-facing. Plain dark background.", avoid };
}
function promptText(m) {
  const p = buildPrompt(m);
  const ch = (m.next || []).length ? `\n\nCHANGES FOR THIS DRAFT\n${m.next.map(x => "- " + x).join("\n")}` : "";
  return `STYLE BLOCK\n${styleBlock}\nThis monster is: ${(m.look || "not decided").toLowerCase()}\n\nSUBJECT\n${p.subject}\n\nCOMPOSITION\n${p.composition}\n\nAVOID\n${p.avoid.map(x => "- " + x).join("\n")}${ch}`;
}

/* ---------- overlays ---------- */
function renderOv() {
  const el = $("ov"); if (!ov) { el.innerHTML = ""; return; }
  const m = ov.id ? getM(ov.id) : null; let h = "";
  if (ov.k === "prompt") {
    const p = buildPrompt(m); const sw = wc(p.subject), cw = wc(p.composition);
    h = `<div class="row" style="justify-content:space-between;flex-wrap:nowrap"><h2>${esc(m.name)} image prompt</h2><button class="helpbtn" data-act="help" data-key="prompt" aria-label="Help">?</button></div>
    <p class="muted" style="margin-top:0">${esc(p.version)}. Paste it into the image tool. Upload Draft ${cur(m).n} as the reference image.</p>
    <pre class="prompt" id="ptext">${esc(promptText(m))}</pre>
    <div class="row" style="margin-top:10px"><span class="pill ${sw >= 50 && sw <= 80 ? "pass" : "miss"}">Subject: ${sw} words (50 to 80)</span><span class="pill ${cw <= 25 ? "pass" : "miss"}">Composition: ${cw} words (25 or fewer)</span></div>
    <div class="row" style="margin-top:16px;justify-content:flex-end"><button class="btn ghost" data-act="close">Close</button><button class="btn primary" data-act="copy">Copy prompt</button></div>`;
  }
  if (ov.k === "new") {
    h = `<h2>New monster</h2><div class="field"><label for="f-nn">What's its name?</label><input id="f-nn" autocomplete="off" placeholder="Monster name"></div><div class="err" id="oerr" role="alert"></div>
    <div class="row" style="justify-content:flex-end"><button class="btn ghost" data-act="close">Cancel</button><button class="btn primary" data-act="create">Make it</button></div>`;
  }
  if (ov.k === "lock") {
    const miss = checks(m).filter(c => !c[1]);
    h = `<h2>Lock ${esc(m.name)}?</h2><p>Locked means Grayson says it's done. The card loses its draft stamp. You can unlock later for a new draft.</p>
    ${miss.length ? `<p class="muted">Rules not passed yet: ${miss.map(c => c[0]).join(", ")}.</p>` : ""}
    <div class="row" style="justify-content:flex-end"><button class="btn ghost" data-act="close">Not yet</button><button class="btn primary" data-act="dolock">Lock it</button></div>`;
  }
  if (ov.k === "help") {
    const hp = HELP[ov.key];
    h = `<h2>${esc(hp.title)}</h2>${hp.steps.length ? `<ol class="steps">${hp.steps.map(s => `<li>${esc(s)}</li>`).join("")}</ol>` : ""}
    ${hp.legend ? `<dl class="helplegend">${hp.legend.map(l => `<dt>${esc(l[0])}</dt><dd>${esc(l[1])}</dd>`).join("")}</dl>` : ""}
    <div class="row" style="margin-top:16px;justify-content:flex-end">${speakBtn("help", ov.key)}<button class="btn primary" data-act="close">Close</button></div>`;
  }
  if (ov.k === "confirm") {
    h = `<h2>${esc(ov.title)}</h2><p>${esc(ov.text)}</p><div class="row" style="justify-content:flex-end"><button class="btn ghost" data-act="close">${esc(ov.no || "Cancel")}</button><button class="btn primary" data-act="confirmyes">${esc(ov.yes)}</button></div>`;
  }
  if (ov.k === "keepdraw") {
    h = `<h2>You have a drawing you did not save</h2><p>Do you want to keep drawing it?</p><div class="row" style="justify-content:flex-end"><button class="btn ghost" data-act="freshdraw">Start a new drawing</button><button class="btn primary" data-act="keepdraw">Keep drawing</button></div>`;
  }
  if (ov.k === "note") {
    const n = nextN(m);
    h = `<h2>${missingLast(m) ? `Add the drawing for Draft ${n}` : `Add Draft ${n}`}</h2><img class="notepreview" src="${esc(ov.url)}" alt="Your picture">
    <div class="field"><label for="f-note">What's this draft? (short)</label><input id="f-note" autocomplete="off" placeholder="${n === 1 ? "Grayson's pencil drawing" : "What changed from Draft " + (n - 1)}"></div>
    <div class="field"><label>Who made it?</label><div class="chips">${["Grayson", "Image tool"].map(x => `<button class="chip ${ov.by === x ? "on" : ""}" data-act="noteby" data-v="${x}" aria-pressed="${ov.by === x}">${x}</button>`).join("")}</div></div>
    ${!missingLast(m) && (m.next || []).length ? `<p class="hint">These changes were asked for, and they get logged with Draft ${n}: ${esc(m.next.join("; "))}</p>` : ""}
    <div class="err" id="oerr" role="alert"></div>
    <div class="row" style="justify-content:flex-end"><button class="btn ghost" data-act="close">Cancel</button><button class="btn primary" data-act="notesave">Add Draft ${n}</button></div>`;
  }
  el.innerHTML = `<div class="ov" data-act="ovbg"><div class="dlg" role="dialog" aria-modal="true">${h}</div></div>`;
  const f = el.querySelector("#f-nn"); if (f) f.focus();
  updateBanner();
}
function closeOv() {
  if (ov && ov.url) URL.revokeObjectURL(ov.url);
  ov = null; renderOv();
}

/* ---------- saving ---------- */
async function save(m) {
  const copy = clone(m); copy.updated = new Date().toISOString();
  try {
    await S.putMonster(copy);
    const i = monsters.findIndex(x => x.id === copy.id);
    if (i >= 0) monsters[i] = copy; else monsters.push(copy);
    return true;
  } catch (e) { toast("Couldn't save. Try again."); return false; }
}
async function finishDraft(id, blob, note, by) {
  const m = clone(getM(id)); const imgId = await addImage(blob); let n;
  m.drafts = m.drafts || []; m.log = m.log || [];
  if (missingLast(m)) {
    const d = cur(m); d.imgId = imgId; delete d.seedImg; if (note) d.note = note; d.by = by || d.by; n = d.n;
  } else {
    n = m.drafts.length + 1;
    m.drafts.push({ n, imgId, note: note || (by === "Image tool" ? "Image tool" : "Grayson's drawing"), by });
    (m.next || []).forEach(x => m.log.push({ draft: n, kind: "CHANGE", text: "Asked for in this draft: " + x, who: "Grayson" }));
    m.next = []; m.seen = { n, items: [], checked: true };
  }
  if (!(await save(m))) return false;
  if (pad && padId === id) pad.discard = true;
  await S.delMeta("wip:" + id);
  viewDraft[id] = null;
  toast(`Draft ${n} added.`);
  return true;
}

/* ---------- backup and restore ---------- */
async function doBackup() {
  try {
    const data = await S.exportAll(); const files = []; const imgs = {};
    for (const { id, blob } of data.images) {
      const ext = blob.type === "image/png" ? "png" : "jpg"; const name = `images/${id}.${ext}`;
      imgs[id] = { file: name, type: blob.type || "image/jpeg" };
      files.push({ name, data: new Uint8Array(await blob.arrayBuffer()) });
    }
    const json = { app: "monster-lab", dataVersion: S.DATA_VERSION, exported: new Date().toISOString(), monsters: data.monsters, meta: data.meta, images: imgs };
    files.unshift({ name: "backup.json", data: new TextEncoder().encode(JSON.stringify(json, null, 1)) });
    const zip = makeZip(files);
    const d = new Date(); const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const name = `monster-lab-backup-${stamp}.zip`;
    const file = new File([zip], name, { type: "application/zip" });
    let saved = false;
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: "Monster Lab backup" }); saved = true; }
      catch (e) { if (e && e.name === "AbortError") return; }
    }
    if (!saved) {
      const a = document.createElement("a"); a.href = URL.createObjectURL(zip); a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    }
    lastBackup = new Date().toISOString(); await S.setMeta("lastBackup", lastBackup);
    toast("Backup made."); if (route().v === "parent") render();
  } catch (e) { toast("The backup didn't work: " + (e.message || e)); }
}
async function readBackup(file) {
  const files = await readZip(await file.arrayBuffer());
  const raw = files["backup.json"]; if (!raw) throw new Error("This zip is not a Monster Lab backup.");
  const j = JSON.parse(new TextDecoder().decode(raw));
  if (j.app !== "monster-lab" || !Array.isArray(j.monsters)) throw new Error("This zip is not a Monster Lab backup.");
  if (j.dataVersion > S.DATA_VERSION) throw new Error("This backup is from a newer Monster Lab. Update the app first.");
  const images = [];
  for (const [id, info] of Object.entries(j.images || {})) { const d = files[info.file]; if (d) images.push({ id, blob: new Blob([d], { type: info.type || "image/jpeg" }) }); }
  return { monsters: S.migrate(j.monsters, j.dataVersion || 1), images, meta: j.meta || {} };
}
async function doRestore(data) {
  await S.replaceAll(data);
  monsters = await S.allMonsters(); await loadUrls();
  tips = (await S.getMeta("tips")) || {}; styleBlock = (await S.getMeta("styleBlock")) || STYLE_BLOCK;
  quiz = null; viewDraft = {};
  toast(`Restored ${monsters.length} monsters.`); go("roster");
}

/* ---------- events ---------- */
document.addEventListener("input", e => {
  const b = e.target.dataset && e.target.dataset.bind; if (!b || !quiz) return;
  quiz.t[b] = b === "dmg" ? +e.target.value : e.target.value;
  if (b === "dmg") { $("o-md").textContent = e.target.value; $("dmgbox").classList.remove("unset"); }
  const st = quiz.steps[quiz.i];
  if (b === "text" && ["signature", "expression"].includes(st.k) && e.target.value && quiz.t.v) { quiz.t.v = ""; document.querySelectorAll('[data-act="tv"].on').forEach(c => { c.classList.remove("on"); c.setAttribute("aria-pressed", "false"); }); }
  if (b === "text" && st.k === "change" && e.target.value && quiz.t.nothing) { quiz.t.nothing = false; const c = document.querySelector('[data-act="tnothing"]'); if (c) { c.classList.remove("on"); c.setAttribute("aria-pressed", "false"); } }
  const er = $("qerr"); if (er) er.textContent = "";
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && ov && ov.k !== "keepdraw") closeOv();
  if (e.key === "Enter" && quiz && e.target.matches && e.target.matches("input[data-bind]")) { e.preventDefault(); const n = document.querySelector('[data-act="qnext"]'); if (n) n.click(); }
  if (e.key === "Enter" && ov && ov.k === "new" && e.target.id === "f-nn") document.querySelector('[data-act="create"]').click();
});
document.addEventListener("pointerdown", e => { const h = e.target.closest && e.target.closest("#hold"); if (h) startHold(h); });
document.addEventListener("contextmenu", e => { if (e.target.closest && e.target.closest("#hold")) e.preventDefault(); });

document.addEventListener("change", async e => {
  const t = e.target;
  if (t.dataset && t.dataset.file) {
    const f = t.files[0]; const src = t.dataset.file; const id = t.dataset.id; t.value = "";
    if (!f) return;
    const m = getM(id);
    try {
      toast("Getting your picture ready...");
      const blob = await resizeToJpeg(f);
      ov = { k: "note", id, blob, url: URL.createObjectURL(blob), by: src === "photo" || nextN(m) === 1 ? "Grayson" : "Image tool" };
      $("toast").hidden = true; renderOv();
    } catch (_) { toast("That picture didn't work. Try another one."); }
    return;
  }
  if (t.id === "pmore" && pad) { tool.color = t.value; tool.eraser = false; pad.color = tool.color; pad.eraser = false; syncTools(); document.querySelectorAll('[data-act="pcolor"]').forEach(b => b.classList.remove("on")); return; }
  if (t.id === "f-restore") {
    const f = t.files[0]; t.value = ""; if (!f) return;
    try {
      const data = await readBackup(f);
      ov = { k: "confirm", title: "Restore this backup?", text: `This replaces everything on this iPad with the ${data.monsters.length} monsters in the backup. Anything made since the backup will be gone.`, yes: "Replace everything", no: "Keep what I have", fn: () => doRestore(data) };
      renderOv();
    } catch (err) { toast(err.message || "That file didn't work."); }
  }
});

document.addEventListener("click", async e => {
  const el = e.target.closest("[data-act]"); if (!el) return; const a = el.dataset.act;
  if (a === "ovbg" && e.target !== el) return;
  if (a === "ovbg") { if (ov && ov.k !== "keepdraw") closeOv(); return; }
  const id = el.dataset.id;
  switch (a) {
    case "open": go("monster-" + id); window.scrollTo(0, 0); break;
    case "home": go("roster"); break;
    case "tomonster": go("monster-" + id); break;
    case "new": ov = { k: "new" }; renderOv(); break;
    case "close": closeOv(); break;
    case "help": ov = { k: "help", key: el.dataset.key }; renderOv(); break;
    case "help-here": ov = { k: "help", key: helpKey() }; renderOv(); break;
    case "speak": { const h = el.dataset.kind === "tip" ? TIPS[el.dataset.key] : HELP[el.dataset.key]; speak(helpText(h)); break; }
    case "dismisstip": tips[el.dataset.key] = true; { const tp = el.closest(".tip"); if (tp) tp.remove(); } await S.setMeta("tips", tips); break;
    case "seldraft": viewDraft[id] = +el.dataset.n; render(); break;
    case "quiz": startQuiz(getM(id), false); break;
    case "quizall": startQuiz(getM(id), true); break;
    case "resumequiz": go("quiz-" + id); break;
    case "prompt": ov = { k: "prompt", id }; renderOv(); break;
    case "adddraft": go("draft-" + id); window.scrollTo(0, 0); break;
    case "godraw": go("draw-" + id); window.scrollTo(0, 0); break;
    case "lock": ov = { k: "lock", id }; renderOv(); break;
    case "dolock": { const m = clone(getM(ov.id)); m.status = "locked"; m.log = m.log || []; m.log.push({ draft: cur(m) ? cur(m).n : 0, kind: "KEEP", text: "Locked. Grayson says it's done.", who: "Grayson" }); if (await save(m)) { closeOv(); render(); toast(m.name + " is locked."); } break; }
    case "unlock": { const m = clone(getM(id)); m.status = "draft"; if (await save(m)) { render(); toast(m.name + " is open for a new draft."); } break; }
    case "closeopen": { const m = clone(getM(id)); m.open.splice(+el.dataset.i, 1); if (await save(m)) render(); break; }
    case "copy": { const txt = promptText(getM(ov.id)); try { await navigator.clipboard.writeText(txt); toast("Prompt copied."); } catch (_) { const r = document.createRange(); r.selectNodeContents($("ptext")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast("Selected. Press Cmd+C to copy."); } break; }
    case "create": {
      const name = $("f-nn").value.trim(); if (!name) { $("oerr").textContent = "Type a name first."; return; }
      let sid = slug(name), k = 2; while (getM(sid)) sid = slug(name) + "-" + k++;
      const m = { id: sid, name, status: "draft", order: monsters.length + 1, drafts: [], parts: [], colors: [], moves: [{}, {}, {}], log: [], next: [], open: [] };
      if (await save(m)) { closeOv(); go("draft-" + sid); }
      break;
    }
    case "noteby": ov.by = el.dataset.v; { const keep = $("f-note").value; renderOv(); $("f-note").value = keep; } break;
    case "notesave": {
      const note = $("f-note").value.trim(); el.disabled = true; el.textContent = "Saving...";
      const m = ov.id, blob = ov.blob, by = ov.by;
      if (await finishDraft(m, blob, note, by)) { closeOv(); go("monster-" + m); window.scrollTo(0, 0); }
      else { el.disabled = false; el.textContent = "Try again"; }
      break;
    }
    case "confirmyes": { const f = ov.fn; closeOv(); await f(); break; }
    /* drawing pad */
    case "pcolor": tool.color = el.dataset.c; tool.eraser = false; if (pad) { pad.color = tool.color; pad.eraser = false; } syncTools(); break;
    case "psize": tool.size = +el.dataset.s; if (pad) pad.size = tool.size; syncTools(); break;
    case "peraser": tool.eraser = !tool.eraser; if (pad) pad.eraser = tool.eraser; syncTools(); break;
    case "pundo": if (pad) pad.undo(); break;
    case "predo": if (pad) pad.redo(); break;
    case "pclear": ov = { k: "confirm", title: "Start over?", text: "This erases the whole drawing.", yes: "Start over", no: "Keep drawing", fn: async () => { if (pad) pad.clear(); } }; renderOv(); break;
    case "psave": {
      if (!pad || pad.isEmpty) { toast("Draw something first."); break; }
      const blob = await pad.toBlob(); if (!blob) { toast("Couldn't save the drawing."); break; }
      ov = { k: "note", id, blob, url: URL.createObjectURL(blob), by: "Grayson" }; renderOv(); break;
    }
    case "keepdraw": { const b = ov.blob; ov = null; renderOv(); if (pad) await pad.loadBase(b); break; }
    case "freshdraw": { await S.delMeta("wip:" + ov.id); ov = null; renderOv(); break; }
    /* grown-ups */
    case "backup": await doBackup(); break;
    case "savestyle": { const v = $("f-style").value.trim(); if (!v) { toast("The text can't be empty."); break; } styleBlock = v; await S.setMeta("styleBlock", v); toast("Saved."); break; }
    case "resetstyle": styleBlock = STYLE_BLOCK; await S.delMeta("styleBlock"); render(); toast("The locked text is back."); break;
    /* quiz */
    case "tw": { const i = +el.dataset.i; const w = quiz.t.wrong; const j = w.indexOf(i); j >= 0 ? w.splice(j, 1) : w.push(i); render(); break; }
    case "tsel": { const v = el.dataset.v; const s = quiz.t.sel; const j = s.indexOf(v); j >= 0 ? s.splice(j, 1) : s.push(v); render(); break; }
    case "tv": quiz.t.v = quiz.t.v === el.dataset.v ? "" : el.dataset.v; if (["signature", "expression"].includes(quiz.steps[quiz.i].k) && quiz.t.v) quiz.t.text = ""; render(); break;
    case "tnothing": quiz.t.nothing = !quiz.t.nothing; if (quiz.t.nothing) quiz.t.text = ""; render(); break;
    case "dmgstep": { const v = Math.max(60, Math.min(300, (quiz.t.dmg || 180) + +el.dataset.d)); quiz.t.dmg = v; $("f-md").value = v; $("o-md").textContent = v; $("dmgbox").classList.remove("unset"); const er = $("qerr"); if (er) er.textContent = ""; break; }
    case "cpart": quiz.t.part = el.dataset.v; render(); break;
    case "cword": { const c = quiz.t.color ? quiz.t.color + " and " + el.dataset.v : el.dataset.v; quiz.t.color = c; $("f-cc").value = c; break; }
    case "coloradd": quiz.t.stage = "part"; quiz.reflect = ""; render(); break;
    case "qnext": {
      const st = quiz.steps[quiz.i]; const t = quiz.t;
      if (st.k === "review") { el.disabled = true; await saveQuiz(); return; }
      if (st.k === "color") {
        if (t.stage === "part") { const p = (t.part || "").trim(); if (!p) { $("qerr").textContent = "Pick a part, or type one."; return; } t.part = p; t.stage = "color"; quiz.reflect = ""; render(); return; }
        if (t.stage === "color") { const c = (t.color || "").trim(); if (!c) { $("qerr").textContent = "Pick a color, or type one."; return; } t.list.push({ part: t.part, color: c }); quiz.reflect = `Got it. ${t.part}: ${c}.`; t.part = ""; t.color = ""; t.stage = "more"; render(); return; }
        const ans = { list: t.list }; quiz.a.color = ans; quiz.reflect = "Got it. " + reflectFor(st, ans); quiz.i++; loadT(); render(); window.scrollTo(0, 0); return;
      }
      const ans = answerFor(st, t); if (typeof ans === "string") { $("qerr").textContent = ans; return; }
      quiz.a[key(st)] = ans; quiz.reflect = st.k === "intro" ? "" : "Got it. " + reflectFor(st, ans); quiz.i++; loadT(); render(); window.scrollTo(0, 0); break;
    }
    case "qskip": {
      const st = quiz.steps[quiz.i]; const t = quiz.t;
      if (st.k === "color") {
        if (t.stage === "color") { t.part = ""; t.color = ""; t.stage = t.list.length ? "more" : "part"; quiz.reflect = "Got it. Color: not decided yet."; render(); return; }
        if (t.list.length) { const ans = { list: t.list }; quiz.a.color = ans; quiz.reflect = "Got it. " + reflectFor(st, ans); quiz.i++; loadT(); render(); window.scrollTo(0, 0); return; }
      }
      quiz.a[key(st)] = { skip: true }; quiz.reflect = "Got it. " + label(st) + ": not decided yet."; quiz.i++; loadT(); render(); window.scrollTo(0, 0); break;
    }
    case "qback": {
      const st = quiz.steps[quiz.i]; const t = quiz.t;
      if (st.k === "color") {
        if (t.stage === "color") { t.stage = "part"; render(); return; }
        if (t.stage === "more") { const l = t.list.pop(); if (l) { t.part = l.part; t.color = l.color; t.stage = "color"; render(); return; } }
        if (t.stage === "part" && t.list.length) { t.stage = "more"; render(); return; }
      }
      if (quiz.i === 0) { const qid = quiz.id; quiz = null; go("monster-" + qid); } else { quiz.i--; quiz.reflect = ""; loadT(); render(); }
      break;
    }
    case "qexit": { const qid = quiz.id; quiz = null; go("monster-" + qid); toast("Stopped. Nothing from this quiz was saved."); break; }
  }
});
addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); });
addEventListener("pagehide", () => { if (pad) saveWip(); });
document.addEventListener("visibilitychange", () => { if (document.hidden && pad) saveWip(); });

/* ---------- updates ---------- */
function updateBanner() {
  const r = route();
  const busy = r.v === "draw" || (r.v === "quiz" && quiz) || (ov && ov.k !== "help");
  $("upd").hidden = !(waiting && !busy);
}
function watchSW(reg) {
  const check = () => { if (reg.waiting && navigator.serviceWorker.controller) { waiting = reg.waiting; updateBanner(); } };
  reg.addEventListener("updatefound", () => { const nw = reg.installing; if (nw) nw.addEventListener("statechange", check); });
  check();
  const ping = () => reg.update().catch(() => {});
  document.addEventListener("visibilitychange", () => { if (!document.hidden) ping(); });
  setInterval(ping, 30 * 60 * 1000);
}
$("upd-btn").addEventListener("click", () => { if (waiting) { updating = true; waiting.postMessage("skipWaiting"); } });
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (updating) location.reload(); });
}

/* ---------- first run ---------- */
async function fetchSeedImage(path) {
  try {
    const r = await fetch(path, { cache: "no-cache" });
    if (!r.ok || !/^image\//.test(r.headers.get("content-type") || "")) return null;
    const blob = await resizeToJpeg(await r.blob());
    const id = path.split("/").pop().replace(/\.[^.]+$/, "");
    await S.putImage(id, blob);
    return id;
  } catch (_) { return null; }
}
async function seedIfNeeded() {
  if (await S.getMeta("seeded")) return;
  const r = await fetch("monsters.json", { cache: "no-cache" });
  if (!r.ok) throw new Error("Could not load monsters.json.");
  const j = await r.json(); const out = [];
  for (const [id, src] of Object.entries(j.monsters)) {
    const m = clone(src); m.id = id; m.drafts = [];
    for (const d of src.drafts || []) {
      const nd = { n: d.n, imgId: null, note: d.note, by: d.by };
      const imgId = d.img ? await fetchSeedImage(d.img) : null;
      if (imgId) nd.imgId = imgId; else if (d.img) nd.seedImg = d.img;
      m.drafts.push(nd);
    }
    out.push(m);
  }
  for (const m of out) await S.putMonster(m);
  await S.setMeta("dataVersion", S.DATA_VERSION);
  await S.setMeta("seeded", true);
}
// Drawings that were not there on first run are picked up when they appear on the site.
async function retrySeedImages() {
  for (const m of await S.allMonsters()) {
    let changed = false;
    for (const d of m.drafts || []) {
      if (!d.imgId && d.seedImg) { const id = await fetchSeedImage(d.seedImg); if (id) { d.imgId = id; delete d.seedImg; changed = true; } }
    }
    if (changed) await S.putMonster(m);
  }
}

async function boot() {
  render();
  try {
    await S.init();
    await seedIfNeeded();
    await retrySeedImages();
    monsters = await S.allMonsters();
    await loadUrls();
    tips = (await S.getMeta("tips")) || {};
    styleBlock = (await S.getMeta("styleBlock")) || STYLE_BLOCK;
    lastBackup = (await S.getMeta("lastBackup")) || null;
    loaded = true;
    S.requestPersist();
  } catch (e) { loadFail = e; }
  render();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").then(watchSW).catch(() => {});
}
boot();
