// Vercel Serverless Function — Custom Roles & Permissions, same pattern as
// the other modules. permissions is a nested object (one entry per app
// module), stored as JSONB rather than broken into columns.
//
//   GET     /api/roles             -> list every custom role
//   POST    /api/roles             -> create a new one
//   PUT     /api/roles             -> update one (id in body) — e.g. change its permissions
//   DELETE  /api/roles?id=xxxx     -> delete one

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

function toAppShape(row) {
  return { id: row.id, name: row.name, permissions: row.permissions };
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM custom_roles ORDER BY created_at ASC`;
      return res.status(200).json(rows.map(toAppShape));
    }

    if (req.method === 'POST') {
      const r = req.body;
      if (!r.id || !r.name) {
        return res.status(400).json({ error: 'Missing required fields.' });
      }
      await sql`
        INSERT INTO custom_roles (id, name, permissions)
        VALUES (${r.id}, ${r.name}, ${JSON.stringify(r.permissions || {})}::jsonb)
      `;
      return res.status(201).json({ ok: true });
    }

    if (req.method === 'PUT') {
      const r = req.body;
      if (!r.id) {
        return res.status(400).json({ error: 'Missing id.' });
      }
      await sql`
        UPDATE custom_roles
        SET name = ${r.name}, permissions = ${JSON.stringify(r.permissions || {})}::jsonb
        WHERE id = ${r.id}
      `;
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ error: 'Missing id.' });
      }
      await sql`DELETE FROM custom_roles WHERE id = ${id}`;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    console.error('roles API error:', err);
    return res.status(500).json({ error: 'Something went wrong on the server.' });
  }
}
