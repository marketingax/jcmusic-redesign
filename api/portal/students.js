'use strict';
const { requirePortal, ghlFetch, LOCATION_ID, GHL_VERSIONS } = require('../../lib/ghl');

// Returns the Student custom-object records linked to the authenticated parent contact.
// GHL stores Parent ↔ Student as a USER_DEFINED association between a contact and a
// `custom_objects.students` record (association labels: Parent / Student).
//
// Env vars:
//   GHL_STUDENTS_OBJECT_KEY  default "custom_objects.students"
//   GHL_PARENT_ASSOC_LABEL   default "Parent"
module.exports = async (req, res) => {
  const contactId = requirePortal(req, res);
  if (!contactId) return;

  const loc = LOCATION_ID();
  const schemaKey = process.env.GHL_STUDENTS_OBJECT_KEY || 'custom_objects.students';
  const parentLabel = (process.env.GHL_PARENT_ASSOC_LABEL || 'Parent').toLowerCase();

  // 1) Get all relations attached to this parent contact.
  const rel = await ghlFetch(
    `/associations/relations/${contactId}?locationId=${loc}&limit=100`,
    { version: GHL_VERSIONS.associations }
  );
  if (!rel.ok) return res.status(rel.status).json(rel.data);

  const rows = rel.data.relations || rel.data.data || rel.data || [];

  const studentIds = new Set();
  rows.forEach((r) => {
    const sides = [
      { id: r.firstRecordId  || (r.firstRecord  && r.firstRecord.id),  key: r.firstObjectKey  || (r.firstRecord  && r.firstRecord.objectKey) },
      { id: r.secondRecordId || (r.secondRecord && r.secondRecord.id), key: r.secondObjectKey || (r.secondRecord && r.secondRecord.objectKey) },
    ];
    // Match either side of the labelled relationship — this contact is the Parent,
    // so the OTHER side is the Student record we want.
    const label = String(r.associationLabel || r.label || '').toLowerCase();
    if (parentLabel && label && !label.includes(parentLabel) && !label.includes('student')) return;
    sides.forEach((s) => {
      if (s.id && s.id !== contactId && s.key === schemaKey) studentIds.add(s.id);
    });
  });

  if (!studentIds.size) return res.status(200).json({ students: [] });

  // 2) Hydrate each student record. GHL exposes the configured custom fields under
  //    `properties` keyed without the schema prefix (e.g. `student_name`).
  const students = [];
  for (const id of studentIds) {
    const r = await ghlFetch(
      `/objects/${schemaKey}/records/${id}?locationId=${loc}`,
      { version: GHL_VERSIONS.objects }
    );
    if (!r.ok) continue;
    const rec = r.data.record || r.data || {};
    const props = rec.properties || rec.fields || {};
    const prefix = schemaKey + '.';
    // Some GHL responses return keys WITH the schema prefix — normalize both shapes.
    const get = (k) => props[k] != null ? props[k] : props[prefix + k];
    students.push({
      id: rec.id || id,
      name: get('student_name') || rec.searchableName || 'Student',
      trainingType: get('training_type') || '',
      monthlyCost: get('monthly_cost') || '',
      properties: props,
    });
  }

  return res.status(200).json({ students });
};
