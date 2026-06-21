import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { WEB_APP_BASE } from "@/constants/urls";

const COMMISSION_RATE = 20;
const REBATE_RATE = 10;

const HOW_IT_WORKS = [
  {
    step: "01",
    icon: "link",
    title: "Get Your Link",
    desc: "Connect your wallet on the FrostDex web app and copy your unique referral link.",
    color: "#38E0F8",
  },
  {
    step: "02",
    icon: "users",
    title: "Invite Friends",
    desc: "Share your link on social media, Telegram, or Discord. Friends sign up and start trading.",
    color: "#a78bfa",
  },
  {
    step: "03",
    icon: "dollar-sign",
    title: "Earn Commissions",
    desc: `Earn ${COMMISSION_RATE}% of your friends' trading fees in USDC — paid out automatically on-chain.`,
    color: "#34d399",
  },
];

const FEATURES = [
  { icon: "percent", label: "Your Commission", value: `${COMMISSION_RATE}%` },
  { icon: "tag", label: "Friend's Rebate", value: `${REBATE_RATE}%` },
  { icon: "zap", label: "Payout", value: "Automatic" },
  { icon: "shield", label: "Settlement", value: "On-chain" },
];

export default function ReferralScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 : insets.bottom + 80;
  const [copied, setCopied] = useState(false);

  const referralUrl = WEB_APP_BASE
    ? `${WEB_APP_BASE}/?ref=YOURCODE`
    : "https://frostdex.pw/?ref=YOURCODE";

  const handleCopy = async () => {
    try {
      if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(referralUrl);
      }
    } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Trade perpetuals on FrostDex and get ${REBATE_RATE}% fee rebate! ${referralUrl}`,
        url: referralUrl,
      });
    } catch {}
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad }}
      >
        {/* Hero */}
        <View
          style={[
            styles.hero,
            {
              paddingTop: topPad + 20,
              borderBottomColor: `${colors.primary}20`,
              backgroundColor: `${colors.primary}08`,
            },
          ]}
        >
          <View style={[styles.heroBadge, { backgroundColor: `${colors.primary}18` }]}>
            <Feather name="gift" size={14} color={colors.primary} />
            <Text style={[styles.heroBadgeText, { color: colors.primary }]}>Referral Program</Text>
          </View>
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>
            Invite Friends,{"\n"}
            <Text style={{ color: colors.primary }}>Earn Rewards</Text>
          </Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
            Share your link and earn{" "}
            <Text style={{ color: colors.primary, fontWeight: "700" }}>{COMMISSION_RATE}%</Text>
            {" "}commission on friends' fees. They get{" "}
            <Text style={{ color: colors.primary, fontWeight: "700" }}>{REBATE_RATE}%</Text>
            {" "}rebate.
          </Text>

          {/* Link box */}
          <View style={[styles.linkBox, { backgroundColor: colors.card, borderColor: `${colors.primary}30` }]}>
            <Feather name="link" size={14} color={colors.primary} style={{ flexShrink: 0 }} />
            <Text style={[styles.linkText, { color: colors.mutedForeground }]} numberOfLines={1}>
              Connect wallet on web app to get your link
            </Text>
          </View>

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              onPress={handleCopy}
              activeOpacity={0.7}
              style={[styles.actionBtn, { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}40` }]}
            >
              <Feather name={copied ? "check" : "copy"} size={16} color={colors.primary} />
              <Text style={[styles.actionBtnText, { color: colors.primary }]}>
                {copied ? "Copied!" : "Copy Link"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleShare}
              activeOpacity={0.7}
              style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Feather name="share-2" size={16} color={colors.foreground} />
              <Text style={[styles.actionBtnText, { color: colors.foreground }]}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          {FEATURES.map((f) => (
            <View
              key={f.label}
              style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Feather name={f.icon as any} size={18} color={colors.primary} />
              <Text style={[styles.statValue, { color: colors.foreground }]}>{f.value}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{f.label}</Text>
            </View>
          ))}
        </View>

        {/* How it works */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>How It Works</Text>
        <View style={styles.stepsCol}>
          {HOW_IT_WORKS.map((s) => (
            <View
              key={s.step}
              style={[styles.stepCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[styles.stepIconWrap, { backgroundColor: `${s.color}18` }]}>
                <Feather name={s.icon as any} size={20} color={s.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.stepTitle, { color: colors.foreground }]}>{s.title}</Text>
                <Text style={[styles.stepDesc, { color: colors.mutedForeground }]}>{s.desc}</Text>
              </View>
              <Text style={[styles.stepNum, { color: `${s.color}30` }]}>{s.step}</Text>
            </View>
          ))}
        </View>

        {/* CTA */}
        <View style={[styles.cta, { backgroundColor: `${colors.primary}08`, borderColor: `${colors.primary}20` }]}>
          <MaterialCommunityIcons name="open-in-new" size={18} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.ctaTitle, { color: colors.foreground }]}>Full Dashboard on Web</Text>
            <Text style={[styles.ctaDesc, { color: colors.mutedForeground }]}>
              View detailed charts, daily volume, and manage multiple referral codes on frostdex.pw
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 14,
  },
  heroBadgeText: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  heroTitle: { fontSize: 30, fontWeight: "800", lineHeight: 36, marginBottom: 10 },
  heroSub: { fontSize: 14, lineHeight: 20, marginBottom: 18 },
  linkBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  linkText: { flex: 1, fontSize: 13, fontFamily: "monospace" },
  actionRow: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionBtnText: { fontSize: 14, fontWeight: "700" },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    width: "47%",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    alignItems: "center",
    gap: 6,
  },
  statValue: { fontSize: 20, fontWeight: "800" },
  statLabel: { fontSize: 11, textAlign: "center" },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  stepsCol: { paddingHorizontal: 16, gap: 10, marginBottom: 20 },
  stepCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  stepIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stepTitle: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  stepDesc: { fontSize: 13, lineHeight: 18 },
  stepNum: {
    position: "absolute",
    top: 8,
    right: 12,
    fontSize: 36,
    fontWeight: "900",
  },
  cta: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  ctaTitle: { fontSize: 14, fontWeight: "700", marginBottom: 4 },
  ctaDesc: { fontSize: 12, lineHeight: 17 },
});
