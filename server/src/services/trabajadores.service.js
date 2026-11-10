const { NotFoundError } = require('../errors');
const { parseId } = require('../validators/comunes');
const { validarNuevoTrabajador } = require('../validators/trabajador.validator');

function crearTrabajadoresService({ repos }) {
  async function crear(body) {
    return repos.trabajadores.crear(validarNuevoTrabajador(body));
  }

  async function listar() {
    const todos = await repos.trabajadores.listar();
    return todos.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  async function obtener(idParam) {
    const trabajador = await repos.trabajadores.buscarPorId(parseId(idParam));
    if (!trabajador) throw new NotFoundError('Trabajador no encontrado');
    return trabajador;
  }

  return { crear, listar, obtener };
}

module.exports = { crearTrabajadoresService };
