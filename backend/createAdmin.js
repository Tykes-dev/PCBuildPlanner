import 'dotenv/config';
import mongoose from 'mongoose';
import User from './models/User.js';
import { connectDatabase } from './config/db.js';
import { hashPassword } from './services/auth.js';
const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD, MONGO_URI } = process.env;
if (!ADMIN_NAME?.trim() || ADMIN_NAME.trim().length > 80) throw new Error('Set ADMIN_NAME (up to 80 characters).');
if (!ADMIN_EMAIL || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ADMIN_EMAIL.trim())) throw new Error('Set a valid ADMIN_EMAIL.');
if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12 || ADMIN_PASSWORD.length > 128) throw new Error('Set ADMIN_PASSWORD to 12–128 characters.');
try {
  await connectDatabase(MONGO_URI);
  await User.init();
  const email = ADMIN_EMAIL.trim().toLowerCase();
  if (await User.exists({ email })) throw new Error('That email already belongs to an account. Choose another email for the initial admin.');
  const user = await User.create({ name: ADMIN_NAME.trim(), email, passwordHash: await hashPassword(ADMIN_PASSWORD), role: 'admin' });
  console.log('Initial admin created: ' + user.email);
} finally { await mongoose.disconnect(); }
