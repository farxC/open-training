import { useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useRoutine } from "@/hooks/useRoutine";
import { NumField } from "@/components/TargetFields";
import { getProgramWeeks } from "@/db/queries";

export default function NewProgramScreen() {
  const { splitId } = useLocalSearchParams<{ splitId: string }>();
  const r = useRoutine();
  const split = r.splits.find((s) => s.id === Number(splitId));
  const isCorrida = split?.modality === "corrida";
  const units = r.unitsBySplit[Number(splitId)] ?? [];

  const [name, setName] = useState("");
  const [totalWeeks, setTotalWeeks] = useState<number | null>(8);

  const create = () => {
    const finalName = name.trim() || (isCorrida ? "Plano de Corrida" : "Plano");
    const weeks = totalWeeks && totalWeeks > 0 ? totalWeeks : 8;
    const programId = r.addProgram(Number(splitId), finalName, weeks);
    r.activateProgram(Number(splitId), programId);

    if (units.length === 0) {
      // No days defined yet (e.g. a fresh cyclic split) — nothing to map per week yet.
      router.replace(`/routine/${splitId}`);
      return;
    }

    // Walk the user through mapping each week's workouts before landing on the split screen.
    const weekIds = getProgramWeeks(programId).map((w) => w.id);
    router.replace({
      pathname: "/routine/program/week/[id]",
      params: { id: String(weekIds[0]), wizardWeekIds: weekIds.join(","), wizardIndex: "0", wizardSplitId: splitId },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-row items-center px-4 py-3">
        <Text className="text-ink font-display font-semibold text-2xl flex-1" style={{ letterSpacing: -0.4 }}>
          Novo Plano
        </Text>
        {!isCorrida && (
          <TouchableOpacity onPress={() => router.back()}>
            <Text className="text-ink-soft text-base">Cancelar</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        {isCorrida && (
          <Text className="text-ink-mute text-sm mb-4">
            Um split de corrida precisa de um plano com pelo menos uma semana definida.
          </Text>
        )}
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={isCorrida ? "Nome (ex.: Plano de Corrida)" : "Nome (ex.: Bloco de força)"}
          placeholderTextColor="#bdb8aa"
          className="bg-surface-elevated text-ink rounded-xl px-4 py-3 mb-3"
        />
        <View className="flex-row items-center mb-3" style={{ gap: 8 }}>
          <Text className="text-ink-mute text-sm">Semanas</Text>
          <NumField value={totalWeeks} onChange={setTotalWeeks} integer />
        </View>
        <TouchableOpacity className="py-2.5 rounded-xl items-center bg-brand-500" onPress={create}>
          <Text className="text-white text-sm font-medium">Criar plano</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
