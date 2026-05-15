'use strict';
const { requireAuth, ghlFetch, LOCATION_ID } = require('../lib/ghl');

module.exports = async (req, res) => {
  if (!requireAuth(req, res)) return;
  const days = Math.min(Number(req.query.days) || 30, 120);
  const back = Math.min(Number(req.query.back) || 1, 30);
  const start = Date.now() - back * 86400000;
  const end = Date.now() + days * 86400000;
  const calId = process.env.GHL_CALENDAR_ID || '';
  const r = await ghlFetch(
    `/calendars/events?locationId=${LOCATION_ID()}&calendarId=${calId}&startTime=${start}&endTime=${end}`,
    { version: '2021-04-15' }
  );
  return res.status(r.ok ? 200 : r.status).json(r.data);
};
