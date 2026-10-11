import { Router } from 'express';
import mongoose from 'mongoose';

const router = Router();

// Readiness rather than liveness: the process can be up while Atlas is not
// reachable, and every other route would fail in that state, so this answers
// 503 instead of pretending to be healthy.
router.get('/', (req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({ database: connected ? 'connected' : 'unavailable' });
});

export default router;