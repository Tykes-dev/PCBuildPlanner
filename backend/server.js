import Build from './models/Build.js';
import BuildRequest from './models/BuildRequest.js';
import Component from './models/Component.js';
import User from './models/User.js';
import Session from './models/Session.js';
import 'dotenv/config';
import app from './app.js';
import { connectDatabase } from './config/db.js';

try {
  await connectDatabase(process.env.MONGO_URI);
  await Promise.all([User.init(), Session.init(), Component.init(), Build.init(), BuildRequest.init()]);
  app.listen(process.env.PORT || 3001, () => console.log(`PC Build Planner API listening on port ${process.env.PORT || 3001}`));
} catch (error) {
  if (error.code === 'DATABASE_CONFIGURATION') {
    console.error('Configuration problem: ' + error.message);
  } else {
    console.error('Database connection failed. Check backend/.env, database credentials, and Atlas network access.');
    console.error(error.name + ': ' + error.message);
  }
  process.exitCode = 1;
}