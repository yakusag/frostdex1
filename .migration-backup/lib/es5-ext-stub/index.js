'use strict';
// Stub: es5-ext — all polyfills are natively available in modern browsers/Node.
function identity(x) { return x; }
function noop() {}
const stub = new Proxy(function(){}, {
  get(t, p) { return stub; },
  apply(t, ctx, args) { return args[0] !== undefined ? args[0] : stub; },
  construct(t, args) { return stub; }
});
module.exports = stub;
module.exports.default = stub;
