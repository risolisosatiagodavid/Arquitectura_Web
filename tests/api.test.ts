import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, before, beforeEach, describe, it } from 'node:test';

process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret';

const [{ default: app }, { db, initializeDatabase }] = await Promise.all([
  import('../src/app.js'),
  import('../src/config/database.js'),
]);

type TestServer = ReturnType<typeof app.listen>;
type AuthenticatedUser = { id: number; token: string };

let server: TestServer;
let baseUrl: string;

const jsonRequest = async (path: string, options: RequestInit = {}) => {
  const headers = new Headers(options.headers);
  headers.set('content-type', 'application/json');

  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });
};

const registerUser = async (suffix = `${Date.now()}-${Math.random()}`): Promise<AuthenticatedUser> => {
  const email = `test-${suffix}@example.com`;
  const registration = await jsonRequest('/auth/registro', {
    method: 'POST',
    body: JSON.stringify({
      nombre: 'Test User',
      email,
      password: 'secret123',
      domicilio: 'Buenos Aires',
    }),
  });
  const user = await registration.json() as { id: number };
  const login = await jsonRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: 'secret123' }),
  });
  const setCookie = login.headers.get('set-cookie');
  const token = setCookie?.match(/mercado_ya_session=([^;]+)/)?.[1];
  assert.ok(token);

  return { id: user.id, token };
};

const authRequest = (path: string, token: string, options: RequestInit = {}) =>
  jsonRequest(path, {
    ...options,
    headers: {
      ...options.headers,
      cookie: `mercado_ya_session=${token}`,
    },
  });

const createTestStore = async (
  user: AuthenticatedUser,
  name: string,
  visibilidad: 'publica' | 'privada' = 'publica',
) => {
  const response = await authRequest('/tiendas', user.token, {
    method: 'POST',
    body: JSON.stringify({
      storename: name,
      descripcion: 'Descripcion',
      owner: user.id,
      visibilidad,
    }),
  });
  assert.equal(response.status, 201);
  return await response.json() as { id: number };
};

const createTestProduct = async (user: AuthenticatedUser, storeId: number, stock = 8) => {
  const response = await authRequest(`/tiendas/${storeId}/productos`, user.token, {
    method: 'POST',
    body: JSON.stringify({
      nombre: 'Producto de prueba',
      descripcion: 'Descripcion del producto',
      precio: 1250,
      stock,
    }),
  });
  assert.equal(response.status, 201);
  return await response.json() as { id: number };
};

