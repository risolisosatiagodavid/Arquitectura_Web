import { createServer } from 'node:http';

import app from './app.js';
import { initializeDatabase } from './config/database.js';

const port = Number(process.env.PORT) || 8080;

const startServer = async () => {
  await initializeDatabase();

  createServer(app).listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
};

startServer().catch((error: unknown) => {
  console.error('Unable to initialize database', error);
  process.exit(1);
});