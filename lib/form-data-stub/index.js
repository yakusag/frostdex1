'use strict';
class FormData {
  constructor() { this._data = []; }
  append(k,v,opts) { this._data.push({k,v,opts}); }
  getHeaders() { return {'content-type':'multipart/form-data'}; }
  getBoundary() { return '----FormDataBoundary'; }
  getBuffer() { return Buffer.alloc(0); }
  getLengthSync() { return 0; }
}
module.exports = FormData;
