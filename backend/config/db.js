import mongoose from 'mongoose';

export async function connectDatabase(uri) {
  const configurationError = message => { const error = new Error(message); error.code = 'DATABASE_CONFIGURATION'; return error; };
  if (!uri) throw configurationError('Set MONGO_URI in backend/.env before starting the API.');
  if (/<[^>]+>|USERNAME|PASSWORD|YOUR_CLUSTER/.test(uri)) throw configurationError('MONGO_URI still contains a placeholder. Replace the Atlas password placeholder and any example values in backend/.env.');
  let parsed;
  try { parsed = new URL(uri); } catch { throw configurationError('MONGO_URI is not a valid connection URL. Check backend/.env.'); }
  if (!['mongodb:', 'mongodb+srv:'].includes(parsed.protocol)) throw configurationError('MONGO_URI must start with mongodb:// or mongodb+srv://.');
  if (!parsed.pathname || parsed.pathname === '/') throw configurationError('Add /pcbuildplanner before the connection string query (?...) in backend/.env.');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
}
