'use strict';

var core = require('@fluppy/core');

// src/index.ts
var FLUPPY_BROWSER_VERSION = "0.1.0";

exports.FLUPPY_BROWSER_VERSION = FLUPPY_BROWSER_VERSION;
Object.keys(core).forEach(function (k) {
  if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) Object.defineProperty(exports, k, {
    enumerable: true,
    get: function () { return core[k]; }
  });
});
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map