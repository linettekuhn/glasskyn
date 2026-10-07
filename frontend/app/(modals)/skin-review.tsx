import { useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableWithoutFeedback,
  View,
  useColorScheme,
} from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";

import { ThemedText } from "@/components/ui/themed-text";
import ThemedButton from "@/components/ui/themed-button";
import IconButton from "@/components/ui/icon-button";
import StarRating from "@/components/ui/star-rating";
import EntrySteps from "@/components/journal/entry-steps";
import { Colors, getTheme } from "@/constants/theme";
import { useSkinCapture } from "@/contexts/SkinCaptureContext";
import { submitSkinCheckIn } from "@/api/skin";

const NOTES_MAX_LENGTH = 500;

const RATING_ROWS = [
  { key: "moisture", label: "Moisture" },
  { key: "texture", label: "Texture" },
  { key: "tone", label: "Tone" },
] as const;

export default function SkinReviewScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const { draft, circles, review, setReview, clearEntry } = useSkinCapture();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave =
    review.moisture != null && review.texture != null && review.tone != null;

  const handleSave = async () => {
    if (submitting || !canSave) return;
    if (!draft) {
      setError("No photo found for this entry. Go back and capture again.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const trimmedNotes = review.notes.trim();
      await submitSkinCheckIn({
        photo_uri: draft.photoUri ?? null,
        captured_at: draft.capturedAt ?? null,
        face_landmarks: draft.landmarks ?? null,
        concerns: (circles ?? []).map((c) => ({
          uuid: c.uuid,
          number: c.number,
          x: c.x,
          y: c.y,
          concern_id: c.concernId,
          status: c.status,
          carried_uuid: c.carriedFrom,
          resolved: c.isResolved,
        })),
        moisture_rating: review.moisture,
        texture_rating: review.texture,
        tone_rating: review.tone,
        notes: trimmedNotes ? trimmedNotes.slice(0, NOTES_MAX_LENGTH) : null,
      });
      Toast.show({
        type: "success",
        text1: "Journal entry saved",
        position: "bottom",
      });
      clearEntry();
      router.back();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message || "Could not save. Try again.");
      Toast.show({
        type: "error",
        text1: "Could not save",
        text2: message,
        position: "bottom",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!draft) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ThemedText type="bodyLarge">No photo yet</ThemedText>
        <ThemedButton text="Continue" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topBar}>
            <IconButton
              IconComponent={MaterialCommunityIcons}
              iconName="chevron-left"
              iconSize={22}
              iconColor={colors.neutral[600]}
              backgroundColor="transparent"
              onPress={() => router.back()}
            />
            <View style={{ width: 40 }} />
          </View>

          <EntrySteps active="review" />

          <ThemedText type="h2">Review your skin</ThemedText>
          <ThemedText
            type="bodyLarge"
            style={{ color: colors.neutral[600] }}
          >
            Rate how your skin feels today
          </ThemedText>

          <View style={styles.rows}>
            {RATING_ROWS.map((row) => (
              <View key={row.key} style={styles.row}>
                <ThemedText type="bodyLarge" weight="semiBold">
                  {row.label}
                </ThemedText>
                <StarRating
                  label={row.label}
                  value={review[row.key]}
                  onChange={(next) =>
                    setReview((prev) => ({ ...prev, [row.key]: next }))
                  }
                />
              </View>
            ))}
          </View>

          <View style={styles.notesBlock}>
            <ThemedText type="bodyLarge" weight="semiBold">
              Notes (optional)
            </ThemedText>
            <TextInput
              multiline
              maxLength={NOTES_MAX_LENGTH}
              value={review.notes}
              onChangeText={(text: string) =>
                setReview((prev) => ({ ...prev, notes: text }))
              }
              placeholder="Anything you want to remember about today?"
              placeholderTextColor={colors.neutral[500]}
              style={[
                styles.notesInput,
                {
                  color: colors.text,
                  borderColor: colors.neutral[300],
                  backgroundColor: colors.background,
                },
              ]}
              textAlignVertical="top"
              accessibilityLabel="Notes, optional"
            />
            <ThemedText
              type="captionSmall"
              style={{ color: colors.neutral[500], textAlign: "right" }}
            >
              {`${review.notes.length} / ${NOTES_MAX_LENGTH}`}
            </ThemedText>
          </View>

          {error && (
            <View style={styles.errorBlock}>
              <ThemedText type="bodySmall" style={{ color: colors.error }}>
                {error}
              </ThemedText>
              <ThemedButton
                text="Try again"
                onPress={handleSave}
                loading={submitting}
                disabled={!canSave || submitting}
              />
            </View>
          )}

          <ThemedButton
            text="Save entry"
            onPress={handleSave}
            disabled={!canSave || submitting}
            loading={submitting}
          />
          {!canSave && (
            <ThemedText
              type="captionSmall"
              style={{ color: colors.neutral[500], textAlign: "center" }}
            >
              Rate moisture, texture, and tone to save your entry.
            </ThemedText>
          )}
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  content: {
    flexGrow: 1,
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rows: {
    gap: 16,
    marginTop: 8,
  },
  row: {
    gap: 4,
  },
  notesBlock: {
    gap: 8,
    marginTop: 8,
  },
  notesInput: {
    minHeight: 96,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  errorBlock: {
    gap: 8,
  },
});
