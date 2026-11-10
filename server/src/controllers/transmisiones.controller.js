// Los controladores solo traducen HTTP <-> servicios. En Express 5 los errores de
// funciones async llegan solos al middleware de errores, sin try/catch.
function crearTransmisionesController({ transmisiones, asignaciones }) {
  return {
    // RF2
    crear: async (req, res) => {
      res.status(201).json(await transmisiones.agendar(req.body));
    },
    // RF3
    listar: async (req, res) => {
      res.json(await transmisiones.listar());
    },
    obtener: async (req, res) => {
      res.json(await transmisiones.obtener(req.params.id));
    },
    registrarAbono: async (req, res) => {
      res.json(await transmisiones.registrarAbono(req.params.id, req.body));
    },
    // RF4
    asignar: async (req, res) => {
      res.status(201).json(await asignaciones.asignar(req.params.id, req.body));
    },
    nomina: async (req, res) => {
      res.json(await asignaciones.nomina(req.params.id));
    },
    desasignar: async (req, res) => {
      await asignaciones.desasignar(req.params.id, req.params.asignacionId);
      res.status(204).end();
    },
  };
}

module.exports = { crearTransmisionesController };
