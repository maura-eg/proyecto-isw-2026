const { ValidationError } = require('../errors');

const objeto = (valor) =>
  valor && typeof valor === 'object' && !Array.isArray(valor) ? valor : {};

// Acepta números finitos o strings decimales simples ("150000", "99.5").
// Rechaza "", "abc", "1e3", booleanos, null, arreglos, NaN e Infinity.
function aNumero(valor) {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : NaN;
  if (typeof valor === 'string' && /^\d+(\.\d+)?$/.test(valor.trim())) {
    return Number(valor.trim());
  }
  return NaN;
}

// Fecha en formato AAAA-MM-DD (lo que envía <input type="date">) y que exista en el calendario.
function esFechaISO(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [anio, mes, dia] = valor.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia
  );
}

function textoNoVacio(valor) {
  return typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : null;
}

function parseId(valor, campo = 'id') {
  let n = NaN;
  if (typeof valor === 'number') n = valor;
  else if (typeof valor === 'string' && /^\d+$/.test(valor)) n = Number(valor);
  if (!Number.isSafeInteger(n) || n < 1) {
    throw new ValidationError({ [campo]: 'Debe ser un identificador numérico válido' });
  }
  return n;
}

module.exports = { objeto, aNumero, esFechaISO, textoNoVacio, parseId };
