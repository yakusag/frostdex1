import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

type BotStrategy = "grid" | "dca" | "signal";
type BotStatus = "running" | "stopped" | "paused";

interface Bot {
  id: string;
  name: string;
  strategy: BotStrategy;
  symbol: string;
  investment: number;
  status: BotStatus;
  pnl: number;
  pnlPct: number;
  trades: number;
  createdAt: number;
}

const STRATEGIES: { key: BotStrategy; label: string; icon: string; desc: string; color: string }[] = [
  {
    key: "grid",
    label: "Grid",
    icon: "grid",
    desc: "Place buy/sell orders at evenly spaced price intervals. Best for sideways markets.",
    color: "#38E0F8",
  },
  {
    key: "dca",
    label: "DCA",
    icon: "trending-down",
    desc: "Dollar-cost average into a position over time regardless of price. Reduce volatility risk.",
    color: "#a78bfa",
  },
  {
    key: "signal",
    label: "Signal",
    icon: "zap",
    desc: "Execute trades based on RSI + EMA crossover signals. Momentum-driven strategy.",
    color: "#34d399",
  },
];

const SYMBOLS = ["ETH-PERP", "BTC-PERP", "SOL-PERP", "DOGE-PERP", "ARB-PERP", "OP-PERP"];

const DEMO_BOTS: Bot[] = [
  {
    id: "1",
    name: "ETH Grid Bot",
    strategy: "grid",
    symbol: "ETH-PERP",
    investment: 500,
    status: "running",
    pnl: 34.2,
    pnlPct: 6.84,
    trades: 47,
    createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
  },
  {
    id: "2",
    name: "BTC DCA",
    strategy: "dca",
    symbol: "BTC-PERP",
    investment: 1000,
    status: "paused",
    pnl: -12.5,
    pnlPct: -1.25,
    trades: 8,
    createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
  },
];

function daysSince(ts: number) {
  const days = Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  return `${days}d ago`;
}

