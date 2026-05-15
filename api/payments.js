'use strict';
const { requireAuth, ghlFetch, LOCATION_ID } = require('../lib/ghl');

module.exports = async (req, res) => {
  if (!requireAuth(req, res)) return;
  const loc = LOCATION_ID();
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const r = await ghlFetch(
    `/payments/transactions?altId=${loc}&altType=location&limit=${limit}`
  );
  return res.status(r.ok ? 200 : r.status).json(r.data);
};
