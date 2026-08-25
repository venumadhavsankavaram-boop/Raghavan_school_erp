// Vercel Serverless Function — handles all Manage Student operations against
// the shared Neon database, following the same pattern as api/users.js.
//
// Endpoints (all under /api/students):
//   GET     /api/students             -> list every student
//   POST    /api/students             -> create a new student
//   PUT     /api/students             -> update an existing student (id in body)
//   DELETE  /api/students?id=xxxx     -> delete a student

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

// These fields get their own real database column (things other modules
// search/filter/join on). Everything else on a student record rides along
// in the "extra" JSONB column and gets merged back in on the way out.
const CORE_FIELDS = ['id', 'firstName', 'lastName', 'className', 'section', 'status', 'admissionNo'];

function splitCoreAndExtra(s) {
  const extra = {};
  Object.keys(s).forEach(k => { if (!CORE_FIELDS.includes(k)) extra[k] = s[k]; });
  return {
    id: s.id, firstName: s.firstName || '', lastName: s.lastName || '',
    className: s.className || '', section: s.section || '', status: s.status || 'Active',
    admissionNo: s.admissionNo || '', extra,
  };
}

function toAppShape(row) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    className: row.class_name,
    section: row.section,
    status: row.status,
    admissionNo: row.admission_no,
    ...row.extra, // spread the rest of the student's fields back in
  };
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM students ORDER BY created_at ASC`;
      return res.status(200).json(rows.map(toAppShape));
    }

    if (req.method === 'POST') {
      const s = splitCoreAndExtra(req.body);
      if (!s.id || !s.firstName || !s.lastName || !s.className || !s.section) {
        return res.status(400).json({ error: 'Missing required fields.' });
      }
      await sql`
        INSERT INTO students (id, first_name, last_name, class_name, section, status, admission_no, extra)
        VALUES (${s.id}, ${s.firstName}, ${s.lastName}, ${s.className}, ${s.section}, ${s.status}, ${s.admissionNo}, ${JSON.stringify(s.extra)}::jsonb)
      `;
      return res.status(201).json({ ok: true });
    }

    if (req.method === 'PUT') {
      const s = splitCoreAndExtra(req.body);
      if (!s.id) {
        return res.status(400).json({ error: 'Missing id.' });
      }
      await sql`
        UPDATE students
        SET first_name = ${s.firstName}, last_name = ${s.lastName}, class_name = ${s.className},
            section = ${s.section}, status = ${s.status}, admission_no = ${s.admissionNo},
            extra = ${JSON.stringify(s.extra)}::jsonb
        WHERE id = ${s.id}
      `;
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ error: 'Missing id.' });
      }
      await sql`DELETE FROM students WHERE id = ${id}`;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    console.error('students API error:', err);
    return res.status(500).json({ error: 'Something went wrong on the server.' });
  }
}
