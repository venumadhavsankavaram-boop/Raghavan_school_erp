// Vercel Serverless Function — ONE consolidated handler for every resource.
//
// Vercel's free (Hobby) plan allows a maximum of 12 serverless functions per
// deployment. With 14 separate api/*.js files (one per module) we went over
// that limit, which is what caused the "No more than 12 Serverless Functions"
// build failure. This file replaces ALL of them with a single function.
//
// The key trick: this file is named api/[resource].js — the square brackets
// mean Vercel treats it as ONE dynamic function that handles every URL
// matching /api/anything. A request to /api/students automatically gets
// req.query.resource === 'students', no code changes needed on the frontend
// at all — every existing fetch('/api/students'), fetch('/api/payments'),
// etc. call keeps working exactly as before, just routed through here now.
//
// If you ever delete the old individual files (users.js, students.js, etc.)
// from the api folder, do it now — they'd conflict with this one otherwise.

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

// ---------- Resource configuration ----------
// "simple" resources: every field is a real column, no nested JSON.
// fields: [{ app: 'camelCaseName', col: 'snake_case_column' }, ...]
const SIMPLE_RESOURCES = {
  users: {
    table: 'users',
    fields: [
      { app: 'id', col: 'id' }, { app: 'name', col: 'name' }, { app: 'username', col: 'username' },
      { app: 'password', col: 'password' }, { app: 'role', col: 'role' },
      { app: 'linkedStudentId', col: 'linked_student_id' }, { app: 'recoveryCode', col: 'recovery_code' },
    ],
  },
  payments: {
    table: 'payments',
    fields: [
      { app: 'id', col: 'id' }, { app: 'receiptNo', col: 'receipt_no' }, { app: 'studentId', col: 'student_id' },
      { app: 'studentName', col: 'student_name' }, { app: 'category', col: 'category' }, { app: 'mode', col: 'mode' },
      { app: 'amount', col: 'amount' }, { app: 'discount', col: 'discount' }, { app: 'instalment', col: 'instalment' },
      { app: 'date', col: 'date' }, { app: 'note', col: 'note' }, { app: 'classAtPayment', col: 'class_at_payment' },
      { app: 'extraFeeName', col: 'extra_fee_name' }, { app: 'extraFeeId', col: 'extra_fee_id' },
    ],
  },
  discounts: {
    table: 'student_discounts',
    fields: [
      { app: 'id', col: 'id' }, { app: 'batchId', col: 'batch_id' }, { app: 'studentId', col: 'student_id' },
      { app: 'type', col: 'type' }, { app: 'appliesTo', col: 'applies_to' }, { app: 'mode', col: 'mode' },
      { app: 'value', col: 'value' }, { app: 'note', col: 'note' }, { app: 'status', col: 'status' },
      { app: 'requestedBy', col: 'requested_by' }, { app: 'requestedRole', col: 'requested_role' },
      { app: 'requestedDate', col: 'requested_date' }, { app: 'approverId', col: 'approver_id' },
      { app: 'approverName', col: 'approver_name' }, { app: 'approvedBy', col: 'approved_by' },
      { app: 'approvedDate', col: 'approved_date' },
    ],
  },
  'extra-fees': {
    table: 'student_extra_fees',
    fields: [
      { app: 'id', col: 'id' }, { app: 'studentId', col: 'student_id' }, { app: 'name', col: 'name' },
      { app: 'amount', col: 'amount' }, { app: 'paid', col: 'paid' }, { app: 'paidAmount', col: 'paid_amount' },
      { app: 'date', col: 'date' },
    ],
  },
  attendance: {
    table: 'attendance_records',
    fields: [
      { app: 'id', col: 'id' }, { app: 'studentId', col: 'student_id' }, { app: 'date', col: 'date' },
      { app: 'status', col: 'status' },
    ],
  },
  holidays: {
    table: 'holidays',
    fields: [{ app: 'id', col: 'id' }, { app: 'date', col: 'date' }, { app: 'name', col: 'name' }],
  },
  'exam-results': {
    table: 'exam_results',
    fields: [
      { app: 'id', col: 'id' }, { app: 'examId', col: 'exam_id' }, { app: 'studentId', col: 'student_id' },
      { app: 'subject', col: 'subject' }, { app: 'marks', col: 'marks' }, { app: 'absent', col: 'absent' },
    ],
  },
};

