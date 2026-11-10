const { ValidationError } = require('../errors');
const { objeto, aNumero, esFechaISO } = require('./comunes');

// RF2: Precio Base (> 0), fecha de realización y cantidad de personal técnico son obligatorios.
// El estado NO se toma del cliente: lo fija el servicio como "Agendado".
function validarNuevaTransmision(body) {
  const b = objeto(body);
  const errores = {};

  const precioBase = aNumero(b.precioBase);
  if (!(precioBase > 0)) {
    errores.precioBase = 'El Precio Base debe ser un monto numérico mayor a cero';
  }

  if (!esFechaISO(b.fecha)) {
    errores.fecha =
      'La fecha de realización es obligatoria (formato AAAA-MM-DD) y debe ser una fecha real';
  }

  const personalRequerido = aNumero(b.personalRequerido);
  if (!Number.isInteger(personalRequerido) || personalRequerido < 1) {
    errores.personalRequerido =
      'El personal técnico requerido debe ser un número entero mayor o igual a 1';
  }

  // Opcional: abono recibido al confirmar el servicio (por defecto 0).
  let montoAbonado = 0;
  if (b.montoAbonado !== undefined) {
    montoAbonado = aNumero(b.montoAbonado);
    if (!(montoAbonado >= 0)) {
      errores.montoAbonado = 'El monto abonado debe ser un número mayor o igual a cero';
    }
  }

  if (Object.keys(errores).length > 0) throw new ValidationError(errores);
  return { precioBase, fecha: b.fecha, personalRequerido, montoAbonado };
}

function validarAbono(body) {
  const montoAbonado = aNumero(objeto(body).montoAbonado);
  if (!(montoAbonado >= 0)) {
    throw new ValidationError({
      montoAbonado: 'El monto abonado debe ser un número mayor o igual a cero',
    });
  }
  return montoAbonado;
}

module.exports = { validarNuevaTransmision, validarAbono };
