import type { Request, Response } from 'express';

import {
  createStore,
  deleteStore,
  findStoreById,
  findStoreByName,
  listStores,
  updateStore,
} from '../services/store.service.js';
import type { StoreVisibility, UpdateStoreInput } from '../types/store.js';

const validVisibilities: StoreVisibility[] = ['publica', 'privada'];

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const parseStoreId = (value: unknown) => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : undefined;
};

export const list = async (request: Request, response: Response) => {
  const { nombre, zona, categoria } = request.query;
  const filters = {
    ...(typeof nombre === 'string' && { nombre }),
    ...(typeof zona === 'string' && { zona }),
    ...(typeof categoria === 'string' && { categoria }),
  };

  if ([nombre, zona, categoria].some((value) => value !== undefined && typeof value !== 'string')) {
    response.status(400).json({ error: 'Los filtros deben ser texto' });
    return;
  }

  response.json(await listStores(filters));
};

export const getById = async (request: Request, response: Response) => {
  const storeId = parseStoreId(request.params.id);
  const store = storeId ? await findStoreById(storeId) : undefined;

  if (!store) {
    response.status(404).json({ error: 'Tienda no encontrada' });
    return;
  }

  if (store.visibilidad === 'privada' && request.authenticatedUser?.id !== store.owner) {
    response.status(403).json({ error: 'La tienda no es visible para este usuario' });
    return;
  }

  response.json(store);
};

export const create = async (request: Request, response: Response) => {
  const { storename, descripcion, owner, visibilidad, zona, categoria, telefono } = request.body ?? {};
  const authenticatedUser = request.authenticatedUser;

  if (!authenticatedUser) {
    response.status(401).json({ error: 'Autenticacion requerida' });
    return;
  }

  if (!isNonEmptyString(storename) || !isNonEmptyString(descripcion)
    || !Number.isInteger(owner) || owner !== authenticatedUser.id
    || !validVisibilities.includes(visibilidad)) {
    response.status(400).json({
      error: 'storename, descripcion, owner y visibilidad son requeridos; owner debe ser el usuario autenticado',
    });
    return;
  }

  if (await findStoreByName(storename.trim())) {
    response.status(409).json({ error: 'Ya existe una tienda con ese nombre' });
    return;
  }

  const store = await createStore({
    storename: storename.trim(),
    descripcion: descripcion.trim(),
    owner,
    visibilidad,
    ...(isNonEmptyString(zona) && { zona: zona.trim() }),
    ...(isNonEmptyString(categoria) && { categoria: categoria.trim() }),
    ...(isNonEmptyString(telefono) && { telefono: telefono.trim() }),
  });

  response.status(201).json(store);
};

export const update = async (request: Request, response: Response) => {
  const storeId = parseStoreId(request.params.id);
  const store = storeId ? await findStoreById(storeId) : undefined;

  if (!store) {
    response.status(404).json({ error: 'Tienda no encontrada' });
    return;
  }

  if (request.authenticatedUser?.id !== store.owner) {
    response.status(403).json({ error: 'Solo el dueño puede modificar esta tienda' });
    return;
  }

  const { nombre, descripcion, telefono, visibilidad, zona, categoria } = request.body ?? {};
  const fields: UpdateStoreInput = { nombre, descripcion, telefono, visibilidad, zona, categoria };

  if (Object.values(fields).some((value) => value !== undefined && !isNonEmptyString(value))) {
    response.status(400).json({ error: 'Los campos deben ser textos no vacios' });
    return;
  }

  if (visibilidad !== undefined && !validVisibilities.includes(visibilidad)) {
    response.status(400).json({ error: 'visibilidad debe ser publica o privada' });
    return;
  }

  response.json(await updateStore(store.id, fields));
};

export const remove = async (request: Request, response: Response) => {
  const storeId = parseStoreId(request.params.id);
  const store = storeId ? await findStoreById(storeId) : undefined;

  if (!store) {
    response.status(404).json({ error: 'Tienda no encontrada' });
    return;
  }

  if (request.authenticatedUser?.id !== store.owner) {
    response.status(403).json({ error: 'Solo el dueño puede eliminar esta tienda' });
    return;
  }

  await deleteStore(store.id);
  response.status(204).send();
};