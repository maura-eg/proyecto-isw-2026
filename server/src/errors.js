class AppError extends Error {
  constructor(mensaje, status, codigo, detalles) {
    super(mensaje);
    this.name = this.constructor.name;
    this.status = status;
    this.codigo = codigo;
    this.detalles = detalles;
  }
}

class ValidationError extends AppError {
  constructor(detalles) {
    super('Datos inválidos', 400, 'VALIDACION', detalles);
  }
}

class NotFoundError extends AppError {
  constructor(mensaje = 'Recurso no encontrado') {
    super(mensaje, 404, 'NO_ENCONTRADO');
  }
}

class ConflictError extends AppError {
  constructor(mensaje) {
    super(mensaje, 409, 'CONFLICTO');
  }
}

module.exports = { AppError, ValidationError, NotFoundError, ConflictError };
