const { ESTADOS } = require('../config/estados');
const { ConflictError, NotFoundError, ValidationError } = require('../errors');
const { objeto, parseId, esFechaISO } = require('../validators/comunes');

function crearAsignacionesService({ repos }) {
  const datosTrabajador = (t) =>
    t && {
      id: t.id,
      nombre: t.nombre,
      telefono: t.telefono,
      especialidad: t.especialidad,
      tarifa: t.tarifa,
    };

  // RF4: cada asignación expone teléfono, especialidad/cargo y tarifa del trabajador.
  const presentar = (asignacion, trabajador) => ({
    id: asignacion.id,
    transmisionId: asignacion.transmisionId,
    trabajadorId: asignacion.trabajadorId,
    tarifaAcordada: asignacion.tarifaAcordada,
    createdAt: asignacion.createdAt,
    trabajador: datosTrabajador(trabajador),
  });

  async function buscarTransmision(idParam) {
    const transmision = await repos.transmisiones.buscarPorId(parseId(idParam, 'transmisionId'));
    if (!transmision) throw new NotFoundError('Transmisión no encontrada');
    return transmision;
  }

  // Trabajadores que ya tienen una transmisión (no cancelada) en esa fecha.
  async function idsOcupadosEn(fecha) {
    const ocupados = new Set();
    for (const t of await repos.transmisiones.listar()) {
      if (t.fecha !== fecha || t.estado === ESTADOS.CANCELADO) continue;
      for (const a of await repos.asignaciones.listarPorTransmision(t.id)) {
        ocupados.add(a.trabajadorId);
      }
    }
    return ocupados;
  }

  // RF4: vincula al trabajador con la transmisión.
  // El riesgo financiero de RF3 NO se consulta aquí: no debe bloquear la asignación.
  async function asignar(transmisionIdParam, body) {
    const transmision = await buscarTransmision(transmisionIdParam);
    const trabajadorId = parseId(objeto(body).trabajadorId, 'trabajadorId');

    if (transmision.estado !== ESTADOS.AGENDADO) {
      throw new ConflictError('Solo se puede asignar personal a transmisiones en estado Agendado');
    }

    const trabajador = await repos.trabajadores.buscarPorId(trabajadorId);
    if (!trabajador) throw new NotFoundError('Trabajador no encontrado');
    if (!trabajador.activo) throw new ConflictError('El trabajador no está activo');

    if (await repos.asignaciones.buscar(transmision.id, trabajadorId)) {
      throw new ConflictError('El trabajador ya está asignado a esta transmisión');
    }
    if ((await idsOcupadosEn(transmision.fecha)).has(trabajadorId)) {
      throw new ConflictError(`El trabajador ya tiene otra transmisión el ${transmision.fecha}`);
    }

    // Se guarda la tarifa vigente al asignar: si luego cambia la tarifa del trabajador,
    // las liquidaciones de eventos ya asignados no se alteran.
    const asignacion = await repos.asignaciones.crear({
      transmisionId: transmision.id,
      trabajadorId,
      tarifaAcordada: trabajador.tarifa,
    });
    return presentar(asignacion, trabajador);
  }

  // RF4: nómina del evento (base para las liquidaciones posteriores).
  async function nomina(transmisionIdParam) {
    const transmision = await buscarTransmision(transmisionIdParam);
    const asignaciones = await repos.asignaciones.listarPorTransmision(transmision.id);
    const filas = [];
    for (const a of asignaciones) {
      filas.push(presentar(a, await repos.trabajadores.buscarPorId(a.trabajadorId)));
    }
    const personalAsignado = filas.length;
    return {
      transmisionId: transmision.id,
      personalRequerido: transmision.personalRequerido,
      personalAsignado,
      faltante: Math.max(0, transmision.personalRequerido - personalAsignado),
      excedido: personalAsignado > transmision.personalRequerido,
      totalTarifas: filas.reduce((suma, f) => suma + f.tarifaAcordada, 0),
      asignaciones: filas,
    };
  }

  async function desasignar(transmisionIdParam, asignacionIdParam) {
    const transmision = await buscarTransmision(transmisionIdParam);
    const asignacionId = parseId(asignacionIdParam, 'asignacionId');
    const asignacion = await repos.asignaciones.buscarPorId(asignacionId);
    if (!asignacion || asignacion.transmisionId !== transmision.id) {
      throw new NotFoundError('Asignación no encontrada');
    }
    if (transmision.estado !== ESTADOS.AGENDADO) {
      throw new ConflictError('Solo se puede quitar personal de transmisiones en estado Agendado');
    }
    await repos.asignaciones.eliminar(asignacionId);
  }

  async function trabajadoresDisponibles(fecha) {
    if (!esFechaISO(fecha)) {
      throw new ValidationError({ fecha: 'Debe indicar la fecha en formato AAAA-MM-DD' });
    }
    const ocupados = await idsOcupadosEn(fecha);
    const todos = await repos.trabajadores.listar();
    return todos
      .filter((t) => t.activo && !ocupados.has(t.id))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  return { asignar, nomina, desasignar, trabajadoresDisponibles };
}

module.exports = { crearAsignacionesService };
