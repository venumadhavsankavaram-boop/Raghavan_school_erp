// Vercel Serverless Function — Attendance Settings (threshold %, working
// days). A single settings row, same whole-object pattern as fee-structure.js.
//
//   GET  /api/attendance-settings   -> { threshold, workingDays }
//   PUT  /api/attendance-settings   -> replaces it wholesale

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  try {
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
        ON CONFLICT (id) DO UPDATE
        SET threshold = ${s.threshold || 75}, working_days = ${JSON.stringify(s.workingDays || [1,2,3,4,5,6])}::jsonb
      `;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    console.error('attendance-settings API error:', err);
    return res.status(500).json({ error: 'Something went wrong on the server.' });
  }
}
