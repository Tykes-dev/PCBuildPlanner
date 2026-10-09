import 'dotenv/config';
import app from './app.js';
import { connectDatabase } from './config/db.js';
import { validateAuthConfig } from './services/auth.js';
try {
  validateAuthConfig();
  await connectDatabase(process.env.MONGO_URI);
  app.listen(process.env.PORT || 3001, () => console.log(`PC Build Planner API listening on port ${process.env.PORT || 3001}`));
} catch (error) {
  if (error.code === 'AUTH_CONFIGURATION' || error.code === 'DATABASE_CONFIGURATION') console.error(error.message);
  else console.error('Database connection failed. Check backend/.env, database credentials, and Atlas network access.');
  process.exitCode = 1;
}