function StatusBadge({ status, colors }: { status: BotStatus; colors: ReturnType<typeof useColors> }) {
  const cfg = {
    running: { label: "Running", color: colors.success, dot: true },
    paused: { label: "Paused", color: colors.warning, dot: false },
    stopped: { label: "Stopped", color: colors.mutedForeground, dot: false },
  }[status];

  return (
    <View style={[styles.statusBadge, { backgroundColor: `${cfg.color}18` }]}>
      {cfg.dot && <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />}
      <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

function BotCard({ bot, colors, onToggle, onDelete }: {
  bot: Bot;
  colors: ReturnType<typeof useColors>;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const strategy = STRATEGIES.find((s) => s.key === bot.strategy)!;
  const isUp = bot.pnl >= 0;

  return (
    <View style={[styles.botCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.botCardTop}>
        <View style={[styles.strategyIconWrap, { backgroundColor: `${strategy.color}18` }]}>
          <Feather name={strategy.icon as any} size={18} color={strategy.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.botName, { color: colors.foreground }]}>{bot.name}</Text>
          <Text style={[styles.botMeta, { color: colors.mutedForeground }]}>
            {strategy.label} · {bot.symbol} · ${bot.investment}
          </Text>
        </View>
        <StatusBadge status={bot.status} colors={colors} />
      </View>

      <View style={[styles.botDivider, { backgroundColor: colors.border }]} />

      <View style={styles.botStats}>
        <View style={styles.botStat}>
          <Text style={[styles.botStatLabel, { color: colors.mutedForeground }]}>PnL</Text>
          <Text style={[styles.botStatValue, { color: isUp ? colors.success : colors.destructive }]}>
            {isUp ? "+" : ""}${bot.pnl.toFixed(2)}
          </Text>
        </View>
        <View style={styles.botStat}>
          <Text style={[styles.botStatLabel, { color: colors.mutedForeground }]}>Return</Text>
          <Text style={[styles.botStatValue, { color: isUp ? colors.success : colors.destructive }]}>
            {isUp ? "+" : ""}{bot.pnlPct.toFixed(2)}%
          </Text>
        </View>
        <View style={styles.botStat}>
          <Text style={[styles.botStatLabel, { color: colors.mutedForeground }]}>Trades</Text>
          <Text style={[styles.botStatValue, { color: colors.foreground }]}>{bot.trades}</Text>
        </View>
        <View style={styles.botStat}>
          <Text style={[styles.botStatLabel, { color: colors.mutedForeground }]}>Started</Text>
          <Text style={[styles.botStatValue, { color: colors.foreground }]}>{daysSince(bot.createdAt)}</Text>
        </View>
      </View>

      <View style={styles.botActions}>
        <TouchableOpacity
          onPress={() => onToggle(bot.id)}
          style={[styles.botActionBtn, { backgroundColor: colors.accent, borderColor: colors.border }]}
          activeOpacity={0.7}
        >
          <Feather name={bot.status === "running" ? "pause" : "play"} size={14} color={colors.foreground} />
          <Text style={[styles.botActionText, { color: colors.foreground }]}>
            {bot.status === "running" ? "Pause" : "Resume"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onDelete(bot.id)}
          style={[styles.botActionBtn, { backgroundColor: `${colors.destructive}12`, borderColor: `${colors.destructive}30` }]}
          activeOpacity={0.7}
        >
          <Feather name="trash-2" size={14} color={colors.destructive} />
          <Text style={[styles.botActionText, { color: colors.destructive }]}>Stop</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function CreateBotModal({ visible, onClose, onCreate, colors }: {
  visible: boolean;
  onClose: () => void;
  onCreate: (bot: Omit<Bot, "id" | "pnl" | "pnlPct" | "trades" | "createdAt" | "status">) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [selectedStrategy, setSelectedStrategy] = useState<BotStrategy>("grid");
  const [selectedSymbol, setSelectedSymbol] = useState("ETH-PERP");
  const [investment, setInvestment] = useState("500");
  const [name, setName] = useState("");

  const reset = () => { setStep(0); setSelectedStrategy("grid"); setSelectedSymbol("ETH-PERP"); setInvestment("500"); setName(""); };

  const handleCreate = () => {
    const strategy = STRATEGIES.find((s) => s.key === selectedStrategy)!;
    onCreate({
      name: name || `${selectedSymbol} ${strategy.label} Bot`,
      strategy: selectedStrategy,
      symbol: selectedSymbol,
      investment: parseFloat(investment) || 500,
    });
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalDrag} />
            <View style={styles.modalTitleRow}>
              {step > 0 && (
                <TouchableOpacity onPress={() => setStep((s) => (s - 1) as 0 | 1 | 2)} style={styles.modalBackBtn}>
                  <Feather name="chevron-left" size={20} color={colors.primary} />
                </TouchableOpacity>
              )}
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {step === 0 ? "Choose Strategy" : step === 1 ? "Configure Bot" : "Review & Launch"}
              </Text>
              <TouchableOpacity onPress={() => { onClose(); reset(); }} style={styles.modalCloseBtn}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            {/* Step indicators */}
            <View style={styles.stepDots}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={[styles.stepDot, { backgroundColor: i <= step ? colors.primary : colors.border }]} />
              ))}
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
            {step === 0 && (
              <View style={styles.strategiesCol}>
                {STRATEGIES.map((s) => (
                  <TouchableOpacity
                    key={s.key}
                    onPress={() => setSelectedStrategy(s.key)}
                    activeOpacity={0.7}
                    style={[
                      styles.strategyCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: selectedStrategy === s.key ? s.color : colors.border,
                        borderWidth: selectedStrategy === s.key ? 2 : 1,
                      },
                    ]}
                  >
                    <View style={[styles.strategyCardIcon, { backgroundColor: `${s.color}18` }]}>
                      <Feather name={s.icon as any} size={24} color={s.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.strategyCardLabel, { color: colors.foreground }]}>{s.label} Bot</Text>
                      <Text style={[styles.strategyCardDesc, { color: colors.mutedForeground }]}>{s.desc}</Text>
                    </View>
                    {selectedStrategy === s.key && (
                      <Feather name="check-circle" size={20} color={s.color} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {step === 1 && (
              <View style={styles.configCol}>
                <Text style={[styles.configLabel, { color: colors.mutedForeground }]}>Bot Name (optional)</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder={`${selectedSymbol} ${STRATEGIES.find((s) => s.key === selectedStrategy)?.label} Bot`}
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.configInput, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
                />

                <Text style={[styles.configLabel, { color: colors.mutedForeground }]}>Symbol</Text>
                <View style={styles.symbolGrid}>
                  {SYMBOLS.map((sym) => (
                    <TouchableOpacity
                      key={sym}
                      onPress={() => setSelectedSymbol(sym)}
                      activeOpacity={0.7}
                      style={[
                        styles.symbolChip,
                        {
                          backgroundColor: selectedSymbol === sym ? `${colors.primary}18` : colors.card,
                          borderColor: selectedSymbol === sym ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.symbolChipText, { color: selectedSymbol === sym ? colors.primary : colors.mutedForeground }]}>
                        {sym.replace("-PERP", "")}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.configLabel, { color: colors.mutedForeground }]}>Investment (USDC)</Text>
                <View style={styles.investRow}>
                  {["100", "250", "500", "1000"].map((v) => (
                    <TouchableOpacity
                      key={v}
                      onPress={() => setInvestment(v)}
                      activeOpacity={0.7}
                      style={[
                        styles.investChip,
                        {
                          backgroundColor: investment === v ? `${colors.primary}18` : colors.card,
                          borderColor: investment === v ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.investChipText, { color: investment === v ? colors.primary : colors.mutedForeground }]}>
                        ${v}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  value={investment}
                  onChangeText={setInvestment}
                  keyboardType="decimal-pad"
                  placeholder="Custom amount..."
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.configInput, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, marginTop: 8 }]}
                />
              </View>
            )}

            {step === 2 && (
              <View style={styles.reviewCol}>
                <View style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {[
                    { label: "Strategy", value: STRATEGIES.find((s) => s.key === selectedStrategy)?.label },
                    { label: "Symbol", value: selectedSymbol },
                    { label: "Investment", value: `$${investment} USDC` },
                    { label: "Name", value: name || `${selectedSymbol} ${STRATEGIES.find((s) => s.key === selectedStrategy)?.label} Bot` },
                    { label: "Mode", value: "Paper Trading (Demo)" },
                  ].map((r) => (
                    <View key={r.label} style={[styles.reviewRow, { borderBottomColor: colors.border }]}>
                      <Text style={[styles.reviewLabel, { color: colors.mutedForeground }]}>{r.label}</Text>
                      <Text style={[styles.reviewValue, { color: colors.foreground }]}>{r.value}</Text>
                    </View>
                  ))}
                </View>
                <View style={[styles.infoBox, { backgroundColor: `${colors.warning}10`, borderColor: `${colors.warning}30` }]}>
                  <Feather name="info" size={14} color={colors.warning} />
                  <Text style={[styles.infoText, { color: colors.warning }]}>
                    This bot runs in demo mode. Connect your wallet on the web app (frostdex.pw) to enable live trading.
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
            {step < 2 ? (
              <TouchableOpacity
                onPress={() => setStep((s) => (s + 1) as 0 | 1 | 2)}
                style={[styles.nextBtn, { backgroundColor: colors.primary }]}
                activeOpacity={0.8}
              >
                <Text style={styles.nextBtnText}>Continue</Text>
                <Feather name="arrow-right" size={16} color="#fff" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={handleCreate} style={[styles.nextBtn, { backgroundColor: colors.primary }]} activeOpacity={0.8}>
                <Feather name="zap" size={16} color="#fff" />
                <Text style={styles.nextBtnText}>Launch Bot</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function BotScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 : insets.bottom + 80;

  const [bots, setBots] = useState<Bot[]>(DEMO_BOTS);
  const [showCreate, setShowCreate] = useState(false);
  const [activeTab, setActiveTab] = useState<"bots" | "strategies">("bots");

  const handleToggle = (id: string) => {
    setBots((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, status: b.status === "running" ? "paused" : "running" } : b
      )
    );
  };

  const handleDelete = (id: string) => {
    Alert.alert("Stop Bot", "Are you sure you want to stop and delete this bot?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Stop Bot",
        style: "destructive",
        onPress: () => setBots((prev) => prev.filter((b) => b.id !== id)),
      },
    ]);
  };

  const handleCreate = (data: Omit<Bot, "id" | "pnl" | "pnlPct" | "trades" | "createdAt" | "status">) => {
    const newBot: Bot = {
      ...data,
      id: Date.now().toString(),
      status: "running",
      pnl: 0,
      pnlPct: 0,
      trades: 0,
      createdAt: Date.now(),
    };
    setBots((prev) => [newBot, ...prev]);
  };

  const totalPnl = bots.reduce((sum, b) => sum + b.pnl, 0);
  const runningCount = bots.filter((b) => b.status === "running").length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Trading Bots</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            {runningCount} running · Total PnL{" "}
            <Text style={{ color: totalPnl >= 0 ? colors.success : colors.destructive, fontWeight: "700" }}>
              {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
            </Text>
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowCreate(true)}
          activeOpacity={0.8}
          style={[styles.createBtn, { backgroundColor: colors.primary }]}
        >
          <Feather name="plus" size={16} color="#fff" />
          <Text style={styles.createBtnText}>New Bot</Text>
        </TouchableOpacity>
      </View>

      {/* Tab switcher */}
      <View style={[styles.tabSwitcher, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {(["bots", "strategies"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setActiveTab(t)}
            activeOpacity={0.7}
            style={[styles.tabSwitcherBtn, activeTab === t && { backgroundColor: `${colors.primary}20` }]}
          >
            <Text
              style={[
                styles.tabSwitcherText,
                { color: activeTab === t ? colors.primary : colors.mutedForeground },
              ]}
            >
              {t === "bots" ? `My Bots (${bots.length})` : "Strategies"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad, paddingHorizontal: 16, paddingTop: 12, gap: 12 }}
      >
        {activeTab === "bots" ? (
          bots.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="robot-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Bots Yet</Text>
              <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
                Create your first trading bot and let it work for you 24/7.
              </Text>
              <TouchableOpacity
                onPress={() => setShowCreate(true)}
                style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
                activeOpacity={0.8}
              >
                <Text style={styles.emptyBtnText}>Create Bot</Text>
              </TouchableOpacity>
            </View>
          ) : (
            bots.map((bot) => (
              <BotCard key={bot.id} bot={bot} colors={colors} onToggle={handleToggle} onDelete={handleDelete} />
            ))
          )
        ) : (
          STRATEGIES.map((s) => (
            <TouchableOpacity
              key={s.key}
              onPress={() => { setShowCreate(true); }}
              activeOpacity={0.7}
              style={[styles.strategyInfoCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[styles.strategyInfoIcon, { backgroundColor: `${s.color}18` }]}>
                <Feather name={s.icon as any} size={26} color={s.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.strategyInfoLabel, { color: colors.foreground }]}>{s.label} Bot</Text>
                <Text style={[styles.strategyInfoDesc, { color: colors.mutedForeground }]}>{s.desc}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <CreateBotModal visible={showCreate} onClose={() => setShowCreate(false)} onCreate={handleCreate} colors={colors} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 24, fontWeight: "700" },
  headerSub: { fontSize: 12, marginTop: 2 },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  createBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  tabSwitcher: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 4,
    borderRadius: 10,
    borderWidth: 1,
    padding: 3,
  },
  tabSwitcherBtn: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8 },
  tabSwitcherText: { fontSize: 13, fontWeight: "600" },
  botCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  botCardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  strategyIconWrap: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  botName: { fontSize: 15, fontWeight: "700", marginBottom: 2 },
  botMeta: { fontSize: 12 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "700" },
  botDivider: { height: StyleSheet.hairlineWidth, marginBottom: 12 },
  botStats: { flexDirection: "row", marginBottom: 12 },
  botStat: { flex: 1, alignItems: "center", gap: 2 },
  botStatLabel: { fontSize: 10 },
  botStatValue: { fontSize: 14, fontWeight: "700" },
  botActions: { flexDirection: "row", gap: 8 },
  botActionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  botActionText: { fontSize: 13, fontWeight: "600" },
  emptyState: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: "700", marginTop: 8 },
  emptyDesc: { fontSize: 14, textAlign: "center", lineHeight: 20, paddingHorizontal: 20 },
  emptyBtn: { marginTop: 12, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  strategyInfoCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 14, borderWidth: 1 },
  strategyInfoIcon: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  strategyInfoLabel: { fontSize: 16, fontWeight: "700", marginBottom: 3 },
  strategyInfoDesc: { fontSize: 13, lineHeight: 18 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    maxHeight: "85%",
  },
  modalDrag: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#555", alignSelf: "center", marginTop: 10, marginBottom: 4 },
  modalHeader: { paddingHorizontal: 20, paddingBottom: 12 },
  modalTitleRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  modalBackBtn: { marginRight: 8 },
  modalTitle: { flex: 1, fontSize: 18, fontWeight: "700" },
  modalCloseBtn: { padding: 4 },
  stepDots: { flexDirection: "row", gap: 6 },
  stepDot: { width: 6, height: 6, borderRadius: 3 },
  modalBody: { paddingHorizontal: 20, paddingBottom: 20 },
  modalFooter: { paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth },
  nextBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14 },
  nextBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  strategiesCol: { gap: 12 },
  strategyCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 14 },
  strategyCardIcon: { width: 50, height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  strategyCardLabel: { fontSize: 15, fontWeight: "700", marginBottom: 3 },
  strategyCardDesc: { fontSize: 12, lineHeight: 17 },
  configCol: { gap: 8 },
  configLabel: { fontSize: 13, fontWeight: "600", marginTop: 8 },
  configInput: { borderRadius: 10, borderWidth: 1, padding: 12, fontSize: 14, marginTop: 4 },
  symbolGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  symbolChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  symbolChipText: { fontSize: 13, fontWeight: "600" },
  investRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  investChip: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10, borderWidth: 1 },
  investChipText: { fontSize: 13, fontWeight: "600" },
  reviewCol: { gap: 14 },
  reviewCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  reviewRow: { flexDirection: "row", justifyContent: "space-between", padding: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  reviewLabel: { fontSize: 13 },
  reviewValue: { fontSize: 13, fontWeight: "600" },
  infoBox: { flexDirection: "row", gap: 8, padding: 14, borderRadius: 12, borderWidth: 1, alignItems: "flex-start" },
  infoText: { flex: 1, fontSize: 12, lineHeight: 17 },
});
