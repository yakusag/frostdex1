'use strict';
// Wildcard handler for any es5-ext/* subpath import.
// Returns sensible defaults based on common patterns used by dependents.
function identity(x) { return x != null ? x : undefined; }
function noop() { return undefined; }

const stub = new Proxy(function stub(){}, {
  get(t, p) {
    if (p === '__esModule') return true;
    if (p === 'default') return stub;
    return stub;
  },
  apply(t, ctx, args) {
    if (args.length === 0) return stub;
    if (args[0] == null) throw new TypeError('Cannot convert undefined or null to object');
    return args[0];
  },
  construct(t, args) { return {}; }
});

module.exports = stub;
module.exports.default = stub;
