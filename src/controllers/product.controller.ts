import type { Request, Response } from 'express';

import { findStoreById } from '../services/store.service.js';
import { createProduct } from '../services/product.service.js';

const parseStoreId = (value: unknown): number | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : undefined;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export const createForStore = async (request: Request, response: Response) => {
  const storeId = parseStoreId(request.params.id);
  const store = storeId ? await findStoreById(storeId) : undefined;

  if (!store) {
    response.status(404).json({ error: 'Tienda no encontrada' });
    return;
  }

  if (request.authenticatedUser?.id !== store.owner) {
    response.status(403).json({ error: 'Solo el dueño puede agregar productos a esta tienda' });
    return;
  }

  const { nombre, descripcion, precio, stock } = request.body ?? {};

  if (!isNonEmptyString(nombre) || !isNonEmptyString(descripcion)
    || typeof precio !== 'number' || !Number.isFinite(precio) || precio < 0
    || !Number.isInteger(stock) || stock < 0) {
    response.status(400).json({
      error: 'nombre y descripcion deben ser textos no vacios; precio debe ser un numero no negativo y stock un entero no negativo',
    });
    return;
  }

  const product = await createProduct(store.id, {
    nombre: nombre.trim(),
    descripcion: descripcion.trim(),
    precio,
    stock,
  });

  response.status(201).json(product);
};