// "hybrid" resources: a few core columns other modules search/filter by,
// everything else rides along in one JSONB "extra" column.
const HYBRID_RESOURCES = {
  students: {
    table: 'students',
    core: [
      { app: 'id', col: 'id' }, { app: 'firstName', col: 'first_name' }, { app: 'lastName', col: 'last_name' },
      { app: 'className', col: 'class_name' }, { app: 'section', col: 'section' }, { app: 'status', col: 'status' },
      { app: 'admissionNo', col: 'admission_no' },
    ],
  },
  staff: {
    table: 'staff',
    core: [
      { app: 'id', col: 'id' }, { app: 'firstName', col: 'first_name' }, { app: 'lastName', col: 'last_name' },
      { app: 'department', col: 'department' }, { app: 'designation', col: 'designation' },
      { app: 'status', col: 'status' }, { app: 'staffId', col: 'staff_id' },
    ],
  },
};

// "custom" resources: distinct enough shapes (JSONB-heavy, or single-object
// settings) that they get their own small handler function below instead of
// fitting the generic simple/hybrid patterns.
const CUSTOM_RESOURCES = ['subjects', 'exam-defs', 'roles', 'fee-structure', 'attendance-settings'];

// ---------- Generic helpers for "simple" resources ----------
function simpleToAppShape(row, fields) {
  const out = {};
  fields.forEach(f => {
    let v = row[f.col];
    if (v && typeof v === 'object' && v instanceof Date) v = v.toISOString().slice(0, 10);
    out[f.app] = v;
  });
  return out;
}
async function handleSimple(req, res, config) {
  const { table, fields } = config;
  if (req.method === 'GET') {
    const rows = await sql.query(`SELECT * FROM ${table} ORDER BY created_at ASC NULLS LAST`);
    return res.status(200).json(rows.map(r => simpleToAppShape(r, fields)));
  }
  if (req.method === 'POST' || req.method === 'PUT') {
    const body = req.body || {};
    if (!body.id) return res.status(400).json({ error: 'Missing id.' });
    const cols = fields.map(f => f.col);
    const vals = fields.map(f => (body[f.app] === undefined ? null : body[f.app]));
    if (req.method === 'POST') {
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
      await sql.query(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`, vals);
      return res.status(201).json({ ok: true });
    } else {
      const setClause = cols.filter(c => c !== 'id').map((c, i) => `${c} = $${i + 2}`).join(', ');
      const updateVals = [body.id, ...fields.filter(f => f.col !== 'id').map(f => (body[f.app] === undefined ? null : body[f.app]))];
      await sql.query(`UPDATE ${table} SET ${setClause} WHERE id = $1`, updateVals);
      return res.status(200).json({ ok: true });
    }
  }
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing id.' });
    await sql.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ error: 'Method not allowed.' });
}

// ---------- Generic helpers for "hybrid" (core + JSONB extra) resources ----------
function hybridToAppShape(row, core) {
  const out = {};
  core.forEach(f => { out[f.app] = row[f.col]; });
  return { ...out, ...(row.extra || {}) };
}
function splitCoreExtra(body, core) {
  const coreAppKeys = core.map(f => f.app);
  const extra = {};
  Object.keys(body).forEach(k => { if (!coreAppKeys.includes(k)) extra[k] = body[k]; });
  const coreVals = {};
  core.forEach(f => { coreVals[f.app] = body[f.app] !== undefined ? body[f.app] : (f.app === 'status' ? 'Active' : ''); });
  return { coreVals, extra };
}
async function handleHybrid(req, res, config) {
  const { table, core } = config;
  if (req.method === 'GET') {
    const rows = await sql.query(`SELECT * FROM ${table} ORDER BY created_at ASC NULLS LAST`);
    return res.status(200).json(rows.map(r => hybridToAppShape(r, core)));
  }
  if (req.method === 'POST' || req.method === 'PUT') {
    const body = req.body || {};
    if (!body.id) return res.status(400).json({ error: 'Missing id.' });
    const { coreVals, extra } = splitCoreExtra(body, core);
    const cols = core.map(f => f.col);
    const vals = core.map(f => coreVals[f.app]);
    if (req.method === 'POST') {
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
      await sql.query(
        `INSERT INTO ${table} (${cols.join(', ')}, extra) VALUES (${placeholders}, $${cols.length + 1}::jsonb)`,
        [...vals, JSON.stringify(extra)]
      );
      return res.status(201).json({ ok: true });
    } else {
      const setClause = cols.filter(c => c !== 'id').map((c, i) => `${c} = $${i + 2}`).join(', ');
      const nonIdVals = core.filter(f => f.col !== 'id').map(f => coreVals[f.app]);
      await sql.query(
        `UPDATE ${table} SET ${setClause}, extra = $${nonIdVals.length + 2}::jsonb WHERE id = $1`,
        [body.id, ...nonIdVals, JSON.stringify(extra)]
      );
      return res.status(200).json({ ok: true });
    }
  }
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing id.' });
    await sql.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ error: 'Method not allowed.' });
}

// ---------- Custom per-resource handlers (distinct/JSONB-heavy shapes) ----------
async function handleSubjects(req, res) {
  if (req.method === 'GET') {
    const rows = await sql`SELECT * FROM subjects ORDER BY created_at ASC`;
    return res.status(200).json(rows.map(r => ({
      id: r.id, name: r.name, code: r.code || '', className: r.class_name,
      sections: r.sections || [], sectionStaff: r.section_staff || {}, staffIds: r.staff_ids || [],
      countable: r.countable, elective: r.elective,
    })));
  }
  if (req.method === 'POST') {
    const s = req.body;
    if (!s.id || !s.name || !s.className) return res.status(400).json({ error: 'Missing required fields.' });
    await sql`
      INSERT INTO subjects (id, name, code, class_name, sections, section_staff, staff_ids, countable, elective)
      VALUES (${s.id}, ${s.name}, ${s.code || ''}, ${s.className}, ${JSON.stringify(s.sections || [])}::jsonb,
              ${JSON.stringify(s.sectionStaff || {})}::jsonb, ${JSON.stringify(s.staffIds || [])}::jsonb,
              ${s.countable !== false}, ${!!s.elective})
    `;
    return res.status(201).json({ ok: true });
  }
  if (req.method === 'PUT') {
    const s = req.body;
    if (!s.id) return res.status(400).json({ error: 'Missing id.' });
    await sql`
      UPDATE subjects SET name = ${s.name}, code = ${s.code || ''}, class_name = ${s.className},
        sections = ${JSON.stringify(s.sections || [])}::jsonb, section_staff = ${JSON.stringify(s.sectionStaff || {})}::jsonb,
        staff_ids = ${JSON.stringify(s.staffIds || [])}::jsonb, countable = ${s.countable !== false}, elective = ${!!s.elective}
      WHERE id = ${s.id}
    `;
    return res.status(200).json({ ok: true });
  }
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing id.' });
    await sql`DELETE FROM subjects WHERE id = ${id}`;
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ error: 'Method not allowed.' });
}

async function handleExamDefs(req, res) {
  if (req.method === 'GET') {
    const rows = await sql`SELECT * FROM exam_defs ORDER BY created_at ASC`;
    return res.status(200).json(rows.map(r => ({
      id: r.id, name: r.name, examType: r.exam_type,
      startDate: r.start_date ? r.start_date.toISOString().slice(0, 10) : '',
      endDate: r.end_date ? r.end_date.toISOString().slice(0, 10) : '',
      classSubjects: r.class_subjects || {},
    })));
  }
  if (req.method === 'POST') {
    const e = req.body;
    if (!e.id || !e.name) return res.status(400).json({ error: 'Missing required fields.' });
    await sql`
      INSERT INTO exam_defs (id, name, exam_type, start_date, end_date, class_subjects)
      VALUES (${e.id}, ${e.name}, ${e.examType}, ${e.startDate || null}, ${e.endDate || null}, ${JSON.stringify(e.classSubjects || {})}::jsonb)
    `;
    return res.status(201).json({ ok: true });
  }
  if (req.method === 'PUT') {
    const e = req.body;
    if (!e.id) return res.status(400).json({ error: 'Missing id.' });
    await sql`
      UPDATE exam_defs SET name = ${e.name}, exam_type = ${e.examType}, start_date = ${e.startDate || null},
        end_date = ${e.endDate || null}, class_subjects = ${JSON.stringify(e.classSubjects || {})}::jsonb
      WHERE id = ${e.id}
    `;
    return res.status(200).json({ ok: true });
  }
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing id.' });
    await sql`DELETE FROM exam_defs WHERE id = ${id}`;
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ error: 'Method not allowed.' });
}

async function handleRoles(req, res) {
  if (req.method === 'GET') {
    const rows = await sql`SELECT * FROM custom_roles ORDER BY created_at ASC`;
    return res.status(200).json(rows.map(r => ({ id: r.id, name: r.name, permissions: r.permissions })));
  }
  if (req.method === 'POST') {
    const r = req.body;
    if (!r.id || !r.name) return res.status(400).json({ error: 'Missing required fields.' });
    await sql`INSERT INTO custom_roles (id, name, permissions) VALUES (${r.id}, ${r.name}, ${JSON.stringify(r.permissions || {})}::jsonb)`;
    return res.status(201).json({ ok: true });
  }
  if (req.method === 'PUT') {
    const r = req.body;
    if (!r.id) return res.status(400).json({ error: 'Missing id.' });
    await sql`UPDATE custom_roles SET name = ${r.name}, permissions = ${JSON.stringify(r.permissions || {})}::jsonb WHERE id = ${r.id}`;
    return res.status(200).json({ ok: true });
  }
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing id.' });
    await sql`DELETE FROM custom_roles WHERE id = ${id}`;
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ error: 'Method not allowed.' });
}

async function handleFeeStructure(req, res) {
  if (req.method === 'GET') {
    const rows = await sql`SELECT * FROM fee_structure`;
    const obj = {};
    rows.forEach(r => { obj[r.class_name] = { admission: Number(r.admission), fee: Number(r.fee), bus: Number(r.bus), stock: Number(r.stock) }; });
    return res.status(200).json(obj);
  }
  if (req.method === 'PUT') {
    const structure = req.body || {};
    for (const [className, rates] of Object.entries(structure)) {
      await sql`
        INSERT INTO fee_structure (class_name, admission, fee, bus, stock)
        VALUES (${className}, ${rates.admission || 0}, ${rates.fee || 0}, ${rates.bus || 0}, ${rates.stock || 0})
        ON CONFLICT (class_name) DO UPDATE SET admission = ${rates.admission || 0}, fee = ${rates.fee || 0}, bus = ${rates.bus || 0}, stock = ${rates.stock || 0}
      `;
    }
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ error: 'Method not allowed.' });
}

async function handleAttendanceSettings(req, res) {
  if (req.method === 'GET') {
    const rows = await sql`SELECT * FROM attendance_settings WHERE id = 1`;
    if (rows.length === 0) return res.status(200).json({});
    return res.status(200).json({ threshold: Number(rows[0].threshold), workingDays: rows[0].working_days });
  }
  if (req.method === 'PUT') {
    const s = req.body || {};
    await sql`
      INSERT INTO attendance_settings (id, threshold, working_days)
      VALUES (1, ${s.threshold || 75}, ${JSON.stringify(s.workingDays || [1,2,3,4,5,6])}::jsonb)
      ON CONFLICT (id) DO UPDATE SET threshold = ${s.threshold || 75}, working_days = ${JSON.stringify(s.workingDays || [1,2,3,4,5,6])}::jsonb
    `;
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ error: 'Method not allowed.' });
}

// ---------- Main router ----------
export default async function handler(req, res) {
  const { resource } = req.query;
  try {
    if (SIMPLE_RESOURCES[resource]) return await handleSimple(req, res, SIMPLE_RESOURCES[resource]);
    if (HYBRID_RESOURCES[resource]) return await handleHybrid(req, res, HYBRID_RESOURCES[resource]);
    if (resource === 'subjects') return await handleSubjects(req, res);
    if (resource === 'exam-defs') return await handleExamDefs(req, res);
    if (resource === 'roles') return await handleRoles(req, res);
    if (resource === 'fee-structure') return await handleFeeStructure(req, res);
    if (resource === 'attendance-settings') return await handleAttendanceSettings(req, res);
    return res.status(404).json({ error: `Unknown resource: ${resource}` });
  } catch (err) {
    console.error(`${resource} API error:`, err);
    return res.status(500).json({ error: 'Something went wrong on the server.' });
  }
}
