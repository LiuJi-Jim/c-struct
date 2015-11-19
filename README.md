# c-struct

A node.js package to deal with c-structs in an easy way.

# How to Use

## Struct definition

```
var cstruct = require('c-struct')

var Simple = cstruct.define(
  cstruct.uint8('first'),
  cstruct.int8('second')
)

Simple.size // 2

var buffer = new Buffer(Simple.size)
buffer[0] = 1
buffer[1] = 10
// buffer is [01 0a]

var one = new Simple(buffer)
one.first // 1
one.second // 10
// buffer is a nodejs Buffer instance
// which matches the raw memory layout of struct Simple
// just like casting a byte* to simple* in C

var another = Simple.alloc() // or you can alloc a new buffer

one.first += 10
one.second += 20
// operations on the fields will be proxied to the raw buffer
// thus mutates buffer to [0b, 1e]

one._buffer === buffer // true
```

## Docs

### Defining a Struct Type

```
var MyStruct = cstruct.define(...definitions: Definition): CStructType
```

### Types

#### Primitive Types

```
cstruct.uint8(name: string): Definition
cstruct.int8(name: string): Definition
cstruct.uint16(name: string): Definition
cstruct.int16(name: string): Definition
cstruct.uint32(name: string): Definition
cstruct.int32(name: string): Definition
cstruct.float(name: string): Definition
cstruct.double(name: string): Definition
// just use them like the Simple example above
```

### Arrays

```
cstruct.array(
  name: string,
  type: DataType,
  length: number
): Definition
```

in which `DataType` could be primitive types below, and will be proxied as JavaScript Typed Arrays

```
cstruct.UInt8  // -> Uint8Array
cstruct.Int8   // -> Int8Array
cstruct.UInt16 // -> Uint16Array
cstruct.Int16  // -> Int16Array
cstruct.UInt32 // -> Uint32Array
cstruct.Int32  // -> Int32Array
cstruct.Float  // -> Float32Array
cstruct.Double // -> Float64Array
```

e.g.

```
var List = cstruct.define(
  cstruct.array('values', cstruct.Uint8, 16)
)
```

or other `CStructType`, e.g.

```
var Complex = cstruct.define(
  cstruct.array('list', Simple, 4)
)
// list field will be proxed as Array<Simple>
```

or arrays

```
var Matrix4 = cstruct.define(
  cstruct.array('data', cstruct.arrayOf(
    cstruct.Float, 4
  ), 4)
)
// data field will be proxied as Array<Float32Array>
```

or arrays (of arrays (of arrays (of arrays (of arrays (of arrays (of arrays (of arrays ...)))))))

but note that array fields have only getters, so if you wanted to mutate the entire array, you must mutate the elements one by one.

### Nested Structs

structs could be nested

```
var Point = cstruct.define(
  cstruct.float('x'),
  cstruct.float('y')
)
var Segment = cstruct.define(
  cstruct.struct('start', Point),
  cstruct.struct('end', Point)
)
```

still note that nested struct fields have only getters.

### Other APIs

```
// CStructType below infers any Struct you defined

new CStructType(buffer: Buffer, endianness?: string) // 'LE' or 'BE' to specify endianness. default to os.endianness

CStructType.size // byte size of this type

CStructType.alloc(endianness?: string) // allocate a new Buffer and returns the struct instance build on it

instance._copy() // copy the instance's Buffer and returns a new instance build on it. this is deep clone

instance._buffer // get the buffer on which the instance is built

instance._endianness // get the instance's endianness
```

## Tips

### Byte Alignment

c-struct doesn't deal with byte alignment. sometimes your definition will suck if it doesn't fit byte alignments, for example:

```
var MyType = cstruct.define(
  cstruct.uint8('first'),
  cstruct.uint8('second'),
  cstruct.array('arr', cstruct.Int32, 4)
)
var mt = MyType.alloc()
mt.arr // sucked
```

`mt.arr` above will raise an exception like 'RangeError: start offset of Int32Array should be a multiple of 4'.

to fix this you must manually deal with byte alignment, you can put padding fields to match the C struct's memory layout. e.g.

```
var MyType = cstruct.define(
  cstruct.uint8('first'),
  cstruct.uint8('second'),
  cstruct.padding(),
  cstruct.padding(),
  cstruct.array('arr', cstruct.Int32, 4)
)
var mt = MyType.alloc()
mt.arr // oh yeah
```

### Byte Order

when you build an instance on a Buffer or allocate one, you can specify the byte order of this instance reading and writing it's Buffer. once you specified an instance's byte order it couldn't be changed.

note that JavaScript Typed Arrays always use the current platform's byte order.

basically you needn't care about byte order too much unless you are writing cross-platform programs or programs dealing with raw network packages.
