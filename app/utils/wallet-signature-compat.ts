type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

const getSessionMethods = (source: unknown): string[] | null => {
  if (!isRecord(source)) return null;

  const candidates = [source, source.provider];
  for (const candidate of candidates) {
    if (!isRecord(candidate) || !isRecord(candidate.session)) continue;
    const namespaces = candidate.session.namespaces;
    if (!isRecord(namespaces)) continue;

    const evmNamespaces = Object.entries(namespaces).filter(
      ([key]) => key === "eip155" || key.startsWith("eip155:"),
    );
    if (!evmNamespaces.length) continue;

    return evmNamespaces.flatMap(([, namespace]) => {
      if (!isRecord(namespace) || !Array.isArray(namespace.methods)) return [];
      return namespace.methods.filter(
        (method): method is string => typeof method === "string",
      );
    });
  }

  return null;
};

/**
 * WalletConnect sessions persist their approved RPC methods. Older sessions
 * may predate the required EIP-712 method used by Orderly account registration
 * and trading-key authorization. Return null for non-WalletConnect providers.
 */
export function getEvmWalletSessionMethods(wallet: unknown): string[] | null {
  if (!isRecord(wallet)) return null;
  return (
    getSessionMethods(wallet.instance) ??
    getSessionMethods(wallet.provider)
  );
}

export function walletSessionNeedsOrderlyTypedData(wallet: unknown): boolean {
  const methods = getEvmWalletSessionMethods(wallet);
  return methods !== null && !methods.includes("eth_signTypedData_v4");
}
