'use strict';
const { requireAuth, ghlFetch, createPortalSession } = require('../../lib/ghl');

// Admin-only: mint a portal session for a chosen contact so admin/Jerry can
// SEE EXACTLY WHAT THAT CLIENT SEES when they log in. Sets:
//   jc_portal        — short-lived (2h) portal session for that contactId
//   jc_portal_admin  — non-HttpOnly flag so the portal UI shows an
//                      "Impersonating" banner. The flag is cosmetic; the real
//                      auth check is the signed jc_portal cookie.
module.exports = async (req, res) => {
  if (!requireAuth(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};
  const contactId = String(body.contactId || '').trim();
  if (!contactId) return res.status(400).json({ error: 'contactId required' });

  // Sanity check: confirm the contact exists in this location before issuing a session.
  const r = await ghlFetch(`/contacts/${contactId}`);
  if (!r.ok) return res.status(r.status).json({ error: 'contact not found' });
  const c = (r.data && r.data.contact) || {};

  const hours = 2;
  const session = createPortalSession(contactId, hours / 24);
  res.setHeader('Set-Cookie', [
    `jc_portal=${session}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${hours * 3600}`,
    `jc_portal_admin=1; Secure; SameSite=Lax; Path=/; Max-Age=${hours * 3600}`,
  ]);

  return res.status(200).json({
    ok: true,
    url: '/portal/',
    contact: {
      id: c.id || contactId,
      name: c.contactName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email || 'Client',
      email: c.email || '',
    },
  });
};
