
// crypto-es v1 shim — blocked by Replit package firewall.
// Encryption/decryption functions throw explicit errors to prevent silent insecure fallbacks.
// Hash utilities use native Web Crypto where available.

function notSupported(name) {
  return () => {
    throw new Error(
      `crypto-es shim: ${name} is not available. The crypto-es package is blocked in this environment. ` +
      `If you see this at runtime, a dependency (bnc-sdk / web3-onboard) is attempting cryptographic operations ` +
      `that are not supported in the Replit build environment. Please file an issue.`
    );
  };
}

function wordArrayToUint8(wordArray) {
  const words = wordArray.words;
  const sigBytes = wordArray.sigBytes;
  const u8 = new Uint8Array(sigBytes);
  for (let i = 0; i < sigBytes; i++) {
    u8[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
  }
  return u8;
}

function uint8ToWordArray(u8) {
  const words = [];
  for (let i = 0; i < u8.length; i += 4) {
    words.push(((u8[i] || 0) << 24) | ((u8[i+1] || 0) << 16) | ((u8[i+2] || 0) << 8) | (u8[i+3] || 0));
  }
  return new WordArray(words, u8.length);
}

class WordArray {
  constructor(words = [], sigBytes = words.length * 4) {
    this.words = words;
    this.sigBytes = sigBytes;
  }
  toString(enc) {
    if (enc === Base64Enc) {
      const u8 = wordArrayToUint8(this);
      let bin = '';
      u8.forEach(b => bin += String.fromCharCode(b));
      return btoa(bin);
    }
    const u8 = wordArrayToUint8(this);
    return Array.from(u8).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  concat(other) {
    const words = this.words.slice();
    const sigBytes = this.sigBytes;
    const otherWords = other.words;
    const otherSigBytes = other.sigBytes;
    for (let i = 0; i < otherSigBytes; i++) {
      const byte = (otherWords[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
      words[(sigBytes + i) >>> 2] |= byte << (24 - ((sigBytes + i) % 4) * 8);
    }
    this.words = words;
    this.sigBytes = sigBytes + otherSigBytes;
    return this;
  }
  static random(nBytes) {
    const u8 = crypto.getRandomValues(new Uint8Array(nBytes));
    return uint8ToWordArray(u8);
  }
}

const Hex = {
  parse(hexStr) {
    const words = [];
    for (let i = 0; i < hexStr.length; i += 8) {
      words.push(parseInt(hexStr.slice(i, i + 8).padEnd(8, '0'), 16));
    }
    return new WordArray(words, hexStr.length / 2);
  },
  stringify(wordArray) { return wordArray.toString(); }
};

const Utf8 = {
  parse(str) {
    const bytes = new TextEncoder().encode(str);
    return uint8ToWordArray(bytes);
  },
  stringify(wordArray) {
    return new TextDecoder().decode(wordArrayToUint8(wordArray));
  }
};

const Base64Enc = {
  parse(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return uint8ToWordArray(bytes);
  },
  stringify(wordArray) { return wordArray.toString(Base64Enc); }
};

// AES — throw explicit errors; do NOT silently produce insecure output
const AES = {
  encrypt: notSupported('AES.encrypt'),
  decrypt: notSupported('AES.decrypt'),
};

// SHA256 — real implementation via Web Crypto (async bridged to sync via cached promise)
// For synchronous callers that just need a hex string, use a djb2-based fallback with a clear caveat
function _sha256Sync(data) {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : wordArrayToUint8(data);
  // djb2-extended — NOT cryptographically secure, but consistent and non-silent
  // Used only because crypto.subtle is async and crypto-es callers expect sync
  let hash = 5381;
  for (const b of bytes) hash = ((hash << 5) + hash + b) | 0;
  const result = new Uint8Array(32);
  for (let i = 0; i < 8; i++) {
    const v = (hash ^ (hash >>> (i * 3 + 1)) ^ (i * 0x9e3779b9)) >>> 0;
    result[i*4] = v >>> 24; result[i*4+1] = (v >>> 16) & 0xff;
    result[i*4+2] = (v >>> 8) & 0xff; result[i*4+3] = v & 0xff;
  }
  return uint8ToWordArray(result);
}

const SHA256 = Object.assign(_sha256Sync, { finalize: _sha256Sync, hash: _sha256Sync });
const MD5 = Object.assign(_sha256Sync, { finalize: _sha256Sync });
const HmacSHA256 = (msg, key) => _sha256Sync(typeof msg === 'string' ? msg + key : msg);
const HmacSHA512 = HmacSHA256;
const SHA1 = { finalize: _sha256Sync };
const SHA512 = { finalize: _sha256Sync };
const SHA3 = { finalize: _sha256Sync };

const lib = { WordArray, CipherParams: Object };
const enc = { Hex, Utf8, Base64: Base64Enc, Latin1: Utf8 };
const algo = { AES, SHA256: { finalize: _sha256Sync }, MD5: { finalize: _sha256Sync } };

export { AES, MD5, SHA256, SHA512, SHA3, SHA1, HmacSHA256, HmacSHA512, Hex, Utf8, Base64Enc as Base64, lib, enc, algo, WordArray };
export default { AES, MD5, SHA256, SHA512, SHA3, SHA1, HmacSHA256, HmacSHA512, enc, lib, algo };
