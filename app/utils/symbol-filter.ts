import type { API } from "@orderly.network/types";
import type { ConfigProviderProps } from "@orderly.network/hooks";

/**
 * Keep the full Orderly market list available to both Markets and Trading.
 */
export function createSymbolDataAdapter(): NonNullable<
  ConfigProviderProps["dataAdapter"]
> {
  return {
    symbolList: (original: API.MarketInfoExt[]) => original,
  };
}