before(async () => {
  await initializeDatabase();
  server = app.listen(0);
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

beforeEach(async () => {
  await db.deleteFrom('products').execute();
  await db.deleteFrom('stores').execute();
  await db.deleteFrom('users').execute();
});

after(() => server.close());

describe('Autenticacion', () => {
  it('returns_400_for_malformed_json', async () => {
    const response = await jsonRequest('/auth/login', {
      method: 'POST',
      body: '{',
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'JSON inválido' });
  });

  it('returns_json_404_for_unknown_routes', async () => {
    const response = await jsonRequest('/ruta-inexistente');

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'Recurso no encontrado' });
  });

  it('register_success_201', async () => {
    const response = await jsonRequest('/auth/registro', {
      method: 'POST',
      body: JSON.stringify({
        nombre: 'Ana',
        email: 'ana@example.com',
        password: 'secret123',
        domicilio: 'Palermo',
      }),
    });

    assert.equal(response.status, 201);
    const cookie = response.headers.get('set-cookie') ?? '';
    assert.match(cookie, /mercado_ya_session=.*HttpOnly/i);
    const user = await response.json() as { id: number; email: string };
    assert.equal(user.email, 'ana@example.com');

    const sessionResponse = await jsonRequest('/auth/sesion', {
      headers: { cookie: cookie.split(';')[0] },
    });
    assert.equal(sessionResponse.status, 200);
    assert.equal((await sessionResponse.json()).user.id, user.id);
  });

  it('register_failure_400', async () => {
    const response = await jsonRequest('/auth/registro', {
      method: 'POST',
      body: JSON.stringify({ email: 'invalid@example.com' }),
    });

    assert.equal(response.status, 400);
  });

  it('register_failure_409', async () => {
    await registerUser('duplicate');
    const response = await jsonRequest('/auth/registro', {
      method: 'POST',
      body: JSON.stringify({
        nombre: 'Duplicate',
        email: 'test-duplicate@example.com',
        password: 'secret123',
        domicilio: 'Palermo',
      }),
    });

    assert.equal(response.status, 409);
  });

  it('login_success_200', async () => {
    const user = await registerUser('login-success');
    assert.ok(user.token);
  });

  it('login_sets_http_only_session_cookie', async () => {
    const email = `cookie-${Date.now()}@example.com`;
    await jsonRequest('/auth/registro', {
      method: 'POST',
      body: JSON.stringify({
        nombre: 'Cookie User',
        email,
        password: 'secret123',
        domicilio: 'Buenos Aires',
      }),
    });

    const response = await jsonRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'secret123' }),
    });

    assert.equal(response.status, 200);
    const cookie = response.headers.get('set-cookie') ?? '';
    assert.match(cookie, /mercado_ya_session=/);
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);
    assert.match(cookie, /Max-Age=3600/i);
    const body = await response.json() as { user: { id: number; email: string; passwordHash?: string }; token?: string };
    assert.ok(Number.isInteger(body.user.id));
    assert.equal(body.user.email, email);
    assert.equal(body.user.passwordHash, undefined);
    assert.equal(body.token, undefined);
  });

  it('session_endpoint_returns_user_and_logout_clears_cookie', async () => {
    const user = await registerUser('session-endpoint');
    const sessionResponse = await authRequest('/auth/sesion', user.token);

    assert.equal(sessionResponse.status, 200);
    assert.equal((await sessionResponse.json()).user.id, user.id);

    const logoutResponse = await authRequest('/auth/logout', user.token, { method: 'POST' });
    assert.equal(logoutResponse.status, 204);
    assert.match(logoutResponse.headers.get('set-cookie') ?? '', /mercado_ya_session=;.*Expires=Thu, 01 Jan 1970/i);

    const unauthenticatedResponse = await jsonRequest('/auth/sesion');
    assert.equal(unauthenticatedResponse.status, 401);
  });

  it('login_failure_400', async () => {
    const response = await jsonRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'missing@example.com' }),
    });

    assert.equal(response.status, 400);
  });

  it('login_failure_401', async () => {
    await registerUser('login-failure');
    const response = await jsonRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'test-login-failure@example.com', password: 'wrong' }),
    });

    assert.equal(response.status, 401);
  });
});

