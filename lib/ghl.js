// Shared helpers for GHL API access + admin auth.
// The GHL token lives ONLY in env vars (server-side). Never sent to the browser.
'use strict';
const crypto = require('crypto');

const GHL_BASE = 'https://services.leadconnectorhq.com';

// Per-endpoint API versions. GHL pins each surface to its own dated version.
const GHL_VERSIONS = {
  contacts:      '2021-07-28',
  conversations: '2021-07-28',
  invoices:      '2023-02-21',
  payments:      '2023-02-21',
  objects:       '2023-02-21',
  associations:  '2023-02-21',
  calendars:     '2021-04-15',
};

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

// --- Client portal auth (per-contact, magic-link based) ---
function b64url(s) {
  return Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64url(s) {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
}
function signCtx(ctx, value) {
  return crypto.createHmac('sha256', sessionSecret()).update(`${ctx}:${value}`).digest('hex');
}
function safeEq(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// Short-lived token emailed to the client.
function createMagicToken(contactId, minutes = 20) {
  const exp = String(Date.now() + minutes * 60000);
  const payload = `${contactId}.${exp}`;
  return b64url(`${payload}.${signCtx('magic', payload)}`);
}
function verifyMagicToken(token) {
  try {
    const [contactId, exp, sig] = unb64url(String(token)).split('.');
    if (!contactId || !exp || !sig) return null;
    if (!safeEq(sig, signCtx('magic', `${contactId}.${exp}`))) return null;
    if (Date.now() > Number(exp)) return null;
    return contactId;
  } catch {
    return null;
  }
}

// Longer-lived portal session cookie.
function createPortalSession(contactId, days = 14) {
  const exp = String(Date.now() + days * 86400000);
  const payload = `${contactId}.${exp}`;
  return `${payload}.${signCtx('portal', payload)}`;
}
function verifyPortalSession(token) {
  if (!token || typeof token !== 'string') return null;
  const [contactId, exp, sig] = token.split('.');
  if (!contactId || !exp || !sig) return null;
  if (!safeEq(sig, signCtx('portal', `${contactId}.${exp}`))) return null;
  if (Date.now() > Number(exp)) return null;
  return contactId;
}

// Returns the authenticated contactId, or null after writing a 401.
function requirePortal(req, res) {
  const cookies = parseCookies(req);
  const contactId = verifyPortalSession(cookies.jc_portal);
  if (!contactId) {
    res.status(401).json({ error: 'unauthorized' });
    return null;
  }
  return contactId;
}

module.exports = {
  GHL_BASE,
  GHL_VERSIONS,
  ghlFetch,
  LOCATION_ID,
  createSession,
  verifySession,
  parseCookies,
  requireAuth,
  createMagicToken,
  verifyMagicToken,
  createPortalSession,
  verifyPortalSession,
  requirePortal,
};
