import { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useFocusEffect, router, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import { Colors, Fonts, getTheme } from "@/constants/theme";
import { ThemedText } from "@/components/ui/themed-text";
import ThemedTextInput from "@/components/ui/themed-text-input";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  sendMessage,
  generateRoutine,
  type ChatMessageOut,
} from "@/api/chat";

const QUICK_ACTIONS = [
  { label: "Generate Routine", message: "Generate a skincare routine for me" },
  { label: "Swap moisturizer", message: "Swap my moisturizer for something lighter for my skin type" },
  { label: "My products", message: "What products do I have for my routine?" },
];

export default function ChatScreen() {
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<ChatMessageOut[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const autoTriggeredRef = useRef(false);
  const routineSavedRef = useRef(false);
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const { generate } = useLocalSearchParams<{ generate?: string }>();

  useEffect(() => {
    setSessionId(Crypto.randomUUID());
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (generate === "1" && sessionId) {
        router.setParams({} as any);
        autoTriggeredRef.current = false;
        handleSend("Generate a skincare routine for me based on my profile");
      }
    }, [sessionId, generate]),
  );

  const handleSend = async (text?: string) => {
    const msg = (text ?? inputText).trim();
    if (!msg || !sessionId) return;

    setInputText("");
    setLoading(true);

    const userMessage: ChatMessageOut = {
      id: Date.now(),
      session_id: sessionId,
      role: "user",
      content: msg,
      tool_calls: null,
      tool_call_id: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await sendMessage(sessionId, msg, 60000);
      setMessages((prev) => [...prev, ...response.messages]);

      const hasRoutine = response.messages.some(
        (m) => m.role === "assistant" && m.content && /\b(AM \||PM \|)/.test(m.content),
      );
      if (hasRoutine && !routineSavedRef.current) {
        routineSavedRef.current = true;
        try {
          const routine = await generateRoutine();
          const summary: ChatMessageOut = {
            id: Date.now() + 1,
            session_id: sessionId,
            role: "assistant",
            content: `✅ Routine "${routine.name}" created — ${routine.steps.length} steps. Tap View/Edit below to review.`,
            tool_calls: null,
            tool_call_id: null,
            created_at: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, summary]);
          setTimeout(() => {
            router.push(`/(modals)/edit-routine?routineId=${routine.id}&returnTo=/(main)/chat`);
          }, 100);
        } catch {
          const errMsg: ChatMessageOut = {
            id: Date.now() + 2,
            session_id: sessionId,
            role: "assistant",
            content: "Could not save the routine. Make sure you've completed your skin profile in Settings first.",
            tool_calls: null,
            tool_call_id: null,
            created_at: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, errMsg]);
        }
      }
    } catch {
      const errorMsg: ChatMessageOut = {
        id: Date.now() + 1,
        session_id: sessionId,
        role: "assistant",
        content: "Sorry, I couldn't process that. Please try again.",
        tool_calls: null,
        tool_call_id: null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: ChatMessageOut }) => {
    const isUser = item.role === "user";
    return (
      <View
        style={[
          styles.bubbleRow,
          { justifyContent: isUser ? "flex-end" : "flex-start" },
        ]}
      >
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: isUser ? colors.primary[600] : colors.neutral[200],
            },
          ]}
        >
          <ThemedText
            style={{
              color: isUser ? colors.neutral[100] : colors.text,
            }}
          >
            {item.content}
          </ThemedText>
        </View>
      </View>
    );
  };

  const renderFooter = () => {
    if (!loading) return null;
    return (
      <View style={styles.footerSection}>
        <View style={styles.thinkingRow}>
          <ActivityIndicator size="small" color={colors.neutral[700]} />
          <ThemedText style={{ marginLeft: 8 }} type="bodySmall">
            Thinking...
          </ThemedText>
        </View>
      </View>
    );
  };

  const renderQuickActions = () => {
    if (messages.length > 5) return null;
    return (
      <View style={styles.quickActions}>
        <ThemedText type="captionSmall" style={{ marginBottom: 8 }}>
          Quick actions
        </ThemedText>
        <View style={styles.chipRow}>
          {QUICK_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={[styles.chip, { borderColor: colors.primary[300] }]}
              onPress={() => handleSend(action.message)}
            >
              <ThemedText type="caption" style={{ color: colors.primary[700] }}>
                {action.label}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.neutral[100] }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <View style={styles.header}>
        <ThemedText type="h1">Chat</ThemedText>
        <ThemedText type="bodySmall" style={{ color: colors.secondary[600] }}>
          Ask about products, ingredients, or your routine
        </ThemedText>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderMessage}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons
                name="chat-outline"
                size={48}
                color={colors.neutral[400]}
              />
              <ThemedText
                type="bodyLarge"
                style={{ color: colors.secondary[600], textAlign: "center" }}
              >
                Start a conversation about your skincare
              </ThemedText>
            </View>
          ) : null
        }
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
      />

      {renderQuickActions()}

      <View
        style={[
          styles.inputBar,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.neutral[200],
          },
        ]}
      >
        <ThemedTextInput
          value={inputText}
          onChangeText={setInputText}
          placeholder="Ask about your routine..."
          onSubmitEditing={() => handleSend()}
          style={{ flex: 1 }}
          editable={!loading}
        />
        <TouchableOpacity
          onPress={() => handleSend()}
          disabled={loading || !inputText.trim()}
          style={[
            styles.sendButton,
            {
              backgroundColor:
                loading || !inputText.trim()
                  ? colors.neutral[300]
                  : colors.primary[600],
            },
          ]}
        >
          <MaterialCommunityIcons
            name="send"
            size={20}
            color={colors.neutral[100]}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 32,
    paddingTop: 16,
    paddingBottom: 8,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexGrow: 1,
  },
  bubbleRow: {
    flexDirection: "row",
    marginVertical: 4,
  },
  bubble: {
    maxWidth: "80%",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  footerSection: {
    paddingVertical: 8,
    gap: 8,
  },
  thinkingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    paddingTop: 80,
  },
  quickActions: {
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  sendButton: {
    borderRadius: 25,
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
});