describe('Checkout', () => {
  const submitCheckout = (user: AuthenticatedUser, items: Array<{ productId: number; quantity: number }>) =>
    authRequest('/checkout', user.token, {
      method: 'POST',
      body: JSON.stringify({
        nombre: 'Ana',
        apellido: 'Pérez',
        direccion: 'Calle 123',
        codigoPostal: 'C1000',
        items,
      }),
    });

  it('confirma la compra y descuenta el stock solicitado', async () => {
    const seller = await registerUser('checkout-seller');
    const buyer = await registerUser('checkout-buyer');
    const store = await createTestStore(seller, 'Tienda checkout');
    const product = await createTestProduct(seller, store.id, 5);

    const response = await submitCheckout(buyer, [{ productId: product.id, quantity: 2 }]);

    assert.equal(response.status, 200);
    const stock = await db.selectFrom('products').select('stock')
      .where('id', '=', product.id).executeTakeFirstOrThrow();
    assert.equal(stock.stock, 3);
  });

  it('rechaza la compra sin stock suficiente y no modifica inventario', async () => {
    const seller = await registerUser('checkout-stock-seller');
    const buyer = await registerUser('checkout-stock-buyer');
    const store = await createTestStore(seller, 'Tienda stock checkout');
    const product = await createTestProduct(seller, store.id, 1);

    const response = await submitCheckout(buyer, [{ productId: product.id, quantity: 2 }]);

    assert.equal(response.status, 409);
    const stock = await db.selectFrom('products').select('stock')
      .where('id', '=', product.id).executeTakeFirstOrThrow();
    assert.equal(stock.stock, 1);
  });

  it('revierte todos los descuentos si falta stock en otro producto', async () => {
    const seller = await registerUser('checkout-rollback-seller');
    const buyer = await registerUser('checkout-rollback-buyer');
    const firstStore = await createTestStore(seller, 'Tienda checkout rollback 1');
    const secondStore = await createTestStore(seller, 'Tienda checkout rollback 2');
    const firstProduct = await createTestProduct(seller, firstStore.id, 2);
    const secondProduct = await createTestProduct(seller, secondStore.id, 1);

    const response = await submitCheckout(buyer, [
      { productId: firstProduct.id, quantity: 1 },
      { productId: secondProduct.id, quantity: 2 },
    ]);

    assert.equal(response.status, 409);
    const stocks = await db.selectFrom('products').select(['id', 'stock'])
      .where('id', 'in', [firstProduct.id, secondProduct.id])
      .orderBy('id')
      .execute();
    assert.deepEqual(stocks.map((product) => product.stock), [2, 1]);
  });

  it('no vende dos veces la última unidad en compras simultáneas', async () => {
    const seller = await registerUser('checkout-race-seller');
    const firstBuyer = await registerUser('checkout-race-buyer-1');
    const secondBuyer = await registerUser('checkout-race-buyer-2');
    const store = await createTestStore(seller, 'Tienda checkout simultáneo');
    const product = await createTestProduct(seller, store.id, 1);

    const responses = await Promise.all([
      submitCheckout(firstBuyer, [{ productId: product.id, quantity: 1 }]),
      submitCheckout(secondBuyer, [{ productId: product.id, quantity: 1 }]),
    ]);

    assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
    const stock = await db.selectFrom('products').select('stock')
      .where('id', '=', product.id).executeTakeFirstOrThrow();
    assert.equal(stock.stock, 0);
  });

  it('impide comprar productos de la propia tienda', async () => {
    const owner = await registerUser('checkout-own-store');
    const store = await createTestStore(owner, 'Tienda propia checkout');
    const product = await createTestProduct(owner, store.id);

    const response = await submitCheckout(owner, [{ productId: product.id, quantity: 1 }]);

    assert.equal(response.status, 403);
  });

  it('requiere autenticación y datos válidos', async () => {
    const unauthenticated = await jsonRequest('/checkout', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    assert.equal(unauthenticated.status, 401);

    const user = await registerUser('checkout-invalid');
    const invalid = await authRequest('/checkout', user.token, {
      method: 'POST',
      body: JSON.stringify({ nombre: 'Ana', items: [{ productId: 1, quantity: 0 }] }),
    });
    assert.equal(invalid.status, 400);
  });
});

describe('Usuarios', () => {
  it('getUsuario_success_200', async () => {
    const user = await registerUser('get-success');
    const response = await authRequest(`/usuarios/${user.id}`, user.token);

    assert.equal(response.status, 200);
    assert.equal((await response.json()).id, user.id);
  });

  it('getUsuario_failure_401', async () => {
    const response = await jsonRequest('/usuarios/1');
    assert.equal(response.status, 401);
  });

  it('getUsuario_failure_401_invalid_token', async () => {
    const response = await authRequest('/usuarios/1', 'token-invalido');
    assert.equal(response.status, 401);
  });

  it('getUsuario_failure_403', async () => {
    const owner = await registerUser('get-owner');
    const other = await registerUser('get-other');
    const response = await authRequest(`/usuarios/${owner.id}`, other.token);

    assert.equal(response.status, 403);
  });

  it('getUsuario_failure_404', async () => {
    const user = await registerUser('get-missing');
    const response = await authRequest('/usuarios/99999', user.token);

    assert.equal(response.status, 404);
  });

  it('updateUsuario_success_200', async () => {
    const user = await registerUser('update-success');
    const response = await authRequest(`/usuarios/${user.id}`, user.token, {
      method: 'PATCH',
      body: JSON.stringify({ telefono: '1144445555' }),
    });

    assert.equal(response.status, 200);
    assert.equal((await response.json()).telefono, '1144445555');
  });

  it('updateUsuario_failure_400', async () => {
    const user = await registerUser('update-invalid');
    const response = await authRequest(`/usuarios/${user.id}`, user.token, {
      method: 'PATCH',
      body: JSON.stringify({ telefono: 123 }),
    });

    assert.equal(response.status, 400);
  });

  it('updateUsuario_failure_403', async () => {
    const owner = await registerUser('update-owner');
    const other = await registerUser('update-other');
    const response = await authRequest(`/usuarios/${owner.id}`, other.token, {
      method: 'PATCH',
      body: JSON.stringify({ domicilio: 'Belgrano' }),
    });

    assert.equal(response.status, 403);
  });

  it('updateUsuario_failure_404', async () => {
    const user = await registerUser('update-missing');
    const response = await authRequest('/usuarios/99999', user.token, {
      method: 'PATCH',
      body: JSON.stringify({ domicilio: 'Belgrano' }),
    });

    assert.equal(response.status, 404);
  });
});

describe('Tiendas', () => {
  it('getTiendas_success_200', async () => {
    const user = await registerUser('list-success');
    await authRequest('/tiendas', user.token, {
      method: 'POST',
      body: JSON.stringify({
        storename: 'Tienda Publica',
        descripcion: 'Descripcion',
        owner: user.id,
        visibilidad: 'publica',
      }),
    });

    const response = await jsonRequest('/tiendas');
    assert.equal(response.status, 200);
    assert.equal((await response.json()).length, 1);
  });

  it('getTiendas_failure_400', async () => {
    const response = await jsonRequest('/tiendas?zona=a&zona=b');
    assert.equal(response.status, 400);
  });

  it('getTienda_success_200', async () => {
    const user = await registerUser('get-store-success');
    const created = await authRequest('/tiendas', user.token, {
      method: 'POST',
      body: JSON.stringify({
        storename: 'Tienda Detalle',
        descripcion: 'Descripcion',
        owner: user.id,
        visibilidad: 'publica',
      }),
    });
    const store = await created.json() as { id: number };
    const response = await jsonRequest(`/tiendas/${store.id}`);

    assert.equal(response.status, 200);
    assert.equal((await response.json()).id, store.id);
  });

  it('getTienda_failure_403', async () => {
    const user = await registerUser('private-store');
    const created = await authRequest('/tiendas', user.token, {
      method: 'POST',
      body: JSON.stringify({
        storename: 'Tienda Privada',
        descripcion: 'Descripcion',
        owner: user.id,
        visibilidad: 'privada',
      }),
    });
    const store = await created.json() as { id: number };
    const response = await jsonRequest(`/tiendas/${store.id}`);

    assert.equal(response.status, 403);
  });

  it('getTienda_failure_404', async () => {
    const response = await jsonRequest('/tiendas/99999');
    assert.equal(response.status, 404);
  });

  it('postTienda_success_201', async () => {
    const user = await registerUser('post-success');
    const response = await authRequest('/tiendas', user.token, {
      method: 'POST',
      body: JSON.stringify({
        storename: 'Tienda Nueva',
        descripcion: 'Descripcion',
        owner: user.id,
        visibilidad: 'publica',
        categoria: 'Gastronomía',
      }),
    });

    assert.equal(response.status, 201);
    const createdStore = await response.json() as { id: number; categoria: string };
    assert.equal(createdStore.categoria, 'Gastronomía');

    const catalogResponse = await jsonRequest('/tiendas');
    const catalog = await catalogResponse.json() as Array<{ id: number; categoria: string }>;
    assert.equal(catalog.find((store) => store.id === createdStore.id)?.categoria, 'Gastronomía');
  });

  it('postTienda_failure_401', async () => {
    const response = await jsonRequest('/tiendas', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 401);
  });

  it('postTienda_failure_400', async () => {
    const user = await registerUser('post-invalid');
    const response = await authRequest('/tiendas', user.token, {
      method: 'POST',
      body: JSON.stringify({ storename: 'Invalida', owner: user.id }),
    });
    assert.equal(response.status, 400);
  });

  it('postTienda_failure_409', async () => {
    const user = await registerUser('post-duplicate');
    const body = JSON.stringify({
      storename: 'Tienda Duplicada',
      descripcion: 'Descripcion',
      owner: user.id,
      visibilidad: 'publica',
    });
    await authRequest('/tiendas', user.token, { method: 'POST', body });
    const response = await authRequest('/tiendas', user.token, { method: 'POST', body });

    assert.equal(response.status, 409);
  });

  it('postProducto_success_201', async () => {
    const user = await registerUser('post-product-success');
    const createdStore = await authRequest('/tiendas', user.token, {
      method: 'POST',
      body: JSON.stringify({
        storename: 'Tienda con productos',
        descripcion: 'Descripcion',
        owner: user.id,
        visibilidad: 'publica',
      }),
    });
    const store = await createdStore.json() as { id: number };
    const response = await authRequest(`/tiendas/${store.id}/productos`, user.token, {
      method: 'POST',
      body: JSON.stringify({
        nombre: 'Producto nuevo',
        descripcion: 'Descripcion del producto',
        precio: 1250.5,
        stock: 8,
      }),
    });

    assert.equal(response.status, 201);
    const product = await response.json() as {
      id: number;
      tienda_id: number;
      nombre: string;
      descripcion: string;
      precio: number;
      stock: number;
    };
    assert.ok(Number.isInteger(product.id));
    assert.deepEqual(product, {
      id: product.id,
      tienda_id: store.id,
      nombre: 'Producto nuevo',
      descripcion: 'Descripcion del producto',
      precio: 1250.5,
      stock: 8,
    });
  });

  it('postProducto_failure_400', async () => {
    const user = await registerUser('post-product-invalid');
    const createdStore = await authRequest('/tiendas', user.token, {
      method: 'POST',
      body: JSON.stringify({
        storename: 'Tienda para producto invalido',
        descripcion: 'Descripcion',
        owner: user.id,
        visibilidad: 'publica',
      }),
    });
    const store = await createdStore.json() as { id: number };
    const response = await authRequest(`/tiendas/${store.id}/productos`, user.token, {
      method: 'POST',
      body: JSON.stringify({
        nombre: 'Producto invalido',
        descripcion: 'Descripcion',
        precio: -1,
        stock: 2.5,
      }),
    });

    assert.equal(response.status, 400);
  });

  it('postProducto_failure_401', async () => {
    const response = await jsonRequest('/tiendas/1/productos', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    assert.equal(response.status, 401);
  });

  it('postProducto_failure_403', async () => {
    const owner = await registerUser('post-product-owner');
    const other = await registerUser('post-product-other');
    const createdStore = await authRequest('/tiendas', owner.token, {
      method: 'POST',
      body: JSON.stringify({
        storename: 'Tienda ajena',
        descripcion: 'Descripcion',
        owner: owner.id,
        visibilidad: 'publica',
      }),
    });
    const store = await createdStore.json() as { id: number };
    const response = await authRequest(`/tiendas/${store.id}/productos`, other.token, {
      method: 'POST',
      body: JSON.stringify({
        nombre: 'Producto de otro',
        descripcion: 'Descripcion',
        precio: 10,
        stock: 1,
      }),
    });

    assert.equal(response.status, 403);
  });

  it('postProducto_failure_404', async () => {
    const user = await registerUser('post-product-missing-store');
    const response = await authRequest('/tiendas/99999/productos', user.token, {
      method: 'POST',
      body: JSON.stringify({
        nombre: 'Producto',
        descripcion: 'Descripcion',
        precio: 10,
        stock: 1,
      }),
    });

    assert.equal(response.status, 404);
  });

  it('getProductos_success_200', async () => {
    const user = await registerUser('list-products');
    const store = await createTestStore(user, 'Tienda listado productos');
    await createTestProduct(user, store.id);
    await createTestProduct(user, store.id);

    const response = await jsonRequest(`/tiendas/${store.id}/productos`);

    assert.equal(response.status, 200);
    const products = await response.json() as Array<{ tienda_id: number }>;
    assert.equal(products.length, 2);
    assert.ok(products.every((product) => product.tienda_id === store.id));
  });

  it('getProductos_failure_403_for_private_store', async () => {
    const owner = await registerUser('list-private-products-owner');
    const visitor = await registerUser('list-private-products-visitor');
    const store = await createTestStore(owner, 'Tienda privada listado productos', 'privada');
    await createTestProduct(owner, store.id);

    const response = await authRequest(`/tiendas/${store.id}/productos`, visitor.token);

    assert.equal(response.status, 403);
    const ownerResponse = await authRequest(`/tiendas/${store.id}/productos`, owner.token);
    assert.equal(ownerResponse.status, 200);
  });

  it('getProductos_failure_404', async () => {
    const response = await jsonRequest('/tiendas/99999/productos');
    assert.equal(response.status, 404);
  });

  it('getProducto_success_200', async () => {
    const owner = await registerUser('get-product');
    const store = await createTestStore(owner, 'Tienda get producto');
    const product = await createTestProduct(owner, store.id);

    const response = await jsonRequest(`/productos/${product.id}`);

    assert.equal(response.status, 200);
    assert.equal((await response.json()).id, product.id);
  });

  it('getProducto_failure_403_for_private_store', async () => {
    const owner = await registerUser('get-private-product-owner');
    const store = await createTestStore(owner, 'Tienda privada get producto', 'privada');
    const product = await createTestProduct(owner, store.id);

    const response = await jsonRequest(`/productos/${product.id}`);

    assert.equal(response.status, 403);
  });

  it('getProducto_failure_404', async () => {
    const response = await jsonRequest('/productos/99999');
    assert.equal(response.status, 404);
  });

  it('patchProducto_success_200', async () => {
    const owner = await registerUser('patch-product');
    const store = await createTestStore(owner, 'Tienda patch producto');
    const product = await createTestProduct(owner, store.id);

    const response = await authRequest(`/productos/${product.id}`, owner.token, {
      method: 'PATCH',
      body: JSON.stringify({ precio: 999.5, stock: 3 }),
    });

    assert.equal(response.status, 200);
    const updated = await response.json();
    assert.equal(updated.precio, 999.5);
    assert.equal(updated.stock, 3);
    assert.equal(updated.nombre, 'Producto de prueba');
  });

  it('patchProducto_failure_400', async () => {
    const owner = await registerUser('patch-product-invalid');
    const store = await createTestStore(owner, 'Tienda patch producto invalido');
    const product = await createTestProduct(owner, store.id);

    const response = await authRequest(`/productos/${product.id}`, owner.token, {
      method: 'PATCH',
      body: JSON.stringify({ stock: -1 }),
    });

    assert.equal(response.status, 400);
  });

  it('patchProducto_failure_403', async () => {
    const owner = await registerUser('patch-product-owner');
    const visitor = await registerUser('patch-product-visitor');
    const store = await createTestStore(owner, 'Tienda patch ajeno');
    const product = await createTestProduct(owner, store.id);

    const response = await authRequest(`/productos/${product.id}`, visitor.token, {
      method: 'PATCH',
      body: JSON.stringify({ stock: 4 }),
    });

    assert.equal(response.status, 403);
  });

  it('patchProducto_failure_404', async () => {
    const owner = await registerUser('patch-product-missing');
    const response = await authRequest('/productos/99999', owner.token, {
      method: 'PATCH',
      body: JSON.stringify({ stock: 4 }),
    });

    assert.equal(response.status, 404);
  });

  it('deleteProducto_success_204', async () => {
    const owner = await registerUser('delete-product');
    const store = await createTestStore(owner, 'Tienda delete producto');
    const product = await createTestProduct(owner, store.id);

    const response = await authRequest(`/productos/${product.id}`, owner.token, { method: 'DELETE' });

    assert.equal(response.status, 204);
    const missing = await jsonRequest(`/productos/${product.id}`);
    assert.equal(missing.status, 404);
  });

  it('deleteProducto_failure_403', async () => {
    const owner = await registerUser('delete-product-owner');
    const visitor = await registerUser('delete-product-visitor');
    const store = await createTestStore(owner, 'Tienda delete ajeno');
    const product = await createTestProduct(owner, store.id);

    const response = await authRequest(`/productos/${product.id}`, visitor.token, { method: 'DELETE' });

    assert.equal(response.status, 403);
  });

  it('deleteProducto_failure_404', async () => {
    const owner = await registerUser('delete-product-missing');
    const response = await authRequest('/productos/99999', owner.token, { method: 'DELETE' });
    assert.equal(response.status, 404);
  });

  it('deleteProducto_failure_401', async () => {
    const response = await jsonRequest('/productos/1', { method: 'DELETE' });
    assert.equal(response.status, 401);
  });

  it('patchTienda_success_200', async () => {
    const user = await registerUser('patch-success');
    const created = await authRequest('/tiendas', user.token, {
      method: 'POST',
      body: JSON.stringify({
        storename: 'Tienda Editable',
        descripcion: 'Descripcion',
        owner: user.id,
        visibilidad: 'publica',
      }),
    });
    const store = await created.json() as { id: number };
    const response = await authRequest(`/tiendas/${store.id}`, user.token, {
      method: 'PATCH',
      body: JSON.stringify({ telefono: '1144445555' }),
    });

    assert.equal(response.status, 200);
  });

  it('patchTienda_failure_400', async () => {
    const user = await registerUser('patch-invalid');
    const created = await authRequest('/tiendas', user.token, {
      method: 'POST',
      body: JSON.stringify({
        storename: 'Tienda Payload Invalido',
        descripcion: 'Descripcion',
        owner: user.id,
        visibilidad: 'publica',
      }),
    });
    const store = await created.json() as { id: number };
    const response = await authRequest(`/tiendas/${store.id}`, user.token, {
      method: 'PATCH',
      body: JSON.stringify({ telefono: 123 }),
    });
    assert.equal(response.status, 400);
  });

  it('patchTienda_failure_404', async () => {
    const user = await registerUser('patch-missing');
    const response = await authRequest('/tiendas/99999', user.token, {
      method: 'PATCH',
      body: JSON.stringify({ telefono: '1144445555' }),
    });

    assert.equal(response.status, 404);
  });

  it('patchTienda_failure_403', async () => {
    const owner = await registerUser('patch-owner');
    const other = await registerUser('patch-other');
    const created = await authRequest('/tiendas', owner.token, {
      method: 'POST',
      body: JSON.stringify({
        storename: 'Tienda Ajena',
        descripcion: 'Descripcion',
        owner: owner.id,
        visibilidad: 'publica',
      }),
    });
    const store = await created.json() as { id: number };
    const response = await authRequest(`/tiendas/${store.id}`, other.token, {
      method: 'PATCH',
      body: JSON.stringify({ telefono: '1144445555' }),
    });

    assert.equal(response.status, 403);
  });

  it('deleteTienda_success_204', async () => {
    const user = await registerUser('delete-success');
    const created = await authRequest('/tiendas', user.token, {
      method: 'POST',
      body: JSON.stringify({
        storename: 'Tienda Eliminable',
        descripcion: 'Descripcion',
        owner: user.id,
        visibilidad: 'publica',
      }),
    });
    const store = await created.json() as { id: number };
    const response = await authRequest(`/tiendas/${store.id}`, user.token, { method: 'DELETE' });

    assert.equal(response.status, 204);
  });

  it('deleteTienda_failure_403', async () => {
    const owner = await registerUser('delete-owner');
    const other = await registerUser('delete-other');
    const created = await authRequest('/tiendas', owner.token, {
      method: 'POST',
      body: JSON.stringify({
        storename: 'Tienda Protegida',
        descripcion: 'Descripcion',
        owner: owner.id,
        visibilidad: 'publica',
      }),
    });
    const store = await created.json() as { id: number };
    const response = await authRequest(`/tiendas/${store.id}`, other.token, { method: 'DELETE' });

    assert.equal(response.status, 403);
  });

  it('deleteTienda_failure_404', async () => {
    const user = await registerUser('delete-missing');
    const response = await authRequest('/tiendas/99999', user.token, { method: 'DELETE' });

    assert.equal(response.status, 404);
  });
});
