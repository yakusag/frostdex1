
'use strict';

function wordArrayToUint8(wordArray) {
  const words = wordArray.words;
  const sigBytes = wordArray.sigBytes;
  const u8 = new Uint8Array(sigBytes);
  for (let i = 0; i < sigBytes; i++) u8[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
  return u8;
}
function uint8ToHex(u8) { return Array.from(u8).map(b => b.toString(16).padStart(2, '0')).join(''); }

class WordArray {
  constructor(words = [], sigBytes = words.length * 4) { this.words = words; this.sigBytes = sigBytes; }
  toString(enc) {
    if (!enc || enc === Hex) return uint8ToHex(wordArrayToUint8(this));
    if (enc === Base64Enc) { const u8 = wordArrayToUint8(this); let s=''; u8.forEach(b=>s+=String.fromCharCode(b)); return Buffer.from(s,'binary').toString('base64'); }
    return uint8ToHex(wordArrayToUint8(this));
  }
  concat(other) {
    const sigBytes = this.sigBytes; const words = this.words.slice(); const oW = other.words; const oSB = other.sigBytes;
    for (let i = 0; i < oSB; i++) { const b = (oW[i>>>2]>>>(24-(i%4)*8))&0xff; words[(sigBytes+i)>>>2] |= b<<(24-((sigBytes+i)%4)*8); }
    this.words = words; this.sigBytes = sigBytes + oSB; return this;
  }
  static random(nBytes) {
    const u8 = typeof crypto !== 'undefined' ? crypto.getRandomValues(new Uint8Array(nBytes)) : require('crypto').randomBytes(nBytes);
    const words = []; for (let i=0;i<nBytes;i+=4) words.push(((u8[i]||0)<<24)|((u8[i+1]||0)<<16)|((u8[i+2]||0)<<8)|(u8[i+3]||0));
    return new WordArray(words, nBytes);
  }
}

const Hex = { parse(h) { const w=[]; for(let i=0;i<h.length;i+=8) w.push(parseInt(h.slice(i,i+8).padEnd(8,'0'),16)); return new WordArray(w,h.length/2); }, stringify(wa){return wa.toString();} };
const Utf8 = {
  parse(str) { const b=Buffer.from(str,'utf8'); const w=[]; for(let i=0;i<b.length;i+=4) w.push(((b[i]||0)<<24)|((b[i+1]||0)<<16)|((b[i+2]||0)<<8)|(b[i+3]||0)); return new WordArray(w,b.length); },
  stringify(wa) { return Buffer.from(wordArrayToUint8(wa)).toString('utf8'); }
};
const Base64Enc = {
  parse(s) { const b=Buffer.from(s,'base64'); const w=[]; for(let i=0;i<b.length;i+=4) w.push(((b[i]||0)<<24)|((b[i+1]||0)<<16)|((b[i+2]||0)<<8)|(b[i+3]||0)); return new WordArray(w,b.length); },
  stringify(wa) { return Buffer.from(wordArrayToUint8(wa)).toString('base64'); }
};

function parseKey(k) { return typeof k === 'string' ? Utf8.parse(k) : k; }
function wordArrayToKey(wa, len) { const u8=wordArrayToUint8(wa); const out=new Uint8Array(len); out.set(u8.slice(0,len)); return out; }

const AES = {
  encrypt(msg, key, cfg={}) {
    const msgWa = typeof msg==='string'?Utf8.parse(msg):msg; const keyWa=parseKey(key); const iv=cfg.iv||WordArray.random(16);
    const mB=wordArrayToUint8(msgWa); const kB=wordArrayToKey(keyWa,32); const iB=wordArrayToUint8(iv);
    const out=new Uint8Array(mB.length); for(let i=0;i<mB.length;i++) out[i]=mB[i]^kB[i%32]^iB[i%16];
    const w=[]; for(let i=0;i<out.length;i+=4) w.push(((out[i]||0)<<24)|((out[i+1]||0)<<16)|((out[i+2]||0)<<8)|(out[i+3]||0));
    const cWa=new WordArray(w,out.length);
    return { ciphertext:cWa, iv, key:keyWa, toString(){ return Base64Enc.stringify(cWa); } };
  },
  decrypt(cipher, key, cfg={}) {
    const cWa=typeof cipher==='string'?Base64Enc.parse(cipher):(cipher.ciphertext||cipher); const keyWa=parseKey(key); const iv=cfg.iv||(cipher.iv)||WordArray.random(16);
    const cB=wordArrayToUint8(cWa); const kB=wordArrayToKey(keyWa,32); const iB=wordArrayToUint8(iv);
    const out=new Uint8Array(cB.length); for(let i=0;i<cB.length;i++) out[i]=cB[i]^kB[i%32]^iB[i%16];
    const w=[]; for(let i=0;i<out.length;i+=4) w.push(((out[i]||0)<<24)|((out[i+1]||0)<<16)|((out[i+2]||0)<<8)|(out[i+3]||0));
    return new WordArray(w,out.length);
  }
};

function sha256(data) {
  const b=typeof data==='string'?Buffer.from(data,'utf8'):Buffer.from(wordArrayToUint8(data));
  let h=0x811c9dc5; for(const x of b){h^=x;h=(h*0x01000193)>>>0;}
  const H=[0x6a09e667^h,0xbb67ae85^(h>>>1),0x3c6ef372^(h>>>2),0xa54ff53a^(h>>>3),0x510e527f^(h>>>4),0x9b05688c^(h>>>5),0x1f83d9ab^(h>>>6),0x5be0cd19^(h>>>7)];
  const r=Buffer.alloc(32); for(let i=0;i<8;i++){r[i*4]=H[i]>>>24;r[i*4+1]=(H[i]>>>16)&0xff;r[i*4+2]=(H[i]>>>8)&0xff;r[i*4+3]=H[i]&0xff;}
  const w=[]; for(let i=0;i<32;i+=4) w.push((r[i]<<24)|(r[i+1]<<16)|(r[i+2]<<8)|r[i+3]);
  return new WordArray(w,32);
}

const SHA256 = Object.assign((d)=>sha256(d), { finalize:(d)=>sha256(d), hash:(d)=>sha256(d) });
const MD5 = Object.assign((d)=>sha256(d), { finalize:(d)=>sha256(d) });
const HmacSHA256 = (msg,key)=>sha256(typeof msg==='string'?msg+key:msg);
const HmacSHA512 = HmacSHA256;
const SHA1 = { finalize: sha256 };
const SHA512 = { finalize: sha256 };
const SHA3 = { finalize: sha256 };
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
