const test = require('node:test');
const assert = require('node:assert/strict');
const { crearRepositorios } = require('../src/repositories/memoria');
const { crearServicios } = require('../src/services');
const { ESTADOS } = require('../src/config/estados');
const { NotFoundError, ValidationError } = require('../src/errors');

const base = { precioBase: 100000, fecha: '2026-12-15', personalRequerido: 2 };

function entorno() {
  const repos = crearRepositorios();
  return { repos, ...crearServicios(repos) };
}

// ---------- RF2 ----------

test('RF2: guarda la transmisión con estado inicial "Agendado"', async () => {
  const { transmisiones, repos } = entorno();
  const t = await transmisiones.agendar(base);

  assert.equal(t.estado, 'Agendado');
  assert.equal(t.precioBase, 100000);
  assert.equal(t.fecha, '2026-12-15');
  assert.equal(t.personalRequerido, 2);
  assert.equal(t.montoAbonado, 0);
  assert.ok(t.id);

  const guardada = await repos.transmisiones.buscarPorId(t.id);
  assert.equal(guardada.estado, ESTADOS.AGENDADO);
});

test('RF2: ignora un estado enviado por el cliente', async () => {
  const { transmisiones } = entorno();
  const t = await transmisiones.agendar({ ...base, estado: 'Finalizado', id: 999 });
  assert.equal(t.estado, 'Agendado');
  assert.notEqual(t.id, 999);
});

test('RF2: no guarda nada cuando los datos son inválidos', async () => {
  const { transmisiones, repos } = entorno();
  await assert.rejects(transmisiones.agendar({ ...base, precioBase: 0 }), ValidationError);
  await assert.rejects(transmisiones.agendar({ ...base, precioBase: 'abc' }), ValidationError);
  await assert.rejects(transmisiones.agendar({ ...base, fecha: undefined }), ValidationError);
  assert.equal((await repos.transmisiones.listar()).length, 0);
});

test('RF2: cada transmisión recibe un id distinto', async () => {
  const { transmisiones } = entorno();
  const a = await transmisiones.agendar(base);
  const b = await transmisiones.agendar(base);
  assert.notEqual(a.id, b.id);
});

// ---------- RF3 ----------

const MENSAJE = 'Riesgo Financiero por Falta de Pago';

for (const [abono, esperaRiesgo] of [
  [0, true],
  [1, true],
  [49999, true],
  [50000, false], // exactamente 50%: cumple la garantía
  [50001, false],
  [100000, false],
  [150000, false], // sobrepago: tampoco es riesgo
]) {
  test(`RF3: precio 100000 con abono ${abono} -> riesgo ${esperaRiesgo}`, async () => {
    const { transmisiones } = entorno();
    await transmisiones.agendar({ ...base, montoAbonado: abono });
    const [t] = await transmisiones.listar();

    assert.equal(t.riesgoFinanciero, esperaRiesgo);
    assert.equal(t.alerta, esperaRiesgo ? MENSAJE : null);
  });
}

test('RF3: sin abono informado se considera riesgo (0 < 50%)', async () => {
  const { transmisiones } = entorno();
  const t = await transmisiones.agendar(base);
  assert.equal(t.riesgoFinanciero, true);
  assert.equal(t.alerta, MENSAJE);
});

test('RF3: el listado evalúa cada evento por separado y los ordena por fecha', async () => {
  const { transmisiones } = entorno();
  await transmisiones.agendar({ ...base, fecha: '2026-12-20', montoAbonado: 100000 });
  await transmisiones.agendar({ ...base, fecha: '2026-12-10', montoAbonado: 10000 });

  const lista = await transmisiones.listar();
  assert.deepEqual(
    lista.map((t) => [t.fecha, t.riesgoFinanciero]),
    [
      ['2026-12-10', true],
      ['2026-12-20', false],
    ],
  );
});

test('RF3: informa el porcentaje abonado sin redondear hacia arriba', async () => {
  const { transmisiones } = entorno();
  const t = await transmisiones.agendar({ ...base, montoAbonado: 49950 });
  assert.equal(t.porcentajeAbonado, 49.9);
  assert.equal(t.riesgoFinanciero, true);
});

test('RF3: solo evalúa transmisiones en estado Agendado', async () => {
  const { transmisiones, repos } = entorno();
  const t = await transmisiones.agendar(base);
  await repos.transmisiones.actualizar(t.id, { estado: ESTADOS.FINALIZADO });

  const consultada = await transmisiones.obtener(t.id);
  assert.equal(consultada.riesgoFinanciero, false);
  assert.equal(consultada.alerta, null);
});

test('RF3: registrar un abono suficiente apaga la alerta', async () => {
  const { transmisiones } = entorno();
  const t = await transmisiones.agendar(base);
  assert.equal(t.riesgoFinanciero, true);

  const actualizada = await transmisiones.registrarAbono(t.id, { montoAbonado: 60000 });
  assert.equal(actualizada.montoAbonado, 60000);
  assert.equal(actualizada.riesgoFinanciero, false);
});

test('RF3: registrar abono valida el monto y la existencia de la transmisión', async () => {
  const { transmisiones } = entorno();
  const t = await transmisiones.agendar(base);
  await assert.rejects(transmisiones.registrarAbono(t.id, { montoAbonado: -1 }), ValidationError);
  await assert.rejects(transmisiones.registrarAbono(999, { montoAbonado: 10 }), NotFoundError);
  await assert.rejects(transmisiones.registrarAbono('abc', { montoAbonado: 10 }), ValidationError);
});

test('obtener: 404 si no existe y 400 si el id no es numérico', async () => {
  const { transmisiones } = entorno();
  await assert.rejects(transmisiones.obtener(42), NotFoundError);
  await assert.rejects(transmisiones.obtener('xyz'), ValidationError);
  await assert.rejects(transmisiones.obtener('1; DROP TABLE'), ValidationError);
});
