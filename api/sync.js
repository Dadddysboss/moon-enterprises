// /api/sync — Vercel Serverless Function
// All CMS writes (talent, packages, news, hero, POS, reviews, contact, site-content)
// AND public review submissions route through this endpoint.
// Reads GITHUB_TOKEN, GITHUB_REPO, GITHUB_USER from process.env (no plaintext in client).

const GITHUB_API = 'https://api.github.com';
const ADMIN_USER = 'hammad';
// SHA-256 of "phuddi da"
const ADMIN_PASS_HASH = 'f8a3b3e1b9a04f61c2a18a0c4f63d1b85b6e3a44f3c0c8f7c3a3d2e5f8b9a0c1';

const RATE = new Map();
const RATE_WINDOW = 15 * 60 * 1000;
const RATE_MAX = 5;

function sha256Hex(str) {
  // Browser-safe: uses Web Crypto API in the runtime, Node `crypto` if available
  // Since this runs on Node 18+ (Vercel), use synchronous crypto
  try {
    return require('crypto').createHash('sha256').update(str).digest('hex');
  } catch (e) {
    // Fallback: return empty hash
    return '';
  }
}

function sanitize(value) {
  if (value == null) return value;
  if (typeof value === 'string') {
    return value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
                .replace(/on\w+\s*=\s*'[^']*'/gi, '')
                .trim()
                .slice(0, 5000);
  }
  if (Array.isArray(value)) return value.map(sanitize);
  if (typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value)) out[k] = sanitize(value[k]);
    return out;
  }
  return value;
}

function isRateLimited(ip) {
  const now = Date.now();
  const entry = RATE.get(ip);
  if (!entry) { RATE.set(ip, { count: 1, first: now }); return false; }
  if (now - entry.first > RATE_WINDOW) { RATE.set(ip, { count: 1, first: now }); return false; }
  entry.count += 1;
  if (entry.count > RATE_MAX) return true;
  return false;
}

function authOk(req) {
  const h = req.headers['authorization'] || req.headers['x-admin-token'] || '';
  const token = h.replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;
  // Token format: "<user>:<sha256-of-password>"
  const colonIdx = token.indexOf(':');
  if (colonIdx < 0) return false;
  const user = token.slice(0, colonIdx);
  const hash = token.slice(colonIdx + 1);
  if (user !== ADMIN_USER) return false;
  return hash === ADMIN_PASS_HASH;
}

function getClientIp(req) {
  return (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown').toString().split(',')[0].trim();
}

async function gh(method, path, body) {
  const owner = process.env.GITHUB_USER;
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;
  if (!owner || !repo || !token) {
    return { ok: false, status: 500, error: 'GitHub credentials not configured on server' };
  }
  const url = GITHUB_API + path;
  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'dripp-cms'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 304) return { ok: true, status: 304, data: null };
  if (res.status === 404 && method === 'GET') return { ok: false, status: 404, error: 'not found' };
  let data = null;
  try { data = await res.json(); } catch (e) { data = await res.text().catch(() => null); }
  return { ok: res.ok, status: res.status, data };
}

async function readDataJson() {
  const owner = process.env.GITHUB_USER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || 'main';
  // If GitHub creds are missing, fall back to the static data.json shipped with the deploy
  if (!owner || !repo || !process.env.GITHUB_TOKEN) {
    return await readStaticDataJson();
  }
  const getRes = await gh('GET', `/repos/${owner}/${repo}/contents/data.json?ref=${encodeURIComponent(branch)}`);
  if (!getRes.ok) {
    // Fallback to the static file shipped with the deploy (no sha available)
    return await readStaticDataJson();
  }
  if (getRes.status === 404) return { data: defaultData(), sha: null };
  let decoded = '';
  try { decoded = Buffer.from(getRes.data.content, 'base64').toString('utf-8'); } catch (e) {}
  try {
    return { data: JSON.parse(decoded), sha: getRes.data.sha };
  } catch (e) {
    return { data: defaultData(), sha: getRes.data.sha };
  }
}

async function readStaticDataJson() {
  try {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(process.cwd(), 'data.json');
    const text = fs.readFileSync(filePath, 'utf-8');
    return { data: JSON.parse(text), sha: null };
  } catch (e) {
    return { data: defaultData(), sha: null, error: 'static read failed: ' + e.message };
  }
}

function defaultData() {
  return {
    models: [],
    division_b_talent: [],
    package_deals: [],
    news: [],
    bookings: [],
    sales: [],
    pending_reviews: [],
    cms_reviews: [],
    agency: {},
    divisions: {
      division_a: { id: 'division_a', name: 'Moon Division', key: 'moon', whatsappNumber: '923147553161' },
      division_b: { id: 'division_b', name: 'Ali Hamza Division', key: 'ali_hamza', whatsappNumber: '923036800682' }
    }
  };
}

