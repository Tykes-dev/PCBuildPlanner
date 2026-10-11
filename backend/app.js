import express from 'express';
import cors from 'cors';
import healthRoutes from './routes/health.js';
import coreRoutes from './routes/core.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import buildsRoutes from './routes/builds.js';
import requestRoutes from './routes/requests.js';
import inquiryRoutes from './routes/inquiries.js';
import adminInquiryRoutes from './routes/adminInquiries.js';
import reportingRoutes from './routes/reporting.js';
import { requestLogger } from './middleware/logger.js';
import { sameOriginWrites } from './middleware/origin.js';
import { notFound, errorHandler } from './middleware/errors.js';

const app = express();

// Configuration
const allowedOrigins = [...new Set([
  process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  ...(process.env.NODE_ENV === 'production' ? [] : ['http://localhost:5173', 'http://127.0.0.1:5173'])
])];

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(sameOriginWrites(allowedOrigins));
app.use(express.json({ limit: '64kb' }));
app.use(requestLogger);

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin/inquiries', adminInquiryRoutes);
app.use('/api/admin', reportingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/builds', buildsRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/inquiries', inquiryRoutes);
app.use('/api', coreRoutes);

// A JSON 404 for anything unmatched, then the error handler. Both must stay
// last, and in this order, or they never see the requests they exist for.
app.use(notFound);
app.use(errorHandler);

export default app;