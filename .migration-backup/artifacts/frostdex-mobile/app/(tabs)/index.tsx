import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import {
  fetchMarkets,
  formatSymbolDisplay,
  formatPrice,
  formatVolume,
  getPriceChange,
  type FuturesMarket,
} from "@/constants/api";

function MarketRow({ market, onPress }: { market: FuturesMarket; onPress: () => void }) {
  const colors = useColors();
  const change = getPriceChange(market);
  const isPositive = change >= 0;
  const symbol = formatSymbolDisplay(market.symbol);
  const baseCoin = symbol.split("/")[0] ?? "?";

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={styles.rowLeft}>
        <View style={[styles.symbolBadge, { backgroundColor: colors.accent }]}>
          <Text style={[styles.symbolBadgeText, { color: colors.primary }]}>{baseCoin[0]}</Text>
        </View>
        <View>
          <Text style={[styles.symbolText, { color: colors.foreground }]}>{symbol}</Text>
          <Text style={[styles.volumeText, { color: colors.mutedForeground }]}>
            Vol {formatVolume(market["24h_volume"])}
          </Text>
        </View>
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.priceText, { color: colors.foreground }]}>
          ${formatPrice(market.index_price)}
        </Text>
        <View style={[styles.changeBadge, { backgroundColor: isPositive ? `${colors.success}22` : `${colors.destructive}22` }]}>
          <Text style={[styles.changeText, { color: isPositive ? colors.success : colors.destructive }]}>
            {isPositive ? "+" : ""}{change.toFixed(2)}%
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function MarketsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"volume" | "change" | "price">("volume");

  const { data: markets, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["markets"],
    queryFn: fetchMarkets,
    refetchInterval: 10000,
    staleTime: 5000,
  });

  const filtered = (markets ?? [])
    .filter((m) => formatSymbolDisplay(m.symbol).toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "volume") return b["24h_volume"] - a["24h_volume"];
      if (sortBy === "change") return Math.abs(getPriceChange(b)) - Math.abs(getPriceChange(a));
      return b.index_price - a.index_price;
    });

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background }]}>
        <Text style={[styles.headerTitle, { color: colors.primary }]}>FrostDex</Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
          {markets?.length ?? 0} perpetual markets
        </Text>
      </View>

      <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search markets..."
          placeholderTextColor={colors.mutedForeground}
          style={[styles.searchInput, { color: colors.foreground }]}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.sortRow, { borderBottomColor: colors.border }]}>
        {(["volume", "change", "price"] as const).map((s) => (
          <TouchableOpacity
            key={s}
            onPress={() => setSortBy(s)}
            style={[styles.sortBtn, sortBy === s && { borderBottomWidth: 2, borderBottomColor: colors.primary }]}
          >
            <Text style={[styles.sortBtnText, { color: sortBy === s ? colors.primary : colors.mutedForeground }]}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading markets...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.symbol}
          renderItem={({ item }) => (
            <MarketRow
              market={item}
              onPress={() => router.push({ pathname: "/(tabs)/trade", params: { symbol: item.symbol } })}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 84 : insets.bottom + 80 }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Feather name="search" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No markets found</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 26, fontWeight: "700", letterSpacing: -0.5 },
  headerSub: { fontSize: 12, marginTop: 2 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14 },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 4,
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sortBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  sortBtnText: { fontSize: 13, fontWeight: "600" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowRight: { alignItems: "flex-end", gap: 4 },
  symbolBadge: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  symbolBadgeText: { fontSize: 16, fontWeight: "700" },
  symbolText: { fontSize: 15, fontWeight: "600" },
  volumeText: { fontSize: 12, marginTop: 2 },
  priceText: { fontSize: 15, fontWeight: "600" },
  changeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  changeText: { fontSize: 12, fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  loadingText: { fontSize: 14 },
  emptyText: { fontSize: 15 },
});
