'use strict';
const { requireAuth, ghlFetch, LOCATION_ID, GHL_VERSIONS } = require('../../lib/ghl');

// Two-step manual payment recording. Each call:
//   1. Creates an Invoice in GHL with the parent's chosen name (e.g. "Jesiah
//      White 1 Month") so the Overdue tracker (which infers coverage from the
//      invoice NAME) picks it up correctly.
//   2. Records the manual payment against that invoice so GHL's Payments tab,
//      our admin Payments tab, and the contact's portal all show it.
//
// Payment method maps to GHL's `mode`. Zelle / Venmo / etc don't have their
// own mode — they go in as `other` with the friendly name in `notes`, which
// is exactly how Jerry already does it manually in the GHL UI.
const METHOD_MAP = {
  cash:   { mode: 'cash',   label: 'Cash' },
  check:  { mode: 'cheque', label: 'Check' },
  cheque: { mode: 'cheque', label: 'Check' },
  zelle:  { mode: 'other',  label: 'Zelle' },
  venmo:  { mode: 'other',  label: 'Venmo' },
  cashapp:{ mode: 'other',  label: 'CashApp' },
  card:   { mode: 'card',   label: 'Card (manual)' },
  other:  { mode: 'other',  label: 'Other' },
};

module.exports = async (req, res) => {
  if (!requireAuth(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const contactId = String(body.contactId || '').trim();
  const name = String(body.name || '').trim();
  const amount = Number(body.amount);
  const methodKey = String(body.method || 'zelle').toLowerCase();
  const userNotes = String(body.notes || '').trim();
  const paidAtRaw = body.paidAt ? new Date(body.paidAt) : new Date();

  if (!contactId) return res.status(400).json({ error: 'contactId required' });
  if (!name)      return res.status(400).json({ error: 'invoice name required (e.g. "Jesiah White 1 Month")' });
  if (!(amount > 0)) return res.status(400).json({ error: 'amount must be > 0' });

  const method = METHOD_MAP[methodKey] || METHOD_MAP.other;
  const loc = LOCATION_ID();
  const ymd = (d) => d.toISOString().slice(0, 10);

  // 1) Fetch the contact so we can populate contactDetails on the invoice.
  const cRes = await ghlFetch(`/contacts/${contactId}`, { version: GHL_VERSIONS.contacts });
  if (!cRes.ok) return res.status(cRes.status).json({ error: 'contact not found', detail: cRes.data });
  const c = cRes.data.contact || {};

  // 2) Create the invoice.
  // GHL requires both `businessDetails` and `items` (NOT `invoiceItems`) on create.
  const issueDate = ymd(paidAtRaw);
  const invoicePayload = {
    altId: loc,
    altType: 'location',
    name,
    title: 'INVOICE',
    currency: 'USD',
    liveMode: true,
    issueDate,
    dueDate: issueDate,
    businessDetails: {
      name: 'JC Music Enterprise',
      address: {
        addressLine1: '141 Homecrest Avenue',
        city: 'Ewing',
        state: 'NJ',
        countryCode: 'US',
        postalCode: '08638',
      },
    },
    contactDetails: {
      id: c.id || contactId,
      name: c.contactName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email || 'Client',
      email: c.email || '',
      phoneNo: c.phone || '',
      address: c.address1 ? {
        addressLine1: c.address1 || '',
        city: c.city || '',
        state: c.state || '',
        postalCode: c.postalCode || '',
        countryCode: c.country || 'US',
      } : undefined,
    },
    items: [{
      name,
      description: userNotes || '',
      currency: 'USD',
      amount,
      qty: 1,
    }],
    discount: { value: 0, type: 'percentage' },
    termsNotes: '',
  };

  const invRes = await ghlFetch('/invoices/', {
    method: 'POST',
    version: GHL_VERSIONS.invoices,
    body: invoicePayload,
  });
  if (!invRes.ok) {
    return res.status(invRes.status).json({ error: 'invoice create failed', detail: invRes.data });
  }
  const invoiceId = (invRes.data && (invRes.data._id || invRes.data.id)) || '';
  if (!invoiceId) {
    return res.status(500).json({ error: 'invoice created but no id returned', detail: invRes.data });
  }

  // 3) Record the manual payment.
  const noteParts = [method.label];
  if (userNotes) noteParts.push(userNotes);
  const paymentPayload = {
    altId: loc,
    altType: 'location',
    mode: method.mode,
    amount,
    notes: noteParts.join(' — '),
    meta: { source: 'admin-manual-entry', recordedAt: paidAtRaw.toISOString() },
  };

  const payRes = await ghlFetch(`/invoices/${invoiceId}/record-payment`, {
    method: 'POST',
    version: GHL_VERSIONS.invoices,
    body: paymentPayload,
  });
  if (!payRes.ok) {
    // Invoice was created but payment recording failed — surface both pieces of
    // info so Jerry can finish the job manually in GHL if needed.
    return res.status(payRes.status).json({
      error: 'invoice created but payment recording failed — go to GHL and mark this invoice paid manually',
      invoiceId,
      detail: payRes.data,
    });
  }

  return res.status(200).json({
    ok: true,
    invoiceId,
    transactionId: payRes.data && (payRes.data.transactionId || payRes.data._id),
    message: `Recorded $${amount} ${method.label} payment for "${name}".`,
  });
};
