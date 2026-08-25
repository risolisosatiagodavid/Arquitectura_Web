# Arquitectura Web - Trabajo Práctico Integrador

Repositorio central para el desarrollo del Trabajo Práctico Integrador de la materia **Arquitectura Web** (Universidad de Palermo). El proyecto se enfoca en el diseño e implementación de servicios web, priorizando buenas prácticas de arquitectura y consideraciones de seguridad.

---

## Tecnologías y Entorno
- **Runtime:** Node.js (LTS)
- **Lenguaje:** JavaScript / TypeScript
- **Entorno de desarrollo:** Ubuntu 24.04 LTS en WSL2

---

## Entregas y Modulos

- 1. **Servidor HTTP:** Servidor implementado utilizando el modulo node:http sin utilizar frameworks externos, con los siguientes endpoints:
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
## Autor
* **Estudiante**: Tiago Risoli
* **Institucion**: Universidad de Palermo
* **Carrera**: Lic. En Ciberseguridad
