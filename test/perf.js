var cstruct = require('../index')
var hrtime = require('./hrtime')

function perf(f, times){
    var s = hrtime()
    for(var i = 0; i < times; i++){
        f(i)
    }
    return [hrtime(), s]
}
function split() {
  console.log('----------------------------------------')
}

var TestStruct = cstruct.define([
  cstruct.uint32('value')
])
var t = TestStruct.alloc()
var buf = t._buffer
split()

function testDefine() {
  return cstruct.define([
    cstruct.uint32('value')
  ])
}
var define_times = 1e4
var t_define = perf(testDefine, define_times)
console.log('define', define_times, 'times', t_define[0] - t_define[1])
split()

function testNew() {
  return new TestStruct(buf)
}
var new_times = 1e4
var t_new = perf(testNew, new_times)
console.log('new', new_times, 'times', t_new[0] - t_new[1])
split()

function testAlloc() {
  return TestStruct.alloc()
}
var alloc_times = 1e4
var t_alloc = perf(testAlloc, alloc_times)
console.log('alloc', alloc_times, 'times', t_alloc[0] - t_alloc[1])
split()

function testPropertyWRW(val){
    t.value = val
    t.value = t.value + 1
}
function testNativeWRW(val){
    buf.writeInt32LE(val, 0)
    buf.writeInt32LE(buf.readInt32LE(0) + 1, 0)
}
var wrw_times = 1e6
var t_property = perf(testPropertyWRW, wrw_times)
var t_native = perf(testNativeWRW, wrw_times)
console.log('property', wrw_times, 'time', t_property[0] - t_property[1])
console.log('native', wrw_times, 'time', t_native[0] - t_native[1])
