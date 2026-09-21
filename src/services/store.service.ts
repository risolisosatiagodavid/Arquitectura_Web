import { db } from '../config/database.js';
import type { Store } from '../types/store.js';
import type { CreateStoreInput, UpdateStoreInput } from '../types/store.js';

type StoreRow = {
  id: number;
  store_name: string;
  descripcion: string;
  owner_id: number;
  visibilidad: Store['visibilidad'];
  zona: string | null;
  categoria: string | null;
  telefono: string | null;
};

const toStore = (row: StoreRow): Store => ({
  id: row.id,
  storename: row.store_name,
  descripcion: row.descripcion,
  owner: row.owner_id,
  visibilidad: row.visibilidad,
  ...(row.zona !== null && { zona: row.zona }),
  ...(row.categoria !== null && { categoria: row.categoria }),
  ...(row.telefono !== null && { telefono: row.telefono }),
});

export const listStores = async (filters: {
  nombre?: string;
  zona?: string;
  categoria?: string;
}) => {
  let query = db.selectFrom('stores').selectAll().where('visibilidad', '=', 'publica');

  if (filters.nombre) query = query.where('store_name', 'like', `%${filters.nombre}%`);
  if (filters.zona) query = query.where('zona', '=', filters.zona);
  if (filters.categoria) query = query.where('categoria', '=', filters.categoria);

  const rows = await query.execute();
  return rows.map(toStore);
};

export const findStoreById = async (id: number) => {
  const row = await db.selectFrom('stores')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();

  return row ? toStore(row) : undefined;
};

export const findStoreByName = async (storename: string) => {
  const row = await db.selectFrom('stores')
    .selectAll()
    .where('store_name', '=', storename)
    .executeTakeFirst();

  return row ? toStore(row) : undefined;
};

export const createStore = async (input: CreateStoreInput) => {
  const row = await db.insertInto('stores')
    .values({
      store_name: input.storename,
      descripcion: input.descripcion,
      owner_id: input.owner,
      visibilidad: input.visibilidad,
      zona: input.zona ?? null,
      categoria: input.categoria ?? null,
      telefono: input.telefono ?? null,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return toStore(row);
};

export const updateStore = async (id: number, input: UpdateStoreInput) => {
  const row = await db.updateTable('stores')
    .set({
      ...(input.nombre !== undefined && { store_name: input.nombre }),
      ...(input.descripcion !== undefined && { descripcion: input.descripcion }),
      ...(input.telefono !== undefined && { telefono: input.telefono }),
      ...(input.visibilidad !== undefined && { visibilidad: input.visibilidad }),
      ...(input.zona !== undefined && { zona: input.zona }),
      ...(input.categoria !== undefined && { categoria: input.categoria }),
    })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow();

  return toStore(row);
};

export const deleteStore = async (id: number) => {
  await db.deleteFrom('stores').where('id', '=', id).execute();
};
