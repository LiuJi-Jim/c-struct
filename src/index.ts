/// <reference path="../typings/node/node.d.ts"/>

import os = require('os')

const sizeMap = {
  UInt8: 1,
  Int8: 1,
  UInt16: 2,
  Int16: 2,
  UInt32: 4,
  Int32: 4,
  Float: 4,
  Double: 8
}

const arrayMap = {
  UInt8: Uint8Array,
  Int8: Int8Array,
  UInt16: Uint16Array,
  Int16: Int16Array,
  UInt32: Uint32Array,
  Int32: Int32Array,
  Float: Float32Array,
  Double: Float64Array
}

const readWriteFuncMap = (function() {
  var proto = Buffer.prototype
  var dict = {};
  ['LE', 'BE'].forEach(function(end) {
    ['UInt16', 'Int16', 'UInt32', 'Int32', 'Float', 'Double'].forEach(function(type) {
      var key = type + end
      dict[key] = [
        proto[`read${key}`],
        proto[`write${key}`]
      ]
    });
    ['UInt8', 'Int8'].forEach(function(type) {
      var key = type + end
      dict[key] = [
        proto[`read${type}`],
        proto[`write${type}`]
      ]
    })
  })
  return dict
})()

function getReadWriteFunc(type: string, endianness: string) {
  // expand conditions for optimizing
  return
}

function defineReadonlyProperty(o: any, name: string, value: any, enumerable = true) {
  Object.defineProperty(o, name, {
    writable: false,
    enumerable: enumerable,
    value: value
  })
}

module cstruct {
  export enum PrimitiveType {
    UInt8,
    Int8,
    UInt16,
    Int16,
    UInt32,
    Int32,
    Float,
    Double
  }

  export type DataType = PrimitiveType | CStructType | Field
  type TypedArray = Uint8Array | Int8Array |
    Uint16Array | Int16Array |
    Uint32Array | Int32Array |
    Float32Array | Float64Array

  export abstract class Field {
    dataType: DataType
    protected _size: number
    constructor(type: DataType) {
      this.dataType = type
    }
    get size(): number {
      return this._size
    }
    abstract define(instance: CStruct, ctor: CStructType, name: string, offset: number)
  }

  export class PrimitiveField extends Field {
    dataType: PrimitiveType
    constructor(type: PrimitiveType) {
      super(type)
      var key = PrimitiveType[type]
      this._size = sizeMap[key]
    }
    define(instance: CStruct, ctor: CStructType, name: string, offset: number) {
      var field = this
      var typeName = <string>PrimitiveType[field.dataType]
      var endianness = instance._endianness
      var buffer = instance._buffer
      var [readFunc, writeFunc] = readWriteFuncMap[typeName + endianness]
      Object.defineProperty(instance, name, {
        enumerable: true,
        get: function() {
          return readFunc.call(buffer, offset)
        },
        set: function(value) {
          return writeFunc.call(buffer, value, offset)
        }
      })
    }
  }

  export class StructField extends Field {
    dataType: CStructType
    constructor(type: CStructType) {
      super(type)
      this._size = type.size
    }
    define(instance: CStruct, ctor: CStructType, name: string, offset: number) {
      var field = this
      var subCtor = field.dataType
      Object.defineProperty(instance, name, {
        enumerable: true,
        get: function() {
          var me = <CStruct>this
          var key = `__${name}__`
          if (me[key] === undefined) {
            var buf = me._buffer.slice(offset, ctor.size)
            me[key] = new subCtor(buf, me._endianness)
          }
          return me[key]
        }
      })
    }
  }

  export class ArrayField extends Field {
    dataType: Field
    length: number
    constructor(field: Field, length: number) {
      super(field)
      this.length = length
      this._size = length * field.size
    }
    define(instance: CStruct, ctor: CStructType, name: string, offset: number) {
      var getter = arrayReader(this, offset)
      Object.defineProperty(instance, name, {
        enumerable: true,
        get: function() {
          var me = <CStruct>this
          var key = `__${name}__`
          if (me[key] === undefined) {
            me[key] = getter(me)
          }
          return me[key]
        }
      })
    }
  }

  function primitiveArrayReader(type: PrimitiveType, length: number, offset: number): (me: CStruct) => TypedArray {
    var typeName = <string>PrimitiveType[type]
    var arrayCtor = arrayMap[typeName]
    return function get(me: CStruct) {
      var arrayBuffer = me._buffer.buffer
      var byteOffset = me._buffer.byteOffset + offset
      var arr = new arrayCtor(arrayBuffer, byteOffset, length)
      return arr
    }
  }

  function structArrayReader(ctor: CStructType, length: number, offset: number): (me: CStruct) => CStruct[] {
    return function get(me: CStruct) {
      var buffer = me._buffer
      var arr = new Array(length)
      var off = offset
      var size = ctor.size
      for (var i = 0; i < length; ++i) {
        var buf = buffer.slice(off, off + size)
        arr[i] = new ctor(buf)
        off += size
      }
      return arr
    }
  }

