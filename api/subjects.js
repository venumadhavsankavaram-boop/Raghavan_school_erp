// Vercel Serverless Function — Manage Subjects, same pattern as the others.
// sections/sectionStaff/staffIds are stored as JSONB since they're arrays
// and nested per-section teacher assignments, not simple scalar fields.
//
//   GET     /api/subjects             -> list every subject
//   POST    /api/subjects             -> create a new one
//   PUT     /api/subjects             -> update one (id in body)
//   DELETE  /api/subjects?id=xxxx     -> delete one

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

function toAppShape(row) {
  return {
    id: row.id,
    name: row.name,
    code: row.code || '',
    className: row.class_name,
    sections: row.sections || [],
    sectionStaff: row.section_staff || {},
    staffIds: row.staff_ids || [],
    countable: row.countable,
    elective: row.elective,
  };
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM subjects ORDER BY created_at ASC`;
      return res.status(200).json(rows.map(toAppShape));
    }

    if (req.method === 'POST') {
      const s = req.body;
      if (!s.id || !s.name || !s.className) {
        return res.status(400).json({ error: 'Missing required fields.' });
      }
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
      if (!s.id) {
        return res.status(400).json({ error: 'Missing id.' });
      }
      await sql`
        UPDATE subjects
        SET name = ${s.name}, code = ${s.code || ''}, class_name = ${s.className},
            sections = ${JSON.stringify(s.sections || [])}::jsonb,
            section_staff = ${JSON.stringify(s.sectionStaff || {})}::jsonb,
            staff_ids = ${JSON.stringify(s.staffIds || [])}::jsonb,
            countable = ${s.countable !== false}, elective = ${!!s.elective}
        WHERE id = ${s.id}
      `;
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ error: 'Missing id.' });
      }
      await sql`DELETE FROM subjects WHERE id = ${id}`;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    console.error('subjects API error:', err);
    return res.status(500).json({ error: 'Something went wrong on the server.' });
  }
}
