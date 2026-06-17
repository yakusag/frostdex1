'use strict';
// Stub: Trezor wallet adapter — not available in this environment
class TrezorWalletAdapter {
  constructor() { this.name = 'Trezor'; this.url = ''; this.icon = ''; this.readyState = 'NotDetected'; this.publicKey = null; this.connected = false; }
  async connect() { throw new Error('Trezor wallet not available'); }
  async disconnect() {}
  async signTransaction(tx) { throw new Error('Trezor wallet not available'); }
  async signAllTransactions(txs) { throw new Error('Trezor wallet not available'); }
}
module.exports = { TrezorWalletAdapter };
module.exports.default = { TrezorWalletAdapter };
