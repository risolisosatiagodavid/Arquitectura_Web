import { createServer } from 'node:http';

import app from './app.js';
import { seedDatabase } from './seed.js';

const port = Number(process.env.PORT) || 8080;

const startServer = async () => {
  const seed = await seedDatabase();
  console.log(`Initial data ready: ${seed.stores} stores and ${seed.products} products created.`);

  createServer(app).listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
};

startServer().catch((error: unknown) => {
  console.error('Unable to initialize database', error);
  process.exit(1);
});