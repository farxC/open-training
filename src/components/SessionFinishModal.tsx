import { useEffect, useState } from "react";
import { Modal, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatClock, parseClock } from "@/data/modalities";

interface SessionFinishModalProps {
  visible: boolean;
  initialDurationSec: number;
  onCancel: () => void;
  onConfirm: (durationSeconds: number) => void;
}

export function SessionFinishModal({
  visible,
  initialDurationSec,
  onCancel,
  onConfirm,
}: SessionFinishModalProps) {
  const [durationText, setDurationText] = useState(formatClock(initialDurationSec));

  useEffect(() => {
    if (visible) setDurationText(formatClock(initialDurationSec));
  }, [visible, initialDurationSec]);

  const handleConfirm = () => {
    const parsed = parseClock(durationText);
    onConfirm(parsed ?? 0);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
    >
      <SafeAreaView className="flex-1 bg-surface">
        <View className="flex-row items-center px-4 py-3">
          <Text
            className="text-ink font-display font-semibold text-2xl flex-1"
            style={{ letterSpacing: -0.4 }}
          >
            Finalizar sessão
          </Text>
          <TouchableOpacity onPress={onCancel}>
            <Text className="text-ink-soft text-base">Cancelar</Text>
          </TouchableOpacity>
        </View>

        <View className="px-4">
          <Text
            className="text-ink-mute text-xs mb-2"
            style={{ fontWeight: "700", letterSpacing: 1 }}
          >
            DURAÇÃO (m:ss)
          </Text>
          <TextInput
            value={durationText}
            onChangeText={setDurationText}
            placeholder="0:00"
            placeholderTextColor="#bdb8aa"
            keyboardType="numbers-and-punctuation"
            className="bg-surface-elevated text-ink rounded-xl px-4 py-3 mb-2"
            style={{ borderWidth: 1, borderColor: "#ddd8ce", fontSize: 18, textAlign: "center" }}
          />
          <Text className="text-ink-faint text-xs mb-6" style={{ textAlign: "center" }}>
            Revise ou ajuste o tempo antes de salvar.
          </Text>

          <TouchableOpacity
            className="py-3 rounded-xl items-center bg-brand-500"
            onPress={handleConfirm}
            activeOpacity={0.85}
          >
            <Text className="text-white text-sm font-semibold">Salvar e finalizar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