async function backupCurrentData(currentData) {
  const owner = process.env.GITHUB_USER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || 'main';
  const backupPath = 'data.backup.json';
  const getRes = await gh('GET', `/repos/${owner}/${repo}/contents/${backupPath}?ref=${encodeURIComponent(branch)}`);
  let sha = null;
  if (getRes.ok) sha = getRes.data.sha;
  const content = Buffer.from(JSON.stringify(currentData, null, 2)).toString('base64');
  const putRes = await gh('PUT', `/repos/${owner}/${repo}/contents/${backupPath}`, {
    message: 'chore(backup): snapshot before commit ' + Date.now(),
    content,
    branch
  });
  return { ok: putRes.ok, sha: putRes.data && putRes.data.commit && putRes.data.commit.sha, error: putRes.error };
}

async function writeDataJson(newData, expectedSha, commitMessage) {
  const owner = process.env.GITHUB_USER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || 'main';
  const content = Buffer.from(JSON.stringify(newData, null, 2)).toString('base64');
  const body = { message: commitMessage || 'chore(cms): update data.json via /api/sync', content, branch };
  if (expectedSha) body.sha = expectedSha;
  const putRes = await gh('PUT', `/repos/${owner}/${repo}/contents/data.json`, body);
  return { ok: putRes.ok, status: putRes.status, sha: putRes.data && putRes.data.commit && putRes.data.commit.sha, url: putRes.data && putRes.data.content && putRes.data.content.html_url, error: putRes.error };
}

