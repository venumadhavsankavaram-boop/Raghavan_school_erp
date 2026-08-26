// Vercel Serverless Function — Attendance Holidays.
//   GET     /api/holidays             -> list every holiday
//   POST    /api/holidays             -> create a new one
//   PUT     /api/holidays             -> update one (id in body)
//   DELETE  /api/holidays?id=xxxx     -> delete one

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

function toAppShape(row) {
  return {
    id: row.id,
    date: row.date ? row.date.toISOString().slice(0, 10) : '',
    name: row.name,
  };
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM holidays ORDER BY date ASC`;
      return res.status(200).json(rows.map(toAppShape));
    }

    if (req.method === 'POST') {
      const h = req.body;
      if (!h.id || !h.date || !h.name) {
        return res.status(400).json({ error: 'Missing required fields.' });
      }
      await sql`
        INSERT INTO holidays (id, date, name)
        VALUES (${h.id}, ${h.date}, ${h.name})
        ON CONFLICT (id) DO UPDATE SET date = ${h.date}, name = ${h.name}
      `;
      return res.status(201).json({ ok: true });
    }

    if (req.method === 'PUT') {
      const h = req.body;
      if (!h.id) {
        return res.status(400).json({ error: 'Missing id.' });
      }
      await sql`UPDATE holidays SET date = ${h.date}, name = ${h.name} WHERE id = ${h.id}`;
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ error: 'Missing id.' });
      }
      await sql`DELETE FROM holidays WHERE id = ${id}`;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    console.error('holidays API error:', err);
    return res.status(500).json({ error: 'Something went wrong on the server.' });
  }
}