  function arrayReader(arrayField: ArrayField, offset: number): (me: CStruct) => (TypedArray | CStruct[] | any[][]) {
    var dataType = arrayField.dataType
    var length = arrayField.length
    if (dataType instanceof PrimitiveField) {
      // Array of Primitive Types
      // Define a readonly getter of TypedArray
      var primitive = (<PrimitiveField>dataType).dataType
      return primitiveArrayReader(primitive, length, offset)
    } else if (dataType instanceof StructField) {
      // Array of CStruct Types
      var ctor = (<StructField>dataType).dataType
      return structArrayReader(ctor, length, offset)
    } else {
      var elemField = (<ArrayField>dataType)
      return function get(me: CStruct) {
        var arr = new Array(length)
        var size = elemField.size
        var off = offset
        for (var i = 0; i < length; ++i) {
          var getLine = arrayReader(elemField, off)
          off += size
          var line = getLine(me)
          arr[i] = line
        }
        return arr
      }
    }
  }

  export interface Definition {
    name: string
    field: Field
  }

  export interface CStruct {
    _copy(): CStruct
    _buffer: Buffer
    _endianness: string
  }

  export interface CStructType {
    (buf: Buffer, endianness?: string): void
    definitions?: Definition[]
    size?: number
    alloc?(endianness?: string): CStruct
  }

  export function define(definitions: Definition[]): CStructType {
    var ctor: CStructType = function(buffer: Buffer, endianness?: string) {
      var me = <CStruct>this
      defineReadonlyProperty(me, '_buffer', buffer, false)
      defineReadonlyProperty(me, '_endianness', endianness !== undefined ? endianness : os.endianness(), false)

      var offset = 0
      for (var i = 0, len = definitions.length; i < len; ++i) {
        var def = definitions[i]
        if (def.name !== '_') {
          // discard padding fields
          def.field.define(me, ctor, def.name, offset)
        }
        offset += def.field.size
      }
    }

    var size = 0
    for (var i = 0, len = definitions.length; i < len; ++i) {
      var def = definitions[i]
      size += def.field.size
    }

    function alloc(endianness?: string): CStruct {
      var buffer = new Buffer(size)
      return <CStruct>(new ctor(buffer, endianness))
    }

    function copy(): CStruct {
      var me = <CStruct>this
      var buffer = new Buffer(<any>me._buffer)
      return <CStruct>(new ctor(buffer))
    }

    defineReadonlyProperty(ctor.prototype, '_copy', copy, false)
    defineReadonlyProperty(ctor, 'size', size)
    defineReadonlyProperty(ctor, 'definitions', definitions)
    defineReadonlyProperty(ctor, 'alloc', alloc)

    return ctor as CStructType
  }

  export function field(name: string, field: Field) {
    return {
      name: name,
      field: field
    }
  }

  export var UInt8 = new PrimitiveField(PrimitiveType.UInt8)
  export var Int8 = new PrimitiveField(PrimitiveType.Int8)
  export var UInt16 = new PrimitiveField(PrimitiveType.UInt16)
  export var Int16 = new PrimitiveField(PrimitiveType.Int16)
  export var UInt32 = new PrimitiveField(PrimitiveType.UInt32)
  export var Int32 = new PrimitiveField(PrimitiveType.Int32)
  export var Float = new PrimitiveField(PrimitiveType.Float)
  export var Double = new PrimitiveField(PrimitiveType.Double)

  export function primitive(name: string, field: PrimitiveField): Definition {
    return {
      name: name,
      field: field
    }
  }

  export function uint8(name: string): Definition {
    return primitive(name, UInt8)
  }

  export function int8(name: string): Definition {
    return primitive(name, Int8)
  }

  export function uint16(name: string): Definition {
    return primitive(name, UInt16)
  }

  export function int16(name: string): Definition {
    return primitive(name, Int16)
  }

  export function uint32(name: string): Definition {
    return primitive(name, UInt32)
  }

  export function int32(name: string): Definition {
    return primitive(name, Int32)
  }

  export function float(name: string): Definition {
    return primitive(name, Float)
  }

  export function double(name: string): Definition {
    return primitive(name, Double)
  }

  export function struct(name: string, ctor: CStructType): Definition {
    return {
      name: name,
      field: new StructField(ctor)
    }
  }

  export function array(name: string, type: DataType, length: number): Definition {
    return {
      name: name,
      field: arrayOf(type, length)
    }
  }

  export function arrayOf(type: DataType, length: number): Field {
    if (typeof type === 'object') {
      return new ArrayField(<Field>type, length)
    } else {
      var field = new StructField(<CStructType>type)
      return new ArrayField(field, length)
    }
  }

  export function padding(): Definition {
    return primitive('_', UInt8)
  }
}


export = cstruct
