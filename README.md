[![Build Status](https://travis-ci.org/jcalfee/fcbuffer.svg?branch=master)](https://travis-ci.org/jcalfee/fcbuffer)
[![Coverage Status](https://coveralls.io/repos/github/jcalfee/fcbuffer/badge.svg?branch=master)](https://coveralls.io/github/jcalfee/fcbuffer?branch=master)

# FC Buffer

Serialization library geared towards immutable data storage such as blockchains.

Project status: Beta. FC Buffer is a recent refactor from serialization code used in
Bitshares and Steem.  Some of the serialization code was reduced and the definitions
language added.  The definition format may change.

# Features

- Validation and error reporting
- Concise and intuitive binary format
- Compatible with the FC library used in Graphene blockchains
- Extendable JSON structure definitions
- Binary and JSON string serialization
- Unit testing and code coverage

# Non Features

- Consider Cap'n Proto or Protocol Buffers if your data structures need to be extended
  at the serialization layer.
- No streams, usually smaller objects will work

# Example

```javascript
Fcbuffer = require('fcbuffer') // or: Fcbuffer = require('.')
assert = require('assert')

const definitions = {
    MessageType: 'FixedString16', // CustomType: built-in type
    AccountName: 'FixedString32', // CustomType: built-in type
    Message: { // struct
        fields: {
          from: 'AccountName',
          to: 'AccountName',
          cc: 'AccountName[]',
          type: 'MessageType',
          data: 'Bytes' // built-in type
        }
    }
}

// Warning: Do not use {defaults: true} in production
fcbuffer = Fcbuffer(definitions, {defaults: true})

// Check for errors anywhere in the definitions structure
assert(fcbuffer.errors.length === 0, fcbuffer.errors)

// If there are no errors, you'll get your structs
var {Message} = fcbuffer.structs

// Create JSON serializable object
// returns { from: '', to: '', cc: [ '' ], type: '', data: '' }
Message.toObject()

// Convert JSON into a more compact fcbuffer serializable object
msg = { from: 'jc', to: 'charles', cc: [ 'abc' ], type: '', data: '0f0f0f' }

// Serialize fcbuffer object into a single binary buffer
buf = Fcbuffer.toBuffer(Message, msg)
// returns <Buffer 02 6a 63 07 63 68 61 72 6c 65 73 01 03 61 62 63 00 03 0f 0f 0f>

// Convert binary back into a new (cloned) object
obj = Fcbuffer.fromBuffer(Message, buf)

// Check that the new object matches the original
assert.deepEqual(msg, obj)

// A definition may extend and define other definitions.  This works in the initial
// definition or later via the extend function.
fcbuffer2 = fcbuffer.extend({
    PermissionName: 'FixedString16',
    AccountPermission: {
        fields: {
          account: 'AccountName',
          permission: 'PermissionName'
        }
    }
})

assert(fcbuffer2.errors.length === 0, fcbuffer2.errors)

var {AccountPermission} = fcbuffer2.structs
AccountPermission.toObject()
// toObject returns: { account: '', permission: '' }

```

# References

- Built-in Types: [types.js](./src/types.js)
- EOS Definitions: [operations.json](https://github.com/eosjs/json/blob/master/schema/operations.json)

# Environment

Node 6+ and browser (browserify, webpack, etc)
