const { Router } = require('express');
const { crearTransmisionesController } = require('../controllers/transmisiones.controller');

function crearTransmisionesRouter(servicios) {
  const c = crearTransmisionesController(servicios);
  const router = Router();

  router.post('/', c.crear); // RF2
  router.get('/', c.listar); // RF3
  router.get('/:id', c.obtener);
  router.patch('/:id/abono', c.registrarAbono);

  router.post('/:id/asignaciones', c.asignar); // RF4
  router.get('/:id/nomina', c.nomina);
  router.delete('/:id/asignaciones/:asignacionId', c.desasignar);

  return router;
}

module.exports = { crearTransmisionesRouter };
