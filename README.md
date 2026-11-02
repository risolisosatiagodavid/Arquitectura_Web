# Mercado Ya

Aplicación web de comercio local desarrollada para el Trabajo Práctico Integrador de Arquitectura Web de la Universidad de Palermo. Permite explorar tiendas y productos, administrar tiendas y catálogos propios y simular compras con validación de stock.

## Funcionalidades

- Registro e inicio de sesión con cookie de sesión `HttpOnly`.
- Catálogo de tiendas públicas, con filtros por nombre, zona y categoría.
- Creación, edición y eliminación de tiendas propias.
- Catálogo de productos por tienda, con creación, edición y eliminación para su dueño.
- Carrito de compras del lado del cliente. No se pueden agregar productos de una tienda propia.
- Checkout autenticado: solicita datos de entrega, verifica el stock y lo descuenta en una transacción. Si algún producto no tiene stock suficiente, no se completa la compra ni se descuenta stock.
- Seed automático de cuentas, tiendas y productos de demostración al iniciar el servidor.

El checkout es una simulación: no se integra una pasarela de pago, no se persiste un historial de órdenes y no se envían facturas por correo. El mensaje de confirmación es únicamente informativo.

## Tecnologías

- Node.js 22 y TypeScript.
- Express para la API REST.
- SQLite para persistencia, con Kysely como query builder y `better-sqlite3` como driver.
- Vue 3 y Vite para el frontend.
- Argon2 para hashes de contraseñas y JWT para sesiones.
- Docker y Docker Compose para construcción y despliegue.

## Requisitos

- Node.js 22.x y npm.
- Docker y Docker Compose, únicamente si se va a ejecutar con contenedores.

## Configuración y ejecución local

Desde la raíz del proyecto:

```bash
npm ci
cp .env.example .env
```

Configurar las variables de `.env`:

| Variable | Descripción | Valor de desarrollo |
|---|---|---|
| `PORT` | Puerto HTTP del backend | `8080` |
| `JWT_SECRET` | Secreto usado para firmar los JWT | Generar uno aleatorio |
| `DB_PATH` | Ruta del archivo SQLite | `data/arqweb.sqlite` |
| `COOKIE_SECURE` | Requiere HTTPS para enviar la cookie | `false` para HTTP local |

Para generar un secreto:

```bash
openssl rand -base64 32
```

No subir `.env` al repositorio. Para desarrollo local con frontend y backend separados, abrir dos terminales:

```bash
npm run dev
```

```bash
npm run frontend:dev
```

Abrir <http://localhost:5173>. Vite sirve el frontend y reenvía al backend las rutas API, incluido `POST /checkout`; la página `GET /checkout` permanece en Vite para conservar el frontend de desarrollo. El servidor backend escucha en el puerto indicado por `PORT` (por defecto, `8080`).

El backend crea las tablas y ejecuta el seed antes de empezar a escuchar. Para cargar manualmente los datos de demostración:

```bash
npm run seed
```

El seed es idempotente: agrega usuarios, tiendas y productos faltantes sin restablecer las contraseñas ni sobrescribir productos existentes.

## Cuentas y datos de demostración

| Uso | Email | Contraseña |
|---|---|---|
| Comprador y dueño de una tienda | `demo@mercadoya.local` | `Demo1234!` |
| Dueño de las otras tiendas | `tiendas@mercadoya.local` | `Tiendas1234!` |

El seed incluye una tienda para cada una de las 15 categorías del catálogo y dos productos por tienda, con stocks de entre 0 y 10 unidades. La cuenta compradora es dueña de una tienda; puede administrarla y comprar productos de las tiendas restantes.

Las credenciales son públicas y están destinadas a las demostraciones del trabajo práctico. No usarlas para información sensible. Si el email ya existe en la base, el seed conserva esa cuenta y su contraseña actual.

## Scripts de npm

| Script | Propósito |
|---|---|
| `npm run dev` | Ejecuta el backend en modo desarrollo con `tsx watch`. |
| `npm run frontend:dev` | Inicia el servidor de desarrollo de Vite. |
| `npm run build` | Valida y compila frontend y backend. |
| `npm run frontend:build` | Valida tipos y compila el frontend. |
| `npm start` | Ejecuta el backend compilado en `dist/`; requiere correr `npm run build` antes. |
| `npm test` | Ejecuta las pruebas HTTP automatizadas. |
| `npm run seed` | Crea las tablas y agrega los datos de demostración faltantes. |
| `npm run commit` | Inicia Commitizen para preparar un commit Conventional Commit. |
| `npm run lint:commits` | Valida mensajes de commit con Commitlint. |
| `npm run release` | Ejecuta semantic-release; el workflow lo usa al integrar cambios a `main`. |

