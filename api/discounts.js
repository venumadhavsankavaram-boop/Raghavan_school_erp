// Vercel Serverless Function — Student Discounts, same pattern as users.js/payments.js.
//   GET     /api/discounts             -> list every discount request
//   POST    /api/discounts             -> create a new one
//   PUT     /api/discounts             -> update one (id in body) — e.g. approve/reject
//   DELETE  /api/discounts?id=xxxx     -> delete one

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

function toAppShape(row) {
  return {
    id: row.id,
    batchId: row.batch_id,
    studentId: row.student_id,
    type: row.type,
    appliesTo: row.applies_to,
    mode: row.mode,
    value: Number(row.value),
    note: row.note,
    status: row.status,
    requestedBy: row.requested_by,
    requestedRole: row.requested_role,
    requestedDate: row.requested_date ? row.requested_date.toISOString().slice(0, 10) : '',
    approverId: row.approver_id,
    approverName: row.approver_name,
    approvedBy: row.approved_by || undefined,
    approvedDate: row.approved_date ? row.approved_date.toISOString().slice(0, 10) : undefined,
  };
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM student_discounts ORDER BY created_at ASC`;
      return res.status(200).json(rows.map(toAppShape));
    }

    if (req.method === 'POST') {
      const d = req.body;
      if (!d.id || !d.studentId) {
        return res.status(400).json({ error: 'Missing required fields.' });
      }
      await sql`
        INSERT INTO student_discounts (id, batch_id, student_id, type, applies_to, mode, value, note, status, requested_by, requested_role, requested_date, approver_id, approver_name, approved_by, approved_date)
        VALUES (${d.id}, ${d.batchId}, ${d.studentId}, ${d.type}, ${d.appliesTo}, ${d.mode}, ${d.value || 0},
                ${d.note || ''}, ${d.status || 'Pending'}, ${d.requestedBy}, ${d.requestedRole}, ${d.requestedDate || null},
                ${d.approverId}, ${d.approverName}, ${d.approvedBy || null}, ${d.approvedDate || null})
      `;
      return res.status(201).json({ ok: true });
    }

    if (req.method === 'PUT') {
      const d = req.body;
      if (!d.id) {
        return res.status(400).json({ error: 'Missing id.' });
      }
      await sql`
        UPDATE student_discounts
        SET batch_id = ${d.batchId}, student_id = ${d.studentId}, type = ${d.type}, applies_to = ${d.appliesTo},
            mode = ${d.mode}, value = ${d.value || 0}, note = ${d.note || ''}, status = ${d.status || 'Pending'},
            requested_by = ${d.requestedBy}, requested_role = ${d.requestedRole}, requested_date = ${d.requestedDate || null},
            approver_id = ${d.approverId}, approver_name = ${d.approverName},
            approved_by = ${d.approvedBy || null}, approved_date = ${d.approvedDate || null}
        WHERE id = ${d.id}
      `;
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ error: 'Missing id.' });
      }
      await sql`DELETE FROM student_discounts WHERE id = ${id}`;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    console.error('discounts API error:', err);
    return res.status(500).json({ error: 'Something went wrong on the server.' });
  }
}
