import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Image,
  Linking,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

interface CoinResult {
  id: string;
  name: string;
  symbol: string;
  thumb: string;
  market_cap_rank: number | null;
}

interface TrendingCoin {
  item: {
    id: string;
    name: string;
    symbol: string;
    thumb: string;
    market_cap_rank: number;
    data: { price_change_percentage_24h: { usd: number } };
  };
}

interface CoinDetail {
  id: string;
  name: string;
  symbol: string;
  image: { large: string };
  market_cap_rank: number | null;
  market_data: {
    current_price: { usd: number };
    market_cap: { usd: number };
    total_volume: { usd: number };
    price_change_percentage_24h: number;
    price_change_percentage_7d: number;
    price_change_percentage_30d: number;
    high_24h: { usd: number };
    low_24h: { usd: number };
    circulating_supply: number;
    total_supply: number | null;
    ath: { usd: number };
    atl: { usd: number };
  };
  description: { en: string };
  links: {
    homepage: string[];
    twitter_screen_name: string;
    telegram_channel_identifier: string;
  };
}

function fmt(n: number, compact = false): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: n < 1 ? 6 : n < 100 ? 4 : 2,
  }).format(n);
}

function fmtCompact(n: number): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(n);
}

function pct(n: number): string {
  if (n == null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function StatCard({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.statValue, { color: colors.foreground }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function CoinDetailView({ coin, colors, onClose }: { coin: CoinDetail; colors: ReturnType<typeof useColors>; onClose: () => void }) {
  const md = coin.market_data;
  const price = md.current_price.usd;
  const change24h = md.price_change_percentage_24h;
  const isUp = change24h >= 0;

  const rangeWidth = md.high_24h.usd > md.low_24h.usd
    ? Math.min(100, Math.max(0, ((price - md.low_24h.usd) / (md.high_24h.usd - md.low_24h.usd)) * 100))
    : 0;

  const links = [
    coin.links.homepage?.[0] && { label: "Website", url: coin.links.homepage[0] },
    coin.links.twitter_screen_name && { label: "Twitter", url: `https://twitter.com/${coin.links.twitter_screen_name}` },
    coin.links.telegram_channel_identifier && { label: "Telegram", url: `https://t.me/${coin.links.telegram_channel_identifier}` },
  ].filter(Boolean) as { label: string; url: string }[];

  const desc = coin.description?.en
    ? coin.description.en.replace(/<[^>]*>/g, "").split(". ").slice(0, 3).join(". ") + "."
    : "";

  const periods = [
    { label: "24h", value: md.price_change_percentage_24h },
    { label: "7d", value: md.price_change_percentage_7d },
    { label: "30d", value: md.price_change_percentage_30d },
  ];

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailScroll}>
      <TouchableOpacity onPress={onClose} style={styles.backBtn} activeOpacity={0.7}>
        <Feather name="chevron-left" size={20} color={colors.primary} />
        <Text style={[styles.backText, { color: colors.primary }]}>Search</Text>
      </TouchableOpacity>

      <View style={[styles.detailHeader, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.coinMeta}>
          <Image source={{ uri: coin.image.large }} style={styles.coinLogo} />
          <View style={{ flex: 1 }}>
            <View style={styles.coinNameRow}>
              <Text style={[styles.coinName, { color: colors.foreground }]}>{coin.name}</Text>
              <View style={[styles.symbolBadge, { backgroundColor: colors.accent }]}>
                <Text style={[styles.symbolBadgeText, { color: colors.mutedForeground }]}>{coin.symbol.toUpperCase()}</Text>
              </View>
              {coin.market_cap_rank && (
                <View style={[styles.rankBadge, { backgroundColor: `${colors.primary}18` }]}>
                  <Text style={[styles.rankText, { color: colors.primary }]}>#{coin.market_cap_rank}</Text>
                </View>
              )}
            </View>
            <View style={styles.priceRow}>
              <Text style={[styles.detailPrice, { color: colors.foreground }]}>{fmt(price)}</Text>
              <View style={[styles.changePill, { backgroundColor: isUp ? `${colors.success}22` : `${colors.destructive}22` }]}>
                <Feather name={isUp ? "trending-up" : "trending-down"} size={12} color={isUp ? colors.success : colors.destructive} />
                <Text style={[styles.changeText, { color: isUp ? colors.success : colors.destructive }]}>{pct(change24h)}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.rangeRow}>
          <Text style={[styles.rangeLabel, { color: colors.mutedForeground }]}>Lo {fmt(md.low_24h.usd)}</Text>
          <Text style={[styles.rangeLabel, { color: colors.mutedForeground }]}>Hi {fmt(md.high_24h.usd)}</Text>
        </View>
        <View style={[styles.rangeBar, { backgroundColor: colors.accent }]}>
          <View style={[styles.rangeFill, { width: `${rangeWidth}%`, backgroundColor: colors.primary }]} />
        </View>

        <View style={styles.periodsRow}>
          {periods.map((p) => (
            <View key={p.label} style={[styles.periodCard, { backgroundColor: colors.accent }]}>
              <Text style={[styles.periodLabel, { color: colors.mutedForeground }]}>{p.label}</Text>
              {p.value != null ? (
                <Text style={[styles.periodValue, { color: p.value >= 0 ? colors.success : colors.destructive }]}>{pct(p.value)}</Text>
              ) : (
                <Text style={[styles.periodValue, { color: colors.mutedForeground }]}>—</Text>
              )}
            </View>
          ))}
        </View>
      </View>

      <View style={styles.statsGrid}>
        {[
          { label: "Market Cap", value: fmt(md.market_cap.usd, true) },
          { label: "24h Volume", value: fmt(md.total_volume.usd, true) },
          { label: "Circ. Supply", value: `${fmtCompact(md.circulating_supply)} ${coin.symbol.toUpperCase()}` },
          { label: "Total Supply", value: md.total_supply ? `${fmtCompact(md.total_supply)} ${coin.symbol.toUpperCase()}` : "∞" },
          { label: "All-Time High", value: fmt(md.ath.usd) },
          { label: "All-Time Low", value: fmt(md.atl.usd) },
        ].map((s) => <StatCard key={s.label} label={s.label} value={s.value} colors={colors} />)}
      </View>

      {!!desc && desc.length > 5 && (
        <View style={[styles.descCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.descTitle, { color: colors.foreground }]}>About</Text>
          <Text style={[styles.descText, { color: colors.mutedForeground }]}>{desc}</Text>
        </View>
      )}

      {links.length > 0 && (
        <View style={styles.linksRow}>
          {links.map((l) => (
            <TouchableOpacity
              key={l.label}
              onPress={() => Linking.openURL(l.url)}
              style={[styles.linkBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              activeOpacity={0.7}
            >
              <Feather name="external-link" size={12} color={colors.mutedForeground} />
              <Text style={[styles.linkText, { color: colors.mutedForeground }]}>{l.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={[styles.credit, { color: colors.mutedForeground }]}>Data by CoinGecko</Text>
    </ScrollView>
  );
}

export default function TokensScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 : insets.bottom + 80;

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CoinResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selectedCoinId, setSelectedCoinId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: trending } = useQuery<TrendingCoin[]>({
    queryKey: ["trending"],
    queryFn: async () => {
      const res = await fetch(`${COINGECKO_BASE}/search/trending`);
      const json = await res.json();
      return (json.coins ?? []).slice(0, 8);
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: coinDetail, isLoading: detailLoading } = useQuery<CoinDetail | null>({
    queryKey: ["coin-detail", selectedCoinId],
    queryFn: async () => {
      if (!selectedCoinId) return null;
      const res = await fetch(
        `${COINGECKO_BASE}/coins/${selectedCoinId}?localization=false&tickers=false&community_data=false&developer_data=false`
      );
      return res.json();
    },
    enabled: !!selectedCoinId,
    staleTime: 60 * 1000,
  });

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); setShowDropdown(false); return; }
    setSearching(true);
    try {
      const res = await fetch(`${COINGECKO_BASE}/search?query=${encodeURIComponent(q)}`);
      const json = await res.json();
      setSearchResults((json.coins ?? []).slice(0, 8));
      setShowDropdown(true);
    } catch {}
    setSearching(false);
  }, []);

  const handleInput = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(text), 350);
  };

  const selectCoin = (coin: CoinResult) => {
    setQuery(coin.name);
    setShowDropdown(false);
    setSelectedCoinId(coin.id);
  };

  const clearSearch = () => {
    setQuery("");
    setSearchResults([]);
    setShowDropdown(false);
    setSelectedCoinId(null);
  };

  if (selectedCoinId && detailLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.center, { paddingTop: topPad + 60 }]}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (selectedCoinId && coinDetail) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <CoinDetailView
          coin={coinDetail}
          colors={colors}
          onClose={clearSearch}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Token Search</Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>Live prices from CoinGecko</Text>
      </View>

      <View style={styles.searchWrapper}>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: showDropdown ? colors.primary : colors.border }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            value={query}
            onChangeText={handleInput}
            placeholder="Bitcoin, ETH, SOL..."
            placeholderTextColor={colors.mutedForeground}
            style={[styles.searchInput, { color: colors.foreground }]}
            returnKeyType="search"
          />
          {searching && <ActivityIndicator size="small" color={colors.primary} />}
          {!!query && !searching && (
            <TouchableOpacity onPress={clearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>

        {showDropdown && searchResults.length > 0 && (
          <View style={[styles.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {searchResults.map((coin, idx) => (
              <TouchableOpacity
                key={coin.id}
                onPress={() => selectCoin(coin)}
                activeOpacity={0.7}
                style={[
                  styles.dropdownItem,
                  { borderBottomColor: colors.border },
                  idx === searchResults.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                {coin.thumb ? (
                  <Image source={{ uri: coin.thumb }} style={styles.dropdownThumb} />
                ) : (
                  <View style={[styles.dropdownThumb, { backgroundColor: colors.accent }]} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.dropdownName, { color: colors.foreground }]}>{coin.name}</Text>
                  <Text style={[styles.dropdownSymbol, { color: colors.mutedForeground }]}>{coin.symbol.toUpperCase()}</Text>
                </View>
                {coin.market_cap_rank && (
                  <Text style={[styles.dropdownRank, { color: colors.mutedForeground }]}>#{coin.market_cap_rank}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {trending && trending.length > 0 && (
          <View style={styles.trendingSection}>
            <View style={styles.sectionHeader}>
              <Feather name="star" size={14} color={colors.warning} />
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Trending</Text>
            </View>
            <View style={styles.trendingGrid}>
              {trending.map(({ item }) => {
                const change = item.data?.price_change_percentage_24h?.usd;
                const isUp = change != null && change >= 0;
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => { setQuery(item.name); setSelectedCoinId(item.id); }}
                    activeOpacity={0.7}
                    style={[styles.trendingCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    {item.thumb ? (
                      <Image source={{ uri: item.thumb }} style={styles.trendingThumb} />
                    ) : (
                      <View style={[styles.trendingThumb, { backgroundColor: colors.accent }]} />
                    )}
                    <Text style={[styles.trendingSymbol, { color: colors.foreground }]} numberOfLines={1}>{item.symbol}</Text>
                    {change != null && (
                      <Text style={[styles.trendingChange, { color: isUp ? colors.success : colors.destructive }]}>{pct(change)}</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14 },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 24, fontWeight: "700" },
  headerSub: { fontSize: 12, marginTop: 2 },
  searchWrapper: { paddingHorizontal: 16, marginBottom: 4, zIndex: 100 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15 },
  dropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    zIndex: 200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dropdownThumb: { width: 32, height: 32, borderRadius: 16 },
  dropdownName: { fontSize: 14, fontWeight: "600" },
  dropdownSymbol: { fontSize: 12, marginTop: 1 },
  dropdownRank: { fontSize: 12 },
  trendingSection: { paddingHorizontal: 16, paddingTop: 16 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  sectionTitle: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  trendingGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  trendingCard: {
    width: "47%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  trendingThumb: { width: 36, height: 36, borderRadius: 18 },
  trendingSymbol: { fontSize: 13, fontWeight: "700", flex: 1 },
  trendingChange: { fontSize: 12, fontWeight: "600" },
  detailScroll: { paddingHorizontal: 16, paddingBottom: 40 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 16, paddingTop: 8 },
  backText: { fontSize: 15, fontWeight: "600" },
  detailHeader: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  coinMeta: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 16 },
  coinLogo: { width: 52, height: 52, borderRadius: 26 },
  coinNameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 6 },
  coinName: { fontSize: 18, fontWeight: "700" },
  symbolBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  symbolBadgeText: { fontSize: 11, fontWeight: "600" },
  rankBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  rankText: { fontSize: 11, fontWeight: "600" },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  detailPrice: { fontSize: 22, fontWeight: "700" },
  changePill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  changeText: { fontSize: 13, fontWeight: "600" },
  rangeRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  rangeLabel: { fontSize: 11 },
  rangeBar: { height: 6, borderRadius: 3, overflow: "hidden", marginBottom: 14 },
  rangeFill: { height: "100%", borderRadius: 3 },
  periodsRow: { flexDirection: "row", gap: 8 },
  periodCard: { flex: 1, borderRadius: 10, padding: 10, alignItems: "center", gap: 4 },
  periodLabel: { fontSize: 11 },
  periodValue: { fontSize: 13, fontWeight: "700" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  statCard: { width: "47%", borderRadius: 12, borderWidth: 1, padding: 12, gap: 4 },
  statLabel: { fontSize: 11 },
  statValue: { fontSize: 14, fontWeight: "600" },
  descCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12 },
  descTitle: { fontSize: 14, fontWeight: "700", marginBottom: 6 },
  descText: { fontSize: 13, lineHeight: 19 },
  linksRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  linkBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  linkText: { fontSize: 12, fontWeight: "600" },
  credit: { fontSize: 11, textAlign: "center", marginTop: 8 },
});
