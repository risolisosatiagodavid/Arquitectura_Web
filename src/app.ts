import express from 'express';

import authRoutes from './routes/auth.routes.js';
import storeRoutes from './routes/store.routes.js';
import userRoutes from './routes/user.routes.js';

const app = express();

app.use(express.json());
app.use('/auth', authRoutes);
app.use('/tiendas', storeRoutes);
app.use('/usuarios', userRoutes);

export default app;