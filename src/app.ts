import express from 'express';
import path from 'node:path';

import authRoutes from './routes/auth.routes.js';
import storeRoutes from './routes/store.routes.js';
import userRoutes from './routes/user.routes.js';
import productRoutes from './routes/product.routes.js';
import checkoutRoutes from './routes/checkout.routes.js';
import { errorHandler, notFound } from './middlewares/error.middleware.js';

const app = express();

app.use(express.json());
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/tiendas', storeRoutes);
app.use('/api/v1/productos', productRoutes);
app.use('/api/v1/usuarios', userRoutes);
app.use('/api/v1/checkout', checkoutRoutes);
app.get('/', (_request, response) => response.redirect('/tiendas'));
app.get(['/tiendas', '/tiendas/:storeId', '/checkout'], (_request, response, next) => {
  response.sendFile(path.resolve('frontend/dist/index.html'), (error) => {
    if (error) next(error);
  });
});
app.use(express.static(path.resolve('frontend/dist')));
app.use(notFound);
app.use(errorHandler);

export default app;