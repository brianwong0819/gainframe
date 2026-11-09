// CloudFront Function (cloudfront-js-2.0) on viewer requests to the static site.
// The static export writes /workout as workout.html; S3 has no notion of routes.
// Paths with a file extension pass through; a known route maps to its .html
// file; anything else is served 404.html. Attached to the site behaviour only,
// so API responses are never rewritten.
//
// main.tf substitutes the routes in routes.json, as { "/path": true }, for the
// placeholder below.
var routes = ROUTE_TABLE

function handler(event) {
  var request = event.request
  var uri = request.uri
  var name = uri.slice(uri.lastIndexOf('/') + 1)
  if (name.indexOf('.') !== -1) return request

  var route = uri.length > 1 && uri.endsWith('/') ? uri.slice(0, -1) : uri
  if (route === '/') {
    request.uri = '/index.html'
  } else if (routes[route] === true) {
    request.uri = route + '.html'
  } else {
    request.uri = '/404.html'
  }
  return request
}
