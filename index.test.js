/* eslint-env mocha */
const assert = require('assert')
const ByteBuffer = require('bytebuffer')

const Fcbuffer = require('.')
const Types = require('./src/types')
const Struct = require('./src/struct')
const {create} = require('./src/fcbuffer')

describe('API', function () {
  it('Bytes', function () {
    const {Bytes} = Types()
    const type = Bytes()
    assertSerializer(type, '00aaeeff')
    assertRequired(type)
  })

  it('String', function () {
    const {String} = Types()
    const type = String()
    assertSerializer(type, '爱')
    assertRequired(type)
  })

  it('Vector', function () {
    const {Vector, String} = Types()
    const type = Vector(String())
    throws(() => Vector('String'), /Vector type should be a serializer/)
    assertSerializer(type, ['z', 'a', 'z']) // does not sort
    assertRequired(type)
  })

  it('FixedBytes', function () {
    const {FixedBytes16} = Types()
    const type = FixedBytes16()
    assertSerializer(type, Array(16 + 1).join('ff')) // hex string
    throws(() => assertSerializer(type, Array(17 + 1).join('ff')), /FixedBytes16 length 17 does not equal 16/)
    assertRequired(type)
  })

  it('FixedString', function () {
    const {FixedString16} = Types()
    const type = FixedString16()
    assertSerializer(type, '1234567890123456')
    throws(() => assertSerializer(type, '12345678901234567'), /exceeds maxLen 16/)
    assertRequired(type)
  })

  it('TypesAll', function () {
    const types = Types()
    for (let typeName of Object.keys(types)) {
      const fn = types[typeName]
      if (typeof fn === 'function') {
        fn(types.String())
      }
    }
  })

  it('Time', function () {
    const {Time} = Types()
    const type = Time()

    throws(() => type.fromObject({}), /Unknown date type/)
    type.fromObject(new Date())
    type.fromObject(1000)
    type.fromObject('1970-01-01T00:00:00')

    assertSerializer(type, '1970-01-01T00:00:00Z')
    assertSerializer(type, '2106-02-07T06:28:15Z')
    throws(() => assertSerializer(type, '1969-12-31T23:59:59Z'), /Overflow/)
    throws(() => assertSerializer(type, '2106-02-07T06:28:16Z'), /Overflow/)
    assertRequired(type)
  })

  it('Optional', function () {
    const {Optional, String} = Types()
    const type = Optional(String())
    throws(() => Optional('String'), /Optional parameter should be a serializer/)
    assertSerializer(type, 'str')
    assertSerializer(type, null)
    assertSerializer(type, undefined)
  })

  it('UInt', function () {
    const {UInt8} = Types()
    const type = UInt8()
    assertSerializer(type, 0)
    assertSerializer(type, 255)
    throws(() => assertSerializer(type, 256), /Overflow/)
    throws(() => assertSerializer(type, -1), /Overflow/)
    assertRequired(type)
  })

  it('UInt64', function () {
    const {UInt64} = Types()
    const type = UInt64()

    assertSerializer(type, '18446744073709551615')
    assertSerializer(type, '0')
    throws(() => assertSerializer(type, '18446744073709551616'), /Overflow/)
    throws(() => assertSerializer(type, '-1'), /Overflow/)
    assertRequired(type)
  })

  it('Int', function () {
    const {Int8} = Types()
    const type = Int8()
    assertSerializer(type, -128)
    assertSerializer(type, 127)
    throws(() => assertSerializer(type, -129), /Overflow/)
    throws(() => assertSerializer(type, 128), /Overflow/)
    assertRequired(type)
  })

  it('Int64', function () {
    const {Int64} = Types()
    const type = Int64()

    assertSerializer(type, '9223372036854775807')
    assertSerializer(type, '-9223372036854775808')
    throws(() => assertSerializer(type, '9223372036854775808'), /Overflow/)
    throws(() => assertSerializer(type, '-9223372036854775809'), /Overflow/)
    assertRequired(type)
  })

  it('Struct', function () {
    const {Vector, UInt16, FixedBytes33} = Types()

    const KeyPermissionWeight = Struct('KeyPermissionWeight')
    KeyPermissionWeight.add('key', FixedBytes33())
    KeyPermissionWeight.add('weight', UInt16())

    const type = Vector(KeyPermissionWeight)
    assertSerializer(type, [
      {key: Array(33 + 1).join('00'), weight: 1},
      {key: Array(33 + 1).join('00'), weight: 1}
    ])
  })
})

