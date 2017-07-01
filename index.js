const Types = require('./src/types')
const {create, fromBuffer, toBuffer} = require('./src/fcbuffer')

/**
  @typedef {object} SerializerConfig
  @property {boolean} [SerializerConfig.defaults = false] - Insert in defaults (like 0, false, '000...', or '') for any missing values.  This helps test and inspect what a definition should look like.  Do not enable in production.
  @property {boolean} [SerializerConfig.debug = false] - Prints lots of HEX and field-level information to help debug binary serialization.
  @property {object} [customTypes] - Add or overwrite low level types (see ./src/types.js `const types = {...}`).
*/

/**
  @typedef {object} CreateStruct
  @property {Array<String>} CreateStruct.errors - If any errors exists, no struts will be created.
  @property {Object} CreateStruct.struct - Struct objects keyed by definition name.
  @property {String} CreateStruct.struct.structName - Struct object that will serialize this type.
  @property {Struct} CreateStruct.struct.struct - Struct object that will serialize this type (see ./src/struct.js).
*/

/**
  @arg {object} definitions - examples https://github.com/eosjs/json/blob/master/schema/operations.json
  @arg {SerializerConfig} config
  @return {CreateStruct}
*/
module.exports = (definitions, config) => {
  if(typeof definitions !== 'object') {
    throw new TypeError('definitions is a required parameter')
  }
  const types = Types(config)
  const {errors, structs} = create(definitions, types)
  const extend = (parent, child) => {
    const combined = Object.assign(parent, child)
    const {structs, errors} = create(combined, types)
    return {
      errors,
      structs,
      extend: child => extend(combined, child)
    }
  }
  return {
    errors,
    structs,
    extend: child => extend(definitions, child)
  }
}

module.exports.fromBuffer = fromBuffer
module.exports.toBuffer = toBuffer
