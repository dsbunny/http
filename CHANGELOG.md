# Changelog
## v2.0.5
- Style request and response body in _grey_, splitting into separate lines due to `docker log` resetting ANSI style per line.
- Change HTTP command line to cyan.

## v2.0.4
- Always log body for HTTP/400-599 errors.
- Enable HTTP/400-499 errors to exit early on retry.

## v2.0.3
- Add `contentLength` and `contentMd5` fields to responses of `putJson()`,
  `postJson()`, and `patchJson()`.
- Breaking ABI change.

## v1.2.2
- Add `conditionalRequestGuards()` API for ExpressJS handlers.
- Add workaround for `PUT` returning 304 from Minio.

## v1.1.1
- Add `serverTimings()` API for ExpressJS performance monitoring.

## v1.0.0
- Initial release.
