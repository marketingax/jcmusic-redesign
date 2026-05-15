'use strict';
const { requireAuth, ghlFetch, LOCATION_ID } = require('../lib/ghl');

module.exports = async (req, res) => {
  if (!requireAuth(req, res)) return;
  const loc = LOCATION_ID();
  const calId = process.env.GHL_CALENDAR_ID || '';
  const now = Date.now();

  const [contacts, events, invoices, opps] = await Promise.all([
    ghlFetch(`/contacts/?locationId=${loc}&limit=1`),
    ghlFetch(
      `/calendars/events?locationId=${loc}&calendarId=${calId}&startTime=${now}&endTime=${now + 7 * 86400000}`,
      { version: '2021-04-15' }
    ),
    ghlFetch(`/invoices/?altId=${loc}&altType=location&limit=100&offset=0`),
    ghlFetch(`/opportunities/search?location_id=${loc}&limit=1`),
  ]);

  const invList = invoices.ok ? invoices.data.invoices || [] : [];
  const paid = invList.filter((i) => i.status === 'paid');
  const revenue = paid.reduce((s, i) => s + (Number(i.amountPaid) || 0), 0);
  const outstanding = invList
    .filter((i) => i.status !== 'paid' && i.status !== 'void')
    .reduce((s, i) => s + (Number(i.total) || Number(i.amountDue) || 0), 0);

  return res.status(200).json({
    contactsTotal: contacts.ok ? contacts.data.total ?? (contacts.data.contacts || []).length : 0,
    upcomingAppointments: events.ok ? (events.data.events || []).length : 0,
    openOpportunities: opps.ok ? opps.data.meta?.total || 0 : 0,
    invoicesTotal: invList.length,
    invoicesPaid: paid.length,
    revenuePaid: revenue,
    revenueOutstanding: outstanding,
    paymentsScopeOk: invoices.ok,
  });
};
