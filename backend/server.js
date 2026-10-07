import 'dotenv/config';
import app from './app.js';
import { connectDatabase } from './config/db.js';
try {
  await connectDatabase(process.env.MONGO_URI);
  app.listen(process.env.PORT || 3001, () => console.log(`PC Build Planner API listening on port ${process.env.PORT || 3001}`));
} catch (error) {
  console.error(error.name === 'Error' && !process.env.MONGO_URI ? error.message : 'Database connection failed. Check backend/.env, database credentials, and Atlas network access.');
  process.exitCode = 1;
}
