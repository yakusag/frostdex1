'use strict';
// Stub for deprecated `request` HTTP client — not used at browser runtime
function request(opts, cb) { if(cb) cb(new Error('request: not available in browser')); }
['get','post','put','delete','patch','head'].forEach(m=>{ request[m]=request; });
request.defaults = ()=>request;
request.cookie = ()=>null;
request.jar = ()=>({ add:()=>{}, get:()=>[] });
module.exports = request;
