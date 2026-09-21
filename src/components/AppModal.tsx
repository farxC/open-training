import { useEffect, useRef } from "react";
import { useSyncExternalStore } from "react";
import { Animated, Easing, Modal, Text, TouchableOpacity, View } from "react-native";
import type { TextStyle, ViewStyle } from "react-native";
import { useTheme } from "@/theme";
import type { ThemeColors } from "@/theme";

type AppModalVariant = "cancel" | "destructive" | "neutral";

type AppModalAction = {
  label: string;
  variant: AppModalVariant;
  onPress?: () => void;
};

type AppModalRequest = {
  title: string;
  message: string;
  actions: AppModalAction[];
} | null;

let currentRequest: AppModalRequest = null;
const listeners = new Set<() => void>();

function setRequest(request: AppModalRequest): void {
  currentRequest = request;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): AppModalRequest {
  return currentRequest;
}

/** Alert.alert is a no-op on react-native-web and window.confirm can't be styled — this
 * renders our own centered dialog via RN's Modal, which works on both. */
export function confirmAction(
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => void
): void {
  setRequest({
    title,
    message,
    actions: [
      { label: "Cancelar", variant: "cancel" },
      { label: confirmLabel, variant: "destructive", onPress: onConfirm },
    ],
  });
}

export function notify(title: string, message: string): void {
  setRequest({
    title,
    message,
    actions: [{ label: "OK", variant: "neutral" }],
  });
}

function handleAction(action: AppModalAction): void {
  setRequest(null);
  if (action.onPress) setTimeout(action.onPress, 0);
}

/**
 * A function of the theme rather than a module constant, because AppModalHost
 * renders outside the normal tree (it is driven by useSyncExternalStore) and a
 * frozen style map would keep serving light colors after a theme switch.
 */
function variantStyles(
  colors: ThemeColors
): Record<AppModalVariant, { container: ViewStyle; text: TextStyle }> {
  return {
    cancel: {
      container: {
        borderWidth: 1,
        borderColor: colors["surface-border"],
        backgroundColor: "transparent",
      },
      text: { color: colors["ink-soft"] },
    },
    destructive: {
      container: { backgroundColor: colors["accent-red"] },
      // brand-ink, not a fixed white: the dark scheme lightens accent-red to
      // #e0705f, where white drops to 3.16:1. brand-ink flips to the dark face
      // and holds 5.84:1.
      text: { color: colors["brand-ink"] },
    },
    neutral: {
      container: { backgroundColor: colors["brand-500"] },
      text: { color: colors["brand-ink"] },
    },
  };
}

export function AppModalHost() {
  const request = useSyncExternalStore(subscribe, getSnapshot);
  const { colors } = useTheme();
  const variants = variantStyles(colors);
  const scale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!request) return;
    scale.setValue(0.92);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 8, tension: 140 }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 160,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [request, scale, opacity]);

  if (!request) return null;

  // Android hardware back button — treat as pressing the first action (Cancelar for
  // confirmAction, the single OK for notify). Never leaves the dialog with no way out.
  const handleRequestClose = () => handleAction(request.actions[0]);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleRequestClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: colors.scrim,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <Animated.View
          style={{
            width: "100%",
            maxWidth: 340,
            backgroundColor: colors["surface-card"],
            borderRadius: 24,
            padding: 24,
            opacity,
            transform: [{ scale }],
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.2,
            shadowRadius: 24,
            elevation: 12,
          }}
        >
          <Text
            className="font-display font-semibold text-ink"
            style={{ fontSize: 20, letterSpacing: -0.3, marginBottom: 8 }}
          >
            {request.title}
          </Text>
          <Text className="text-ink-soft" style={{ fontSize: 14, lineHeight: 20, marginBottom: 20 }}>
            {request.message}
          </Text>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12 }}>
            {request.actions.map((action) => (
              <TouchableOpacity
                key={action.label}
                onPress={() => handleAction(action)}
                activeOpacity={0.8}
                style={[
                  { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12 },
                  variants[action.variant].container,
                ]}
              >
                <Text style={[{ fontSize: 14, fontWeight: "600" }, variants[action.variant].text]}>
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
