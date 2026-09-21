import { createServer } from 'node:http';

import app from './app.js';

const port = Number(process.env.PORT) || 8080;

createServer(app).listen(port, () => {
  console.log(`Server running on port ${port}`);
});