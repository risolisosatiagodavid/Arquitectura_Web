import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { db, initializeDatabase } from './config/database.js';
import { createProduct, listProductsByStoreId } from './services/product.service.js';
import { createStore, findStoreByName } from './services/store.service.js';
import { findUserByEmail, registerUser } from './services/user.service.js';
import type { CreateProductInput } from './types/product.js';
import type { RegisterUserInput } from './types/user.js';

const demoBuyer: RegisterUserInput = {
  nombre: 'Alex Demostración',
  email: 'demo@mercadoya.local',
  password: 'Demo1234!',
  domicilio: 'Palermo, Buenos Aires',
};

const demoMerchant: RegisterUserInput = {
  nombre: 'Comercios del Barrio',
  email: 'tiendas@mercadoya.local',
  password: 'Tiendas1234!',
  domicilio: 'Buenos Aires',
};

interface SeedStore {
  storename: string;
  descripcion: string;
  categoria: string;
  zona: string;
  owner: 'demoBuyer' | 'demoMerchant';
  productos: CreateProductInput[];
}

const seedStores: SeedStore[] = [
  {
    storename: 'Rincón de la Plaza',
    descripcion: 'Café de especialidad y pastelería artesanal para disfrutar en el barrio.',
    categoria: 'Gastronomía',
    zona: 'Palermo',
    owner: 'demoBuyer',
    productos: [
      { nombre: 'Café de especialidad', descripcion: 'Paquete de café en grano tostado localmente.', precio: 8500, stock: 8 },
      { nombre: 'Medialunas artesanales', descripcion: 'Media docena recién horneada.', precio: 4800, stock: 3 },
    ],
  },
  {
    storename: 'Hilo Urbano',
    descripcion: 'Prendas cómodas y accesorios hechos por diseñadores independientes.',
    categoria: 'Indumentaria',
    zona: 'Villa Crespo',
    owner: 'demoMerchant',
    productos: [
      { nombre: 'Remera de algodón', descripcion: 'Remera unisex de algodón suave.', precio: 18000, stock: 6 },
      { nombre: 'Bolso de lona', descripcion: 'Bolso reutilizable confeccionado a mano.', precio: 12500, stock: 1 },
    ],
  },
  {
    storename: 'Almacén La Esquina',
    descripcion: 'Productos cotidianos y sabores de pequeños productores.',
    categoria: 'Almacén',
    zona: 'Caballito',
    owner: 'demoMerchant',
    productos: [
      { nombre: 'Miel de campo', descripcion: 'Frasco de miel pura de 500 g.', precio: 6200, stock: 10 },
      { nombre: 'Dulce de leche artesanal', descripcion: 'Dulce de leche tradicional de 450 g.', precio: 5100, stock: 4 },
    ],
  },
  {
    storename: 'Pixel y Papel',
    descripcion: 'Accesorios tecnológicos útiles para trabajar y crear.',
    categoria: 'Tecnología',
    zona: 'Belgrano',
    owner: 'demoMerchant',
    productos: [
      { nombre: 'Soporte para notebook', descripcion: 'Soporte plegable de aluminio.', precio: 22000, stock: 2 },
      { nombre: 'Cable USB-C', descripcion: 'Cable reforzado de carga rápida.', precio: 7800, stock: 0 },
    ],
  },
  {
    storename: 'Mundo Mini',
    descripcion: 'Juguetes para imaginar, construir y compartir.',
    categoria: 'Juguetería',
    zona: 'Almagro',
    owner: 'demoMerchant',
    productos: [
      { nombre: 'Bloques de madera', descripcion: 'Set de construcción de 30 piezas.', precio: 14500, stock: 5 },
      { nombre: 'Rompecabezas del barrio', descripcion: 'Rompecabezas ilustrado de 100 piezas.', precio: 8900, stock: 2 },
    ],
  },
  {
    storename: 'Punto y Coma',
    descripcion: 'Libros, cuadernos y papelería para lectores y estudiantes.',
    categoria: 'Librería',
    zona: 'Recoleta',
    owner: 'demoMerchant',
    productos: [
      { nombre: 'Cuaderno rayado', descripcion: 'Cuaderno artesanal de 80 hojas.', precio: 5600, stock: 7 },
      { nombre: 'Set de marcadores', descripcion: 'Seis marcadores de colores.', precio: 7300, stock: 3 },
    ],
  },
  {
    storename: 'Pequeños Detalles',
    descripcion: 'Regalos originales preparados con dedicación.',
    categoria: 'Regalos',
    zona: 'Chacarita',
    owner: 'demoMerchant',
    productos: [
      { nombre: 'Vela aromática', descripcion: 'Vela de soja con aroma a lavanda.', precio: 9500, stock: 4 },
      { nombre: 'Tarjeta ilustrada', descripcion: 'Tarjeta impresa en papel reciclado.', precio: 2800, stock: 9 },
    ],
  },
  {
    storename: 'Bazar Nube',
    descripcion: 'Hallazgos prácticos y coloridos para todos los días.',
    categoria: 'Chinerías',
    zona: 'Once',
    owner: 'demoMerchant',
    productos: [
      { nombre: 'Botella térmica', descripcion: 'Botella reutilizable de acero inoxidable.', precio: 11500, stock: 5 },
      { nombre: 'Organizador multiuso', descripcion: 'Organizador compacto para el hogar.', precio: 6400, stock: 2 },
    ],
  },
  {
    storename: 'Casa en Calma',
    descripcion: 'Textiles y objetos simples para hacer más lindo tu hogar.',
    categoria: 'Hogar',
    zona: 'Villa Devoto',
    owner: 'demoMerchant',
    productos: [
      { nombre: 'Almohadón de lino', descripcion: 'Funda de lino natural de 40 × 40 cm.', precio: 16800, stock: 3 },
      { nombre: 'Maceta de cerámica', descripcion: 'Maceta esmaltada hecha a mano.', precio: 10200, stock: 6 },
    ],
  },
  {
    storename: 'Botánica Cercana',
    descripcion: 'Cuidado personal con ingredientes de origen natural.',
    categoria: 'Belleza y cuidado personal',
    zona: 'Nuñez',
    owner: 'demoMerchant',
    productos: [
      { nombre: 'Jabón vegetal', descripcion: 'Jabón artesanal de avena y caléndula.', precio: 3900, stock: 8 },
      { nombre: 'Crema de manos', descripcion: 'Crema hidratante de rápida absorción.', precio: 7200, stock: 0 },
    ],
  },
  {
    storename: 'Patitas Felices',
    descripcion: 'Accesorios y cuidados para los compañeros de cuatro patas.',
    categoria: 'Mascotas',
    zona: 'Colegiales',
    owner: 'demoMerchant',
    productos: [
      { nombre: 'Juguete mordillo', descripcion: 'Mordillo resistente para perros medianos.', precio: 6800, stock: 4 },
      { nombre: 'Comedero de acero', descripcion: 'Comedero antideslizante fácil de limpiar.', precio: 9200, stock: 7 },
    ],
  },
  {
    storename: 'Aire Libre',
    descripcion: 'Equipo liviano para moverte y disfrutar afuera.',
    categoria: 'Deportes y aire libre',
    zona: 'Parque Chas',
    owner: 'demoMerchant',
    productos: [
      { nombre: 'Botella deportiva', descripcion: 'Botella liviana de 750 ml.', precio: 8500, stock: 5 },
      { nombre: 'Banda elástica', descripcion: 'Banda de resistencia para entrenamiento.', precio: 5900, stock: 1 },
    ],
  },
  {
    storename: 'Manos a la Obra',
    descripcion: 'Herramientas y materiales para arreglos y proyectos creativos.',
    categoria: 'Ferretería y construcción',
    zona: 'Flores',
    owner: 'demoMerchant',
    productos: [
      { nombre: 'Set de destornilladores', descripcion: 'Set de seis destornilladores de precisión.', precio: 12400, stock: 2 },
      { nombre: 'Cinta métrica', descripcion: 'Cinta métrica retráctil de cinco metros.', precio: 4600, stock: 10 },
    ],
  },
  {
    storename: 'Bienestar Natural',
    descripcion: 'Opciones simples para acompañar tus rutinas de bienestar.',
    categoria: 'Salud y bienestar',
    zona: 'San Telmo',
    owner: 'demoMerchant',
    productos: [
      { nombre: 'Infusión relajante', descripcion: 'Blend de hierbas en hebras, 50 g.', precio: 5700, stock: 6 },
      { nombre: 'Almohadilla térmica', descripcion: 'Almohadilla reutilizable de semillas.', precio: 13200, stock: 3 },
    ],
  },
  {
    storename: 'Taller de Ideas',
    descripcion: 'Objetos únicos y creaciones originales de artistas locales.',
    categoria: 'Otros',
    zona: 'La Paternal',
    owner: 'demoMerchant',
    productos: [
      { nombre: 'Lámina ilustrada', descripcion: 'Ilustración original impresa en tamaño A4.', precio: 7800, stock: 4 },
      { nombre: 'Pin esmaltado', descripcion: 'Pin coleccionable diseñado en el barrio.', precio: 3500, stock: 8 },
    ],
  },
];

