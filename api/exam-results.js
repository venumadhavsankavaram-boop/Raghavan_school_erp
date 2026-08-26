// Vercel Serverless Function — Exam Results (actual marks students received).
//   GET     /api/exam-results             -> list every result
//   POST    /api/exam-results             -> create a new one
//   PUT     /api/exam-results             -> update one (id in body)
//   DELETE  /api/exam-results?id=xxxx     -> delete one

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

function toAppShape(row) {
  return {
    id: row.id,
    examId: row.exam_id,
    studentId: row.student_id,
    subject: row.subject,
    marks: row.marks !== null ? Number(row.marks) : null,
    absent: row.absent,
  };
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM exam_results ORDER BY created_at ASC`;
      return res.status(200).json(rows.map(toAppShape));
    }

    if (req.method === 'POST') {
      const r = req.body;
      if (!r.id || !r.examId || !r.studentId || !r.subject) {
        return res.status(400).json({ error: 'Missing required fields.' });
      }
      await sql`
        INSERT INTO exam_results (id, exam_id, student_id, subject, marks, absent)
        VALUES (${r.id}, ${r.examId}, ${r.studentId}, ${r.subject}, ${r.marks}, ${!!r.absent})
      `;
      return res.status(201).json({ ok: true });
    }

    if (req.method === 'PUT') {
      const r = req.body;
      if (!r.id) {
        return res.status(400).json({ error: 'Missing id.' });
      }
      await sql`
        UPDATE exam_results
        SET exam_id = ${r.examId}, student_id = ${r.studentId}, subject = ${r.subject},
            marks = ${r.marks}, absent = ${!!r.absent}
        WHERE id = ${r.id}
      `;
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ error: 'Missing id.' });
      }
      await sql`DELETE FROM exam_results WHERE id = ${id}`;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    console.error('exam-results API error:', err);
    return res.status(500).json({ error: 'Something went wrong on the server.' });
  }
}
