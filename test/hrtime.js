module.exports = function hrtime() {
  var [seconds, nanoseconds] = process.hrtime()
  return seconds * 1e3 + nanoseconds / 1e6
}
