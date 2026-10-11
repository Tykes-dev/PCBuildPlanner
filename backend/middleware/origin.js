// A browser attaches the session cookie to any request it makes, including one
// started by another site. CORS alone does not stop that, because the request
// still reaches the server. Anything that writes is therefore refused unless it
// came from an origin the shop runs.
export function sameOriginWrites(allowedOrigins) {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  return (req, res, next) => {
    const origin = req.headers.origin;
    const crossSite = (origin && !allowedOrigins.includes(origin))
      || req.headers['sec-fetch-site'] === 'cross-site';
    if (!safeMethods.includes(req.method) && crossSite) {
      return res.status(403).json({ message: 'Request origin is not allowed.' });
    }
    next();
  };
}