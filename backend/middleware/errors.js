export function notFound(req, res) { res.status(404).json({ message: 'Endpoint not found' }); }
export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  let status = error.status || 500;
  let fields = error.fields;
  let message = error.message;
  if (error.name === 'ValidationError') { status = 400; message = 'Validation failed'; fields = Object.fromEntries(Object.entries(error.errors).map(([k, v]) => [k, v.message])); }
  if (error.name === 'CastError') { status = 400; message = 'Invalid ID or field value'; }
  if (error.code === 11000) { status = 409; message = 'A record with these unique values already exists.'; }
  if (status === 500) { console.error('API request failed:', error.name); message = 'An unexpected server error occurred.'; }
  res.status(status).json({ message, ...(fields ? { fields } : {}) });
}
