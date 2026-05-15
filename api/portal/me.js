'use strict';
const { requirePortal, ghlFetch } = require('../../lib/ghl');

module.exports = async (req, res) => {
  const contactId = requirePortal(req, res);
  if (!contactId) return;
  const r = await ghlFetch(`/contacts/${contactId}`);
  if (!r.ok) return res.status(r.status).json(r.data);
  const c = r.data.contact || {};
  return res.status(200).json({
    id: c.id,
    firstName: c.firstName || '',
    lastName: c.lastName || '',
    name: c.contactName || `${c.firstName || ''} ${c.lastName || ''}`.trim(),
    email: c.email || '',
    phone: c.phone || '',
  });
};
