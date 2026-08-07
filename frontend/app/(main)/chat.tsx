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
  Alert,
} from "react-native";
import { useFocusEffect, router, useLocalSearchParams } from "expo-router";
import { Colors, Fonts, getTheme } from "@/constants/theme";
import { ThemedText } from "@/components/ui/themed-text";
import ThemedTextInput from "@/components/ui/themed-text-input";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  sendMessage,
  getMessages,
  deleteSession,
  generateRoutine,
  type ChatMessageOut,
} from "@/api/chat";
import { useChatSession } from "@/contexts/ChatSessionContext";

const QUICK_ACTIONS = [
  {
    label: "Generate a Skincare Routine",
    message: "Generate a skincare routine for me",
  },
  {
    label: "Audit My Vanity",
    message: "Check my saved products for any risky or concerning ingredients",
  },
  {
    label: "Find Routine Gaps",
    message: "What am I missing from my current routine?",
  },
];

export default function ChatScreen() {
  const { sessionId, resetSession } = useChatSession();
  const [messages, setMessages] = useState<ChatMessageOut[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [editableRoutine, setEditableRoutine] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const routineSavedRef = useRef(false);
  const sendingRef = useRef(false);
  const hydratedSessionRef = useRef<string | null>(null);
  const skipHydrationRef = useRef(false);
  const prevParamsRef = useRef<{
    generate?: string;
    routineDiscarded?: string;
  }>({});
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const { generate, routineDiscarded } = useLocalSearchParams<{
    generate?: string;
    routineDiscarded?: string;
  }>();

  useEffect(() => {
    setMessages([]);
    hydratedSessionRef.current = null;
  }, [sessionId]);

  useFocusEffect(
    useCallback(() => {
      const prev = prevParamsRef.current;

      if (generate === "1" && sessionId && prev.generate !== "1") {
        prev.generate = "1";
        router.setParams({ generate: undefined } as any);
        handleSend("Generate a skincare routine for me based on my profile");
      } else if (!generate) {
        prev.generate = undefined;
      }

      if (routineDiscarded === "1" && prev.routineDiscarded !== "1") {
        prev.routineDiscarded = "1";
        router.setParams({ routineDiscarded: undefined } as any);
        routineSavedRef.current = false;
        setEditableRoutine(null);
        const msg: ChatMessageOut = {
          id: -Date.now(),
          session_id: sessionId,
          role: "assistant",
          content: "The routine was not saved. Would you like to try again?",
          tool_calls: null,
          tool_call_id: null,
          created_at: new Date().toISOString(),
        };
        setMessages((prevMsgs) => [...prevMsgs, msg]);
      } else if (!routineDiscarded) {
        prev.routineDiscarded = undefined;
      }
    }, [sessionId, generate, routineDiscarded]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!sessionId) return;
      if (skipHydrationRef.current) {
        skipHydrationRef.current = false;
        hydratedSessionRef.current = sessionId;
        return;
      }
      if (hydratedSessionRef.current === sessionId) return;
      let cancelled = false;
      getMessages(sessionId)
        .then((history) => {
          if (cancelled) return;
          hydratedSessionRef.current = sessionId;
          if (history.length > 0) {
            setMessages((prev) => {
              const localOnly = prev.filter(
                (m) =>
                  !history.some(
                    (h) => h.role === m.role && h.content === m.content,
                  ),
              );
              return [...history, ...localOnly];
            });
          }
        })
        .catch(() => {
          if (cancelled) return;
          hydratedSessionRef.current = sessionId;
        });
      return () => {
        cancelled = true;
      };
    }, [sessionId]),
  );

  const handleSend = async (text?: string) => {
    const msg = (text ?? inputText).trim();
    if (!msg || !sessionId) return;
    if (sendingRef.current) return;
    sendingRef.current = true;
    setInputText("");
    setLoading(true);

    const userMessage: ChatMessageOut = {
      id: -Date.now(),
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
      const routineGenerated = response.routine_generated;
      let newMessages = response.messages.filter(
        (m) => m.role === "assistant" && !!m.content,
      );
      if (routineGenerated) {
        newMessages = newMessages.filter(
          (m) =>
            !m.content ||
            !/(###?\s*AM Routine)|(###?\s*PM Routine)|(AM \||PM \||Raw data:)/.test(
              m.content,
            ),
        );
        if (newMessages.length === 0) {
          const fallback: ChatMessageOut = {
            id: -Date.now() - 1,
            session_id: sessionId,
            role: "assistant",
            content:
              "I've created a routine for you. I'll take you to the edit routine page to confirm or make changes.",
            tool_calls: null,
            tool_call_id: null,
            created_at: new Date().toISOString(),
          };
          newMessages = [fallback];
        }
      }
      setMessages((prev) => [...prev, ...newMessages]);

      if (routineGenerated && !routineSavedRef.current) {
        routineSavedRef.current = true;
        try {
          const routine = await generateRoutine();
          setEditableRoutine({ id: routine.id, name: routine.name });
          setTimeout(() => {
            router.push(
              `/(modals)/edit-routine?routineId=${routine.id}&returnTo=/(main)/chat`,
            );
          }, 100);
        } catch {
          const errMsg: ChatMessageOut = {
            id: -Date.now() - 1,
            session_id: sessionId,
            role: "assistant",
            content:
              "Could not save the routine. Make sure you've completed your skin profile in Settings first.",
            tool_calls: null,
            tool_call_id: null,
            created_at: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, errMsg]);
        }
      }
    } catch {
      const errorMsg: ChatMessageOut = {
        id: -Date.now() - 1,
        session_id: sessionId,
        role: "assistant",
        content: "Sorry, I couldn't process that. Please try again.",
        tool_calls: null,
        tool_call_id: null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      sendingRef.current = false;
      setLoading(false);
    }
  };

  const handleNewChat = () => {
    if (loading) return;
    Alert.alert("Start a new chat?", "This clears the current conversation.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "New Chat",
        style: "destructive",
        onPress: () => {
          const oldSessionId = sessionId;
          setMessages([]);
          setInputText("");
          routineSavedRef.current = false;
          setEditableRoutine(null);
          skipHydrationRef.current = true;
          if (oldSessionId) {
            deleteSession(oldSessionId).catch(() => {});
          }
          resetSession();
        },
      },
    ]);
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
              backgroundColor: isUser
                ? colors.primary[600]
                : colors.neutral[200],
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

  const displayMessages = messages.filter(
    (m) => m.role === "user" || (m.role === "assistant" && !!m.content),
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.neutral[100] }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 146 : 0}
    >
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <ThemedText type="h1">Cur.ai</ThemedText>
          {displayMessages.length > 0 && (
            <TouchableOpacity
              onPress={handleNewChat}
              disabled={loading}
              style={[styles.newChatButton, loading && { opacity: 0.4 }]}
              accessibilityLabel="Start a new chat"
            >
              <MaterialCommunityIcons
                name="chat-plus-outline"
                size={24}
                color={colors.primary[700]}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={displayMessages}
        keyExtractor={(item: ChatMessageOut) => String(item.id)}
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

      {editableRoutine && (
        <TouchableOpacity
          style={[
            styles.continueBanner,
            {
              backgroundColor: colors.primary[100],
              borderColor: colors.primary[300],
            },
          ]}
          onPress={() =>
            router.push(
              `/(modals)/edit-routine?routineId=${editableRoutine.id}&returnTo=/(main)/chat`,
            )
          }
          accessibilityLabel="Continue editing routine"
        >
          <MaterialCommunityIcons
            name="pencil-outline"
            size={18}
            color={colors.primary[700]}
          />
          <ThemedText
            type="caption"
            weight="bold"
            numberOfLines={1}
            style={{ color: colors.primary[800], flex: 1 }}
          >
            {editableRoutine.name}
          </ThemedText>
          <ThemedText
            type="captionSmall"
            style={{ color: colors.primary[700] }}
          >
            Continue editing
          </ThemedText>
          <MaterialCommunityIcons
            name="chevron-right"
            size={18}
            color={colors.primary[700]}
          />
        </TouchableOpacity>
      )}

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
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  newChatButton: {
    padding: 8,
    marginTop: -4,
    borderRadius: 20,
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
  continueBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
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
