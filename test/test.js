var cstruct = require('../index')

function dumpArray(arr, mapper) {
  mapper = mapper || String
  return '[' + arr.map(mapper).join(', ') + ']'
}

var Simple = cstruct.define(
  cstruct.uint8('first'),
  cstruct.int8('second')
)
Simple.prototype.toString = function() {
  return `(${this.first}, ${this.second})`
}

var FirstBlood = cstruct.define(
  cstruct.uint8('first'),
  cstruct.int8('second'),
  cstruct.struct('simple', Simple),
  cstruct.array('array', cstruct.Int32, 8),
  cstruct.array('simples', Simple, 4),
  cstruct.array('array2d', cstruct.arrayOf(
    cstruct.Int8, 8
  ), 4),
  cstruct.array('simples2d', cstruct.arrayOf(
    Simple, 2
  ), 4)
)

console.log(FirstBlood)

var buffer = new Buffer(FirstBlood.size)
for (var i = 0; i < buffer.length; ++i) {
  buffer[i] = i
}
console.log(buffer)
var fb = new FirstBlood(buffer)

console.log(fb)

console.log('first', '=', fb.first)
console.log('second', '=', fb.second)

console.log('simple', '=', fb.simple.toString())

console.log('array', '=', dumpArray(fb.array))

console.log('simples', '=', dumpArray(fb.simples))

for (var i = 0; i < fb.array2d.length; ++i) {
  var array = fb.array2d[i]
  console.log(`array2d[${i}]`, '=', dumpArray(array))
}

for (var i = 0; i < fb.simples2d.length; ++i) {
  var array = fb.simples2d[i]
  console.log(`simples2d[${i}]`, '=', dumpArray(array))
}
