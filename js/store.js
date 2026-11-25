// All storage lives here. IndexedDB: monsters, images (blobs), meta.
// To move storage to a server later, replace the functions in this file and keep the same names.

export const DATA_VERSION = 1;
const DB_NAME = "monster-lab";
const DB_VERSION = 1;
let db = null;

const p = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const done = t => new Promise((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error("aborted")); });

function open() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains("monsters")) d.createObjectStore("monsters", { keyPath: "id" });
      if (!d.objectStoreNames.contains("images")) d.createObjectStore("images", { keyPath: "id" });
      if (!d.objectStoreNames.contains("meta")) d.createObjectStore("meta");
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error("blocked"));
  });
}

// Data migrations. MIGRATIONS[n] upgrades monsters from data version n to n+1.
// Add one here whenever the shape of a monster changes, and raise DATA_VERSION.
const MIGRATIONS = {
  // 1: monsters => monsters.map(m => ({ ...m, newField: "" })),
};
export function migrate(monsters, from) {
  let v = from || 1;
  while (v < DATA_VERSION) {
    const fn = MIGRATIONS[v];
    if (fn) monsters = fn(monsters);
    v++;
  }
  return monsters;
}

export async function init() {
  db = await open();
  const v = await getMeta("dataVersion");
  if (v != null && v < DATA_VERSION) {
    const list = migrate(await allMonsters(), v);
    for (const m of list) await putMonster(m);
    await setMeta("dataVersion", DATA_VERSION);
  }
}

export async function requestPersist() {
  try {
    if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist();
  } catch (_) {}
  return false;
}
export async function storageInfo() {
  const out = { persisted: false, usage: null, quota: null };
  try {
    if (navigator.storage && navigator.storage.persisted) out.persisted = await navigator.storage.persisted();
    if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); out.usage = e.usage; out.quota = e.quota; }
  } catch (_) {}
  return out;
}

export const getMeta = async k => p(db.transaction("meta").objectStore("meta").get(k));
export async function setMeta(k, v) { const t = db.transaction("meta", "readwrite"); t.objectStore("meta").put(v, k); return done(t); }
export async function delMeta(k) { const t = db.transaction("meta", "readwrite"); t.objectStore("meta").delete(k); return done(t); }

export const allMonsters = async () => p(db.transaction("monsters").objectStore("monsters").getAll());
export async function putMonster(m) { const t = db.transaction("monsters", "readwrite"); t.objectStore("monsters").put(m); return done(t); }

export async function putImage(id, blob) { const t = db.transaction("images", "readwrite"); t.objectStore("images").put({ id, blob }); return done(t); }
export async function getImage(id) { const r = await p(db.transaction("images").objectStore("images").get(id)); return r ? r.blob : null; }
export const allImages = async () => p(db.transaction("images").objectStore("images").getAll());

// Backup support
export async function exportAll() {
  const monsters = await allMonsters();
  const images = await allImages();
  const meta = {};
  for (const k of ["styleBlock", "tips"]) { const v = await getMeta(k); if (v != null) meta[k] = v; }
  return { monsters, images, meta };
}

// Replaces everything. Used by Restore.
export async function replaceAll({ monsters, images, meta }) {
  const t = db.transaction(["monsters", "images", "meta"], "readwrite");
  const ms = t.objectStore("monsters"), is = t.objectStore("images"), me = t.objectStore("meta");
  ms.clear(); is.clear();
  // Drop unsaved drawings too
  me.openKeyCursor().onsuccess = e => {
    const c = e.target.result;
    if (c) { if (String(c.key).startsWith("wip:")) me.delete(c.key); c.continue(); }
  };
  for (const m of monsters) ms.put(m);
  for (const i of images) is.put({ id: i.id, blob: i.blob });
  for (const k of ["styleBlock", "tips"]) { if (meta && meta[k] != null) me.put(meta[k], k); else me.delete(k); }
  me.put(DATA_VERSION, "dataVersion");
  me.put(true, "seeded");
  return done(t);
}
