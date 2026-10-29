import express from 'express';
import path from 'node:path';

import authRoutes from './routes/auth.routes.js';
import storeRoutes from './routes/store.routes.js';
import userRoutes from './routes/user.routes.js';
import productRoutes from './routes/product.routes.js';
import { errorHandler, notFound } from './middlewares/error.middleware.js';

const app = express();

app.use(express.static(path.resolve('frontend/dist')));
app.use(express.json());
app.use('/auth', authRoutes);
app.use('/tiendas', storeRoutes);
app.use('/productos', productRoutes);
app.use('/usuarios', userRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;