export function isLocalhost(req: Request) {
  return req.url.startsWith("http://localhost");
}
