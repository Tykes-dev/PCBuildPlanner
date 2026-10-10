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
  console.error(error.name === 'Error' && !process.env.MONGO_URI ? error.message : 'Database connection failed. Check backend/.env, database credentials, and Atlas network access.');
  process.exitCode = 1;
}



