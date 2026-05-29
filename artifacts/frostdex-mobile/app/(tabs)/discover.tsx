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

interface DiscoverItem {
  id: string;
  title: string;
  description: string;
  iconName: string;
  iconFamily: "feather" | "material" | "ionicons";
  tag?: string;
  tagColor?: "primary" | "success" | "warning";
  webPath: string;
}

const DISCOVER_ITEMS: DiscoverItem[] = [
  {
    id: "rewards",
    title: "Affiliate Rewards",
    description: "Earn FROST by referring traders to FrostDex. Share your affiliate link and receive a cut of their fees.",
    iconName: "gift",
    iconFamily: "feather",
    tag: "Earn",
    tagColor: "success",
    webPath: "/rewards/affiliate",
  },
  {
    id: "points",
    title: "Trading Points",
    description: "Earn points for every trade on FrostDex. Points convert to FROST at the end of each epoch.",
    iconName: "star",
    iconFamily: "feather",
    tag: "Rewards",
    tagColor: "primary",
    webPath: "/points",
  },
  {
    id: "vaults",
    title: "Yield Vaults",
    description: "Deposit USDC into automated yield-generating vaults managed by on-chain strategies.",
    iconName: "safe-square-outline",
    iconFamily: "material",
    tag: "Yield",
    tagColor: "success",
    webPath: "/vaults",
  },
  {
    id: "bot",
    title: "Trading Bots",
    description: "Set up Grid, DCA, or Signal bots that trade automatically based on your strategy — no manual execution needed.",
    iconName: "hardware-chip-outline",
    iconFamily: "ionicons",
    tag: "Auto",
    tagColor: "warning",
    webPath: "/bot",
  },
];

const STATS = [
  { label: "Affiliate Commission", value: "20%", icon: "percent" },
  { label: "Points per $1M Vol", value: "1,000", icon: "trending-up" },
  { label: "Vault APY (est.)", value: "~8.5%", icon: "bar-chart-2" },
  { label: "Active Bots", value: "3 types", icon: "cpu" },
];

function TagBadge({ tag, tagColor, colors }: { tag: string; tagColor: "primary" | "success" | "warning"; colors: ReturnType<typeof useColors> }) {
  const colorMap = {
    primary: colors.primary,
    success: colors.success,
    warning: colors.warning,
  };
  const c = colorMap[tagColor];
  return (
    <View style={[styles.tag, { backgroundColor: `${c}22` }]}>
      <Text style={[styles.tagText, { color: c }]}>{tag}</Text>
    </View>
  );
}

function DiscoverCard({ item, colors }: { item: DiscoverItem; colors: ReturnType<typeof useColors> }) {
  const Icon =
    item.iconFamily === "feather"
      ? Feather
      : item.iconFamily === "ionicons"
      ? Ionicons
      : MaterialCommunityIcons;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      activeOpacity={0.7}
      onPress={() => Linking.openURL(`https://frostdex.replit.app${item.webPath}`)}
    >
      <View style={styles.cardTop}>
        <View style={[styles.cardIcon, { backgroundColor: `${colors.primary}18` }]}>
          <Icon name={item.iconName as any} size={22} color={colors.primary} />
        </View>
        {item.tag && item.tagColor && (
          <TagBadge tag={item.tag} tagColor={item.tagColor} colors={colors} />
        )}
      </View>
      <Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.title}</Text>
      <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>{item.description}</Text>
      <View style={styles.cardAction}>
        <Text style={[styles.cardActionText, { color: colors.primary }]}>Open in web app</Text>
        <Feather name="external-link" size={14} color={colors.primary} />
      </View>
    </TouchableOpacity>
  );
}

export default function DiscoverScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 : insets.bottom + 80;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Discover</Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>Earn, automate, and grow</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        <View style={styles.statsRow}>
          {STATS.map((s) => (
            <View key={s.label} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name={s.icon as any} size={16} color={colors.primary} />
              <Text style={[styles.statVal, { color: colors.foreground }]}>{s.value}</Text>
              <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Features</Text>

        <View style={styles.cardGrid}>
          {DISCOVER_ITEMS.map((item) => (
            <DiscoverCard key={item.id} item={item} colors={colors} />
          ))}
        </View>

        <View style={[styles.banner, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}30` }]}>
          <MaterialCommunityIcons name="snowflake" size={20} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.bannerTitle, { color: colors.foreground }]}>All features on the web app</Text>
            <Text style={[styles.bannerDesc, { color: colors.mutedForeground }]}>
              The mobile app shows live data. Full trading, bots, vaults, and rewards are available at frostdex.replit.app.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 24, fontWeight: "700" },
  headerSub: { fontSize: 12, marginTop: 2 },
  statsRow: { flexDirection: "row", flexWrap: "wrap", padding: 8, gap: 8, paddingHorizontal: 12 },
  statCard: { flex: 1, minWidth: "44%", padding: 12, borderRadius: 12, borderWidth: 1, alignItems: "center", gap: 6 },
  statVal: { fontSize: 16, fontWeight: "700" },
  statLbl: { fontSize: 11, textAlign: "center" },
  sectionLabel: { fontSize: 12, fontWeight: "600", paddingHorizontal: 20, marginBottom: 8, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  cardGrid: { paddingHorizontal: 16, gap: 12 },
  card: { padding: 16, borderRadius: 14, borderWidth: 1 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  cardIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tagText: { fontSize: 12, fontWeight: "600" },
  cardTitle: { fontSize: 16, fontWeight: "700", marginBottom: 6 },
  cardDesc: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  cardAction: { flexDirection: "row", alignItems: "center", gap: 5 },
  cardActionText: { fontSize: 13, fontWeight: "600" },
  banner: { flexDirection: "row", alignItems: "flex-start", marginHorizontal: 16, marginTop: 12, padding: 14, borderRadius: 14, borderWidth: 1, gap: 12 },
  bannerTitle: { fontSize: 14, fontWeight: "600", marginBottom: 4 },
  bannerDesc: { fontSize: 12, lineHeight: 17 },
});
