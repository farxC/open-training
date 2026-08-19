import { Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { Exercise } from "@/types";

interface Props {
  visible: boolean;
  currentExerciseId: number;
  /** The parent plus every sibling variation, including the current one. */
  family: Exercise[];
  onSelect: (exercise: Exercise) => void;
  onClose: () => void;
}

/** Single-select picker restricted to one variation family — the parent and
 *  its sibling variations — used to correct which one was actually logged in
 *  an already-saved session. Simpler than ExercisePickerModal on purpose: no
 *  search, no creation, no multi-select. */
export function VariationSwapModal({ visible, currentExerciseId, family, onSelect, onClose }: Props) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-surface">
        <View className="flex-row items-center px-4 py-3" style={{ gap: 8 }}>
          <Text
            className="text-ink font-display font-semibold text-2xl flex-1"
            style={{ letterSpacing: -0.4 }}
            numberOfLines={1}
          >
            Trocar variação
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={10} style={{ padding: 4 }}>
            <Text className="text-ink-soft text-base">Fechar</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
          {family.map((exercise) => {
            const isCurrent = exercise.id === currentExerciseId;
            return (
              <Pressable
                key={exercise.id}
                onPress={() => !isCurrent && onSelect(exercise)}
                disabled={isCurrent}
                className="flex-row items-center rounded-2xl mb-2"
                style={{
                  borderWidth: 1,
                  borderColor: "#e7e4dc",
                  padding: 14,
                  gap: 10,
                  opacity: isCurrent ? 0.5 : 1,
                }}
              >
                <Text className="text-ink flex-1" style={{ fontSize: 14 }}>
                  {exercise.name}
                </Text>
                {isCurrent ? (
                  <MaterialCommunityIcons name="check" size={16} color="#928d80" />
                ) : (
                  <MaterialCommunityIcons name="chevron-right" size={16} color="#bdb8aa" />
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
