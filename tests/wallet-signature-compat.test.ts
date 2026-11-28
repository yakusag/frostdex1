import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getEvmWalletSessionMethods,
  walletSessionNeedsOrderlyTypedData,
} from "../app/utils/wallet-signature-compat";

test("detects a WalletConnect session missing Orderly typed-data v4", () => {
  const wallet = {
    instance: {
      session: {
        namespaces: {
          eip155: {
            methods: ["eth_sendTransaction", "personal_sign"],
          },
        },
      },
    },
  };

  assert.deepEqual(getEvmWalletSessionMethods(wallet), [
    "eth_sendTransaction",
    "personal_sign",
  ]);
  assert.equal(walletSessionNeedsOrderlyTypedData(wallet), true);
});

test("accepts a WalletConnect session with Orderly typed-data v4", () => {
  const wallet = {
    provider: {
      session: {
        namespaces: {
          eip155: {
            methods: [
              "eth_sendTransaction",
              "personal_sign",
              "eth_signTypedData_v4",
            ],
          },
        },
      },
    },
  };

  assert.equal(walletSessionNeedsOrderlyTypedData(wallet), false);
});

test("does not classify injected wallets without WalletConnect session data", () => {
  const wallet = {
    label: "MetaMask",
    provider: { request: async () => "0x1" },
  };

  assert.equal(getEvmWalletSessionMethods(wallet), null);
  assert.equal(walletSessionNeedsOrderlyTypedData(wallet), false);
});
