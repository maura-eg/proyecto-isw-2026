const express = require('express');
const cors = require('cors');
const { crearRepositorios } = require('./repositories/memoria');
const { crearServicios } = require('./services');
const { crearTransmisionesRouter } = require('./routes/transmisiones.routes');
const { crearTrabajadoresRouter } = require('./routes/trabajadores.routes');
const { rutaNoEncontrada, manejadorErrores } = require('./middleware/errores');

function crearApp({ repos = crearRepositorios() } = {}) {
  const app = express();
  const servicios = crearServicios(repos);

  app.use(cors());
  app.use(express.json());

  app.get('/api', (req, res) => {
    res.json({ status: 'ok', mensaje: 'Servidor del proyecto funcionando correctamente' });
  });

  app.use('/api/transmisiones', crearTransmisionesRouter(servicios));
  app.use('/api/trabajadores', crearTrabajadoresRouter(servicios));

  app.use('/api', rutaNoEncontrada);
  app.use(manejadorErrores);

  return app;
}

module.exports = { crearApp };
