// Where saves and settings live. In the desktop app they are files in the app's data folder, written
// atomically (temp file, then rename) with rolling backups. In a plain browser they fall back to localStorage.
const T = typeof window !== 'undefined' ? window.__TAURI__ : null;
export const isDesktop = !!(T && T.fs && T.path);
const safe = s => String(s || 'main').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24) || 'main';
const BACKUPS = 3, BACKUP_EVERY_MS = 10 * 60 * 1000;
let dirP = null;
async function dir() {
  if (!dirP) dirP = (async () => { const base = await T.path.appDataDir(); const d = await T.path.join(base, 'saves'); try { await T.fs.mkdir(d, { recursive: true }); } catch { /* exists */ } return { base, d }; })();
  return dirP;
}

const ls = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } } };

export const storage = {
  isDesktop,
  async where() { if (!isDesktop) return 'browser storage'; return (await dir()).d; },

  async read(slot) {
    slot = safe(slot);
    if (!isDesktop) return ls.get('catyard:' + slot);
    const { d } = await dir(), p = await T.path.join(d, slot + '.json');
    if (!(await T.fs.exists(p))) return null;
    return T.fs.readTextFile(p);
  },

  // atomic write, rolling backups. returns true on success
  async write(slot, text, { backup = true } = {}) {
    slot = safe(slot);
    if (!isDesktop) return ls.set('catyard:' + slot, text);
    const { d } = await dir(), p = await T.path.join(d, slot + '.json'), tmp = await T.path.join(d, slot + '.tmp');
    await T.fs.writeTextFile(tmp, text);
    if (backup && (await T.fs.exists(p))) {
      const stampP = await T.path.join(d, slot + '.bak.stamp'); let last = 0;
      try { if (await T.fs.exists(stampP)) last = +(await T.fs.readTextFile(stampP)) || 0; } catch { /* ignore */ }
      if (Date.now() - last > BACKUP_EVERY_MS) {
        for (let i = BACKUPS; i >= 2; i--) { const a = await T.path.join(d, `${slot}.bak${i - 1}.json`), b = await T.path.join(d, `${slot}.bak${i}.json`); if (await T.fs.exists(a)) await T.fs.copyFile(a, b); }
        await T.fs.copyFile(p, await T.path.join(d, `${slot}.bak1.json`)); await T.fs.writeTextFile(stampP, String(Date.now()));
      }
    }
    await T.fs.rename(tmp, p);
    return true;
  },

  // the newest backup that parses, used if the main save is unreadable
  async readBackup(slot) {
    slot = safe(slot); if (!isDesktop) return null;
    const { d } = await dir();
    for (let i = 1; i <= BACKUPS; i++) { const p = await T.path.join(d, `${slot}.bak${i}.json`); try { if (await T.fs.exists(p)) return await T.fs.readTextFile(p); } catch { /* next */ } }
    return null;
  },

  async list() {
    if (!isDesktop) { const out = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('catyard:')) out.push(k.slice(8)); } } catch { /* ignore */ } return out.sort(); }
    const { d } = await dir(); const ents = await T.fs.readDir(d);
    return ents.map(e => e.name).filter(n => /^[a-z0-9_-]+\.json$/.test(n) && !/\.bak\d\.json$/.test(n)).map(n => n.replace(/\.json$/, '')).sort();
  },

  async readSettings() {
    try {
      if (!isDesktop) return JSON.parse(ls.get('catyard:settings') || 'null');
      const { base } = await dir(), p = await T.path.join(base, 'settings.json');
      return (await T.fs.exists(p)) ? JSON.parse(await T.fs.readTextFile(p)) : null;
    } catch { return null; }
  },
  async writeSettings(obj) {
    const text = JSON.stringify(obj);
    if (!isDesktop) return ls.set('catyard:settings', text);
    const { base } = await dir(), p = await T.path.join(base, 'settings.json'), tmp = await T.path.join(base, 'settings.tmp');
    await T.fs.writeTextFile(tmp, text); await T.fs.rename(tmp, p); return true;
  },

  // the exported story: a text file in the app's exports folder (desktop) or a download (browser). returns where it went
  async writeExport(name, text) {
    name = String(name).replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80) || 'cat-yard.txt';
    if (!isDesktop) {
      const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' })), a = document.createElement('a');
      a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); return 'your downloads (' + name + ')';
    }
    const { base } = await dir(), d = await T.path.join(base, 'exports'); try { await T.fs.mkdir(d, { recursive: true }); } catch { /* exists */ }
    const p = await T.path.join(d, name); await T.fs.writeTextFile(p, text); return p;
  },

  // network: the desktop app goes through the Rust-side HTTP plugin so there are no browser CORS limits
  http: (url, opt) => (T && T.http && T.http.fetch ? T.http.fetch(url, opt) : fetch(url, opt)),
};
