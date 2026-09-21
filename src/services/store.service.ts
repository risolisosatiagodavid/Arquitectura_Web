import type { CreateStoreInput, Store, UpdateStoreInput } from '../types/store.js';

const stores: Store[] = [];
let nextStoreId = 1;

export const listStores = (filters: {
  nombre?: string;
  zona?: string;
  categoria?: string;
}) => stores.filter((store) => store.visibilidad === 'publica').filter((store) => {
  const matchesName = !filters.nombre
    || store.storename.toLowerCase().includes(filters.nombre.toLowerCase());
  const matchesZone = !filters.zona
    || store.zona?.toLowerCase() === filters.zona.toLowerCase();
  const matchesCategory = !filters.categoria
    || store.categoria?.toLowerCase() === filters.categoria.toLowerCase();

  return matchesName && matchesZone && matchesCategory;
});

export const findStoreById = (id: number) => stores.find((store) => store.id === id);

export const findStoreByName = (storename: string) =>
  stores.find((store) => store.storename.toLowerCase() === storename.toLowerCase());

export const createStore = (input: CreateStoreInput) => {
  const store: Store = { id: nextStoreId++, ...input };
  stores.push(store);
  return store;
};

export const updateStore = (store: Store, input: UpdateStoreInput) => {
  if (input.nombre !== undefined) {
    store.storename = input.nombre;
  }

  Object.assign(store, {
    ...(input.descripcion !== undefined && { descripcion: input.descripcion }),
    ...(input.telefono !== undefined && { telefono: input.telefono }),
    ...(input.visibilidad !== undefined && { visibilidad: input.visibilidad }),
    ...(input.zona !== undefined && { zona: input.zona }),
    ...(input.categoria !== undefined && { categoria: input.categoria }),
  });

  return store;
};

export const deleteStore = (store: Store) => {
  const storeIndex = stores.indexOf(store);
  stores.splice(storeIndex, 1);
};