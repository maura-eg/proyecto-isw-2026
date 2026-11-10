const test = require('node:test');
const assert = require('node:assert/strict');
const { crearRepositorios } = require('../src/repositories/memoria');
const { crearServicios } = require('../src/services');
const { ESTADOS } = require('../src/config/estados');
const { ConflictError, NotFoundError, ValidationError } = require('../src/errors');

const transmisionBase = { precioBase: 100000, fecha: '2026-12-15', personalRequerido: 2 };
const ana = { nombre: 'Ana Pérez', telefono: '+56 9 1234 5678', especialidad: 'Camarógrafa', tarifa: 40000 };
const luis = { nombre: 'Luis Soto', telefono: '+56 9 8765 4321', especialidad: 'Sonidista', tarifa: 35000 };
const marta = { nombre: 'Marta Rojas', telefono: '+56 9 5555 0000', especialidad: 'Director técnico', tarifa: 60000 };

function entorno() {
  const repos = crearRepositorios();
  return { repos, ...crearServicios(repos) };
}

test('RF4: asignar devuelve teléfono, especialidad y tarifa del trabajador', async () => {
  const { transmisiones, trabajadores, asignaciones } = entorno();
  const t = await transmisiones.agendar(transmisionBase);
  const w = await trabajadores.crear(ana);

  const a = await asignaciones.asignar(t.id, { trabajadorId: w.id });

  assert.equal(a.transmisionId, t.id);
  assert.equal(a.trabajadorId, w.id);
  assert.equal(a.tarifaAcordada, 40000);
  assert.deepEqual(a.trabajador, {
    id: w.id,
    nombre: 'Ana Pérez',
    telefono: '+56 9 1234 5678',
    especialidad: 'Camarógrafa',
    tarifa: 40000,
  });
});

test('RF4: la asignación queda registrada de inmediato en la nómina', async () => {
  const { transmisiones, trabajadores, asignaciones } = entorno();
  const t = await transmisiones.agendar(transmisionBase);
  const w1 = await trabajadores.crear(ana);
  const w2 = await trabajadores.crear(luis);

  assert.equal((await asignaciones.nomina(t.id)).personalAsignado, 0);

  await asignaciones.asignar(t.id, { trabajadorId: w1.id });
  await asignaciones.asignar(t.id, { trabajadorId: w2.id });

  const nomina = await asignaciones.nomina(t.id);
  assert.equal(nomina.personalAsignado, 2);
  assert.equal(nomina.personalRequerido, 2);
  assert.equal(nomina.faltante, 0);
  assert.equal(nomina.excedido, false);
  assert.equal(nomina.totalTarifas, 75000);
  assert.deepEqual(
    nomina.asignaciones.map((f) => f.trabajador.nombre),
    ['Ana Pérez', 'Luis Soto'],
  );
});

test('RF4: la nómina informa cuánto personal falta', async () => {
  const { transmisiones, trabajadores, asignaciones } = entorno();
  const t = await transmisiones.agendar({ ...transmisionBase, personalRequerido: 3 });
  const w = await trabajadores.crear(ana);
  await asignaciones.asignar(t.id, { trabajadorId: w.id });

  const nomina = await asignaciones.nomina(t.id);
  assert.equal(nomina.faltante, 2);
  assert.equal(nomina.excedido, false);
});

test('RF4: permite superar el personal requerido y lo marca como excedido', async () => {
  const { transmisiones, trabajadores, asignaciones } = entorno();
  const t = await transmisiones.agendar({ ...transmisionBase, personalRequerido: 1 });
  const w1 = await trabajadores.crear(ana);
  const w2 = await trabajadores.crear(luis);
  await asignaciones.asignar(t.id, { trabajadorId: w1.id });
  await asignaciones.asignar(t.id, { trabajadorId: w2.id });

  const nomina = await asignaciones.nomina(t.id);
  assert.equal(nomina.personalAsignado, 2);
  assert.equal(nomina.faltante, 0);
  assert.equal(nomina.excedido, true);
});

