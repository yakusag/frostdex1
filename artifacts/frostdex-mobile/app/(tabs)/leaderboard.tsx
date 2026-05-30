import React from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
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

interface LeaderItem {
  rank: number;
  symbol: string;
  displaySymbol: string;
  volume: number;
  price: number;
  change: number;
  openInterest: number;
}

function RankBadge({ rank, colors }: { rank: number; colors: ReturnType<typeof useColors> }) {
  if (rank === 1) return <View style={[styles.medalBadge, { backgroundColor: "#F0B90B22" }]}><Text style={[styles.medalText, { color: "#F0B90B" }]}>1</Text></View>;
  if (rank === 2) return <View style={[styles.medalBadge, { backgroundColor: "#C0C0C022" }]}><Text style={[styles.medalText, { color: "#C0C0C0" }]}>2</Text></View>;
  if (rank === 3) return <View style={[styles.medalBadge, { backgroundColor: "#CD7F3222" }]}><Text style={[styles.medalText, { color: "#CD7F32" }]}>3</Text></View>;
  return <Text style={[styles.rankNum, { color: colors.mutedForeground }]}>#{rank}</Text>;
}

function LeaderRow({ item }: { item: LeaderItem }) {
  const colors = useColors();
  const isPositive = item.change >= 0;

  return (
    <TouchableOpacity
      onPress={() => router.push({ pathname: "/(tabs)/trade", params: { symbol: item.symbol } })}
      activeOpacity={0.7}
      style={[styles.row, { borderBottomColor: colors.border }]}
    >
      <View style={styles.rankCol}>
        <RankBadge rank={item.rank} colors={colors} />
      </View>

      <View style={styles.mainCol}>
        <Text style={[styles.symbolText, { color: colors.foreground }]}>{item.displaySymbol}</Text>
        <Text style={[styles.volumeText, { color: colors.mutedForeground }]}>
          {formatVolume(item.volume)}
        </Text>
      </View>

      <View style={styles.rightCol}>
        <Text style={[styles.priceText, { color: colors.foreground }]}>${formatPrice(item.price)}</Text>
        <Text style={[styles.changeText, { color: isPositive ? colors.success : colors.destructive }]}>
          {isPositive ? "+" : ""}{item.change.toFixed(2)}%
        </Text>
      </View>

      <View style={styles.oiCol}>
        <Text style={[styles.oiLabel, { color: colors.mutedForeground }]}>OI</Text>
        <Text style={[styles.oiValue, { color: colors.foreground }]}>{formatVolume(item.openInterest)}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function LeaderboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 : insets.bottom + 80;

  const { data: markets, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["markets"],
    queryFn: fetchMarkets,
    staleTime: 30000,
  });

  const leaderboard: LeaderItem[] = (markets ?? [])
    .sort((a, b) => b["24h_volume"] - a["24h_volume"])
    .slice(0, 30)
    .map((m, i) => ({
      rank: i + 1,
      symbol: m.symbol,
      displaySymbol: formatSymbolDisplay(m.symbol),
      volume: m["24h_volume"],
      price: m.index_price,
      change: getPriceChange(m),
      openInterest: m.open_interest,
    }));

  const totalVolume = (markets ?? []).reduce((sum, m) => sum + m["24h_volume"], 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Leaderboard</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>Top markets by 24h volume</Text>
        </View>
        <View style={[styles.totalBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="activity" size={12} color={colors.primary} />
          <Text style={[styles.totalText, { color: colors.primary }]}>{formatVolume(totalVolume)}</Text>
        </View>
      </View>

      <View style={[styles.tableHeader, { borderBottomColor: colors.border, borderTopColor: colors.border }]}>
        <Text style={[styles.thRank, { color: colors.mutedForeground }]}>#</Text>
        <Text style={[styles.thMain, { color: colors.mutedForeground }]}>Market</Text>
        <Text style={[styles.thRight, { color: colors.mutedForeground }]}>Price</Text>
        <Text style={[styles.thOi, { color: colors.mutedForeground }]}>OI</Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading...</Text>
        </View>
      ) : (
        <FlatList
          data={leaderboard}
          keyExtractor={(item) => item.symbol}
          renderItem={({ item }) => <LeaderRow item={item} />}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />
          }
          contentContainerStyle={{ paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  headerTitle: { fontSize: 24, fontWeight: "700" },
  headerSub: { fontSize: 12, marginTop: 2 },
  totalBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  totalText: { fontSize: 12, fontWeight: "600" },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  thRank: { width: 48, fontSize: 11 },
  thMain: { flex: 1, fontSize: 11 },
  thRight: { width: 80, textAlign: "right", fontSize: 11 },
  thOi: { width: 70, textAlign: "right", fontSize: 11 },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  rankCol: { width: 48, alignItems: "center" },
  medalBadge: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  medalText: { fontSize: 13, fontWeight: "700" },
  rankNum: { fontSize: 13, fontWeight: "600" },
  mainCol: { flex: 1 },
  symbolText: { fontSize: 14, fontWeight: "600" },
  volumeText: { fontSize: 11, marginTop: 2 },
  rightCol: { width: 80, alignItems: "flex-end" },
  priceText: { fontSize: 13, fontWeight: "600" },
  changeText: { fontSize: 11, marginTop: 2, fontWeight: "500" },
  oiCol: { width: 70, alignItems: "flex-end" },
  oiLabel: { fontSize: 10 },
  oiValue: { fontSize: 12, fontWeight: "500", marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  loadingText: { fontSize: 14 },
});
