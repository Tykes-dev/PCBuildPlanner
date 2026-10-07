import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase } from './config/db.js';
import Component from './models/Component.js';
import AllocationProfile from './models/AllocationProfile.js';
import CheckSetting from './models/CheckSetting.js';
import BalancePair from './models/BalancePair.js';
import { components, profiles, settings, pairs } from './data/catalog.js';
try {
  await connectDatabase(process.env.MONGO_URI);
  // Insert missing sample records only. Reruns preserve existing shop edits.
  for (const { id, ...data } of components) await Component.updateOne({ brand: data.brand, name: data.name }, { $setOnInsert: data }, { upsert: true, runValidators: true });
  for (const data of profiles) {
    const hasDefault = await AllocationProfile.exists({ isDefault: true });
    await AllocationProfile.updateOne({ slug: data.slug }, { $setOnInsert: { ...data, isDefault: data.isDefault && !hasDefault } }, { upsert: true, runValidators: true });
  }
  for (const data of settings) await CheckSetting.updateOne({ code: data.code }, { $setOnInsert: data }, { upsert: true, runValidators: true });
  for (const data of pairs) await BalancePair.updateOne({ categoryA: data.categoryA, categoryB: data.categoryB }, { $setOnInsert: data }, { upsert: true, runValidators: true });
  await Promise.all([Component.init(), AllocationProfile.init(), CheckSetting.init(), BalancePair.init()]);
  console.log('Sample catalog, profiles, check settings, and balance pairs are ready. Existing records were preserved.');
} catch (error) {
  if (error.code === 'DATABASE_CONFIGURATION') console.error(`Seeding failed: ${error.message}`);
  else if (error.code === 18 || error.codeName === 'AuthenticationFailed') console.error('Seeding failed: database authentication failed. Check your database username and password in backend/.env.');
  else if (error.name === 'MongooseServerSelectionError') console.error('Seeding failed: cannot reach the database. Check cluster readiness and Atlas Network Access for your current IP.');
  else if (error.name === 'ValidationError') console.error('Seeding failed: sample data did not satisfy the database schema.');
  else if (error.code === 11000) console.error('Seeding failed: a unique database constraint conflicts with existing records.');
  else console.error('Seeding failed. Check your MongoDB configuration and data constraints.');
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
