const { Router } = require('express');
const { crearTrabajadoresController } = require('../controllers/trabajadores.controller');

function crearTrabajadoresRouter(servicios) {
  const c = crearTrabajadoresController(servicios);
  const router = Router();

  router.post('/', c.crear);
  router.get('/', c.listar);
  router.get('/disponibles', c.disponibles); // debe ir antes de '/:id'
  router.get('/:id', c.obtener);

  return router;
}

module.exports = { crearTrabajadoresRouter };
