const { ESTADOS, UMBRAL_GARANTIA, MENSAJE_RIESGO } = require('../config/estados');
const { NotFoundError } = require('../errors');
const { parseId } = require('../validators/comunes');
const { validarNuevaTransmision, validarAbono } = require('../validators/transmision.validator');

// RF3: el riesgo se calcula cada vez que se consulta (no se guarda), así siempre
// refleja el abono actual. Solo aplica a transmisiones en estado "Agendado".
// Si el abono es exactamente el 50% del Precio Base, NO hay riesgo.
function conEvaluacionFinanciera(transmision) {
  const enRiesgo =
    transmision.estado === ESTADOS.AGENDADO &&
    transmision.montoAbonado < transmision.precioBase * UMBRAL_GARANTIA;

  return {
    ...transmision,
    porcentajeAbonado: Math.floor((transmision.montoAbonado / transmision.precioBase) * 1000) / 10,
    riesgoFinanciero: enRiesgo,
    alerta: enRiesgo ? MENSAJE_RIESGO : null,
  };
}

function crearTransmisionesService({ repos }) {
  async function buscarOFallar(idParam) {
    const id = parseId(idParam);
    const transmision = await repos.transmisiones.buscarPorId(id);
    if (!transmision) throw new NotFoundError('Transmisión no encontrada');
    return transmision;
  }

  // RF2
  async function agendar(body) {
    const datos = validarNuevaTransmision(body);
    const transmision = await repos.transmisiones.crear({
      ...datos,
      estado: ESTADOS.AGENDADO,
    });
    return conEvaluacionFinanciera(transmision);
  }

  // RF3
  async function listar() {
    const todas = await repos.transmisiones.listar();
    return todas
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id)
      .map(conEvaluacionFinanciera);
  }

  async function obtener(idParam) {
    return conEvaluacionFinanciera(await buscarOFallar(idParam));
  }

  // Provisorio: permite registrar el abono mientras el equipo define cómo se manejan los pagos.
  async function registrarAbono(idParam, body) {
    const transmision = await buscarOFallar(idParam);
    const montoAbonado = validarAbono(body);
    const actualizada = await repos.transmisiones.actualizar(transmision.id, { montoAbonado });
    return conEvaluacionFinanciera(actualizada);
  }

  return { agendar, listar, obtener, registrarAbono };
}

module.exports = { crearTransmisionesService };
