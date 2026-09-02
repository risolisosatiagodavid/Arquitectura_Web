# Arquitectura Web - Trabajo Práctico Integrador

Repositorio central para el desarrollo del Trabajo Práctico Integrador de la materia **Arquitectura Web** (Universidad de Palermo). El proyecto se enfoca en el diseño e implementación de servicios web, priorizando buenas prácticas de arquitectura y consideraciones de seguridad.

---

## Tecnologías y Entorno
- **Runtime:** Node.js (LTS)
- **Lenguaje:** JavaScript / TypeScript
- **Entorno de desarrollo:** Ubuntu 26.04 LTS en WSL2

---

# Entregas y Modulos

 # 1. **Servidor HTTP:** Servidor implementado utilizando el modulo node:http sin utilizar frameworks externos, con los siguientes endpoints:


```http
GET /            //Retorna 'Servidor HTTP funcionando correctamente'
POST /archivo    //Retorna la cantidad de bytes del archivo
```
* Cualquier otra ruta o método retorna 404
     
<br>

  *   **Ejecución**
```bash
node server.js
```
<br>

* **Pruebas**

```bash
# Probar GET
curl -i http://localhost:8080/

# Probar POST con archivo
curl -i -X POST --data-binary @archivo_de_prueba.txt http://localhost:8080/archivo

# Probar 404 (Ruta invalida)
curl -i http://localhost:8080/ruta-invalida
```

---
 # 2. Documentacion de la API

### Autenticación y Usuarios
```http
POST  /auth/registro                  // [201, 400, 409] Registra un usuario en la plataforma
POST  /auth/login                     // [200, 400, 401] Autentica credenciales y emite token JWT
GET   /usuarios/:id                   // [200, 401, 403, 404] Obtiene datos del perfil del usuario
PATCH /usuarios/:id                   // [200, 400, 409] Actualiza datos personales o de contacto
```
*Payloads requeridos:*

* **POST /auth/registro**:
```json
{
  "nombre": "...",
  "email": "...",
  "password": "...",
  "domicilio": "..."
}
```

* **POST /auth/login**:
```json
{
  "email": "...",
  "password": "..."
}
```

* **PATCH /usuarios/:id**:
```json
{
  "username": "...",
  "telefono": "...",
  "domicilio": "..."
}
```

---

### Tiendas
```http
GET    /tiendas                       // [200, 400] Lista tiendas (filtros por nombre, zona o categoría)[cite: 1]
GET    /tiendas/:id                   // [200, 403, 404] Detalle e información de una tienda específica[cite: 1]
POST   /tiendas                       // [201, 400, 401, 409] Crea una tienda (usuario autenticado como dueño)[cite: 1]
PATCH  /tiendas/:id                   // [200, 400, 403, 404] Modifica datos de la tienda (dueño o administradores)[cite: 1]
DELETE /tiendas/:id                   // [204, 403, 404] Elimina una tienda del sistema (solo dueño)[cite: 1]
```
*Payloads requeridos:*

* **POST /tiendas**:
```json
{
  "storename": "...",
  "descripcion": "...",
  "owner": 0,
  "visibilidad": "..."
}
```

* **PATCH /tiendas/:id**:
```json
{
  "nombre": "...",
  "descripcion": "...",
  "telefono": "..."
}
```

---

### Catálogo de Productos
```http
GET    /tiendas/:id/productos         // [200, 404] Obtiene el catálogo de productos de una tienda
POST   /tiendas/:id/productos         // [201, 400, 403, 404] Da de alta un nuevo producto dentro de la tienda
GET    /productos/:id                 // [200, 404] Detalle y datos comerciales de un producto
PATCH  /productos/:id                 // [200, 400, 403, 404] Actualiza precio o inventario de un producto
DELETE /productos/:id                 // [204, 403, 404] Elimina un producto del catálogo
```
*Payloads requeridos:*

* **POST /tiendas/:id/productos**:
```json
{
  "nombre": "...",
  "descripcion": "...",
  "precio": 0.0,
  "stock": 0
}
```

* **PATCH /productos/:id**:
```json
{
  "nombre": "...",
  "descripcion": "...",
  "precio": 0.0,
  "stock": 0
}
```

---

### Carrito de Compras
```http
GET    /carrito                       // [200, 401] Consulta items, cantidades y subtotal acumulado
POST   /carrito/items                 // [200, 400, 404] Agrega o actualiza la cantidad de un producto
DELETE /carrito/items/:producto_id    // [204, 401, 404] Quita un producto específico del carrito
```
*Payloads requeridos:*

* **POST /carrito/items**:
```json
{
  "producto_id": 0,
  "cantidad": 0
}
```

---

### Compras y Órdenes
```http
POST  /compras                        // [201, 400, 409] Procesa el carrito, valida stock y genera la orden
GET   /compras                        // [200, 401] Historial de compras del usuario autenticado
GET   /compras/:id                    // [200, 403, 404] Detalle exhaustivo de una compra puntual
```
*Payloads requeridos:*

* **POST /compras**:
```json
{
  "direccion_envio": "...",
  "metodo_pago": "..."
}
```
---
## Autor
* **Estudiante**: Tiago Risoli
* **Institucion**: Universidad de Palermo
* **Carrera**: Lic. En Ciberseguridad
