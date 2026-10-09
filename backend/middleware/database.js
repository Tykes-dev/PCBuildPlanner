import mongoose from 'mongoose';

export function requireDatabase(req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ message: 'Database unavailable. Configure MongoDB Atlas and run the seed command.' });
  }
  next();
}
