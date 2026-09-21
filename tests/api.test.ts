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
  const { token } = await login.json() as { token: string };

  return { id: user.id, token };
};

const authRequest = (path: string, token: string, options: RequestInit = {}) =>
  jsonRequest(path, {
    ...options,
    headers: {
      ...options.headers,
      authorization: `Bearer ${token}`,
    },
  });

before(async () => {
  await initializeDatabase();
  server = app.listen(0);
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

beforeEach(async () => {
  await db.deleteFrom('stores').execute();
  await db.deleteFrom('users').execute();
});

after(() => server.close());

describe('Autenticacion', () => {
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
    assert.equal((await response.json()).email, 'ana@example.com');
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
      }),
    });

    assert.equal(response.status, 201);
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
