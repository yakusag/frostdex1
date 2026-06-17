'use strict';

// Stub for cli-color — returns strings unchanged (no terminal colors needed at runtime)
function identity(str) { return str == null ? '' : String(str); }

const COLORS = ['black','red','green','yellow','blue','magenta','cyan','white','blackBright','redBright','greenBright','yellowBright','blueBright','magentaBright','cyanBright','whiteBright'];
const STYLES = ['reset','bold','dim','italic','underline','inverse','hidden','strikethrough'];

function makeChain(fn) {
  const proxy = new Proxy(fn, {
    get(target, prop) {
      if (prop === 'then' || prop === 'catch' || prop === 'finally') return undefined;
      return makeChain(fn);
    },
    apply(target, thisArg, args) {
      return identity(args[0]);
    }
  });
  return proxy;
}

const noopFn = makeChain(identity);

const clc = new Proxy(noopFn, {
  get(target, prop) {
    if (prop === 'then' || prop === 'catch' || prop === 'finally') return undefined;
    if (prop === 'reset') return makeChain(identity);
    return noopFn;
  },
  apply(target, thisArg, args) {
    return identity(args[0]);
  }
});

module.exports = clc;
module.exports.default = clc;
