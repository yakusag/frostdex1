import React, { useState, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { getWebAppUrl } from "@/constants/urls";
import { Linking } from "react-native";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
}

const SYSTEM_PROMPT = `You are FrostAI, a trading assistant for FrostDex — a decentralized perpetual futures exchange on Orderly Network. You help traders understand perpetual futures, funding rates, liquidation mechanics, and general DeFi concepts. Be concise, accurate, and helpful. Do not provide financial advice or specific price predictions.`;

const STARTER_QUESTIONS = [
  "What is a perpetual futures contract?",
  "How do funding rates work?",
  "What is liquidation and how do I avoid it?",
  "Explain mark price vs index price",
];

function MessageBubble({ msg }: { msg: Message }) {
  const colors = useColors();
  const isUser = msg.role === "user";

  return (
    <View style={[styles.bubbleWrapper, isUser ? styles.bubbleRight : styles.bubbleLeft]}>
      {!isUser && (
        <View style={[styles.avatar, { backgroundColor: `${colors.primary}20` }]}>
          <MaterialCommunityIcons name="robot-outline" size={16} color={colors.primary} />
        </View>
      )}
      <View
        style={[
          styles.bubble,
          isUser
            ? { backgroundColor: colors.primary, maxWidth: "80%" }
            : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, maxWidth: "85%" },
        ]}
      >
        <Text style={[styles.bubbleText, { color: isUser ? colors.primaryForeground : colors.foreground }]}>
          {msg.content}
        </Text>
      </View>
    </View>
  );
}

export default function AIScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi! I'm FrostAI, your trading assistant. Ask me anything about perpetual futures, DeFi, or how FrostDex works.",
      createdAt: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const apiAvailable = !!domain;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 : insets.bottom + 80;

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      role: "user",
      content: trimmed,
      createdAt: Date.now(),
    };

    setMessages((prev) => [userMsg, ...prev]);
    setInput("");
    setIsLoading(true);

    if (!apiAvailable) {
      const fallback: Message = {
        id: Date.now().toString() + "f",
        role: "assistant",
        content:
          "The AI assistant is only available in the deployed version of FrostDex. Visit the web app for full AI trading support.",
        createdAt: Date.now(),
      };
      setMessages((prev) => [fallback, ...prev]);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`https://${domain}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...messages
              .slice(0, 10)
              .reverse()
              .map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: trimmed },
          ],
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const json = await res.json();
      const replyContent: string =
        json?.choices?.[0]?.message?.content ?? "Sorry, I could not generate a response.";

      const assistantMsg: Message = {
        id: Date.now().toString() + "a",
        role: "assistant",
        content: replyContent,
        createdAt: Date.now(),
      };
      setMessages((prev) => [assistantMsg, ...prev]);
    } catch {
      const errMsg: Message = {
        id: Date.now().toString() + "e",
        role: "assistant",
        content: "Sorry, I ran into an error. Please try again in a moment.",
        createdAt: Date.now(),
      };
      setMessages((prev) => [errMsg, ...prev]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <View style={[styles.headerIcon, { backgroundColor: `${colors.primary}18` }]}>
          <MaterialCommunityIcons name="robot-outline" size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>FrostAI</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            Powered by FrostDex
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => Linking.openURL(getWebAppUrl("/"))}
          style={[styles.webBtn, { backgroundColor: colors.secondary }]}
        >
          <Feather name="external-link" size={14} color={colors.mutedForeground} />
          <Text style={[styles.webBtnText, { color: colors.mutedForeground }]}>Web</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MessageBubble msg={item} />}
        inverted
        contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          messages.length === 1 ? (
            <View style={styles.starters}>
              <Text style={[styles.starterLabel, { color: colors.mutedForeground }]}>
                Suggested questions
              </Text>
              {STARTER_QUESTIONS.map((q) => (
                <TouchableOpacity
                  key={q}
                  onPress={() => sendMessage(q)}
                  style={[styles.starterBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <Text style={[styles.starterText, { color: colors.foreground }]}>{q}</Text>
                  <Feather name="arrow-up-right" size={14} color={colors.primary} />
                </TouchableOpacity>
              ))}
            </View>
          ) : null
        }
        ListHeaderComponent={
          isLoading ? (
            <View style={[styles.typingBubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.typingText, { color: colors.mutedForeground }]}>FrostAI is thinking…</Text>
            </View>
          ) : null
        }
      />

      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: Platform.OS === "web" ? bottomPad : insets.bottom + 12,
          },
        ]}
      >
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask about trading, DeFi, FROST..."
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.input,
            {
              color: colors.foreground,
              backgroundColor: colors.background,
              borderColor: colors.border,
            },
          ]}
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={() => sendMessage(input)}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          onPress={() => sendMessage(input)}
          disabled={!input.trim() || isLoading}
          style={[
            styles.sendBtn,
            {
              backgroundColor: input.trim() && !isLoading ? colors.primary : colors.secondary,
            },
          ]}
          activeOpacity={0.8}
        >
          <Feather name="send" size={18} color={input.trim() && !isLoading ? colors.primaryForeground : colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  headerIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  headerSub: { fontSize: 11, marginTop: 1 },
  webBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  webBtnText: { fontSize: 12 },
  bubbleWrapper: { flexDirection: "row", alignItems: "flex-end", marginBottom: 10, gap: 8 },
  bubbleLeft: { alignSelf: "flex-start" },
  bubbleRight: { alignSelf: "flex-end", flexDirection: "row-reverse" },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  bubble: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  typingText: { fontSize: 13 },
  starters: { paddingBottom: 8 },
  starterLabel: { fontSize: 11, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  starterBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
  starterText: { fontSize: 13, flex: 1 },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14,
    maxHeight: 100,
  },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
});