describe('JSON', function () {
  it('Structure', function () {
    assertCompile({Struct: {fields: {checksum: 'FixedBytes32'}}})
    throws(() => assertCompile({Struct: {}}), /Expecting Struct.fields or Struct.base/)
    throws(() => assertCompile({Struct: {base: {obj: 'val'}}}), /Expecting string/)
    throws(() => assertCompile({Struct: {fields: 'String'}}), /Expecting object/)
    throws(() => assertCompile({Struct: {fields: {name: {obj: 'val'}}}}), /Expecting string in/)
    throws(() => assertCompile({Struct: 0}), /Expecting object or string/)
  })

  it('Debug', function () {
    assertCompile(
      {Name: 'String', Person: {fields: {name: 'Name'}}},
      {defaults: true, debug: true}
    )
  })

  it('typedef', function () {
    throws(() => assertCompile({Type: 'UnknownType'}), /Unrecognized type/)
    assertCompile({Name: 'String', Person: {fields: {name: 'Name'}}})
    assertCompile({Name: 'String', MyName: 'Name', Person: {fields: {name: 'MyName'}}})
  })

  it('typedef', function () {
    assertCompile({Event: {fields: {time: 'Time'}}})
  })

  it('Inherit', function () {
    throws(() => assertCompile({Struct: {fields: {name: 'Name'}}}), /Missing Name/)
    throws(() => assertCompile({Struct: {base: 'String'}}), /Missing String in Struct.base/)
    throws(() => assertCompile({
      Person: {base: 'Human', fields: {name: 'String'}}}
    ), /Missing Human/)

    throws(() => assertCompile({
      Human: 'String', // Human needs to be struct not a type
      Person: {base: 'Human', fields: {name: 'String'}}}
    ), /Missing Human/)

    assertCompile({
      Boolean: 'UInt8',
      Human: {fields: {Alive: 'Boolean'}},
      Person: {base: 'Human', fields: {name: 'String'}}
    })
  })

  it('Optional', function () {
    const {Person} = assertCompile({Person: {fields: {name: 'String?'}}}, {defaults: false})
    assertSerializer(Person, {name: 'Jane'})
    assertSerializer(Person, {name: null})
    assertSerializer(Person, {name: undefined})
    // assertSerializer(Person, {})  {"name": [null]} // TODO ???
  })

  it('Vectors', function () {
    throws(() => assertCompile({Person: {fields: {name: 'Vector[TypeArg]'}}}), /Missing TypeArg/)
    throws(() => assertCompile({Person: {fields: {name: 'BaseType[]'}}}), /Missing BaseType/)
    throws(() => assertCompile({Person: {fields: {name: 'BaseType[String]'}}}), /Missing BaseType/)
    assertCompile({Person: {fields: {name: 'Vector[String]'}}})
    assertCompile({Person: {fields: {name: 'String'}}, Conference: {fields: {attendees: 'Person[]'}}})
    const {Person} = assertCompile({Person: {fields: {friends: 'String[]'}}})
    assertSerializer(Person, {friends: ['Jane', 'Dan']})
  })

  it('Errors', function () {
    const {structs} = create({Struct: {fields: {age: 'String'}}}, Types({defaults: true}))
    const type = structs.Struct
    throws(() => Fcbuffer.fromBuffer(type, Buffer.from('')), /Illegal offset/)
  })
})

describe('Override', function () {
  it('Struct', function () {
    const definitions = {
      Message: {
        fields: {
          type: 'String', // another definition (like transfer)
          data: 'Bytes'
        }
      },
      transfer: {
        fields: {
          from: 'String',
          to: 'String'
        }
      }
    }
    const config = {
      override: {
        'Message.data.fromByteBuffer': ({fields, object, b, config}) => {
          const ser = (object.type || '') == '' ? fields.data : structs[object.type]
          b.readVarint32()
          object.data = ser.fromByteBuffer(b, config)
        },
        'Message.data.appendByteBuffer': ({fields, object, b}) => {
          const ser = (object.type || '') == '' ? fields.data : structs[object.type]
          const b2 = new ByteBuffer(ByteBuffer.DEFAULT_CAPACITY, ByteBuffer.LITTLE_ENDIAN)
          ser.appendByteBuffer(b2, object.data)
          b.writeVarint32(b2.offset)
          b.append(b2.copy(0, b2.offset), 'binary')
        },
        'Message.data.fromObject': ({fields, serializedObject, result}) => {
          const {data, type} = serializedObject
          const ser = (type || '') == '' ? fields.data : structs[type]
          result.data = ser.fromObject(data)
        },
        'Message.data.toObject': ({fields, serializedObject, result, config}) => {
          const {data, type} = serializedObject || {}
          const ser = (type || '') == '' ? fields.data : structs[type]
          result.data = ser.toObject(data, config)
        },
      }
    }
    const {structs, errors} = create(definitions, Types(config))
    assert.equal(errors.length, 0)
    assertSerializer(structs.Message, {
      type: 'transfer',
      data: {
        from: 'slim',
        to: 'charles'
      }
    })
  })
})

function assertCompile (definitions, config) {
  config = Object.assign({defaults: true, debug: false}, config)
  const {errors, structs} = create(definitions, Types(config))
  assert.equal(errors.length, 0, errors[0])
  assert(Object.keys(structs).length > 0, 'expecting struct(s)')
  for (const struct in structs) {
    const type = structs[struct]
    // console.log(struct, JSON.stringify(structs[struct].toObject(), null, 0), '\n')
    assertSerializer(type, type.toObject())
  }
  return structs
}

function assertSerializer (type, value) {
  const obj = type.fromObject(value) // tests fromObject
  const buf = Fcbuffer.toBuffer(type, obj) // tests appendByteBuffer
  const obj2 = Fcbuffer.fromBuffer(type, buf) // tests fromByteBuffer

  // tests toObject
  deepEqual(value, type.toObject(obj), 'serialize object')
  deepEqual(type.toObject(obj), obj2, 'serialize buffer')
}

function assertRequired (type) {
  throws(() => assertSerializer(type, null), /Required/)
  throws(() => assertSerializer(type, undefined), /Required/)
}

/* istanbul ignore next */
function deepEqual (arg1, arg2, message) {
  try {
    assert.deepEqual(arg1, arg2, message)
    // console.log('deepEqual arg1', arg1, '\n', JSON.stringify(arg1))
    // console.log('deepEqual arg2', arg2, '\n', JSON.stringify(arg2))
  } catch (error) {
    // console.error('deepEqual arg1', arg1, '\n', JSON.stringify(arg1))
    // console.error('deepEqual arg2', arg2, '\n', JSON.stringify(arg2))
    throw error
  }
}

/* istanbul ignore next */
function throws (fn, match) {
  try {
    fn()
    assert(false, 'Expecting error')
  } catch (error) {
    if (!match.test(error)) {
      error.message = `Error did not match ${match}\n${error.message}`
      throw error
    }
  }
}
