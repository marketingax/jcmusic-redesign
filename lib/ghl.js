// Shared helpers for GHL API access + admin auth.
// The GHL token lives ONLY in env vars (server-side). Never sent to the browser.
'use strict';
const crypto = require('crypto');

const GHL_BASE = 'https://services.leadconnectorhq.com';

function ghlHeaders(version) {
  return {
    Authorization: `Bearer ${process.env.GHL_PRIVATE_TOKEN || ''}`,
    Version: version || '2021-07-28',
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

async function ghlFetch(path, { method = 'GET', version, body } = {}) {
  const res = await fetch(`${GHL_BASE}${path}`, {
    method,
    headers: ghlHeaders(version),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data };
}

const LOCATION_ID = () => process.env.GHL_LOCATION_ID || '';

// --- Session auth (HMAC-signed cookie, no DB needed) ---
function sessionSecret() {
  return process.env.SESSION_SECRET || 'insecure-dev-secret-change-me';
}

function sign(value) {
  return crypto.createHmac('sha256', sessionSecret()).update(value).digest('hex');
}

function createSession(hours = 12) {
  const exp = String(Date.now() + hours * 3600 * 1000);
  return `${exp}.${sign(exp)}`;
}

function verifySession(token) {
  if (!token || typeof token !== 'string') return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig) return false;
  const expected = sign(exp);
  // constant-time compare
  if (sig.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  return Date.now() <= Number(exp);
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

// Returns true if request is authenticated; otherwise writes 401 and returns false.
function requireAuth(req, res) {
  const cookies = parseCookies(req);
  if (!verifySession(cookies.jc_session)) {
    res.status(401).json({ error: 'unauthorized' });
    return false;
  }
  return true;
}

module.exports = {
  GHL_BASE,
  ghlFetch,
  LOCATION_ID,
  createSession,
  verifySession,
  parseCookies,
  requireAuth,
};
