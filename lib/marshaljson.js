/*!
Copyright (C) 2013 by WebReflection

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

*/
var
  // should be a not so common char
  // possibly one JSON does not encode
  // possibly one encodeURIComponent does not encode
  // right now this char is '~' but this might change in the future
  specialChar = '~',
  functionRegexp = /function\s\([^\)]+\)\{.*\}$/i,
  safeSpecialChar = '\\x' + (
    '0' + specialChar.charCodeAt(0).toString(16)
  ).slice(-2),
  specialCharRG = new RegExp(safeSpecialChar, 'g'),
  safeSpecialCharRG = new RegExp('\\' + safeSpecialChar, 'g'),
  indexOf = [].indexOf || function(v){
    for(var i=this.length;i--&&this[i]!==v;);
    return i;
  },
  $String = String  // there's no way to drop warnings in JSHint
                    // about new String ... well, I need that here!
                    // faked, and happy linter!
;

function generateReplacer(value, replacer, resolve) {
  var
    path = [],
    seen = [value],
    mapp = [resolve ? specialChar : '[Circular]'],
    i
  ;
  /* also store __proto__ as __prototype__ */
  if (value.__proto__) {
        value["__prototype__"] = value.__proto__;
  }
  return function(key, value) {
    // the replacer has rights to decide
    // if a new object should be returned
    // or if there's some key to drop
    // let's call it here rather than "too late"
    if (replacer) value = replacer(key, value);

    // did you know ? Safari passes keys as integers for arrays
    if (key !== '') {
      if (typeof value === 'object' && value) {
        i = indexOf.call(seen, value);
        if (i < 0) {
          i = seen.push(value) - 1;
          if (resolve) {
                // key cannot contain specialChar but could be not a string
                path.push(('' + key).replace(specialCharRG, safeSpecialChar));
                mapp[i] = specialChar + path.join(specialChar);
          } else {
                mapp[i] = mapp[0];
          }
        } else {
          value = mapp[i];
        }
      /* Serialize function too */
      } else if (typeof value === 'function' && value) {
          value = specialChar+value.toString().replace(/[\n\r]|^\s+/gim,"");
      } else {
        if (typeof value === 'string' && resolve) {
          // ensure no special char involved on deserialization
          // in this case only first char is important
          // no need to replace all value (better performance)
          value = value.replace(specialChar, safeSpecialChar);
        }
      }
    }
    return value;
  };
}

function retrieveFromPath(current, keys) {
    for(var i = 0, length = keys.length; i < length; i++){
        // keys should be normalized back here
        /* in super complex JSON around this part always raise error, need more checkup! */
        if (current === undefined) {
            current = "[ERROR_DESERIALIZE]";
        } else {
            current = current[ keys[i].replace(safeSpecialCharRG, specialChar) ];
        }
    } 
  return current;
}

function generateReviver(reviver) {
  return function(key, value) {
    /* revive __proto__ from __prototype__ */
    if (key === "__prototype__") {
        for (var i in value) {
            value.__proto__[i] = value[i]
            delete value[i];
        }
        return undefined;
    }
    var isString = typeof value === 'string';
    if (isString && value.charAt(0) === specialChar) {
        if (functionRegexp.test(value)) {
            var startBody = value.indexOf('{') + 1,
                endBody = value.lastIndexOf('}'),
                startArgs = value.indexOf('(') + 1,
                endArgs = value.indexOf(')');
            return new Function(value.substring(startArgs, endArgs), value.substring(startBody, endBody));
        } else {
            return new $String(value.slice(1));
        }
    }
    if (key === '') value = regenerate(value, value, {});
    // again, only one needed, do not use the RegExp for this replacement
    // only keys need the RegExp
    if (isString) value = value.replace(safeSpecialChar, specialChar);
    return reviver ? reviver(key, value) : value;
  };
}

function regenerateArray(root, current, retrieve) {
    for (var i = 0, length = current.length; i < length; i++) {
        current[i] = regenerate(root, current[i], retrieve);
    }
    return current;
}

function regenerateObject(root, current, retrieve) {
    for (var key in current) {
        if (current.hasOwnProperty(key)) {
            current[key] = regenerate(root, current[key], retrieve);
        }
    }
    return current;
}

function regenerate(root, current, retrieve) {
  return current instanceof Array ?
    // fast Array reconstruction
    regenerateArray(root, current, retrieve) :
    (
      current instanceof $String ?
        (
          // root is an empty string
          current.length ?
            (
              retrieve.hasOwnProperty(current) ?
                retrieve[current] :
                retrieve[current] = retrieveFromPath(
                  root, current.split(specialChar)
                )
            ) :
            root
        ) :
        (
          current instanceof Object ?
            // dedicated Object parser
            regenerateObject(root, current, retrieve) :
            // value as it is
            current
        )
    )
  ;
}

function stringifyRecursion(value, replacer, space, doNotResolve) {
    return JSON.stringify(value, generateReplacer(value, replacer, !doNotResolve), space);
}

function parseRecursion(text, reviver) {
    return JSON.parse(text, generateReviver(reviver));
}

this.stringify = this.serialize = this.dump = stringifyRecursion;
this.parse = this.deserialize = this.load = parseRecursion;
