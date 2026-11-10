// Repositorios en memoria.
// Son el único punto que habla con "la base de datos": para pasar a una BD real
// (PostgreSQL, MySQL, MongoDB...) se reimplementa este módulo con la misma interfaz
// y el resto del backend no cambia. Todos los métodos son async por ese motivo.
//
// Nota: los datos se pierden al reiniciar el servidor.

function crearRepositorios() {
  const tablas = {
    transmisiones: new Map(),
    trabajadores: new Map(),
    asignaciones: new Map(),
  };
  const ultimoId = { transmisiones: 0, trabajadores: 0, asignaciones: 0 };
  const copia = (fila) => (fila ? { ...fila } : null);

  function repositorio(nombre) {
    const tabla = tablas[nombre];
    return {
      async crear(datos) {
        const fila = { id: ++ultimoId[nombre], ...datos, createdAt: new Date().toISOString() };
        tabla.set(fila.id, fila);
        return copia(fila);
      },
      async buscarPorId(id) {
        return copia(tabla.get(id));
      },
      async listar() {
        return [...tabla.values()].map(copia);
      },
      async actualizar(id, cambios) {
        const fila = tabla.get(id);
        if (!fila) return null;
        Object.assign(fila, cambios);
        return copia(fila);
      },
      async eliminar(id) {
        return tabla.delete(id);
      },
    };
  }

  const asignaciones = {
    ...repositorio('asignaciones'),
    async buscar(transmisionId, trabajadorId) {
      const fila = [...tablas.asignaciones.values()].find(
        (a) => a.transmisionId === transmisionId && a.trabajadorId === trabajadorId,
      );
      return copia(fila);
    },
    async listarPorTransmision(transmisionId) {
      return [...tablas.asignaciones.values()]
        .filter((a) => a.transmisionId === transmisionId)
        .map(copia);
    },
  };

  return {
    transmisiones: repositorio('transmisiones'),
    trabajadores: repositorio('trabajadores'),
    asignaciones,
  };
}

module.exports = { crearRepositorios };
