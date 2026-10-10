import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import coreRoutes from './routes/core.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import buildsRoutes from './routes/builds.js';
import requestRoutes from './routes/requests.js';
import inquiryRoutes from './routes/inquiries.js';
import adminInquiryRoutes from './routes/adminInquiries.js';
import reportingRoutes from './routes/reporting.js';
import { notFound, errorHandler } from './middleware/errors.js';
const app = express();
const allowedOrigins = [process.env.CLIENT_ORIGIN || 'http://localhost:5173'];
if (process.env.NODE_ENV !== 'production') allowedOrigins.push('http://localhost:5173', 'http://127.0.0.1:5173');
app.use(cors({ origin: [...new Set(allowedOrigins)], credentials: true }));
app.use((req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      ((req.headers.origin && !allowedOrigins.includes(req.headers.origin)) || req.headers['sec-fetch-site'] === 'cross-site')) {
    return res.status(403).json({ message: 'Request origin is not allowed.' });
  }
  next();
});
app.use(express.json({ limit: '64kb' }));
app.use((req, res, next) => { console.log(req.method + ' ' + req.path); next(); });
app.get('/api/health', (req, res) => res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({ database: mongoose.connection.readyState === 1 ? 'connected' : 'unavailable' }));
app.use('/api/auth', authRoutes);
app.use('/api/admin/inquiries', adminInquiryRoutes);
app.use('/api/admin', reportingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/builds', buildsRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/inquiries', inquiryRoutes);
app.use('/api', coreRoutes);
app.use(notFound);
app.use(errorHandler);
export default app;