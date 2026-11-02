import { db } from '../config/database.js';

interface InventoryProduct {
  id: number;
  nombre: string;
  precio: number;
  stock: number;
}

interface InventoryStore {
  id: number;
  nombre: string;
  categoria: string | null;
  productCount: number;
  totalUnits: number;
  outOfStockCount: number;
  inventoryValue: number;
  products: InventoryProduct[];
}

export const getInventoryReport = async (ownerId: number) => {
  const rows = await db.selectFrom('stores')
    .leftJoin('products', 'products.store_id', 'stores.id')
    .select([
      'stores.id as storeId',
      'stores.store_name as storeName',
      'stores.categoria as category',
      'products.id as productId',
      'products.nombre as productName',
      'products.precio as price',
      'products.stock as stock',
    ])
    .where('stores.owner_id', '=', ownerId)
    .orderBy('stores.id')
    .orderBy('products.id')
    .execute();

  const stores = new Map<number, InventoryStore>();
  for (const row of rows) {
    let store = stores.get(row.storeId);
    if (!store) {
      store = {
        id: row.storeId,
        nombre: row.storeName,
        categoria: row.category,
        productCount: 0,
        totalUnits: 0,
        outOfStockCount: 0,
        inventoryValue: 0,
        products: [],
      };
      stores.set(store.id, store);
    }

    if (row.productId === null || row.productName === null || row.price === null || row.stock === null) {
      continue;
    }

    store.products.push({
      id: row.productId,
      nombre: row.productName,
      precio: row.price,
      stock: row.stock,
    });
    store.productCount += 1;
    store.totalUnits += row.stock;
    store.inventoryValue += row.price * row.stock;
    if (row.stock === 0) store.outOfStockCount += 1;
  }

  const storeList = [...stores.values()];
  const summary = storeList.reduce((total, store) => ({
    storeCount: total.storeCount + 1,
    productCount: total.productCount + store.productCount,
    totalUnits: total.totalUnits + store.totalUnits,
    outOfStockCount: total.outOfStockCount + store.outOfStockCount,
    inventoryValue: total.inventoryValue + store.inventoryValue,
  }), {
    storeCount: 0,
    productCount: 0,
    totalUnits: 0,
    outOfStockCount: 0,
    inventoryValue: 0,
  });

  return { summary, stores: storeList };
};
