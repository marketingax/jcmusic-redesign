'use strict';
const { requirePortal, ghlFetch, LOCATION_ID, GHL_VERSIONS } = require('../../lib/ghl');

// Returns a hosted GHL payment URL the user can open in a new tab.
// If body.email = true, ALSO sends the official invoice email as a fallback.
module.exports = async (req, res) => {
  const contactId = requirePortal(req, res);
  if (!contactId) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};
  const invoiceId = String(body.invoiceId || '');
  const alsoEmail = !!body.email;
  if (!invoiceId) return res.status(400).json({ error: 'invoiceId required' });

  const loc = LOCATION_ID();

  // Verify the invoice belongs to THIS contact before doing anything.
  const inv = await ghlFetch(
    `/invoices/${invoiceId}?altId=${loc}&altType=location`,
    { version: GHL_VERSIONS.invoices }
  );
  if (!inv.ok) return res.status(inv.status).json(inv.data);
  const invoice = inv.data || {};
  if (invoice.contactDetails && invoice.contactDetails.id !== contactId) {
    return res.status(403).json({ error: 'forbidden' });
  }

  // GHL's invoice response field for the hosted payment page is not stably documented.
  // Try the known candidate fields first, then fall back to the well-known public link form.
  const hostedUrl =
    invoice.invoiceUrl ||
    invoice.paymentUrl ||
    invoice.publicUrl ||
    invoice.viewInvoiceUrl ||
    (invoice._id ? `https://link.msgsndr.com/invoice/${invoice._id}` : null);

  let emailed = false;
  if (alsoEmail) {
    const send = await ghlFetch(`/invoices/${invoiceId}/send`, {
      method: 'POST',
      version: GHL_VERSIONS.invoices,
      body: { altId: loc, altType: 'location', action: 'email', liveMode: true },
    });
    emailed = !!send.ok;
  }

  return res.status(200).json({
    ok: true,
    hostedUrl,
    emailed,
    message: emailed
      ? 'Invoice emailed and ready to pay.'
      : hostedUrl
        ? 'Opening secure payment page…'
        : 'Could not generate a payment link.',
  });
};
