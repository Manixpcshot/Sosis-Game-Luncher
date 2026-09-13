'use strict';
/**
 * Sosis Launcher — Web Platform server.
 *
 * Serves:
 *  - Landing site + web app pages (public/, SEO-ready)      https://app.sosis-shop.top/
 *  - Accounts / profiles / avatars                           /api/auth/*
 *  - Play-time sync, leaderboard, popular games              /api/sync, /api/leaderboard, /api/games/popular
 *  - Launcher Download Endpoint (manifest + files)           /datasetup, /datasetup/:file
 *  - Update manifest                                         /latest.json
 *  - Secure admin panel API (files, publish, config)         /api/admin/*
 *
 * Admin password defaults to the value of ADMIN_PASSWORD env or "mani2010"
 * on first run; it is stored ONLY as a scrypt hash and can be changed from
 * the admin panel.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');

const dbLib = require('./lib/db');
const auth = require('./lib/auth');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC = path.join(__dirname, 'public');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '8mb' }));

// ---------------------------------------------------------------- helpers
const db = () => dbLib.get();

function cors(req, res, next) {
  res.set('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.set('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.set('Access-Control-Allow-Headers', 'content-type, authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
}
app.use('/api', cors);
app.use('/datasetup', cors);
app.use('/latest.json', cors);

function bearerUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = auth.verifyToken(token);
  if (!payload) return null;
  return db().users.find((u) => u.id === payload.uid) || null;
}

function cookieToken(req) {
  const header = req.headers.cookie || '';
  const m = header.match(/(?:^|;\s*)sosis_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function webUser(req) {
  const payload = auth.verifyToken(cookieToken(req));
  if (!payload) return null;
  return db().users.find((u) => u.id === payload.uid) || null;
}

function adminSession(req) {
  const header = req.headers.cookie || '';
  const m = header.match(/(?:^|;\s*)sosis_admin=([^;]+)/);
  if (!m) return false;
  const payload = auth.verifyToken(decodeURIComponent(m[1]));
  return !!payload && payload.role === 'admin';
}

function ensureAdminPassword() {
  const d = db();
  if (!d.admin) {
    const plain = process.env.ADMIN_PASSWORD || 'mani2010';
    const { salt, hash } = auth.hashPassword(plain);
    d.admin = { salt, passHash: hash, changed: false };
    dbLib.save();
    console.log('[admin] initial admin password set from ADMIN_PASSWORD env (default mani2010). Change it in the panel!');
  }
}

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    email: u.email || null,
    avatar: u.avatar ? '/avatars/' + u.avatar : null,
    totalPlayTime: u.totalPlayTime || 0,
    totalSessions: u.totalSessions || 0,
    launchCount: u.launchCount || 0,
    createdAt: u.createdAt
  };
}

function sha256File(file) {
  const h = crypto.createHash('sha256');
  h.update(fs.readFileSync(file));
  return h.digest('hex');
}

// ---------------------------------------------------------------- static site
app.use(express.static(PUBLIC, { extensions: ['html'] }));

// robots + sitemap for SEO
app.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send('User-agent: *\nAllow: /\nSitemap: https://app.sosis-shop.top/sitemap.xml\n');
});

// ---------------------------------------------------------------- site config
app.get('/api/site/config', (_req, res) => {
  const s = db().site;
  res.json({
    ok: true,
    downloadEnabled: !!s.downloadEnabled,
    latestVersion: s.latestVersion,
    notes: s.notes || '',
    downloadUrl: s.downloadEnabled ? '/datasetup/' + (s.installerFile || 'SosisLauncherSetup.exe') : null
  });
});

// ---------------------------------------------------------------- auth
app.post('/api/auth/register', (req, res) => {
  const { username, email, password } = req.body || {};
  const name = String(username || '').trim();
  if (!/^[A-Za-z0-9_\-آ-ی]{3,24}$/.test(name)) return res.status(400).json({ ok: false, error: 'bad-username' });
  if (String(password || '').length < 6) return res.status(400).json({ ok: false, error: 'weak-password' });
  const d = db();
  if (d.users.some((u) => u.username.toLowerCase() === name.toLowerCase()))
    return res.status(409).json({ ok: false, error: 'username-taken' });
  const { salt, hash } = auth.hashPassword(password);
  const user = {
    id: auth.randomId(),
    username: name,
    email: String(email || '').trim() || null,
    salt,
    passHash: hash,
    avatar: null,
    totalPlayTime: 0,
    totalSessions: 0,
    launchCount: 0,
    createdAt: Date.now()
  };
  d.users.push(user);
  const token = auth.makeToken(user.id);
  d.tokens[token.slice(0, 24)] = { userId: user.id, createdAt: Date.now() };
  dbLib.save();
  res.setHeader('Set-Cookie', `sosis_token=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000`);
  res.json({ ok: true, token, user: publicUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const d = db();
  const user = d.users.find((u) => u.username.toLowerCase() === String(username || '').trim().toLowerCase());
  if (!user || !auth.verifyPassword(password, user.salt, user.passHash))
    return res.status(401).json({ ok: false, error: 'invalid-credentials' });
  const token = auth.makeToken(user.id);
  d.tokens[token.slice(0, 24)] = { userId: user.id, createdAt: Date.now() };
  dbLib.save();
  res.json({ ok: true, token, user: publicUser(user) });
});

app.post('/api/auth/logout', (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : cookieToken(req);
  if (token) {
    delete db().tokens[token.slice(0, 24)];
    dbLib.save();
  }
  res.clearCookie('sosis_token');
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  const user = bearerUser(req) || webUser(req);
  res.json({ ok: !!user, user: publicUser(user) });
});

app.post('/api/auth/avatar', (req, res) => {
  const user = bearerUser(req) || webUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'unauthorized' });
  const dataUrl = String((req.body || {}).dataUrl || '');
  const m = dataUrl.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return res.status(400).json({ ok: false, error: 'bad-image' });
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 2 * 1024 * 1024) return res.status(413).json({ ok: false, error: 'too-large' });
  const name = user.id + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]);
  fs.writeFileSync(path.join(dbLib.AVATARS_DIR(), name), buf);
  user.avatar = name;
  dbLib.save();
  res.json({ ok: true, user: publicUser(user) });
});

// web session cookie helper (site pages)
app.post('/api/auth/weblogin', (req, res) => {
  const { username, password } = req.body || {};
  const d = db();
  const user = d.users.find((u) => u.username.toLowerCase() === String(username || '').trim().toLowerCase());
  if (!user || !auth.verifyPassword(password, user.salt, user.passHash))
    return res.status(401).json({ ok: false, error: 'invalid-credentials' });
  const token = auth.makeToken(user.id);
  res.setHeader('Set-Cookie', `sosis_token=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000`);
  res.json({ ok: true, user: publicUser(user) });
});

// ---------------------------------------------------------------- sync / social
app.post('/api/sync/session', (req, res) => {
  const user = bearerUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'unauthorized' });
  const { gameName, seconds, endedAt } = req.body || {};
  const secs = Math.max(0, Math.min(24 * 3600, Number(seconds) || 0));
  const name = String(gameName || 'Unknown').slice(0, 80);
  user.totalPlayTime = (user.totalPlayTime || 0) + secs;
  user.totalSessions = (user.totalSessions || 0) + 1;
  user.launchCount = (user.launchCount || 0) + 1;
  const d = db();
  const g = (d.games[name] = d.games[name] || { name, launches: 0, playTime: 0, players: {} });
  g.launches += 1;
  g.playTime += secs;
  g.players[user.id] = (g.players[user.id] || 0) + secs;
  d.sessions.push({ userId: user.id, game: name, seconds: secs, endedAt: endedAt || Date.now() });
  if (d.sessions.length > 5000) d.sessions = d.sessions.slice(-5000);
  dbLib.save();
  res.json({ ok: true, user: publicUser(user) });
});

app.get('/api/leaderboard', (_req, res) => {
  const users = db()
    .users.slice()
    .sort((a, b) => (b.totalPlayTime || 0) - (a.totalPlayTime || 0))
    .slice(0, 50)
    .map((u, i) => ({ rank: i + 1, ...publicUser(u) }));
  res.json({ ok: true, users });
});

app.get('/api/games/popular', (_req, res) => {
  const games = Object.values(db().games)
    .map((g) => ({ name: g.name, launches: g.launches, playTime: g.playTime, players: Object.keys(g.players).length }))
    .sort((a, b) => b.launches - a.launches)
    .slice(0, 24);
  res.json({ ok: true, games });
});

app.use('/avatars', express.static(dbLib.AVATARS_DIR()));

// ---------------------------------------------------------------- update + datasetup endpoint
function buildManifest() {
  const s = db().site;
  const file = s.installerFile || 'SosisLauncherSetup.exe';
  const filePath = path.join(dbLib.DOWNLOADS_DIR(), file);
  const entry = {
    name: file,
    url: `https://app.sosis-shop.top/datasetup/${file}`,
    sha256: fs.existsSync(filePath) ? sha256File(filePath) : null,
    size: fs.existsSync(filePath) ? fs.statSync(filePath).size : 0,
    kind: 'installer',
    run: { silent: ['/S'], after: 'launch' }
  };
  return {
    name: 'Sosis Launcher',
    version: s.latestVersion,
    baseUrl: 'https://app.sosis-shop.top/datasetup',
    notes: s.notes || '',
    downloadEnabled: !!s.downloadEnabled,
    releasedAt: s.releasedAt || null,
    files: [entry]
  };
}

app.get('/datasetup', (_req, res) => res.json(buildManifest()));
app.get('/datasetup/:file', (req, res) => {
  if (!db().site.downloadEnabled) return res.status(403).json({ ok: false, error: 'downloads-disabled' });
  const name = path.basename(req.params.file);
  const file = path.join(dbLib.DOWNLOADS_DIR(), name);
  if (!fs.existsSync(file)) return res.status(404).json({ ok: false, error: 'not-found' });
  res.download(file, name);
});

app.get('/latest.json', (_req, res) => {
  const s = db().site;
  const m = buildManifest();
  res.json({
    app: 'Sosis Launcher',
    channel: 'stable',
    version: s.latestVersion,
    download: m.files[0].url,
    sha256: m.files[0].sha256,
    size: m.files[0].size,
    notes: s.notes || '',
    releasedAt: s.releasedAt || null
  });
});

// ---------------------------------------------------------------- admin
app.post('/api/admin/login', (req, res) => {
  ensureAdminPassword();
  const { password } = req.body || {};
  const a = db().admin;
  if (!auth.verifyPassword(password, a.salt, a.passHash))
    return res.status(401).json({ ok: false, error: 'invalid-password' });
  const token = auth.makeRoleToken('admin');
  res.setHeader('Set-Cookie', `sosis_admin=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Strict; Max-Age=43200`);
  res.json({ ok: true });
});

app.get('/api/admin/state', (req, res) => {
  if (!adminSession(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });
  const s = db().site;
  const files = fs
    .readdirSync(dbLib.DOWNLOADS_DIR())
    .map((name) => {
      const st = fs.statSync(path.join(dbLib.DOWNLOADS_DIR(), name));
      return { name, size: st.size, mtime: st.mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
  res.json({
    ok: true,
    site: s,
    files,
    users: db().users.map((u) => publicUser(u)),
    stats: {
      users: db().users.length,
      sessions: db().sessions.length,
      games: Object.keys(db().games).length
    }
  });
});

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dbLib.DOWNLOADS_DIR()),
    filename: (_req, file, cb) => cb(null, path.basename(file.originalname).replace(/[^\w.\-]/g, '_'))
  }),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }
});

app.post('/api/admin/files/upload', (req, res) => {
  if (!adminSession(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ ok: false, error: err.message });
    if (!req.file) return res.status(400).json({ ok: false, error: 'no-file' });
    res.json({ ok: true, name: req.file.filename, size: req.file.size });
  });
});

app.delete('/api/admin/files/:name', (req, res) => {
  if (!adminSession(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });
  const name = path.basename(req.params.name);
  const file = path.join(dbLib.DOWNLOADS_DIR(), name);
  if (name === db().site.installerFile) return res.status(409).json({ ok: false, error: 'in-use' });
  if (fs.existsSync(file)) fs.unlinkSync(file);
  dbLib.save();
  res.json({ ok: true });
});

app.post('/api/admin/publish', (req, res) => {
  if (!adminSession(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });
  const { version, file, notes } = req.body || {};
  if (!/^\d+\.\d+\.\d+$/.test(String(version || ''))) return res.status(400).json({ ok: false, error: 'bad-version' });
  const name = path.basename(String(file || ''));
  if (!fs.existsSync(path.join(dbLib.DOWNLOADS_DIR(), name))) return res.status(404).json({ ok: false, error: 'file-missing' });
  const s = db().site;
  s.latestVersion = String(version);
  s.installerFile = name;
  s.notes = String(notes || '');
  s.releasedAt = new Date().toISOString();
  s.downloadEnabled = true;
  dbLib.save();
  res.json({ ok: true, site: s });
});

app.post('/api/admin/config', (req, res) => {
  if (!adminSession(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });
  const s = db().site;
  if ('downloadEnabled' in (req.body || {})) s.downloadEnabled = !!req.body.downloadEnabled;
  if ('notes' in (req.body || {})) s.notes = String(req.body.notes);
  dbLib.save();
  res.json({ ok: true, site: s });
});

app.post('/api/admin/password', (req, res) => {
  if (!adminSession(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });
  const { current, next } = req.body || {};
  const a = db().admin;
  if (!auth.verifyPassword(current, a.salt, a.passHash)) return res.status(401).json({ ok: false, error: 'invalid-password' });
  if (String(next || '').length < 8) return res.status(400).json({ ok: false, error: 'weak-password' });
  const { salt, hash } = auth.hashPassword(next);
  db().admin = { salt, passHash: hash, changed: true };
  dbLib.save();
  res.json({ ok: true });
});

app.post('/api/admin/logout', (_req, res) => {
  res.clearCookie('sosis_admin');
  res.json({ ok: true });
});

// ---------------------------------------------------------------- boot
ensureAdminPassword();
app.listen(PORT, HOST, () => {
  console.log(`Sosis Web Platform listening on http://${HOST}:${PORT}`);
  console.log('  site:      /');
  console.log('  admin:     /admin.html');
  console.log('  endpoint:  /datasetup');
  console.log('  update:    /latest.json');
});
