import { sql } from 'kysely';

import { db } from '../config/database.js';
import { HttpError } from '../middlewares/error.middleware.js';

export interface CheckoutItem {
  productId: number;
  quantity: number;
}

export const completeCheckout = async (userId: number, items: CheckoutItem[]): Promise<void> => {
  await db.transaction().execute(async (transaction) => {
    const productIds = items.map((item) => item.productId);
    const products = await transaction.selectFrom('products')
      .innerJoin('stores', 'stores.id', 'products.store_id')
      .select([
        'products.id',
        'products.nombre',
        'products.stock',
        'stores.owner_id',
        'stores.visibilidad',
      ])
      .where('products.id', 'in', productIds)
      .execute();
    const productsById = new Map(products.map((product) => [product.id, product]));

    if (productsById.size !== items.length) {
      throw new HttpError(400, 'Uno o más productos ya no están disponibles');
    }

    for (const item of items) {
      const product = productsById.get(item.productId);
      if (!product || product.visibilidad !== 'publica') {
        throw new HttpError(404, 'Uno o más productos ya no están disponibles');
      }

      if (product.owner_id === userId) {
        throw new HttpError(403, 'No podés comprar productos de tu propia tienda');
      }

      if (product.stock < item.quantity) {
        throw new HttpError(409, `${product.nombre}: solo quedan ${product.stock} unidades disponibles`);
      }
    }

    for (const item of items) {
      const result = await transaction.updateTable('products')
        .set({ stock: sql`stock - ${item.quantity}` })
        .where('id', '=', item.productId)
        .where('stock', '>=', item.quantity)
        .returning('id')
        .executeTakeFirst();

      if (!result) {
        const product = productsById.get(item.productId);
        throw new HttpError(409, `${product?.nombre ?? 'El producto'} ya no tiene stock suficiente`);
      }
    }
  });
};
