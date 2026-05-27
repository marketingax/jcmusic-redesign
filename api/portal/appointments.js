'use strict';
const { requirePortal, ghlFetch, LOCATION_ID } = require('../../lib/ghl');

// Returns this contact's lessons / appointments (past + upcoming).
module.exports = async (req, res) => {
  const contactId = requirePortal(req, res);
  if (!contactId) return;
  const loc = LOCATION_ID();

  // Per-contact appointments endpoint avoids leaking other students' lessons.
  const r = await ghlFetch(
    `/contacts/${contactId}/appointments?locationId=${loc}`,
    { version: '2021-04-15' }
  );
  if (!r.ok) return res.status(r.status).json(r.data);

  const events = (r.data.events || r.data.appointments || []).map((e) => ({
    id: e.id || e._id,
    title: e.title || e.appointmentName || 'Lesson',
    startTime: e.startTime,
    endTime: e.endTime,
    status: e.appointmentStatus || e.status || '',
    address: e.address || '',
    calendarId: e.calendarId || '',
    assignedUserId: e.assignedUserId || '',
  })).sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

  return res.status(200).json({ events });
};
