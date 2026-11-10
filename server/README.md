# Backend – Transmisiones en vivo

API en Express 5 (CommonJS). Implementa **RF2** (agendar), **RF3** (alerta de garantía financiera) y **RF4** (asignación de personal).

## Cómo correrlo

```bash
cd server
npm install
npm start        # http://localhost:1303 (o el PORT de tu .env)
npm test         # pruebas con el runner nativo de Node (sin dependencias extra)
```

## Estructura

```
server/
  index.js                 arranque (puerto y listen)
  src/
    app.js                 arma Express: middlewares, rutas y manejo de errores
    routes/                URL -> controlador
    controllers/           HTTP <-> servicios (códigos de estado)
    services/              reglas de negocio (RF2, RF3, RF4)
    validators/            validación de entradas
    repositories/memoria.js  "base de datos" en memoria (ver nota abajo)
    middleware/errores.js  respuestas de error uniformes
    config/estados.js      estados y constantes de negocio
  test/                    pruebas
```

> **Persistencia:** los datos viven en memoria y se pierden al reiniciar. Todo el acceso a datos pasa por
> `src/repositories/memoria.js`; para usar una base real basta reimplementar ese módulo con la misma
> interfaz (`crear`, `buscarPorId`, `listar`, `actualizar`, `eliminar`, etc.). Servicios y controladores no cambian.
> En la BD real, conviene una restricción única `(transmisionId, trabajadorId)` en asignaciones.

## Endpoints

| Método | Ruta | Requerimiento | Descripción |
|---|---|---|---|
| POST | `/api/transmisiones` | RF2 | Agenda una transmisión (estado inicial `Agendado`) |
| GET | `/api/transmisiones` | RF3 | Lista eventos con `riesgoFinanciero` y `alerta` |
| GET | `/api/transmisiones/:id` | RF3 | Detalle de un evento |
| PATCH | `/api/transmisiones/:id/abono` | RF3 (provisorio) | Registra el monto abonado |
| POST | `/api/transmisiones/:id/asignaciones` | RF4 | Asigna un trabajador al evento |
| GET | `/api/transmisiones/:id/nomina` | RF4 | Nómina del evento y total de tarifas |
| DELETE | `/api/transmisiones/:id/asignaciones/:asignacionId` | RF4 | Quita a un trabajador del evento |
| POST | `/api/trabajadores` | RF4 | Crea un trabajador |
| GET | `/api/trabajadores` | RF4 | Lista trabajadores |
| GET | `/api/trabajadores/disponibles?fecha=AAAA-MM-DD` | RF4 | Trabajadores activos y libres en esa fecha |
| GET | `/api/trabajadores/:id` | RF4 | Detalle de un trabajador |

### RF2 – Agendar

```http
POST /api/transmisiones
{ "precioBase": 150000, "fecha": "2026-12-15", "personalRequerido": 3 }
```

- `precioBase`: número mayor a 0. `fecha`: `AAAA-MM-DD` real. `personalRequerido`: entero ≥ 1.
- `montoAbonado` (opcional, ≥ 0, por defecto 0).
- El `estado` siempre lo fija el servidor en `Agendado`; si el cliente envía otro, se ignora.
- Respuesta `201` con la transmisión. Datos inválidos: `400` con el detalle por campo.

### RF3 – Riesgo financiero

`GET /api/transmisiones` devuelve en cada evento:

```json
{ "id": 1, "precioBase": 150000, "montoAbonado": 50000, "porcentajeAbonado": 33.3,
  "riesgoFinanciero": true, "alerta": "Riesgo Financiero por Falta de Pago", "estado": "Agendado" }
```

- Hay riesgo si `montoAbonado < 50% de precioBase` (exactamente 50% **no** es riesgo) y el evento está `Agendado`.
- Se calcula en cada consulta, no se almacena: siempre refleja el abono actual.
- **No bloquea** nada: el evento se puede seguir gestionando y asignándole personal.

### RF4 – Asignar personal

```http
POST /api/transmisiones/1/asignaciones
{ "trabajadorId": 2 }
```

Respuesta `201`:

```json
{ "id": 1, "transmisionId": 1, "trabajadorId": 2, "tarifaAcordada": 40000,
  "trabajador": { "id": 2, "nombre": "Ana Pérez", "telefono": "+56 9 1234 5678",
                  "especialidad": "Camarógrafa", "tarifa": 40000 } }
```

Reglas (`409` si no se cumplen): evento en estado `Agendado`, trabajador activo, no repetido en el evento
y sin otro evento (no cancelado) el mismo día. Superar `personalRequerido` **está permitido**; la nómina lo
marca con `excedido: true`. La `tarifaAcordada` se congela al asignar, para que cambios posteriores de
tarifa no alteren liquidaciones ya generadas.

## Errores

Formato uniforme: `{ "error": { "codigo": "...", "mensaje": "...", "detalles": { ... } } }`

| Código HTTP | `codigo` | Cuándo |
|---|---|---|
| 400 | `VALIDACION` / `JSON_INVALIDO` | Datos inválidos o JSON mal formado |
| 404 | `NO_ENCONTRADO` / `RUTA_NO_ENCONTRADA` | Recurso o ruta inexistente |
| 409 | `CONFLICTO` | Regla de negocio no se cumple |
| 500 | `ERROR_INTERNO` | Error inesperado (sin exponer detalles) |

## Decisiones pendientes del equipo

1. **Registro de pagos:** `PATCH .../abono` es un parche provisorio. Si se necesita historial, crear una entidad `Pago` y calcular el abono como su suma.
2. **Fecha en el pasado:** hoy se acepta cualquier fecha real; se puede exigir fecha futura si el negocio lo pide.
3. **Definición de "disponible":** hoy es "sin otro evento el mismo día". Si hay horarios, habría que comparar rangos.
4. **Autenticación del Dueño:** aún no hay login; los endpoints están abiertos.
