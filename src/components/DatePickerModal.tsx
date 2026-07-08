import { useEffect, useState } from "react";
import { Modal, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MonthCalendar } from "@/components/MonthCalendar";
import { todayISO } from "@/utils/cycle";

interface Props {
  visible: boolean;
  title?: string;
  /** Currently chosen date (if any) — highlighted, and used to open on the right month. */
  selectedDate?: string | null;
  onSelect: (dateISO: string) => void;
  onClose: () => void;
}

export function DatePickerModal({ visible, title = "Escolher data", selectedDate, onSelect, onClose }: Props) {
  const [monthDate, setMonthDate] = useState(() =>
    selectedDate ? new Date(selectedDate + "T00:00:00") : new Date()
  );

  // Re-sync the visible month each time the modal opens, so it doesn't remember
  // wherever the user last scrolled to on a previous, unrelated use.
  useEffect(() => {
    if (visible) setMonthDate(selectedDate ? new Date(selectedDate + "T00:00:00") : new Date());
  }, [visible, selectedDate]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-surface">
        <View className="flex-row items-center px-4 py-3">
          <Text className="text-ink font-display font-semibold text-2xl flex-1" style={{ letterSpacing: -0.4 }}>
            {title}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Text className="text-ink-soft text-base">Fechar</Text>
          </TouchableOpacity>
        </View>

        <View className="px-4">
          <MonthCalendar
            monthDate={monthDate}
            onMonthChange={setMonthDate}
            selectedDate={selectedDate}
            onSelectDate={onSelect}
          />
        </View>

        <TouchableOpacity
          className="mx-4 mt-6 py-2.5 rounded-xl items-center"
          style={{ borderWidth: 1, borderColor: "#c9c3b6" }}
          onPress={() => onSelect(todayISO())}
        >
          <Text className="text-ink text-sm font-medium">Hoje</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  );
}
