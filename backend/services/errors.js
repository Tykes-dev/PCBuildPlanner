export function badRequest(message, fields) {
  const error = new Error(message); error.status = 400; error.fields = fields; return error;
}
