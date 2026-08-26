// Vercel Serverless Function — Manage Attendance daily records.
//   GET     /api/attendance             -> list every attendance record
//   POST    /api/attendance             -> create a new one
//   PUT     /api/attendance             -> update one (id in body)
//   DELETE  /api/attendance?id=xxxx     -> delete one

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

function toAppShape(row) {
  return {
    id: row.id,
    studentId: row.student_id,
    date: row.date ? row.date.toISOString().slice(0, 10) : '',
    status: row.status,
  };
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM attendance_records ORDER BY date ASC`;
      return res.status(200).json(rows.map(toAppShape));
    }

    if (req.method === 'POST') {
      const a = req.body;
      if (!a.id || !a.studentId || !a.date) {
        return res.status(400).json({ error: 'Missing required fields.' });
      }
      await sql`
        INSERT INTO attendance_records (id, student_id, date, status)
        VALUES (${a.id}, ${a.studentId}, ${a.date}, ${a.status})
      `;
      return res.status(201).json({ ok: true });
    }

    if (req.method === 'PUT') {
      const a = req.body;
      if (!a.id) {
        return res.status(400).json({ error: 'Missing id.' });
      }
      await sql`
        UPDATE attendance_records
        SET student_id = ${a.studentId}, date = ${a.date}, status = ${a.status}
        WHERE id = ${a.id}
      `;
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ error: 'Missing id.' });
      }
      await sql`DELETE FROM attendance_records WHERE id = ${id}`;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    console.error('attendance API error:', err);
    return res.status(500).json({ error: 'Something went wrong on the server.' });
  }
}
