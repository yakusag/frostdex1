import type { ConfigProviderProps } from "@orderly.network/hooks";
import type { API } from "@orderly.network/types";

function rebrandAnnouncementMessage(message: string): string {
  return message.replace(/\b(?:Orderly|ORDERLY)\b/g, "FrostDex");
}

/**
 * Keep the full Orderly market list available to both Markets and Trading.
 */
export function createSymbolDataAdapter(): NonNullable<
  ConfigProviderProps["dataAdapter"]
> {
  return {
    symbolList: (original: API.MarketInfoExt[]) => original,
    announcementList: (original: ReadonlyArray<API.AnnouncementRow>) =>
      original.map((announcement) => ({
        ...announcement,
        message: rebrandAnnouncementMessage(announcement.message),
      })),
  };
}
