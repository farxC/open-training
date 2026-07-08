import { useEffect, useState } from "react";
import { Modal, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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

  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const leading = (firstOfMonth.getDay() + 6) % 7; // Monday-based offset
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayISO = iso(new Date());

  const cells: (number | null)[] = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

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

        <View className="flex-row items-center justify-between px-4 mb-3">
          <TouchableOpacity onPress={() => setMonthDate(new Date(year, month - 1, 1))} className="px-3 py-2">
            <Text className="text-ink-mute text-lg">‹</Text>
          </TouchableOpacity>
          <Text className="text-ink font-display font-semibold text-lg">
            {MONTHS[month]} {year}
          </Text>
          <TouchableOpacity onPress={() => setMonthDate(new Date(year, month + 1, 1))} className="px-3 py-2">
            <Text className="text-ink-mute text-lg">›</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row px-4 mb-1">
          {WEEKDAYS.map((w) => (
            <View key={w} className="flex-1 items-center">
              <Text className="text-ink-faint text-xs">{w}</Text>
            </View>
          ))}
        </View>

        <View className="flex-row flex-wrap px-4">
          {cells.map((day, i) => {
            if (day == null) return <View key={i} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
            const cellISO = iso(new Date(year, month, day));
            const isToday = cellISO === todayISO;
            const isSelected = cellISO === selectedDate;
            return (
              <TouchableOpacity
                key={i}
                style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 3 }}
                onPress={() => onSelect(cellISO)}
              >
                <View
                  style={{
                    flex: 1,
                    borderRadius: 10,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: isSelected ? "#26241f" : "transparent",
                    borderWidth: isToday && !isSelected ? 1.5 : 0,
                    borderColor: "#26241f",
                  }}
                >
                  <Text
                    style={{
                      color: isSelected ? "#ffffff" : "#26241f",
                      fontSize: 14,
                      fontWeight: isToday || isSelected ? "700" : "500",
                    }}
                  >
                    {day}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          className="mx-4 mt-6 py-2.5 rounded-xl items-center"
          style={{ borderWidth: 1, borderColor: "#c9c3b6" }}
          onPress={() => onSelect(todayISO)}
        >
          <Text className="text-ink text-sm font-medium">Hoje</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  );
}
