'use strict';
const { requireAuth, ghlFetch, LOCATION_ID, GHL_VERSIONS } = require('../lib/ghl');

// "Overdue" = past their last payment's coverage window.
// Coverage is inferred from the invoice/payment NAME (e.g. "1 Month", "6 Months",
// "Annual"). Default to 30 days when no duration is parseable.
//
// We start from succeeded transactions (those are the source of truth — manual
// Zelle/cash entries land here too), roll up by contact, and pick the LATEST
// coverage-end date per contact.
//
// Output groups: overdue (past coverage), dueSoon (≤7d), covered, plus the
// underlying coverage details so the admin UI can show last-payment context.

function parseDurationDays(name) {
  const s = String(name || '').toLowerCase();
  // explicit number-month patterns first
  const m = s.match(/(\d+)\s*(?:mo|mos|month|months)\b/);
  if (m) return Math.max(1, parseInt(m[1], 10)) * 30;
  if (/\b(annual|annually|year|yr|yearly|12\s*mo|12\s*month)\b/.test(s)) return 365;
  if (/\bhalf\s*year\b/.test(s)) return 180;
  if (/\bquarter(ly)?\b/.test(s)) return 90;
  if (/\b(week|weekly|wk)\b/.test(s)) return 7;
  // Default: assume one month of coverage.
  return 30;
}

module.exports = async (req, res) => {
  if (!requireAuth(req, res)) return;
  const loc = LOCATION_ID();

  // Pull recent succeeded transactions. 100 is the GHL hard cap per page;
  // newest first is the default. Paginate up to ~500 rows defensively.
  const all = [];
  for (let offset = 0; offset < 500; offset += 100) {
    const r = await ghlFetch(
      `/payments/transactions?altId=${loc}&altType=location&limit=100&offset=${offset}`,
      { version: GHL_VERSIONS.payments }
    );
    if (!r.ok) {
      if (offset === 0) return res.status(r.status).json(r.data);
      break;
    }
    const page = r.data.data || [];
    all.push(...page);
    if (page.length < 100) break;
  }

  const succeeded = all.filter((t) => t.status === 'succeeded' && t.contactId);

  // Roll up per contact → pick the entry with the latest coverage end.
  const byContact = new Map();
  succeeded.forEach((t) => {
    const paidAt = new Date(t.createdAt || t.fulfilledAt || Date.now());
    const days = parseDurationDays(t.entitySourceName || '');
    const coverageEnd = new Date(paidAt.getTime() + days * 86400000);
    const prev = byContact.get(t.contactId);
    if (!prev || coverageEnd > prev.coverageEnd) {
      byContact.set(t.contactId, {
        contactId: t.contactId,
        contactName: t.contactName || (t.contactSnapshot && t.contactSnapshot.name) || '—',
        lastPaidAt: paidAt.toISOString(),
        lastAmount: t.amount,
        lastInvoiceName: t.entitySourceName || '',
        coverageDays: days,
        coverageEnd,
      });
    }
  });

  const today = Date.now();
  const overdue = [], dueSoon = [], covered = [];
  for (const row of byContact.values()) {
    const diffDays = Math.floor((today - row.coverageEnd.getTime()) / 86400000);
    const out = {
      contactId: row.contactId,
      contactName: row.contactName,
      lastPaidAt: row.lastPaidAt,
      lastAmount: row.lastAmount,
      lastInvoiceName: row.lastInvoiceName,
      coverageDays: row.coverageDays,
      coverageEnd: row.coverageEnd.toISOString(),
      daysOverdue: diffDays,
    };
    if (diffDays > 0) overdue.push(out);
    else if (diffDays >= -7) dueSoon.push(out);
    else covered.push(out);
  }
  overdue.sort((a, b) => b.daysOverdue - a.daysOverdue);
  dueSoon.sort((a, b) => a.daysOverdue - b.daysOverdue);
  covered.sort((a, b) => new Date(a.coverageEnd) - new Date(b.coverageEnd));

  return res.status(200).json({
    asOf: new Date(today).toISOString(),
    counts: { overdue: overdue.length, dueSoon: dueSoon.length, covered: covered.length },
    overdue,
    dueSoon,
    covered,
  });
};