## Pruebas y CI

Las pruebas de endpoints están en `tests/api.test.ts` y se ejecutan con:

```bash
npm test
```

Validar frontend y backend con:

```bash
npm run build
```

GitHub Actions ejecuta instalación reproducible (`npm ci`), validación de mensajes de commit, build y pruebas en pull requests dirigidos a `main`. Al integrar cambios a `main`, el workflow de release vuelve a compilar y probar antes de ejecutar semantic-release.

## Ejecución con Docker Compose

Crear `.env` en la raíz y configurar `JWT_SECRET`. Para desarrollo por HTTP, `COOKIE_SECURE=false`:

```bash
docker compose up --build -d
```

La aplicación queda disponible en <http://localhost:8080>. El contenedor ejecuta el seed al iniciar. SQLite se almacena en el volumen persistente `sqlite-data`; reiniciar o recrear el contenedor conserva los datos.

```bash
docker compose logs -f api
docker compose down
```

Para borrar también los datos persistidos, se puede eliminar el volumen con `docker compose down -v`; esto borra la base SQLite del entorno.

En un despliegue detrás de HTTPS, configurar `COOKIE_SECURE=true`. La cookie de sesión es `HttpOnly`, `SameSite=Lax` y expira junto con el JWT al cabo de una hora.

La imagen Docker tiene tres etapas: `builder` compila el proyecto, `development` ejecuta el backend con Node como usuario no root y `production` utiliza una imagen Distroless con los archivos compilados y las dependencias de producción.

### Ejecutar la etapa Docker de desarrollo

```bash
docker build --target development -t arqweb:development .
docker run --rm -p 8080:8080 --env-file .env \
  -v "$PWD/src:/app/src" \
  -v "$PWD/data:/app/data" \
  arqweb:development
```

## API REST

Los endpoints de API usan JSON. En las rutas protegidas se acepta la cookie de sesión emitida por registro o login. Los errores JSON usan el formato `{ "error": "..." }`.

### Autenticación

| Método y ruta | Descripción | Respuestas |
|---|---|---|
| `POST /auth/registro` | Registra una cuenta e inicia sesión. | `201`, `400`, `409`, `500` |
| `POST /auth/login` | Valida credenciales e inicia sesión. | `200`, `400`, `401`, `500` |
| `GET /auth/sesion` | Devuelve la cuenta de la sesión actual. | `200`, `401` |
| `POST /auth/logout` | Elimina la cookie de sesión. | `204` |

`POST /auth/registro`:

```json
{
  "nombre": "Ana Pérez",
  "email": "ana@example.com",
  "password": "una-clave",
  "domicilio": "Buenos Aires"
}
```

`POST /auth/login`:

```json
{
  "email": "ana@example.com",
  "password": "una-clave"
}
```

La contraseña se persiste como hash Argon2, no como texto plano. Registro y login emiten una cookie `HttpOnly`; el JWT no se devuelve en el cuerpo JSON.

### Usuarios

Todas las rutas requieren autenticación. Cada usuario solo puede consultar o modificar su propia cuenta.

| Método y ruta | Descripción | Respuestas |
|---|---|---|
| `GET /usuarios/:id` | Consulta el perfil del usuario autenticado. | `200`, `401`, `403`, `404` |
| `PATCH /usuarios/:id` | Actualiza datos de perfil. | `200`, `400`, `401`, `403`, `404` |

`PATCH /usuarios/:id` acepta uno o más de estos campos:

```json
{
  "username": "ana",
  "telefono": "1144445555",
  "domicilio": "Palermo, Buenos Aires"
}
```

### Tiendas

`GET /tiendas` lista tiendas públicas. Filtros opcionales: `nombre`, `zona` y `categoria`, por ejemplo `GET /tiendas?categoria=Gastronomía&zona=Palermo`.

| Método y ruta | Descripción | Respuestas |
|---|---|---|
| `GET /tiendas` | Lista tiendas públicas y permite filtrar el catálogo. | `200`, `400` |
| `GET /tiendas/:id` | Consulta una tienda; las privadas solo son visibles para su dueño. | `200`, `401`, `403`, `404` |
| `POST /tiendas` | Crea una tienda para el usuario autenticado. | `201`, `400`, `401`, `409` |
| `PATCH /tiendas/:id` | Actualiza datos de una tienda propia. | `200`, `400`, `401`, `403`, `404` |
| `DELETE /tiendas/:id` | Elimina una tienda propia. | `204`, `401`, `403`, `404` |

