import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import coreRoutes from './routes/core.js';
import { notFound, errorHandler } from './middleware/errors.js';
const app = express();
const allowedOrigins = [process.env.CLIENT_ORIGIN || 'http://localhost:5173'];
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:5173', 'http://127.0.0.1:5173');
}
app.use(cors({ origin: [...new Set(allowedOrigins)] }));
app.use(express.json({ limit: '64kb' }));
app.use((req, res, next) => { console.log(`${req.method} ${req.path}`); next(); });
app.get('/api/health', (req, res) => res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({ database: mongoose.connection.readyState === 1 ? 'connected' : 'unavailable' }));
app.use('/api', coreRoutes);
app.use(notFound);
app.use(errorHandler);
export default app;
