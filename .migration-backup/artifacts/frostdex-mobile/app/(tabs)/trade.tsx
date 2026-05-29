import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useColors } from "@/hooks/useColors";
import {
  fetchMarkets,
  fetchTicker,
  fetchOrderbook,
  formatSymbolDisplay,
  formatPrice,
  formatVolume,
  getPriceChange,
  type FuturesMarket,
  type OrderbookLevel,
} from "@/constants/api";

function StatBox({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  const colors = useColors();
  return (
    <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.statValue, { color: valueColor ?? colors.foreground }]}>{value}</Text>
    </View>
  );
}

function OrderbookRow({ level, side, maxQty }: { level: OrderbookLevel; side: "ask" | "bid"; maxQty: number }) {
  const colors = useColors();
  const barColor = side === "ask" ? `${colors.destructive}22` : `${colors.success}22`;
  const textColor = side === "ask" ? colors.destructive : colors.success;
  const fillPct = maxQty > 0 ? Math.min((level.quantity / maxQty) * 100, 100) : 0;

  return (
    <View style={styles.obRow}>
      <View style={[styles.obFill, { width: `${fillPct}%` as any, backgroundColor: barColor, [side === "ask" ? "right" : "left"]: 0 }]} />
      <Text style={[styles.obPrice, { color: textColor }]}>{formatPrice(level.price)}</Text>
      <Text style={[styles.obQty, { color: colors.mutedForeground }]}>{level.quantity.toFixed(2)}</Text>
    </View>
  );
}

