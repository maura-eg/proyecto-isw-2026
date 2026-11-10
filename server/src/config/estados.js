const ESTADOS = Object.freeze({
  AGENDADO: 'Agendado',
  EN_CURSO: 'En Curso',
  FINALIZADO: 'Finalizado',
  CANCELADO: 'Cancelado',
});

// RF3: garantía mínima exigida = 50% del Precio Base.
// Multiplicar por 0.5 es exacto en punto flotante, así que la comparación no pierde precisión.
const UMBRAL_GARANTIA = 0.5;
const MENSAJE_RIESGO = 'Riesgo Financiero por Falta de Pago';

module.exports = { ESTADOS, UMBRAL_GARANTIA, MENSAJE_RIESGO };
