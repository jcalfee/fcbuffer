const ByteBuffer = require('bytebuffer')

/**
  @class Struct

  @arg {object} config.override = {
    'Message.data.appendByteBuffer': ({fields, object, b}) => {..}
  }
  Rare cases where specialized serilization is needed (ex A Message object has
  'type' and 'data' fields where object.type === 'transfer' can define
  serialization time Struct needed for 'data' .. This saves complexity for the
  end-user's working with json.  See override unit test.
*/
module.exports = (name, config = {debug: false}) => {
  config = Object.assign({override: {}}, config)
  const fields = {}
  return {
    /** @private */
    add (fieldName, type) {
      fields[fieldName] = type
    },

    fromByteBuffer (b) {
      let object = {}
      let field = null
      try {
        for (field in fields) {
          const type = fields[field]
          try {
            if (config.debug) {
              if (type.struct) {
                console.error(type.struct)
              } else {
                const o1 = b.offset
                type.fromByteBuffer(b, config)
                const o2 = b.offset
                b.offset = o1
                // b.reset()
                const _b = b.copy(o1, o2)
                console.error(
                  `${name}.${field}\t`,
                  _b.toHex()
                )
              }
            }
            if (field === '') {
              // structPtr
              object = type.fromByteBuffer(b, config)
            } else {
              const fromByteBuffer = config.override[`${name}.${field}.fromByteBuffer`]
              if(fromByteBuffer) {
                fromByteBuffer({fields, object, b, config})
              } else {
                object[field] = type.fromByteBuffer(b, config)
              }
            }
          } catch (e) {
            e.message += ` (${name}.${field})`
            console.error(`Error reading ${name}.${field} in data:`)
            b.printDebug()
            throw e
          }
        }
      } catch (error) {
        error.message += ` ${name}.${field}`
        throw error
      }
      return object
    },

    appendByteBuffer (b, object) {
      let field = null
      try {
        for (field in fields) {
          const type = fields[field]
          if (field === '') {
            // structPtr
            type.appendByteBuffer(b, object)
          } else {
            const appendByteBuffer = config.override[`${name}.${field}.appendByteBuffer`]
            if(appendByteBuffer) {
              appendByteBuffer({fields, object, b})
            } else {
              type.appendByteBuffer(b, object[field])
            }
          }
        }
      } catch (error) {
        try {
          error.message += ' ' + name + '.' + field + ' = ' + JSON.stringify(object[field])
        } catch (e) { // circular ref
          error.message += ' ' + name + '.' + field + ' = ' + object[field]
        }
        throw error
      }
    },

    fromObject (serializedObject) {
      let result = {}
      let field = null
      try {
        for (field in fields) {
          const type = fields[field]
          if (field === '') {
            // structPtr
            const object = type.fromObject(serializedObject)
            result = Object.assign(result, object)
          } else {
            const fromObject = config.override[`${name}.${field}.fromObject`]
            if(fromObject) {
              fromObject({fields, serializedObject, result})
            } else {
              const value = serializedObject[field]
              const object = type.fromObject(value)
              result[field] = object
            }
          }
        }
      } catch (error) {
        error.message += ' ' + name + '.' + field
        throw error
      }

      return result
    },

    toObject (serializedObject = {}) {
      let result = {}
      let field = null
      try {
        if (!fields) { return result }

        for (field in fields) {
          const type = fields[field]

          const toObject = config.override[`${name}.${field}.toObject`]
          if(toObject) {
            toObject({fields, serializedObject, result, config})
          } else {
            const object = type.toObject(serializedObject ? serializedObject[field] : null, config)
            if (field === '') {
              // structPtr
              result = Object.assign(result, object)
            } else {
              result[field] = object
            }
          }

          if (config.debug) {
            try {

              let b = new ByteBuffer(ByteBuffer.DEFAULT_CAPACITY, ByteBuffer.LITTLE_ENDIAN)
              if (serializedObject != null) {
                const value = serializedObject[field]
                if (value) {
                  const appendByteBuffer = config.override[`${name}.${field}.appendByteBuffer`]
                  if(toObject && appendByteBuffer) { // FIXME
                    appendByteBuffer({fields, serializedObject, b})
                  } else {
                    type.appendByteBuffer(b, value)
                  }
                }
              }
              b = b.copy(0, b.offset)
              console.error(name + '.' + field, b.toHex())
            } catch(error) { // work-around to prevent debug time crash
              console.error('DEBUG', name + '.' + field, error.toString())
            }
          }
        }
      } catch (error) {
        error.message += ' ' + name + '.' + field
        throw error
      }
      return result
    },

    /**
      Sort by the first element in a definition. Deterministic ordering is very important.
    */
    compare (a, b) {
      const firstKey = Object.keys(fields)[0]
      const firstType = fields[firstKey]

      const valA = a[firstKey]
      const valB = b[firstKey]

      if (firstType.compare) { return firstType.compare(valA, valB) }

      if (typeof valA === 'number' && typeof valB === 'number') { return valA - valB }

      let encoding
      if (Buffer.isBuffer(valA) && Buffer.isBuffer(valB)) {
        // A binary string compare does not work.  If localeCompare is well
        // supported that could replace HEX.  Performanance is very good so
        // comparing HEX is used for now.
        encoding = 'hex'
      }

      const strA = toString(valA, encoding)
      const strB = toString(valB, encoding)
      return strA > strB ? 1 : strA < strB ? -1 : 0
    }
  }
}

const toString = (value, encoding) =>
  value == null ? null
  : value.toString ? value.toString(encoding)
  : value
