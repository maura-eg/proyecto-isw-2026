const { crearTransmisionesService } = require('./transmisiones.service');
const { crearTrabajadoresService } = require('./trabajadores.service');
const { crearAsignacionesService } = require('./asignaciones.service');

function crearServicios(repos) {
  return {
    transmisiones: crearTransmisionesService({ repos }),
    trabajadores: crearTrabajadoresService({ repos }),
    asignaciones: crearAsignacionesService({ repos }),
  };
}

module.exports = { crearServicios };