test('RF4: conserva la tarifa acordada aunque la tarifa del trabajador cambie después', async () => {
  const { transmisiones, trabajadores, asignaciones, repos } = entorno();
  const t = await transmisiones.agendar(transmisionBase);
  const w = await trabajadores.crear(ana);
  await asignaciones.asignar(t.id, { trabajadorId: w.id });

  await repos.trabajadores.actualizar(w.id, { tarifa: 99999 });

  const nomina = await asignaciones.nomina(t.id);
  assert.equal(nomina.totalTarifas, 40000);
  assert.equal(nomina.asignaciones[0].tarifaAcordada, 40000);
  assert.equal(nomina.asignaciones[0].trabajador.tarifa, 99999);
});

test('RF3 + RF4: el riesgo financiero NO bloquea la asignación de personal', async () => {
  const { transmisiones, trabajadores, asignaciones } = entorno();
  const t = await transmisiones.agendar(transmisionBase); // sin abono => riesgo
  assert.equal(t.riesgoFinanciero, true);
  const w = await trabajadores.crear(ana);

  const a = await asignaciones.asignar(t.id, { trabajadorId: w.id });
  assert.ok(a.id);

  const despues = await transmisiones.obtener(t.id);
  assert.equal(despues.riesgoFinanciero, true); // la advertencia sigue vigente
});

test('RF4: rechaza asignar dos veces al mismo trabajador a la misma transmisión', async () => {
  const { transmisiones, trabajadores, asignaciones } = entorno();
  const t = await transmisiones.agendar(transmisionBase);
  const w = await trabajadores.crear(ana);
  await asignaciones.asignar(t.id, { trabajadorId: w.id });

  await assert.rejects(asignaciones.asignar(t.id, { trabajadorId: w.id }), ConflictError);
  assert.equal((await asignaciones.nomina(t.id)).personalAsignado, 1);
});

test('RF4: no permite al mismo trabajador dos transmisiones el mismo día', async () => {
  const { transmisiones, trabajadores, asignaciones } = entorno();
  const t1 = await transmisiones.agendar(transmisionBase);
  const t2 = await transmisiones.agendar(transmisionBase); // misma fecha
  const w = await trabajadores.crear(ana);
  await asignaciones.asignar(t1.id, { trabajadorId: w.id });

  await assert.rejects(asignaciones.asignar(t2.id, { trabajadorId: w.id }), ConflictError);
});

test('RF4: sí permite el mismo trabajador en fechas distintas', async () => {
  const { transmisiones, trabajadores, asignaciones } = entorno();
  const t1 = await transmisiones.agendar(transmisionBase);
  const t2 = await transmisiones.agendar({ ...transmisionBase, fecha: '2026-12-16' });
  const w = await trabajadores.crear(ana);
  await asignaciones.asignar(t1.id, { trabajadorId: w.id });

  const a = await asignaciones.asignar(t2.id, { trabajadorId: w.id });
  assert.ok(a.id);
});

test('RF4: una transmisión cancelada no ocupa al trabajador', async () => {
  const { transmisiones, trabajadores, asignaciones, repos } = entorno();
  const t1 = await transmisiones.agendar(transmisionBase);
  const t2 = await transmisiones.agendar(transmisionBase);
  const w = await trabajadores.crear(ana);
  await asignaciones.asignar(t1.id, { trabajadorId: w.id });
  await repos.transmisiones.actualizar(t1.id, { estado: ESTADOS.CANCELADO });

  const a = await asignaciones.asignar(t2.id, { trabajadorId: w.id });
  assert.ok(a.id);
});

test('RF4: rechaza trabajadores inactivos', async () => {
  const { transmisiones, trabajadores, asignaciones, repos } = entorno();
  const t = await transmisiones.agendar(transmisionBase);
  const w = await trabajadores.crear(ana);
  await repos.trabajadores.actualizar(w.id, { activo: false });

  await assert.rejects(asignaciones.asignar(t.id, { trabajadorId: w.id }), ConflictError);
});

test('RF4: solo se asigna a transmisiones en estado Agendado', async () => {
  const { transmisiones, trabajadores, asignaciones, repos } = entorno();
  const t = await transmisiones.agendar(transmisionBase);
  const w = await trabajadores.crear(ana);

  for (const estado of [ESTADOS.EN_CURSO, ESTADOS.FINALIZADO, ESTADOS.CANCELADO]) {
    await repos.transmisiones.actualizar(t.id, { estado });
    await assert.rejects(asignaciones.asignar(t.id, { trabajadorId: w.id }), ConflictError);
  }
});

