// Vercel Serverless Function — Exam Definitions (name, dates, per-class
// subject configuration). classSubjects is stored as JSONB since it's a
// nested object, not a simple scalar field.
//
//   GET     /api/exam-defs             -> list every exam
//   POST    /api/exam-defs             -> create a new one
//   PUT     /api/exam-defs             -> update one (id in body)
//   DELETE  /api/exam-defs?id=xxxx     -> delete one

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

function toAppShape(row) {
  return {
    id: row.id,
    name: row.name,
    examType: row.exam_type,
    startDate: row.start_date ? row.start_date.toISOString().slice(0, 10) : '',
    endDate: row.end_date ? row.end_date.toISOString().slice(0, 10) : '',
    classSubjects: row.class_subjects || {},
  };
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM exam_defs ORDER BY created_at ASC`;
      return res.status(200).json(rows.map(toAppShape));
    }

    if (req.method === 'POST') {
      const e = req.body;
      if (!e.id || !e.name) {
        return res.status(400).json({ error: 'Missing required fields.' });
      }
      await sql`
        INSERT INTO exam_defs (id, name, exam_type, start_date, end_date, class_subjects)
        VALUES (${e.id}, ${e.name}, ${e.examType}, ${e.startDate || null}, ${e.endDate || null}, ${JSON.stringify(e.classSubjects || {})}::jsonb)
      `;
      return res.status(201).json({ ok: true });
    }

    if (req.method === 'PUT') {
      const e = req.body;
      if (!e.id) {
        return res.status(400).json({ error: 'Missing id.' });
      }
      await sql`
        UPDATE exam_defs
        SET name = ${e.name}, exam_type = ${e.examType}, start_date = ${e.startDate || null},
            end_date = ${e.endDate || null}, class_subjects = ${JSON.stringify(e.classSubjects || {})}::jsonb
        WHERE id = ${e.id}
      `;
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ error: 'Missing id.' });
      }
      await sql`DELETE FROM exam_defs WHERE id = ${id}`;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    console.error('exam-defs API error:', err);
    return res.status(500).json({ error: 'Something went wrong on the server.' });
  }
}