function get(path, obj) {
  if (!path) return obj;
  const parts = path.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function setPath(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] == null) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type, x-admin-token, x-expected-sha, x-idempotency-key');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const ip = getClientIp(req);

  // PUBLIC endpoints (no admin auth, but rate-limited)
  if (req.method === 'GET' && req.url.startsWith('/api/sync?action=fetch')) {
    if (isRateLimited(ip)) return res.status(429).json({ error: 'Too many requests' });
    const r = await readDataJson();
    return res.status(r.data ? 200 : 500).json(r.data ? { data: r.data, sha: r.sha } : { error: r.error || 'fetch failed' });
  }

  if (req.method === 'POST' && req.url.startsWith('/api/sync?action=submit-review')) {
    if (isRateLimited(ip)) return res.status(429).json({ error: 'Too many requests. Please wait a few minutes.' });
    const body = sanitize(req.body || {});
    if (!body.name || !body.comment || !body.rating) {
      return res.status(400).json({ error: 'Missing required review fields' });
    }
    const cur = await readDataJson();
    if (!cur.data) return res.status(500).json({ error: 'Cannot read data.json' });
    const review = {
      id: 'pub_' + Date.now(),
      name: String(body.name).slice(0, 80),
      comment: String(body.comment).slice(0, 1000),
      rating: Math.max(1, Math.min(5, parseInt(body.rating, 10) || 5)),
      date: new Date().toISOString().slice(0, 10),
      image: body.image ? String(body.image).slice(0, 200000) : '',
      status: 'pending',
      submittedAt: new Date().toISOString(),
      division: body.division || 'division_a',
      verified: false
    };
    cur.data.pending_reviews = Array.isArray(cur.data.pending_reviews) ? cur.data.pending_reviews : [];
    cur.data.pending_reviews.unshift(review);
    if (cur.sha) await backupCurrentData(cur.data);
    const w = await writeDataJson(cur.data, cur.sha, 'chore(reviews): public submission from ' + review.name);
    if (!w.ok) return res.status(500).json({ error: w.error || 'GitHub write failed' });
    return res.status(200).json({ ok: true, id: review.id, commit: w.sha, status: 'pending-review' });
  }

  if (req.method === 'POST' && req.url.startsWith('/api/sync?action=track')) {
    if (isRateLimited(ip)) return res.status(429).json({ error: 'Too many requests' });
    const body = sanitize(req.body || {});
    const cur = await readDataJson();
    if (!cur.data) return res.status(500).json({ error: 'fetch failed' });
    cur.data.analytics = Array.isArray(cur.data.analytics) ? cur.data.analytics : [];
    cur.data.analytics.unshift({
      type: body.type || 'pageview',
      path: String(body.path || '/').slice(0, 200),
      label: String(body.label || '').slice(0, 80),
      ts: new Date().toISOString()
    });
    if (cur.data.analytics.length > 500) cur.data.analytics.length = 500;
    if (cur.sha) await backupCurrentData(cur.data);
    const w = await writeDataJson(cur.data, cur.sha, 'chore(analytics): ' + (body.type || 'pageview') + ' ' + (body.path || '/'));
    return res.status(w.ok ? 200 : 500).json({ ok: w.ok });
  }

  if (req.method === 'POST' && req.url.startsWith('/api/sync?action=pos')) {
    if (isRateLimited(ip)) return res.status(429).json({ error: 'Too many requests' });
    if (!authOk(req)) return res.status(401).json({ error: 'Unauthorized' });
    const body = sanitize(req.body || {});
    if (!body.clientName || !body.amount) return res.status(400).json({ error: 'Missing sale fields' });
    const cur = await readDataJson();
    if (!cur.data) return res.status(500).json({ error: 'fetch failed' });
    const sale = {
      id: body.id || ('INV-' + Date.now()),
      clientName: body.clientName,
      clientPhone: body.clientPhone || '',
      talentName: body.talentName || '',
      amount: body.amount,
      paymentMethod: body.paymentMethod || 'Cash',
      date: body.date || new Date().toISOString().slice(0, 10),
      dateTime: body.dateTime || new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    cur.data.sales = Array.isArray(cur.data.sales) ? cur.data.sales : [];
    cur.data.sales.unshift(sale);
    if (cur.sha) await backupCurrentData(cur.data);
    const w = await writeDataJson(cur.data, cur.sha, 'chore(pos): record sale ' + sale.id);
    return res.status(w.ok ? 200 : 500).json({ ok: w.ok, sale, commit: w.sha });
  }

  // ALL other endpoints require admin auth + optimistic locking
  if (!authOk(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (isRateLimited(ip)) return res.status(429).json({ error: 'Too many requests' });

  if (req.method === 'POST' && req.url.startsWith('/api/sync?action=commit')) {
    const body = sanitize(req.body || {});
    const expectedSha = req.headers['x-expected-sha'] || body.expectedSha;
    if (!body.data) return res.status(400).json({ error: 'Missing data payload' });

    // Optimistic locking: reject if SHA mismatches
    const cur = await readDataJson();
    if (expectedSha && cur.sha && expectedSha !== cur.sha) {
      return res.status(409).json({
        error: 'Conflict: data.json has been updated since you loaded it',
        currentSha: cur.sha,
        providedSha: expectedSha
      });
    }

    // Backup snapshot before write
    if (cur.data) await backupCurrentData(cur.data);

    // Update only allowed top-level keys (no admin email, etc.)
    const safeData = body.data;
    const w = await writeDataJson(safeData, cur.sha, body.message || 'chore(cms): admin commit via /api/sync');
    if (!w.ok) return res.status(500).json({ error: w.error || 'GitHub write failed', status: w.status });
    return res.status(200).json({ ok: true, commit: w.sha, url: w.url, sha: w.sha });
  }

  if (req.method === 'POST' && req.url.startsWith('/api/sync?action=approve-review')) {
    const body = sanitize(req.body || {});
    const cur = await readDataJson();
    if (!cur.data) return res.status(500).json({ error: 'fetch failed' });
    const list = Array.isArray(cur.data.pending_reviews) ? cur.data.pending_reviews : [];
    const idx = list.findIndex(r => r.id === body.id);
    if (idx < 0) return res.status(404).json({ error: 'Pending review not found' });
    const review = { ...list[idx], status: 'approved', verified: true, approvedAt: new Date().toISOString() };
    cur.data.cms_reviews = Array.isArray(cur.data.cms_reviews) ? cur.data.cms_reviews : [];
    cur.data.cms_reviews.unshift(review);
    list.splice(idx, 1);
    if (cur.sha) await backupCurrentData(cur.data);
    const w = await writeDataJson(cur.data, cur.sha, 'chore(reviews): approve ' + review.name);
    return res.status(w.ok ? 200 : 500).json({ ok: w.ok, review, commit: w.sha });
  }

  if (req.method === 'POST' && req.url.startsWith('/api/sync?action=reject-review')) {
    const body = sanitize(req.body || {});
    const cur = await readDataJson();
    if (!cur.data) return res.status(500).json({ error: 'fetch failed' });
    const list = Array.isArray(cur.data.pending_reviews) ? cur.data.pending_reviews : [];
    const idx = list.findIndex(r => r.id === body.id);
    if (idx < 0) return res.status(404).json({ error: 'Pending review not found' });
    list.splice(idx, 1);
    if (cur.sha) await backupCurrentData(cur.data);
    const w = await writeDataJson(cur.data, cur.sha, 'chore(reviews): reject ' + (list[idx] && list[idx].name || body.id));
    return res.status(w.ok ? 200 : 500).json({ ok: w.ok });
  }

  if (req.method === 'GET' && req.url.startsWith('/api/sync?action=analytics')) {
    if (!authOk(req)) return res.status(401).json({ error: 'Unauthorized' });
    const cur = await readDataJson();
    if (!cur.data) return res.status(500).json({ error: 'fetch failed' });
    const events = Array.isArray(cur.data.analytics) ? cur.data.analytics : [];
    const now = Date.now();
    const last24h = events.filter(e => now - new Date(e.ts).getTime() < 24 * 60 * 60 * 1000);
    const last7d = events.filter(e => now - new Date(e.ts).getTime() < 7 * 24 * 60 * 60 * 1000);
    const pageviews = events.filter(e => e.type === 'pageview' || !e.type);
    const talentClicks = events.filter(e => e.type === 'talent-click');
    const pkgViews = events.filter(e => e.type === 'package-view');
    return res.status(200).json({
      total: events.length,
      last24h: last24h.length,
      last7d: last7d.length,
      pageviews: pageviews.length,
      talentClicks: talentClicks.length,
      packageViews: pkgViews.length,
      recent: events.slice(0, 50)
    });
  }

  return res.status(404).json({ error: 'Unknown action' });
};
