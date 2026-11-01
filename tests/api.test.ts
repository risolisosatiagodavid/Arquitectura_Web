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
  it('login_WithMalformedJson_ReturnsBadRequest', async () => {
    const response = await jsonRequest('/auth/login', {
      method: 'POST',
      body: '{',
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'JSON inválido' });
  });

  it('request_UnknownRoute_ReturnsNotFound', async () => {
    const response = await jsonRequest('/ruta-inexistente');

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'Recurso no encontrado' });
  });

  it('register_WithValidData_ReturnsCreatedUser', async () => {
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

  it('register_WithMissingFields_ReturnsBadRequest', async () => {
    const response = await jsonRequest('/auth/registro', {
      method: 'POST',
      body: JSON.stringify({ email: 'invalid@example.com' }),
    });

    assert.equal(response.status, 400);
  });

  it('register_WithExistingEmail_ReturnsConflict', async () => {
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

  it('login_WithValidCredentials_ReturnsSession', async () => {
    const user = await registerUser('login-success');
    assert.ok(user.token);
  });

  it('login_WithValidCredentials_SetsHttpOnlySessionCookie', async () => {
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

  it('session_WithAuthenticatedUser_ReturnsUserAndLogoutClearsCookie', async () => {
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

  it('login_WithMissingFields_ReturnsBadRequest', async () => {
    const response = await jsonRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'missing@example.com' }),
    });

    assert.equal(response.status, 400);
  });

  it('login_WithInvalidCredentials_ReturnsUnauthorized', async () => {
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

  it('checkout_WithAvailableStock_ConfirmsPurchaseAndDecreasesStock', async () => {
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

  it('checkout_WithInsufficientStock_RejectsPurchaseWithoutChangingInventory', async () => {
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

  it('checkout_WithInsufficientStockForOneItem_RollsBackAllStockChanges', async () => {
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

  it('checkout_WithConcurrentRequestsForLastUnit_AllowsOnlyOnePurchase', async () => {
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

  it('checkout_WithOwnStoreProduct_RejectsPurchase', async () => {
    const owner = await registerUser('checkout-own-store');
    const store = await createTestStore(owner, 'Tienda propia checkout');
    const product = await createTestProduct(owner, store.id);

    const response = await submitCheckout(owner, [{ productId: product.id, quantity: 1 }]);

    assert.equal(response.status, 403);
  });

  it('checkout_WithoutAuthenticationOrValidData_ReturnsError', async () => {
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
  it('getUser_WithOwnId_ReturnsUser', async () => {
    const user = await registerUser('get-success');
    const response = await authRequest(`/usuarios/${user.id}`, user.token);

    assert.equal(response.status, 200);
    assert.equal((await response.json()).id, user.id);
  });

  it('getUser_WithoutAuthentication_ReturnsUnauthorized', async () => {
    const response = await jsonRequest('/usuarios/1');
    assert.equal(response.status, 401);
  });

  it('getUser_WithInvalidToken_ReturnsUnauthorized', async () => {
    const response = await authRequest('/usuarios/1', 'token-invalido');
    assert.equal(response.status, 401);
  });

  it('getUser_WithAnotherUsersId_ReturnsForbidden', async () => {
    const owner = await registerUser('get-owner');
    const other = await registerUser('get-other');
    const response = await authRequest(`/usuarios/${owner.id}`, other.token);

    assert.equal(response.status, 403);
  });

  it('getUser_WithUnknownId_ReturnsNotFound', async () => {
    const user = await registerUser('get-missing');
    const response = await authRequest('/usuarios/99999', user.token);

    assert.equal(response.status, 404);
  });

  it('updateUser_WithValidData_ReturnsUpdatedUser', async () => {
    const user = await registerUser('update-success');
    const response = await authRequest(`/usuarios/${user.id}`, user.token, {
      method: 'PATCH',
      body: JSON.stringify({ telefono: '1144445555' }),
    });

    assert.equal(response.status, 200);
    assert.equal((await response.json()).telefono, '1144445555');
  });

  it('updateUser_WithInvalidData_ReturnsBadRequest', async () => {
    const user = await registerUser('update-invalid');
    const response = await authRequest(`/usuarios/${user.id}`, user.token, {
      method: 'PATCH',
      body: JSON.stringify({ telefono: 123 }),
    });

    assert.equal(response.status, 400);
  });

  it('updateUser_WithAnotherUsersId_ReturnsForbidden', async () => {
    const owner = await registerUser('update-owner');
    const other = await registerUser('update-other');
    const response = await authRequest(`/usuarios/${owner.id}`, other.token, {
      method: 'PATCH',
      body: JSON.stringify({ domicilio: 'Belgrano' }),
    });

    assert.equal(response.status, 403);
  });

  it('updateUser_WithUnknownId_ReturnsNotFound', async () => {
    const user = await registerUser('update-missing');
    const response = await authRequest('/usuarios/99999', user.token, {
      method: 'PATCH',
      body: JSON.stringify({ domicilio: 'Belgrano' }),
    });

    assert.equal(response.status, 404);
  });
});

describe('Tiendas', () => {
  it('listStores_WithPublicStores_ReturnsStores', async () => {
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

  it('listStores_WithRepeatedFilter_ReturnsBadRequest', async () => {
    const response = await jsonRequest('/tiendas?zona=a&zona=b');
    assert.equal(response.status, 400);
  });

  it('getStore_WithPublicStoreId_ReturnsStore', async () => {
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

  it('getStore_WithoutAccessToPrivateStore_ReturnsForbidden', async () => {
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

  it('getStore_WithUnknownId_ReturnsNotFound', async () => {
    const response = await jsonRequest('/tiendas/99999');
    assert.equal(response.status, 404);
  });

  it('createStore_WithValidData_ReturnsCreatedStore', async () => {
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

  it('createStore_WithoutAuthentication_ReturnsUnauthorized', async () => {
    const response = await jsonRequest('/tiendas', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 401);
  });

  it('createStore_WithInvalidData_ReturnsBadRequest', async () => {
    const user = await registerUser('post-invalid');
    const response = await authRequest('/tiendas', user.token, {
      method: 'POST',
      body: JSON.stringify({ storename: 'Invalida', owner: user.id }),
    });
    assert.equal(response.status, 400);
  });

  it('createStore_WithDuplicateName_ReturnsConflict', async () => {
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

  it('createProduct_WithValidData_ReturnsCreatedProduct', async () => {
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

  it('createProduct_WithInvalidData_ReturnsBadRequest', async () => {
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

  it('createProduct_WithoutAuthentication_ReturnsUnauthorized', async () => {
    const response = await jsonRequest('/tiendas/1/productos', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    assert.equal(response.status, 401);
  });

  it('createProduct_AsNonOwner_ReturnsForbidden', async () => {
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

  it('createProduct_WithUnknownStore_ReturnsNotFound', async () => {
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

  it('listProducts_WithExistingStore_ReturnsStoreProducts', async () => {
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

  it('listProducts_WithoutAccessToPrivateStore_ReturnsForbidden', async () => {
    const owner = await registerUser('list-private-products-owner');
    const visitor = await registerUser('list-private-products-visitor');
    const store = await createTestStore(owner, 'Tienda privada listado productos', 'privada');
    await createTestProduct(owner, store.id);

    const response = await authRequest(`/tiendas/${store.id}/productos`, visitor.token);

    assert.equal(response.status, 403);
    const ownerResponse = await authRequest(`/tiendas/${store.id}/productos`, owner.token);
    assert.equal(ownerResponse.status, 200);
  });

  it('listProducts_WithUnknownStore_ReturnsNotFound', async () => {
    const response = await jsonRequest('/tiendas/99999/productos');
    assert.equal(response.status, 404);
  });

  it('getProduct_WithExistingProduct_ReturnsProduct', async () => {
    const owner = await registerUser('get-product');
    const store = await createTestStore(owner, 'Tienda get producto');
    const product = await createTestProduct(owner, store.id);

    const response = await jsonRequest(`/productos/${product.id}`);

    assert.equal(response.status, 200);
    assert.equal((await response.json()).id, product.id);
  });

  it('getProduct_WithoutAccessToPrivateStore_ReturnsForbidden', async () => {
    const owner = await registerUser('get-private-product-owner');
    const store = await createTestStore(owner, 'Tienda privada get producto', 'privada');
    const product = await createTestProduct(owner, store.id);

    const response = await jsonRequest(`/productos/${product.id}`);

    assert.equal(response.status, 403);
  });

  it('getProduct_WithUnknownId_ReturnsNotFound', async () => {
    const response = await jsonRequest('/productos/99999');
    assert.equal(response.status, 404);
  });

  it('updateProduct_WithValidData_ReturnsUpdatedProduct', async () => {
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

  it('updateProduct_WithInvalidData_ReturnsBadRequest', async () => {
    const owner = await registerUser('patch-product-invalid');
    const store = await createTestStore(owner, 'Tienda patch producto invalido');
    const product = await createTestProduct(owner, store.id);

    const response = await authRequest(`/productos/${product.id}`, owner.token, {
      method: 'PATCH',
      body: JSON.stringify({ stock: -1 }),
    });

    assert.equal(response.status, 400);
  });

  it('updateProduct_AsNonOwner_ReturnsForbidden', async () => {
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

  it('updateProduct_WithUnknownId_ReturnsNotFound', async () => {
    const owner = await registerUser('patch-product-missing');
    const response = await authRequest('/productos/99999', owner.token, {
      method: 'PATCH',
      body: JSON.stringify({ stock: 4 }),
    });

    assert.equal(response.status, 404);
  });

  it('deleteProduct_AsOwner_ReturnsNoContent', async () => {
    const owner = await registerUser('delete-product');
    const store = await createTestStore(owner, 'Tienda delete producto');
    const product = await createTestProduct(owner, store.id);

    const response = await authRequest(`/productos/${product.id}`, owner.token, { method: 'DELETE' });

    assert.equal(response.status, 204);
    const missing = await jsonRequest(`/productos/${product.id}`);
    assert.equal(missing.status, 404);
  });

  it('deleteProduct_AsNonOwner_ReturnsForbidden', async () => {
    const owner = await registerUser('delete-product-owner');
    const visitor = await registerUser('delete-product-visitor');
    const store = await createTestStore(owner, 'Tienda delete ajeno');
    const product = await createTestProduct(owner, store.id);

    const response = await authRequest(`/productos/${product.id}`, visitor.token, { method: 'DELETE' });

    assert.equal(response.status, 403);
  });

  it('deleteProduct_WithUnknownId_ReturnsNotFound', async () => {
    const owner = await registerUser('delete-product-missing');
    const response = await authRequest('/productos/99999', owner.token, { method: 'DELETE' });
    assert.equal(response.status, 404);
  });

  it('deleteProduct_WithoutAuthentication_ReturnsUnauthorized', async () => {
    const response = await jsonRequest('/productos/1', { method: 'DELETE' });
    assert.equal(response.status, 401);
  });

  it('updateStore_AsOwner_ReturnsUpdatedStore', async () => {
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

  it('updateStore_WithInvalidData_ReturnsBadRequest', async () => {
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

  it('updateStore_WithUnknownId_ReturnsNotFound', async () => {
    const user = await registerUser('patch-missing');
    const response = await authRequest('/tiendas/99999', user.token, {
      method: 'PATCH',
      body: JSON.stringify({ telefono: '1144445555' }),
    });

    assert.equal(response.status, 404);
  });

  it('updateStore_AsNonOwner_ReturnsForbidden', async () => {
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

  it('deleteStore_AsOwner_ReturnsNoContent', async () => {
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

  it('deleteStore_AsNonOwner_ReturnsForbidden', async () => {
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

  it('deleteStore_WithUnknownId_ReturnsNotFound', async () => {
    const user = await registerUser('delete-missing');
    const response = await authRequest('/tiendas/99999', user.token, { method: 'DELETE' });

    assert.equal(response.status, 404);
  });
});
