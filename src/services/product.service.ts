import { db } from '../config/database.js';
import type { CreateProductInput, Product, UpdateProductInput } from '../types/product.js';

const toProduct = (row: {
  id: number;
  store_id: number;
  nombre: string;
  descripcion: string;
  precio: number;
  stock: number;
}): Product => ({
  id: row.id,
  tienda_id: row.store_id,
  nombre: row.nombre,
  descripcion: row.descripcion,
  precio: row.precio,
  stock: row.stock,
});

export const listProductsByStoreId = async (storeId: number): Promise<Product[]> => {
  const rows = await db.selectFrom('products')
    .selectAll()
    .where('store_id', '=', storeId)
    .orderBy('id')
    .execute();

  return rows.map(toProduct);
};

export const findProductById = async (id: number): Promise<Product | undefined> => {
  const row = await db.selectFrom('products')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();

  return row ? toProduct(row) : undefined;
};

export const createProduct = async (storeId: number, input: CreateProductInput): Promise<Product> => {
  const row = await db.insertInto('products')
    .values({
      store_id: storeId,
      nombre: input.nombre,
      descripcion: input.descripcion,
      precio: input.precio,
      stock: input.stock,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return toProduct(row);
};

export const updateProduct = async (id: number, input: UpdateProductInput): Promise<Product> => {
  const row = await db.updateTable('products')
    .set({
      ...(input.nombre !== undefined && { nombre: input.nombre }),
      ...(input.descripcion !== undefined && { descripcion: input.descripcion }),
      ...(input.precio !== undefined && { precio: input.precio }),
      ...(input.stock !== undefined && { stock: input.stock }),
    })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow();

  return toProduct(row);
};

export const deleteProduct = async (id: number): Promise<void> => {
  await db.deleteFrom('products').where('id', '=', id).execute();
};
