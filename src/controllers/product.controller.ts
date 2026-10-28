import type { Request, Response } from 'express';

import { findStoreById } from '../services/store.service.js';
import {
  createProduct,
  deleteProduct,
  findProductById,
  listProductsByStoreId,
  updateProduct,
} from '../services/product.service.js';

const parseStoreId = (value: unknown): number | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : undefined;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const parseProductId = (value: unknown): number | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : undefined;
};

const canViewStore = (store: { visibilidad: string; owner: number }, userId?: number) =>
  store.visibilidad === 'publica' || userId === store.owner;

export const listForStore = async (request: Request, response: Response) => {
  const storeId = parseStoreId(request.params.id);
  const store = storeId ? await findStoreById(storeId) : undefined;

  if (!store) {
    response.status(404).json({ error: 'Tienda no encontrada' });
    return;
  }

  if (!canViewStore(store, request.authenticatedUser?.id)) {
    response.status(403).json({ error: 'La tienda no es visible para este usuario' });
    return;
  }

  response.json(await listProductsByStoreId(store.id));
};

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

export const getById = async (request: Request, response: Response) => {
  const productId = parseProductId(request.params.id);
  const product = productId ? await findProductById(productId) : undefined;

  if (!product) {
    response.status(404).json({ error: 'Producto no encontrado' });
    return;
  }

  const store = await findStoreById(product.tienda_id);
  if (!store) {
    response.status(404).json({ error: 'Producto no encontrado' });
    return;
  }

  if (!canViewStore(store, request.authenticatedUser?.id)) {
    response.status(403).json({ error: 'El producto no es visible para este usuario' });
    return;
  }

  response.json(product);
};

export const update = async (request: Request, response: Response) => {
  const productId = parseProductId(request.params.id);
  const product = productId ? await findProductById(productId) : undefined;

  if (!product) {
    response.status(404).json({ error: 'Producto no encontrado' });
    return;
  }

  const store = await findStoreById(product.tienda_id);
  if (!store) {
    response.status(404).json({ error: 'Producto no encontrado' });
    return;
  }

  if (request.authenticatedUser?.id !== store.owner) {
    response.status(403).json({ error: 'Solo el dueño puede modificar este producto' });
    return;
  }

  const { nombre, descripcion, precio, stock } = request.body ?? {};
  const fields = { nombre, descripcion, precio, stock };

  if (Object.values(fields).every((value) => value === undefined)
    || (nombre !== undefined && !isNonEmptyString(nombre))
    || (descripcion !== undefined && !isNonEmptyString(descripcion))
    || (precio !== undefined && (typeof precio !== 'number' || !Number.isFinite(precio) || precio < 0))
    || (stock !== undefined && (!Number.isInteger(stock) || stock < 0))) {
    response.status(400).json({
      error: 'Envíe al menos un campo válido: nombre y descripcion deben ser textos no vacios, precio un numero no negativo y stock un entero no negativo',
    });
    return;
  }

  response.json(await updateProduct(product.id, {
    ...(nombre !== undefined && { nombre: nombre.trim() }),
    ...(descripcion !== undefined && { descripcion: descripcion.trim() }),
    ...(precio !== undefined && { precio }),
    ...(stock !== undefined && { stock }),
  }));
};

export const remove = async (request: Request, response: Response) => {
  const productId = parseProductId(request.params.id);
  const product = productId ? await findProductById(productId) : undefined;

  if (!product) {
    response.status(404).json({ error: 'Producto no encontrado' });
    return;
  }

  const store = await findStoreById(product.tienda_id);
  if (!store) {
    response.status(404).json({ error: 'Producto no encontrado' });
    return;
  }

  if (request.authenticatedUser?.id !== store.owner) {
    response.status(403).json({ error: 'Solo el dueño puede eliminar este producto' });
    return;
  }

  await deleteProduct(product.id);
  response.status(204).send();
};