const ensureDemoUser = async (input: RegisterUserInput): Promise<number> => {
  const existingUser = await findUserByEmail(input.email);
  if (existingUser) return existingUser.id;

  const user = await registerUser(input);
  return user.id;
};

export const seedDatabase = async (): Promise<{ stores: number; products: number }> => {
  await initializeDatabase();
  const ownerIds = {
    demoBuyer: await ensureDemoUser(demoBuyer),
    demoMerchant: await ensureDemoUser(demoMerchant),
  };
  let createdStores = 0;
  let createdProducts = 0;

  for (const storeInput of seedStores) {
    let store = await findStoreByName(storeInput.storename);
    const owner = ownerIds[storeInput.owner];

    if (store) {
      if (store.owner !== owner || store.categoria !== storeInput.categoria) {
        throw new Error(`La tienda "${storeInput.storename}" ya existe con otros datos; no se modificó`);
      }
    } else {
      store = await createStore({
        storename: storeInput.storename,
        descripcion: storeInput.descripcion,
        categoria: storeInput.categoria,
        zona: storeInput.zona,
        owner,
        visibilidad: 'publica',
      });
      createdStores += 1;
    }

    const existingProducts = await listProductsByStoreId(store.id);
    const existingNames = new Set(existingProducts.map((product) => product.nombre));
    for (const product of storeInput.productos) {
      if (existingNames.has(product.nombre)) continue;
      await createProduct(store.id, product);
      createdProducts += 1;
    }
  }

  return { stores: createdStores, products: createdProducts };
};

const isEntryPoint = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntryPoint) {
  try {
    const result = await seedDatabase();
    console.log(`Seed listo: ${result.stores} tiendas y ${result.products} productos creados.`);
    console.log('Cuentas de demostración:');
    console.log(`  ${demoBuyer.email} / ${demoBuyer.password}`);
    console.log(`  ${demoMerchant.email} / ${demoMerchant.password}`);
  } catch (error) {
    console.error('No se pudo cargar el seed de demostración.', error);
    process.exitCode = 1;
  } finally {
    await db.destroy();
  }
}
