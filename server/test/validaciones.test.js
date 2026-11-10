const test = require('node:test');
const assert = require('node:assert/strict');
const { inspect } = require('node:util');
const {
  validarNuevaTransmision,
  validarAbono,
} = require('../src/validators/transmision.validator');
const { validarNuevoTrabajador } = require('../src/validators/trabajador.validator');
const { ValidationError } = require('../src/errors');

const base = { precioBase: 150000, fecha: '2026-12-15', personalRequerido: 3 };

const rechazaCampo = (datos, campo) =>
  assert.throws(
    () => validarNuevaTransmision(datos),
    (err) => err instanceof ValidationError && campo in err.detalles,
  );

test('RF2: acepta una transmisión válida y convierte strings numéricos', () => {
  const r = validarNuevaTransmision({
    precioBase: '150000',
    fecha: '2026-12-15',
    personalRequerido: '3',
  });
  assert.deepEqual(r, {
    precioBase: 150000,
    fecha: '2026-12-15',
    personalRequerido: 3,
    montoAbonado: 0,
  });
});

test('RF2: acepta un Precio Base con decimales', () => {
  assert.equal(validarNuevaTransmision({ ...base, precioBase: 100.5 }).precioBase, 100.5);
});

for (const valor of [
  0, -1, -0.01, '0', '-5', '', '   ', 'abc', '12abc', '1e3', null, undefined, true, [], {}, NaN,
  Infinity,
]) {
  test(`RF2: rechaza precioBase inválido ${inspect(valor)}`, () => {
    rechazaCampo({ ...base, precioBase: valor }, 'precioBase');
  });
}

for (const valor of [
  '2026-02-30', '2026-13-01', '15-12-2026', '2026/12/15', 'mañana', '', null, undefined, 20261215,
  '2026-12-15T10:00:00Z',
]) {
  test(`RF2: rechaza fecha inválida ${inspect(valor)}`, () => {
    rechazaCampo({ ...base, fecha: valor }, 'fecha');
  });
}

test('RF2: acepta 29 de febrero solo en año bisiesto', () => {
  assert.equal(validarNuevaTransmision({ ...base, fecha: '2028-02-29' }).fecha, '2028-02-29');
  rechazaCampo({ ...base, fecha: '2027-02-29' }, 'fecha');
});

for (const valor of [0, -1, 1.5, '1.5', 'dos', '', null, undefined, '2 Camarógrafos']) {
  test(`RF2: rechaza personalRequerido inválido ${inspect(valor)}`, () => {
    rechazaCampo({ ...base, personalRequerido: valor }, 'personalRequerido');
  });
}

test('RF2: informa todos los campos inválidos a la vez', () => {
  assert.throws(
    () => validarNuevaTransmision({}),
    (err) =>
      err instanceof ValidationError &&
      ['precioBase', 'fecha', 'personalRequerido'].every((c) => c in err.detalles),
  );
});

test('RF2: un body ausente o nulo se trata como inválido, sin lanzar errores internos', () => {
  for (const body of [undefined, null, 'texto', 42, []]) {
    assert.throws(() => validarNuevaTransmision(body), ValidationError);
  }
});

test('RF2/RF3: montoAbonado es opcional y no puede ser negativo', () => {
  assert.equal(validarNuevaTransmision({ ...base, montoAbonado: 75000 }).montoAbonado, 75000);
  assert.equal(validarNuevaTransmision({ ...base, montoAbonado: 0 }).montoAbonado, 0);
  rechazaCampo({ ...base, montoAbonado: -1 }, 'montoAbonado');
  rechazaCampo({ ...base, montoAbonado: 'mucho' }, 'montoAbonado');
});

test('validarAbono acepta 0 y positivos, rechaza el resto', () => {
  assert.equal(validarAbono({ montoAbonado: '25000' }), 25000);
  assert.equal(validarAbono({ montoAbonado: 0 }), 0);
  for (const body of [{ montoAbonado: -5 }, {}, undefined, { montoAbonado: 'x' }]) {
    assert.throws(() => validarAbono(body), ValidationError);
  }
});

const trabajadorBase = {
  nombre: 'Ana Pérez',
  telefono: '+56 9 1234 5678',
  especialidad: 'Camarógrafa',
  tarifa: 40000,
};

test('RF4: valida un trabajador correcto y lo deja activo', () => {
  assert.deepEqual(validarNuevoTrabajador(trabajadorBase), { ...trabajadorBase, activo: true });
});

test('RF4: rechaza trabajadores con datos inválidos', () => {
  const casos = [
    [{ ...trabajadorBase, nombre: '  ' }, 'nombre'],
    [{ ...trabajadorBase, especialidad: '' }, 'especialidad'],
    [{ ...trabajadorBase, telefono: 'abc' }, 'telefono'],
    [{ ...trabajadorBase, telefono: '12345' }, 'telefono'],
    [{ ...trabajadorBase, telefono: '1'.repeat(16) }, 'telefono'],
    [{ ...trabajadorBase, tarifa: 0 }, 'tarifa'],
    [{ ...trabajadorBase, tarifa: 'gratis' }, 'tarifa'],
  ];
  for (const [datos, campo] of casos) {
    assert.throws(
      () => validarNuevoTrabajador(datos),
      (err) => err instanceof ValidationError && campo in err.detalles,
      `debería rechazar ${campo}`,
    );
  }
});
