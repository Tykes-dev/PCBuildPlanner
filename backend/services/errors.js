export function badRequest(message, fields) {
  const error = new Error(message); error.status = 400; error.fields = fields; return error;
}

export function unauthorized(message = 'Authentication required.') {
  const error = new Error(message); error.status = 401; return error;
}

export function forbidden(message = 'Administrator access required.') {
  const error = new Error(message); error.status = 403; return error;
}

export function conflict(message) {
  const error = new Error(message); error.status = 409; return error;
}
