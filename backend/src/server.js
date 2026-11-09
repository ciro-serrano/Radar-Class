import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth.js';
import cursosRoutes from './routes/cursos.js';
import evaluacionesRoutes from './routes/evaluaciones.js';
import intentosRoutes from './routes/intentos.js';
import correccionRoutes from './routes/correccion.js';
import estadisticasRoutes from './routes/estadisticas.js';
import bancoRoutes from './routes/banco.js';

if (!process.env.JWT_SECRET) {
  console.error('Falta JWT_SECRET en backend/.env (copiá .env.example a .env)');
  process.exit(1);
}

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true }));
// Los PDF viajan en base64 dentro del JSON (hasta 14 MB en total): solo esta ruta acepta cuerpos grandes (debe ir antes del parser general)
app.use('/api/evaluaciones/generar', express.json({ limit: '20mb' }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, app: 'Radar Class' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }), authRoutes);
app.use('/api/cursos', cursosRoutes);
app.use('/api/evaluaciones', evaluacionesRoutes);
app.use('/api/intentos', intentosRoutes);
app.use('/api/correccion', correccionRoutes);
app.use('/api/estadisticas', estadisticasRoutes);
app.use('/api/banco', bancoRoutes);

app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'El material es demasiado grande (máximo 14 MB entre todos los PDF)' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Pedido inválido' });
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Radar Class API en http://localhost:${port}`));
