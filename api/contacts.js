'use strict';
const { requireAuth, ghlFetch, LOCATION_ID } = require('../lib/ghl');

module.exports = async (req, res) => {
  if (!requireAuth(req, res)) return;
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const query = req.query.query ? `&query=${encodeURIComponent(req.query.query)}` : '';
  const r = await ghlFetch(`/contacts/?locationId=${LOCATION_ID()}&limit=${limit}${query}`);
  return res.status(r.ok ? 200 : r.status).json(r.data);
};
