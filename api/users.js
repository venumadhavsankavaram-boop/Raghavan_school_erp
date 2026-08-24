// Vercel Serverless Function — handles all Users & Roles operations against
// the shared Neon database. DATABASE_URL is injected automatically by the
// Neon-Vercel integration; no manual setup needed for that part.
//
// Endpoints (all under /api/users):
//   GET     /api/users            -> list every user
//   POST    /api/users            -> create a new user
//   PUT     /api/users            -> update an existing user (pass id in body)
//   DELETE  /api/users?id=xxxx    -> delete a user

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

// Converts a database row (snake_case) into the shape the ERP's frontend
// JavaScript already expects (camelCase) — so the existing app code barely
// has to change at all.
function toAppShape(row) {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    password: row.password,
    role: row.role,
    linkedStudentId: row.linked_student_id || '',
    recoveryCode: row.recovery_code,
  };
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM users ORDER BY created_at ASC`;
      return res.status(200).json(rows.map(toAppShape));
    }

    if (req.method === 'POST') {
      const u = req.body;
      if (!u.id || !u.name || !u.username || !u.password || !u.role) {
        return res.status(400).json({ error: 'Missing required fields.' });
      }
      await sql`
        INSERT INTO users (id, name, username, password, role, linked_student_id, recovery_code)
        VALUES (${u.id}, ${u.name}, ${u.username}, ${u.password}, ${u.role}, ${u.linkedStudentId || ''}, ${u.recoveryCode || ''})
      `;
      return res.status(201).json({ ok: true });
    }

    if (req.method === 'PUT') {
      const u = req.body;
      if (!u.id) {
        return res.status(400).json({ error: 'Missing id.' });
      }
      await sql`
        UPDATE users
        SET name = ${u.name}, username = ${u.username}, password = ${u.password},
            role = ${u.role}, linked_student_id = ${u.linkedStudentId || ''},
            recovery_code = ${u.recoveryCode || ''}
        WHERE id = ${u.id}
      `;
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ error: 'Missing id.' });
      }
      await sql`DELETE FROM users WHERE id = ${id}`;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    console.error('users API error:', err);
    return res.status(500).json({ error: 'Something went wrong on the server.' });
  }
}