test('RF4: errores por ids inexistentes o inválidos', async () => {
  const { transmisiones, trabajadores, asignaciones } = entorno();
  const t = await transmisiones.agendar(transmisionBase);
  const w = await trabajadores.crear(ana);

  await assert.rejects(asignaciones.asignar(999, { trabajadorId: w.id }), NotFoundError);
  await assert.rejects(asignaciones.asignar(t.id, { trabajadorId: 999 }), NotFoundError);
  await assert.rejects(asignaciones.asignar('abc', { trabajadorId: w.id }), ValidationError);
  await assert.rejects(asignaciones.asignar(t.id, { trabajadorId: 'abc' }), ValidationError);
  await assert.rejects(asignaciones.asignar(t.id, {}), ValidationError);
  await assert.rejects(asignaciones.asignar(t.id, undefined), ValidationError);
  await assert.rejects(asignaciones.nomina(999), NotFoundError);
});

test('RF4: trabajadoresDisponibles excluye ocupados e inactivos en esa fecha', async () => {
  const { transmisiones, trabajadores, asignaciones, repos } = entorno();
  const t = await transmisiones.agendar(transmisionBase);
  const wAna = await trabajadores.crear(ana);
  await trabajadores.crear(luis);
  const wMarta = await trabajadores.crear(marta);
  await repos.trabajadores.actualizar(wMarta.id, { activo: false });
  await asignaciones.asignar(t.id, { trabajadorId: wAna.id });

  const ese = await asignaciones.trabajadoresDisponibles('2026-12-15');
  assert.deepEqual(ese.map((w) => w.nombre), ['Luis Soto']);

  const otro = await asignaciones.trabajadoresDisponibles('2026-12-16');
  assert.deepEqual(otro.map((w) => w.nombre), ['Ana Pérez', 'Luis Soto']);
});

test('RF4: trabajadoresDisponibles exige una fecha válida', async () => {
  const { asignaciones } = entorno();
  for (const fecha of [undefined, '', 'hoy', '2026-02-30']) {
    await assert.rejects(asignaciones.trabajadoresDisponibles(fecha), ValidationError);
  }
});

test('RF4: desasignar quita al trabajador de la nómina', async () => {
  const { transmisiones, trabajadores, asignaciones } = entorno();
  const t = await transmisiones.agendar(transmisionBase);
  const w = await trabajadores.crear(ana);
  const a = await asignaciones.asignar(t.id, { trabajadorId: w.id });

  await asignaciones.desasignar(t.id, a.id);

  const nomina = await asignaciones.nomina(t.id);
  assert.equal(nomina.personalAsignado, 0);
  assert.equal(nomina.totalTarifas, 0);
  // Queda disponible de nuevo
  assert.equal((await asignaciones.trabajadoresDisponibles('2026-12-15')).length, 1);
});

test('RF4: desasignar valida pertenencia y estado', async () => {
  const { transmisiones, trabajadores, asignaciones, repos } = entorno();
  const t1 = await transmisiones.agendar(transmisionBase);
  const t2 = await transmisiones.agendar({ ...transmisionBase, fecha: '2026-12-16' });
  const w = await trabajadores.crear(ana);
  const a = await asignaciones.asignar(t1.id, { trabajadorId: w.id });

  // la asignación pertenece a t1, no a t2
  await assert.rejects(asignaciones.desasignar(t2.id, a.id), NotFoundError);
  await assert.rejects(asignaciones.desasignar(t1.id, 999), NotFoundError);

  await repos.transmisiones.actualizar(t1.id, { estado: ESTADOS.FINALIZADO });
  await assert.rejects(asignaciones.desasignar(t1.id, a.id), ConflictError);
  assert.equal((await asignaciones.nomina(t1.id)).personalAsignado, 1);
});

test('trabajadores: listar ordena por nombre y obtener devuelve 404 si no existe', async () => {
  const { trabajadores } = entorno();
  await trabajadores.crear(luis);
  await trabajadores.crear(ana);

  assert.deepEqual((await trabajadores.listar()).map((w) => w.nombre), ['Ana Pérez', 'Luis Soto']);
  await assert.rejects(trabajadores.obtener(999), NotFoundError);
  await assert.rejects(trabajadores.crear({ ...ana, tarifa: 0 }), ValidationError);
});
