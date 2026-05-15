'use strict';
const { requirePortal, ghlFetch, LOCATION_ID } = require('../../lib/ghl');

// Emails the student the official GHL invoice (which carries the real payment link).
module.exports = async (req, res) => {
  const contactId = requirePortal(req, res);
  if (!contactId) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const invoiceId = String((body || {}).invoiceId || '');
  if (!invoiceId) return res.status(400).json({ error: 'invoiceId required' });

  const loc = LOCATION_ID();

  // Verify the invoice belongs to THIS contact before doing anything.
  const inv = await ghlFetch(`/invoices/${invoiceId}?altId=${loc}&altType=location`);
  if (!inv.ok) return res.status(inv.status).json(inv.data);
  if (inv.data.contactDetails && inv.data.contactDetails.id !== contactId) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const send = await ghlFetch(`/invoices/${invoiceId}/send`, {
    method: 'POST',
    body: { altId: loc, altType: 'location', action: 'email', liveMode: true },
  });
  if (!send.ok) return res.status(send.status).json(send.data);
  return res.status(200).json({ ok: true, message: 'Invoice with payment link emailed to you.' });
};
