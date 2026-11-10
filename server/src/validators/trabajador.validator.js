const { ValidationError } = require('../errors');
const { objeto, aNumero, textoNoVacio } = require('./comunes');

function validarNuevoTrabajador(body) {
  const b = objeto(body);
  const errores = {};

  const nombre = textoNoVacio(b.nombre);
  if (!nombre) errores.nombre = 'El nombre es obligatorio';

  const especialidad = textoNoVacio(b.especialidad);
  if (!especialidad) errores.especialidad = 'La especialidad/cargo es obligatoria';

  const telefono = textoNoVacio(b.telefono);
  const digitos = telefono ? telefono.replace(/\D/g, '').length : 0;
  if (!telefono || !/^\+?[\d\s()-]+$/.test(telefono) || digitos < 7 || digitos > 15) {
    errores.telefono = 'El teléfono debe tener entre 7 y 15 dígitos';
  }

  const tarifa = aNumero(b.tarifa);
  if (!(tarifa > 0)) errores.tarifa = 'La tarifa debe ser un monto numérico mayor a cero';

  if (Object.keys(errores).length > 0) throw new ValidationError(errores);
  return { nombre, telefono, especialidad, tarifa, activo: true };
}

module.exports = { validarNuevoTrabajador };
