import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface FeatureItem {
  icon: string;
  title: string;
  desc: string;
}

const FEATURES: FeatureItem[] = [
  { icon: "trending-up", title: "Positions", desc: "View open perpetual positions and unrealized PnL" },
  { icon: "list", title: "Orders", desc: "Manage open limit and stop orders" },
  { icon: "layers", title: "Assets", desc: "Cross-chain deposits & withdrawal balances" },
  { icon: "clock", title: "History", desc: "Trade history, funding, and settlement records" },
  { icon: "award", title: "Rewards", desc: "FROST token rewards and affiliate earnings" },
  { icon: "key", title: "API Keys", desc: "Generate and manage trading API keys" },
];

export default function PortfolioScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 : insets.bottom + 80;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { paddingTop: topPad + 12 }]}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Portfolio</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>Connect wallet to trade</Text>
        </View>

        <View style={[styles.walletCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.walletIconContainer, { backgroundColor: `${colors.primary}18` }]}>
            <MaterialCommunityIcons name="wallet-outline" size={40} color={colors.primary} />
          </View>
          <Text style={[styles.walletTitle, { color: colors.foreground }]}>Wallet Not Connected</Text>
          <Text style={[styles.walletDesc, { color: colors.mutedForeground }]}>
            Connect your wallet on the FrostDex web app to access your portfolio, positions, and trading features.
          </Text>
          <TouchableOpacity
            style={[styles.connectBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.8}
            onPress={() => Linking.openURL("https://frostdex.replit.app")}
          >
            <Feather name="external-link" size={16} color={colors.primaryForeground} />
            <Text style={[styles.connectBtnText, { color: colors.primaryForeground }]}>Open Web App</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.primary }]}>$0.00</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Balance</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.success }]}>$0.00</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Unrealized PnL</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>0</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Positions</Text>
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Portfolio Features</Text>

        <View style={styles.featureList}>
          {FEATURES.map((item) => (
            <View key={item.title} style={[styles.featureCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.featureIcon, { backgroundColor: `${colors.primary}18` }]}>
                <Feather name={item.icon as any} size={20} color={colors.primary} />
              </View>
              <View style={styles.featureText}>
                <Text style={[styles.featureTitle, { color: colors.foreground }]}>{item.title}</Text>
                <Text style={[styles.featureDesc, { color: colors.mutedForeground }]}>{item.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={[styles.infoBanner, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}30` }]}>
          <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            FrostDex Mobile shows live market data. Portfolio management, order placement, and wallet features are on the full web app.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 24, fontWeight: "700" },
  headerSub: { fontSize: 12, marginTop: 2 },
  walletCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    gap: 12,
  },
  walletIconContainer: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  walletTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  walletDesc: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  connectBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, marginTop: 4 },
  connectBtnText: { fontSize: 15, fontWeight: "600" },
  statsRow: { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 20 },
  statCard: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, alignItems: "center", gap: 4 },
  statValue: { fontSize: 16, fontWeight: "700" },
  statLabel: { fontSize: 11 },
  sectionLabel: { fontSize: 12, fontWeight: "600", paddingHorizontal: 20, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  featureList: { paddingHorizontal: 16, gap: 8 },
  featureCard: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1, gap: 14 },
  featureIcon: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 14, fontWeight: "600" },
  featureDesc: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  infoBanner: { flexDirection: "row", alignItems: "flex-start", marginHorizontal: 16, marginTop: 16, padding: 12, borderRadius: 10, borderWidth: 1, gap: 8 },
  infoText: { flex: 1, fontSize: 12, lineHeight: 18 },
});
