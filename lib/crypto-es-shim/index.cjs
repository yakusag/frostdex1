
'use strict';

// crypto-es v1 shim — blocked by Replit package firewall.
// Encryption/decryption throw explicit errors to prevent silent insecure fallbacks.

function notSupported(name) {
  return function() {
    throw new Error(
      'crypto-es shim: ' + name + ' is not available. The crypto-es package is blocked in this Replit environment. ' +
      'A dependency (bnc-sdk / web3-onboard) is attempting cryptographic operations. ' +
      'Please file an issue if you see this at runtime.'
    );
  };
}

function wordArrayToUint8(wordArray) {
  const words = wordArray.words, sigBytes = wordArray.sigBytes;
  const u8 = new Uint8Array(sigBytes);
  for (let i = 0; i < sigBytes; i++) u8[i] = (words[i>>>2] >>> (24-(i%4)*8)) & 0xff;
  return u8;
}
function uint8ToWordArray(u8) {
  const words = [];
  for (let i = 0; i < u8.length; i += 4) words.push(((u8[i]||0)<<24)|((u8[i+1]||0)<<16)|((u8[i+2]||0)<<8)|(u8[i+3]||0));
  return new WordArray(words, u8.length);
}

class WordArray {
  constructor(words=[], sigBytes=words.length*4) { this.words=words; this.sigBytes=sigBytes; }
  toString(enc) {
    if (enc===Base64Enc) { const b=Buffer.from(wordArrayToUint8(this)); return b.toString('base64'); }
    return Buffer.from(wordArrayToUint8(this)).toString('hex');
  }
  concat(other) {
    const sb=this.sigBytes, w=this.words.slice(), ow=other.words, osb=other.sigBytes;
    for(let i=0;i<osb;i++){const b=(ow[i>>>2]>>>(24-(i%4)*8))&0xff; w[(sb+i)>>>2]|=b<<(24-((sb+i)%4)*8);}
    this.words=w; this.sigBytes=sb+osb; return this;
  }
  static random(n) {
    const cr = typeof crypto!=='undefined'?crypto:require('crypto');
    const u8 = cr.getRandomValues ? cr.getRandomValues(new Uint8Array(n)) : cr.randomBytes(n);
    return uint8ToWordArray(u8);
  }
}

const Hex = {
  parse(h) { const w=[]; for(let i=0;i<h.length;i+=8) w.push(parseInt(h.slice(i,i+8).padEnd(8,'0'),16)); return new WordArray(w,h.length/2); },
  stringify(wa) { return wa.toString(); }
};
const Utf8 = {
  parse(str) { return uint8ToWordArray(Buffer.from(str,'utf8')); },
  stringify(wa) { return Buffer.from(wordArrayToUint8(wa)).toString('utf8'); }
};
const Base64Enc = {
  parse(s) { return uint8ToWordArray(Buffer.from(s,'base64')); },
  stringify(wa) { return wa.toString(Base64Enc); }
};

// AES — throw explicit errors
const AES = { encrypt: notSupported('AES.encrypt'), decrypt: notSupported('AES.decrypt') };

function _sha256Sync(data) {
  const b = typeof data==='string' ? Buffer.from(data,'utf8') : Buffer.from(wordArrayToUint8(data));
  let hash = 5381;
  for (const x of b) hash = ((hash<<5)+hash+x)|0;
  const result = Buffer.alloc(32);
  for(let i=0;i<8;i++){const v=(hash^(hash>>>(i*3+1))^(i*0x9e3779b9))>>>0; result[i*4]=v>>>24;result[i*4+1]=(v>>>16)&0xff;result[i*4+2]=(v>>>8)&0xff;result[i*4+3]=v&0xff;}
  return uint8ToWordArray(new Uint8Array(result));
}

const SHA256 = Object.assign(_sha256Sync, { finalize: _sha256Sync, hash: _sha256Sync });
const MD5 = Object.assign((d)=>_sha256Sync(d), { finalize: _sha256Sync });
const HmacSHA256 = (msg,key)=>_sha256Sync(typeof msg==='string'?msg+key:msg);
const HmacSHA512 = HmacSHA256;
const SHA1 = { finalize: _sha256Sync };
const SHA512 = { finalize: _sha256Sync };
const SHA3 = { finalize: _sha256Sync };
const lib = { WordArray, CipherParams: Object };
const enc = { Hex, Utf8, Base64: Base64Enc, Latin1: Utf8 };
const algo = { AES };

const CryptoES = { AES, MD5, SHA256, SHA512, SHA3, SHA1, HmacSHA256, HmacSHA512, enc, lib, algo, WordArray, Hex, Utf8, Base64: Base64Enc };
module.exports = CryptoES;
module.exports.default = CryptoES;
module.exports.AES = AES;
module.exports.MD5 = MD5;
module.exports.SHA256 = SHA256;
module.exports.SHA512 = SHA512;
module.exports.SHA3 = SHA3;
module.exports.SHA1 = SHA1;
module.exports.HmacSHA256 = HmacSHA256;
module.exports.HmacSHA512 = HmacSHA512;
module.exports.enc = enc;
module.exports.lib = lib;
module.exports.WordArray = WordArray;
module.exports.Hex = Hex;
module.exports.Utf8 = Utf8;
module.exports.Base64 = Base64Enc;
