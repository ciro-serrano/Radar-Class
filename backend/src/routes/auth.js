import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { firmarToken, requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/register', async (req, res) => {
  const { nombre, email, password, rol } = req.body || {};
  if (!nombre || !email || !password || !['docente', 'alumno'].includes(rol))
    return res.status(400).json({ error: 'Completá nombre, email, contraseña y rol' });
  if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  const existe = await query('SELECT id FROM usuarios WHERE email = ?', [email.toLowerCase()]);
  if (existe.length) return res.status(409).json({ error: 'Ya existe una cuenta con ese email' });
  const hash = await bcrypt.hash(password, 10);
  const r = await query('INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?,?,?,?)', [nombre.trim(), email.toLowerCase(), hash, rol]);
  const user = { id: r.insertId, nombre: nombre.trim(), rol };
  res.status(201).json({ token: firmarToken(user), user });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const [u] = await query('SELECT * FROM usuarios WHERE email = ?', [String(email || '').toLowerCase()]);
  if (!u || !(await bcrypt.compare(password || '', u.password_hash)))
    return res.status(401).json({ error: 'Email o contraseña incorrectos' });
  const user = { id: u.id, nombre: u.nombre, rol: u.rol };
  res.json({ token: firmarToken(user), user });
});

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

export default router;
