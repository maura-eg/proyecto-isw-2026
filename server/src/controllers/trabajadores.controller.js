function crearTrabajadoresController({ trabajadores, asignaciones }) {
  return {
    crear: async (req, res) => {
      res.status(201).json(await trabajadores.crear(req.body));
    },
    listar: async (req, res) => {
      res.json(await trabajadores.listar());
    },
    // GET /api/trabajadores/disponibles?fecha=AAAA-MM-DD
    disponibles: async (req, res) => {
      res.json(await asignaciones.trabajadoresDisponibles(req.query.fecha));
    },
    obtener: async (req, res) => {
      res.json(await trabajadores.obtener(req.params.id));
    },
  };
}

module.exports = { crearTrabajadoresController };