export default function TradeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ symbol?: string }>();
  const [selectedSymbol, setSelectedSymbol] = useState(params.symbol ?? "PERP_ETH_USDC");
  const [showPicker, setShowPicker] = useState(false);

  const { data: markets } = useQuery({
    queryKey: ["markets"],
    queryFn: fetchMarkets,
    staleTime: 30000,
  });

  const { data: ticker, isLoading: tickerLoading } = useQuery({
    queryKey: ["ticker", selectedSymbol],
    queryFn: () => fetchTicker(selectedSymbol),
    refetchInterval: 5000,
    enabled: !!selectedSymbol,
  });

  const { data: orderbook, isLoading: obLoading } = useQuery({
    queryKey: ["orderbook", selectedSymbol],
    queryFn: () => fetchOrderbook(selectedSymbol, 12),
    refetchInterval: 2000,
    enabled: !!selectedSymbol,
  });

  const change = ticker ? getPriceChange(ticker) : 0;
  const isPositive = change >= 0;
  const displaySymbol = formatSymbolDisplay(selectedSymbol);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 : insets.bottom + 80;

  const maxAsk = Math.max(...(orderbook?.asks.map((a) => a.quantity) ?? [1]));
  const maxBid = Math.max(...(orderbook?.bids.map((b) => b.quantity) ?? [1]));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.symbolPicker, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => setShowPicker(!showPicker)}
          activeOpacity={0.7}
        >
          <Text style={[styles.symbolPickerText, { color: colors.foreground }]}>{displaySymbol}</Text>
          <Feather name={showPicker ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
        </TouchableOpacity>

        {tickerLoading ? (
          <ActivityIndicator color={colors.primary} size="small" />
        ) : ticker ? (
          <View style={styles.headerRight}>
            <Text style={[styles.headerPrice, { color: colors.foreground }]}>${formatPrice(ticker.index_price)}</Text>
            <View style={[styles.changeBadge, { backgroundColor: isPositive ? `${colors.success}22` : `${colors.destructive}22` }]}>
              <Text style={[styles.changeText, { color: isPositive ? colors.success : colors.destructive }]}>
                {isPositive ? "+" : ""}{change.toFixed(2)}%
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      {showPicker && (
        <View style={[styles.pickerDropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <FlatList
            data={(markets ?? []).slice(0, 30)}
            keyExtractor={(item) => item.symbol}
            style={{ maxHeight: 280 }}
            renderItem={({ item }) => {
              const ch = getPriceChange(item);
              const pos = ch >= 0;
              return (
                <TouchableOpacity
                  style={[styles.pickerRow, selectedSymbol === item.symbol && { backgroundColor: colors.accent }]}
                  onPress={() => { setSelectedSymbol(item.symbol); setShowPicker(false); }}
                >
                  <Text style={[styles.pickerSymbol, { color: colors.foreground }]}>{formatSymbolDisplay(item.symbol)}</Text>
                  <Text style={[styles.pickerPrice, { color: pos ? colors.success : colors.destructive }]}>
                    {pos ? "+" : ""}{ch.toFixed(2)}%
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}

      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        {ticker && (
          <View style={styles.statsGrid}>
            <StatBox label="Mark Price" value={`$${formatPrice(ticker.mark_price)}`} />
            <StatBox label="24h High" value={`$${formatPrice(ticker["24h_high"])}`} valueColor={colors.success} />
            <StatBox label="24h Low" value={`$${formatPrice(ticker["24h_low"])}`} valueColor={colors.destructive} />
            <StatBox label="24h Volume" value={formatVolume(ticker["24h_volume"])} />
            <StatBox label="Open Interest" value={formatVolume(ticker.open_interest)} />
            <StatBox
              label="Funding Rate"
              value={`${((ticker.est_funding_rate ?? 0) * 100).toFixed(4)}%`}
              valueColor={(ticker.est_funding_rate ?? 0) >= 0 ? colors.success : colors.destructive}
            />
          </View>
        )}

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Order Book</Text>
            {obLoading && <ActivityIndicator color={colors.primary} size="small" />}
          </View>

          <View style={styles.obHeader}>
            <Text style={[styles.obHeaderText, { color: colors.mutedForeground }]}>Price (USDC)</Text>
            <Text style={[styles.obHeaderText, { color: colors.mutedForeground }]}>Qty</Text>
          </View>

          {(orderbook?.asks.slice(0, 8) ?? []).reverse().map((ask, i) => (
            <OrderbookRow key={`ask-${i}`} level={ask} side="ask" maxQty={maxAsk} />
          ))}

          {ticker && (
            <View style={[styles.obMidRow, { borderTopColor: colors.border, borderBottomColor: colors.border }]}>
              <MaterialCommunityIcons
                name={isPositive ? "arrow-up" : "arrow-down"}
                size={14}
                color={isPositive ? colors.success : colors.destructive}
              />
              <Text style={[styles.obMidPrice, { color: isPositive ? colors.success : colors.destructive }]}>
                ${formatPrice(ticker.index_price)}
              </Text>
            </View>
          )}

          {(orderbook?.bids.slice(0, 8) ?? []).map((bid, i) => (
            <OrderbookRow key={`bid-${i}`} level={bid} side="bid" maxQty={maxBid} />
          ))}
        </View>

        <View style={[styles.infoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="info" size={16} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            Connect a wallet on the FrostDex web app to place orders. This mobile view shows live read-only market data.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  symbolPicker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  symbolPickerText: { fontSize: 16, fontWeight: "700" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerPrice: { fontSize: 20, fontWeight: "700" },
  changeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  changeText: { fontSize: 13, fontWeight: "600" },
  pickerDropdown: {
    position: "absolute",
    top: 80,
    left: 16,
    right: 16,
    zIndex: 100,
    borderRadius: 10,
    borderWidth: 1,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  pickerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pickerSymbol: { fontSize: 14, fontWeight: "600" },
  pickerPrice: { fontSize: 13, fontWeight: "600" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", padding: 8, gap: 8 },
  statBox: { flex: 1, minWidth: "30%", padding: 12, borderRadius: 10, borderWidth: 1, gap: 4 },
  statLabel: { fontSize: 11 },
  statValue: { fontSize: 13, fontWeight: "600" },
  section: { marginHorizontal: 16, marginVertical: 8, borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12 },
  sectionTitle: { fontSize: 15, fontWeight: "600" },
  obHeader: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 12, paddingBottom: 4 },
  obHeaderText: { fontSize: 11 },
  obRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 5,
    overflow: "hidden",
    position: "relative",
  },
  obFill: { position: "absolute", top: 0, bottom: 0 },
  obPrice: { fontSize: 13, fontWeight: "500", zIndex: 1 },
  obQty: { fontSize: 12, zIndex: 1 },
  obMidRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  obMidPrice: { fontSize: 16, fontWeight: "700" },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  infoText: { flex: 1, fontSize: 13, lineHeight: 18 },
});
