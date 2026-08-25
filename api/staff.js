// Vercel Serverless Function — Manage Staff, same hybrid pattern as students.js.
//   GET     /api/staff             -> list every staff member
//   POST    /api/staff             -> create a new one
//   PUT     /api/staff             -> update one (id in body)
//   DELETE  /api/staff?id=xxxx     -> delete one

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

const CORE_FIELDS = ['id', 'firstName', 'lastName', 'department', 'designation', 'status', 'staffId'];

function splitCoreAndExtra(s) {
  const extra = {};
  Object.keys(s).forEach(k => { if (!CORE_FIELDS.includes(k)) extra[k] = s[k]; });
  return {
    id: s.id, firstName: s.firstName || '', lastName: s.lastName || '',
    department: s.department || '', designation: s.designation || '',
    status: s.status || 'Active', staffId: s.staffId || '', extra,
  };
}

function toAppShape(row) {
  return {
    id: row.id, firstName: row.first_name, lastName: row.last_name,
    department: row.department, designation: row.designation,
    status: row.status, staffId: row.staff_id,
    ...row.extra,
  };
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM staff ORDER BY created_at ASC`;
      return res.status(200).json(rows.map(toAppShape));
    }

    if (req.method === 'POST') {
      const s = splitCoreAndExtra(req.body);
      if (!s.id || !s.firstName || !s.lastName) {
        return res.status(400).json({ error: 'Missing required fields.' });
      }
      await sql`
        INSERT INTO staff (id, first_name, last_name, department, designation, status, staff_id, extra)
        VALUES (${s.id}, ${s.firstName}, ${s.lastName}, ${s.department}, ${s.designation}, ${s.status}, ${s.staffId}, ${JSON.stringify(s.extra)}::jsonb)
      `;
      return res.status(201).json({ ok: true });
    }

    if (req.method === 'PUT') {
      const s = splitCoreAndExtra(req.body);
      if (!s.id) {
        return res.status(400).json({ error: 'Missing id.' });
      }
      await sql`
        UPDATE staff
        SET first_name = ${s.firstName}, last_name = ${s.lastName}, department = ${s.department},
            designation = ${s.designation}, status = ${s.status}, staff_id = ${s.staffId},
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
      await sql`DELETE FROM staff WHERE id = ${id}`;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    console.error('staff API error:', err);
    return res.status(500).json({ error: 'Something went wrong on the server.' });
  }
}
