const test = require('node:test');
const assert = require('node:assert/strict');
const { crearRepositorios } = require('../src/repositories/memoria');
const { crearServicios } = require('../src/services');
const { crearTransmisionesController } = require('../src/controllers/transmisiones.controller');
const { crearTrabajadoresController } = require('../src/controllers/trabajadores.controller');
const { manejadorErrores, rutaNoEncontrada } = require('../src/middleware/errores');
const { ConflictError, NotFoundError, ValidationError } = require('../src/errors');

// Respuesta falsa mínima: guarda el código de estado y el cuerpo.
function fakeRes() {
  const res = {
    statusCode: 200,
    cuerpo: undefined,
    terminada: false,
    status(codigo) {
      res.statusCode = codigo;
      return res;
    },
    json(cuerpo) {
      res.cuerpo = cuerpo;
      res.terminada = true;
      return res;
    },
    end() {
      res.terminada = true;
      return res;
    },
  };
  return res;
}

function entorno() {
  const servicios = crearServicios(crearRepositorios());
  return {
    servicios,
    transmisiones: crearTransmisionesController(servicios),
    trabajadores: crearTrabajadoresController(servicios),
  };
}

const body = { precioBase: 100000, fecha: '2026-12-15', personalRequerido: 2 };
const ana = { nombre: 'Ana Pérez', telefono: '+56 9 1234 5678', especialidad: 'Camarógrafa', tarifa: 40000 };

test('POST transmisiones responde 201 con estado Agendado', async () => {
  const { transmisiones } = entorno();
  const res = fakeRes();
  await transmisiones.crear({ body }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.cuerpo.estado, 'Agendado');
});

test('POST transmisiones con datos inválidos rechaza con ValidationError', async () => {
  const { transmisiones } = entorno();
  await assert.rejects(
    transmisiones.crear({ body: { ...body, precioBase: -10 } }, fakeRes()),
    ValidationError,
  );
});

test('GET transmisiones devuelve el indicador de riesgo en cada evento', async () => {
  const { transmisiones } = entorno();
  await transmisiones.crear({ body }, fakeRes());
  const res = fakeRes();
  await transmisiones.listar({}, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.cuerpo.length, 1);
  assert.equal(res.cuerpo[0].riesgoFinanciero, true);
  assert.equal(res.cuerpo[0].alerta, 'Riesgo Financiero por Falta de Pago');
});

test('flujo completo: asignar responde 201, nómina 200 y desasignar 204', async () => {
  const { transmisiones, trabajadores } = entorno();
  const resT = fakeRes();
  await transmisiones.crear({ body }, resT);
  const resW = fakeRes();
  await trabajadores.crear({ body: ana }, resW);
  assert.equal(resW.statusCode, 201);

  const params = { id: String(resT.cuerpo.id) };
  const resA = fakeRes();
  await transmisiones.asignar({ params, body: { trabajadorId: resW.cuerpo.id } }, resA);
  assert.equal(resA.statusCode, 201);
  assert.equal(resA.cuerpo.trabajador.telefono, '+56 9 1234 5678');

  const resN = fakeRes();
  await transmisiones.nomina({ params }, resN);
  assert.equal(resN.cuerpo.personalAsignado, 1);

  const resD = fakeRes();
  await transmisiones.desasignar(
    { params: { ...params, asignacionId: String(resA.cuerpo.id) } },
    resD,
  );
  assert.equal(resD.statusCode, 204);
  assert.equal(resD.terminada, true);
});

test('GET trabajadores/disponibles usa el parámetro fecha de la query', async () => {
  const { trabajadores } = entorno();
  await trabajadores.crear({ body: ana }, fakeRes());
  const res = fakeRes();
  await trabajadores.disponibles({ query: { fecha: '2026-12-15' } }, res);
  assert.equal(res.cuerpo.length, 1);
  await assert.rejects(trabajadores.disponibles({ query: {} }, fakeRes()), ValidationError);
});

// ---------- middleware de errores ----------

test('manejadorErrores traduce errores de negocio a su código HTTP', () => {
  const casos = [
    [new ValidationError({ campo: 'mal' }), 400, 'VALIDACION'],
    [new NotFoundError('no está'), 404, 'NO_ENCONTRADO'],
    [new ConflictError('choca'), 409, 'CONFLICTO'],
  ];
  for (const [error, status, codigo] of casos) {
    const res = fakeRes();
    manejadorErrores(error, {}, res, () => {});
    assert.equal(res.statusCode, status);
    assert.equal(res.cuerpo.error.codigo, codigo);
  }
});

test('manejadorErrores incluye el detalle por campo en errores de validación', () => {
  const res = fakeRes();
  manejadorErrores(new ValidationError({ precioBase: 'mal' }), {}, res, () => {});
  assert.deepEqual(res.cuerpo.error.detalles, { precioBase: 'mal' });
});

test('manejadorErrores responde 400 ante JSON mal formado', () => {
  const res = fakeRes();
  manejadorErrores({ type: 'entity.parse.failed' }, {}, res, () => {});
  assert.equal(res.statusCode, 400);
  assert.equal(res.cuerpo.error.codigo, 'JSON_INVALIDO');
});

test('manejadorErrores no filtra detalles internos en un error inesperado', (t) => {
  t.mock.method(console, 'error', () => {});
  const res = fakeRes();
  manejadorErrores(new Error('password de la BD: secreto'), {}, res, () => {});
  assert.equal(res.statusCode, 500);
  assert.equal(res.cuerpo.error.codigo, 'ERROR_INTERNO');
  assert.ok(!JSON.stringify(res.cuerpo).includes('secreto'));
});

test('rutaNoEncontrada responde 404', () => {
  const res = fakeRes();
  rutaNoEncontrada({ method: 'GET', originalUrl: '/api/nada' }, res);
  assert.equal(res.statusCode, 404);
});
