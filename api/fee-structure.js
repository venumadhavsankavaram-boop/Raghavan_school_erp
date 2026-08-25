// Vercel Serverless Function — Fee Structure is a small settings-style object
// (rates per class), always saved all-at-once from the Fee Structure page,
// not a growing list of records like students/payments. So this API is
// simpler: GET the whole object back, PUT replaces it wholesale.
//
//   GET  /api/fee-structure   -> { "6th Class": { admission, fee, bus, stock }, ... }
//   PUT  /api/fee-structure   -> body is that same shape, upserts every class in it

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM fee_structure`;
      const obj = {};
      rows.forEach(r => {
        obj[r.class_name] = {
          admission: Number(r.admission), fee: Number(r.fee),
          bus: Number(r.bus), stock: Number(r.stock),
        };
      });
      return res.status(200).json(obj);
    }

    if (req.method === 'PUT') {
      const structure = req.body || {};
      for (const [className, rates] of Object.entries(structure)) {
        await sql`
          INSERT INTO fee_structure (class_name, admission, fee, bus, stock)
          VALUES (${className}, ${rates.admission || 0}, ${rates.fee || 0}, ${rates.bus || 0}, ${rates.stock || 0})
          ON CONFLICT (class_name) DO UPDATE
          SET admission = ${rates.admission || 0}, fee = ${rates.fee || 0}, bus = ${rates.bus || 0}, stock = ${rates.stock || 0}
        `;
      }
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    console.error('fee-structure API error:', err);
    return res.status(500).json({ error: 'Something went wrong on the server.' });
  }
}
