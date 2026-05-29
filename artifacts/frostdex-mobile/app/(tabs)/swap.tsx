import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  TextInput,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { fetchTicker, formatPrice, ORDERLY_API_BASE } from "@/constants/api";

const FROST_SYMBOL = "PERP_FROST_USDC";
const FROST_CA = "0xfrost000000000000000000000000000000000000";

interface PriceResult {
  price: number;
  change: number;
}

async function fetchFrostPrice(): Promise<PriceResult | null> {
  try {
    const res = await fetch(`${ORDERLY_API_BASE}/v1/public/futures/${FROST_SYMBOL}`);
    const json = await res.json();
    const data = json?.data;
    if (!data) return null;
    const open = data["24h_open"] ?? 0;
    const close = data.index_price ?? 0;
    const change = open > 0 ? ((close - open) / open) * 100 : 0;
    return { price: close, change };
  } catch {
    return null;
  }
}

async function fetchWooMarkets() {
  const res = await fetch(`${ORDERLY_API_BASE}/v1/public/futures`);
  const json = await res.json();
  return (json?.data?.rows ?? []).slice(0, 5);
}

function PriceCard({ colors }: { colors: ReturnType<typeof useColors> }) {
  const { data: frostPrice } = useQuery({
    queryKey: ["frost-price"],
    queryFn: fetchFrostPrice,
    refetchInterval: 15000,
  });

  const isPositive = (frostPrice?.change ?? 0) >= 0;

  return (
    <View style={[styles.priceCard, { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}40` }]}>
      <View style={styles.priceCardLeft}>
        <View style={[styles.frostIcon, { backgroundColor: `${colors.primary}25` }]}>
          <MaterialCommunityIcons name="snowflake" size={28} color={colors.primary} />
        </View>
        <View>
          <Text style={[styles.frostLabel, { color: colors.mutedForeground }]}>FROST Token</Text>
          {frostPrice ? (
            <Text style={[styles.frostPrice, { color: colors.foreground }]}>
              ${formatPrice(frostPrice.price)}
            </Text>
          ) : (
            <Text style={[styles.frostPrice, { color: colors.mutedForeground }]}>Loading...</Text>
          )}
        </View>
      </View>
      {frostPrice && (
        <View style={[styles.changePill, { backgroundColor: isPositive ? `${colors.success}22` : `${colors.destructive}22` }]}>
          <Text style={[styles.changePillText, { color: isPositive ? colors.success : colors.destructive }]}>
            {isPositive ? "+" : ""}{frostPrice.change.toFixed(2)}%
          </Text>
        </View>
      )}
    </View>
  );
}

export default function SwapScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 : insets.bottom + 80;
  const [activeTab, setActiveTab] = useState<"frost" | "general">("frost");
  const [fromAmount, setFromAmount] = useState("");

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Swap</Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>Buy FROST or swap tokens</Text>
      </View>

      <View style={[styles.tabRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {(["frost", "general"] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tabBtn, activeTab === tab && { backgroundColor: colors.primary }]}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabBtnText, { color: activeTab === tab ? colors.primaryForeground : colors.mutedForeground }]}>
              {tab === "frost" ? "❄ Buy FROST" : "General Swap"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        {activeTab === "frost" ? (
          <>
            <PriceCard colors={colors} />

            <View style={[styles.swapCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.swapCardTitle, { color: colors.foreground }]}>Buy FROST</Text>
              <Text style={[styles.swapCardSub, { color: colors.mutedForeground }]}>
                The native token of FrostDex, used for fee discounts, staking rewards, and governance.
              </Text>

              <View style={[styles.inputGroup, { borderColor: colors.border, backgroundColor: colors.muted }]}>
                <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>You pay (USDC)</Text>
                <TextInput
                  value={fromAmount}
                  onChangeText={setFromAmount}
                  placeholder="0.00"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                  style={[styles.inputField, { color: colors.foreground }]}
                />
              </View>

              <View style={styles.arrowRow}>
                <View style={[styles.arrowCircle, { backgroundColor: colors.accent, borderColor: colors.border }]}>
                  <Feather name="arrow-down" size={16} color={colors.primary} />
                </View>
              </View>

              <View style={[styles.inputGroup, { borderColor: colors.border, backgroundColor: colors.muted }]}>
                <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>You receive (FROST)</Text>
                <Text style={[styles.inputStatic, { color: colors.mutedForeground }]}>
                  {fromAmount ? "~" + (parseFloat(fromAmount) / 0.01).toFixed(0) : "0"}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.buyBtn, { backgroundColor: colors.primary }]}
                activeOpacity={0.8}
                onPress={() => Linking.openURL("https://frostdex.replit.app/swap")}
              >
                <MaterialCommunityIcons name="snowflake" size={18} color={colors.primaryForeground} />
                <Text style={[styles.buyBtnText, { color: colors.primaryForeground }]}>Buy on FrostDex Web</Text>
              </TouchableOpacity>

              <Text style={[styles.contractNote, { color: colors.mutedForeground }]}>
                Token address: {FROST_CA.slice(0, 10)}...{FROST_CA.slice(-8)}
              </Text>
            </View>

            <View style={[styles.infoRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {[
                { icon: "percent", label: "Fee Discount", value: "Up to 30%" },
                { icon: "trending-up", label: "APY Staking", value: "~12%" },
                { icon: "users", label: "Governance", value: "Vote on proposals" },
              ].map((item) => (
                <View key={item.label} style={styles.infoCol}>
                  <Feather name={item.icon as any} size={18} color={colors.primary} />
                  <Text style={[styles.infoVal, { color: colors.foreground }]}>{item.value}</Text>
                  <Text style={[styles.infoLbl, { color: colors.mutedForeground }]}>{item.label}</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <>
            <View style={[styles.swapCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.swapCardTitle, { color: colors.foreground }]}>Cross-chain Swap</Text>
              <Text style={[styles.swapCardSub, { color: colors.mutedForeground }]}>
                Swap any token across chains using the FrostDex web app — powered by WooFi.
              </Text>

              <View style={styles.chainGrid}>
                {["Ethereum", "Arbitrum", "BNB Chain", "Avalanche", "Polygon", "Solana"].map((chain) => (
                  <View key={chain} style={[styles.chainBadge, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                    <Text style={[styles.chainText, { color: colors.foreground }]}>{chain}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.buyBtn, { backgroundColor: colors.secondary }]}
                activeOpacity={0.8}
                onPress={() => Linking.openURL("https://frostdex.replit.app/swap")}
              >
                <Feather name="external-link" size={16} color={colors.foreground} />
                <Text style={[styles.buyBtnText, { color: colors.foreground }]}>Open Swap on Web App</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 24, fontWeight: "700" },
  headerSub: { fontSize: 12, marginTop: 2 },
  tabRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 10,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  tabBtnText: { fontSize: 14, fontWeight: "600" },
  priceCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  priceCardLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  frostIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  frostLabel: { fontSize: 12 },
  frostPrice: { fontSize: 20, fontWeight: "700", marginTop: 2 },
  changePill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  changePillText: { fontSize: 13, fontWeight: "600" },
  swapCard: { marginHorizontal: 16, marginBottom: 12, padding: 18, borderRadius: 14, borderWidth: 1 },
  swapCardTitle: { fontSize: 17, fontWeight: "700", marginBottom: 6 },
  swapCardSub: { fontSize: 13, lineHeight: 18, marginBottom: 16 },
  inputGroup: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 4 },
  inputLabel: { fontSize: 11, marginBottom: 4 },
  inputField: { fontSize: 22, fontWeight: "600" },
  inputStatic: { fontSize: 22, fontWeight: "600" },
  arrowRow: { alignItems: "center", marginVertical: 4 },
  arrowCircle: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  buyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 16, paddingVertical: 14, borderRadius: 12 },
  buyBtnText: { fontSize: 16, fontWeight: "700" },
  contractNote: { fontSize: 11, textAlign: "center", marginTop: 10 },
  infoRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "space-around",
  },
  infoCol: { alignItems: "center", gap: 6 },
  infoVal: { fontSize: 13, fontWeight: "700", textAlign: "center" },
  infoLbl: { fontSize: 11, textAlign: "center" },
  chainGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  chainBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  chainText: { fontSize: 13, fontWeight: "500" },
});