`POST /tiendas`:

```json
{
  "storename": "Mi tienda",
  "descripcion": "Productos hechos en el barrio",
  "owner": 1,
  "visibilidad": "publica",
  "categoria": "Regalos",
  "zona": "Palermo",
  "telefono": "1144445555"
}
```

`owner` debe coincidir con el ID del usuario autenticado. `visibilidad` debe ser `publica` o `privada`. `categoria`, `zona` y `telefono` son opcionales.

`PATCH /tiendas/:id` acepta uno o más campos:

```json
{
  "nombre": "Nuevo nombre",
  "descripcion": "Nueva descripción",
  "categoria": "Hogar",
  "zona": "Belgrano",
  "telefono": "1144445555",
  "visibilidad": "publica"
}
```

Los campos de texto enviados deben ser textos no vacíos. Solo el dueño puede crear productos, modificar o eliminar productos, y modificar o eliminar su tienda.

### Productos

| Método y ruta | Descripción | Respuestas |
|---|---|---|
| `GET /tiendas/:id/productos` | Lista los productos visibles de una tienda. | `200`, `401`, `403`, `404` |
| `POST /tiendas/:id/productos` | Crea un producto en una tienda propia. | `201`, `400`, `401`, `403`, `404` |
| `GET /productos/:id` | Consulta un producto visible. | `200`, `401`, `403`, `404` |
| `PATCH /productos/:id` | Modifica uno o más campos de un producto propio. | `200`, `400`, `401`, `403`, `404` |
| `DELETE /productos/:id` | Elimina un producto propio. | `204`, `401`, `403`, `404` |

`POST /tiendas/:id/productos`:

```json
{
  "nombre": "Cuaderno artesanal",
  "descripcion": "Cuaderno de 80 hojas",
  "precio": 5600,
  "stock": 7
}
```

`PATCH /productos/:id` acepta uno o más campos con la misma forma. `nombre` y `descripcion` deben ser textos no vacíos; `precio` debe ser un número no negativo y `stock` un entero no negativo. Las tiendas privadas y sus productos solo son visibles para su dueño.

### Checkout

| Método y ruta | Descripción | Respuestas |
|---|---|---|
| `POST /checkout` | Valida los datos de entrega y el stock, y descuenta las unidades en una transacción. Requiere sesión. | `200`, `400`, `401`, `403`, `404`, `409` |

Payload:

```json
{
  "nombre": "Ana",
  "apellido": "Pérez",
  "direccion": "Calle 123",
  "codigoPostal": "C1000",
  "items": [
    { "productId": 10, "quantity": 2 }
  ]
}
```

`items` debe contener entre 1 y 100 productos, sin IDs duplicados y con cantidades enteras positivas. `403` indica que se intentó comprar un producto de una tienda propia; `404`, que algún producto no existe o ya no está disponible; `409`, que no hay stock suficiente. Si falla un artículo, la transacción revierte los descuentos de todos los artículos.

### Respuestas de error generales

- `400`: JSON malformado, cuerpo inválido o filtros incorrectos.
- `401`: sesión requerida o inválida.
- `403`: el usuario autenticado no tiene permiso para el recurso.
- `404`: recurso o ruta inexistente.
- `409`: email duplicado, nombre de tienda duplicado o stock insuficiente.
- `413`: cuerpo de solicitud demasiado grande.
- `500`: error interno; los detalles se registran en el servidor y no se incluyen en la respuesta.

### Rutas de interfaz

| Método y ruta | Descripción |
|---|---|
| `GET /` | Sirve la aplicación Vue y el catálogo principal. |
| `GET /checkout` | Sirve la pantalla de checkout. |

Estas rutas sirven páginas HTML; no son endpoints de API.


## Convenciones de commits y releases

El proyecto usa Conventional Commits. Se puede preparar un mensaje interactivo con `npm run commit`. Commitlint valida los mensajes durante el CI. Al integrar cambios a `main`, semantic-release calcula la versión: `fix:` y `perf:` incrementan PATCH, `feat:` incrementa MINOR, y `!` o el pie `BREAKING CHANGE:` incrementan MAJOR. Los commits `docs:`, `test:` y `chore:` no generan una versión por sí solos.

## Autor

- **Estudiante:** Tiago Risoli
- **Institución:** Universidad de Palermo
- **Carrera:** Licenciatura en Ciberseguridad
