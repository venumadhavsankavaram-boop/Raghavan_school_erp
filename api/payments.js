// Vercel Serverless Function — handles all Manage Fee payment operations
// against the shared Neon database, same pattern as users.js and students.js.
//
// Endpoints (all under /api/payments):
//   GET     /api/payments             -> list every payment
//   POST    /api/payments             -> create a new payment
//   PUT     /api/payments             -> update an existing payment (id in body)
//   DELETE  /api/payments?id=xxxx     -> delete a payment

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

function toAppShape(row) {
  return {
    id: row.id,
    receiptNo: row.receipt_no,
    studentId: row.student_id,
    studentName: row.student_name,
    category: row.category,
    mode: row.mode,
    amount: Number(row.amount),
    discount: Number(row.discount),
    instalment: row.instalment,
    date: row.date ? row.date.toISOString().slice(0, 10) : '',
    note: row.note,
    classAtPayment: row.class_at_payment,
    extraFeeName: row.extra_fee_name || undefined,
    extraFeeId: row.extra_fee_id || undefined,
  };
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM payments ORDER BY created_at ASC`;
      return res.status(200).json(rows.map(toAppShape));
    }

    if (req.method === 'POST') {
      const p = req.body;
      if (!p.id || !p.studentId) {
        return res.status(400).json({ error: 'Missing required fields.' });
      }
      await sql`
        INSERT INTO payments (id, receipt_no, student_id, student_name, category, mode, amount, discount, instalment, date, note, class_at_payment, extra_fee_name, extra_fee_id)
        VALUES (${p.id}, ${p.receiptNo}, ${p.studentId}, ${p.studentName}, ${p.category}, ${p.mode},
                ${p.amount || 0}, ${p.discount || 0}, ${p.instalment || ''}, ${p.date || null}, ${p.note || ''},
                ${p.classAtPayment}, ${p.extraFeeName || null}, ${p.extraFeeId || null})
      `;
      return res.status(201).json({ ok: true });
    }

    if (req.method === 'PUT') {
      const p = req.body;
      if (!p.id) {
        return res.status(400).json({ error: 'Missing id.' });
      }
      await sql`
        UPDATE payments
        SET receipt_no = ${p.receiptNo}, student_id = ${p.studentId}, student_name = ${p.studentName},
            category = ${p.category}, mode = ${p.mode}, amount = ${p.amount || 0}, discount = ${p.discount || 0},
            instalment = ${p.instalment || ''}, date = ${p.date || null}, note = ${p.note || ''},
            class_at_payment = ${p.classAtPayment}, extra_fee_name = ${p.extraFeeName || null}, extra_fee_id = ${p.extraFeeId || null}
        WHERE id = ${p.id}
      `;
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ error: 'Missing id.' });
      }
      await sql`DELETE FROM payments WHERE id = ${id}`;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    console.error('payments API error:', err);
    return res.status(500).json({ error: 'Something went wrong on the server.' });
  }
}
