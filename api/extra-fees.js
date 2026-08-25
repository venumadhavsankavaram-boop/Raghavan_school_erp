// Vercel Serverless Function — Student Extra Fees, same pattern as the others.
//   GET     /api/extra-fees             -> list every extra fee
//   POST    /api/extra-fees             -> create a new one
//   PUT     /api/extra-fees             -> update one (id in body) — e.g. mark paid
//   DELETE  /api/extra-fees?id=xxxx     -> delete one

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

function toAppShape(row) {
  return {
    id: row.id,
    studentId: row.student_id,
    name: row.name,
    amount: Number(row.amount),
    paid: row.paid,
    paidAmount: row.paid_amount !== null ? Number(row.paid_amount) : undefined,
    date: row.date ? row.date.toISOString().slice(0, 10) : '',
  };
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM student_extra_fees ORDER BY created_at ASC`;
      return res.status(200).json(rows.map(toAppShape));
    }

    if (req.method === 'POST') {
      const f = req.body;
      if (!f.id || !f.studentId) {
        return res.status(400).json({ error: 'Missing required fields.' });
      }
      await sql`
        INSERT INTO student_extra_fees (id, student_id, name, amount, paid, paid_amount, date)
        VALUES (${f.id}, ${f.studentId}, ${f.name}, ${f.amount || 0}, ${!!f.paid}, ${f.paidAmount || 0}, ${f.date || null})
      `;
      return res.status(201).json({ ok: true });
    }

    if (req.method === 'PUT') {
      const f = req.body;
      if (!f.id) {
        return res.status(400).json({ error: 'Missing id.' });
      }
      await sql`
        UPDATE student_extra_fees
        SET student_id = ${f.studentId}, name = ${f.name}, amount = ${f.amount || 0},
            paid = ${!!f.paid}, paid_amount = ${f.paidAmount || 0}, date = ${f.date || null}
        WHERE id = ${f.id}
      `;
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ error: 'Missing id.' });
      }
      await sql`DELETE FROM student_extra_fees WHERE id = ${id}`;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    console.error('extra-fees API error:', err);
    return res.status(500).json({ error: 'Something went wrong on the server.' });
  }
}
