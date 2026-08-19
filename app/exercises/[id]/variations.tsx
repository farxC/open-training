import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useExercises } from "@/hooks/useExercises";
import { ExerciseNameTakenError } from "@/db/queries";
import { EQUIPMENT_LABELS, EQUIPMENT_OPTIONS, TYPE_LABELS, TYPE_OPTIONS } from "@/data/exerciseMeta";
import { useInteractionState } from "@/hooks/useInteractionState";
import type { Equipment, ExerciseType } from "@/types";

/**
 * A variation is a grip/angle/equipment difference of a parent exercise
 * (e.g. "Supino Reto" -> "Supino com Halteres") — its own independent
 * history, PRs, and config from the moment it's created. Muscle groups and
 * physical config aren't editable here on purpose: a new variation clones
 * the parent's, and gets refined afterward on its own exercise detail screen,
 * the same place any other exercise is edited.
 */
export default function ExerciseVariationsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const parentId = Number(id);
  const { exercises, createVariationOf, setDefaultVariationOf } = useExercises({ include_archived: true });

  const parent = exercises.find((e) => e.id === parentId);
  const variations = exercises.filter((e) => e.parent_exercise_id === parentId);

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [equipment, setEquipment] = useState<Equipment>("barbell");
  const [type, setType] = useState<ExerciseType>("compound");
  const [nameError, setNameError] = useState<string | null>(null);

  if (!parent || parent.parent_exercise_id !== null) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader title="Variações" fallbackHref="/" />
        <View className="flex-1 items-center justify-center">
          <Text className="text-ink-mute">Exercício não encontrado.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const startCreating = () => {
    setName("");
    setEquipment(parent.equipment);
    setType(parent.type);
    setNameError(null);
    setCreating(true);
  };

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("O nome não pode ficar vazio.");
      return;
    }
    try {
      const created = createVariationOf(parentId, { name: trimmed, equipment, type, is_custom: 0 });
      setCreating(false);
      router.push(`/exercises/${created.id}`);
    } catch (err) {
      if (err instanceof ExerciseNameTakenError) {
        setNameError(`Já existe um exercício chamado "${trimmed}".`);
        return;
      }
      throw err;
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader title={`Variações de ${parent.name}`} fallbackHref="/" />

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 44 }}>
        {creating ? (
          <View
            className="bg-surface-card rounded-2xl mb-4"
            style={{ borderWidth: 1, borderColor: "#e7e4dc", padding: 12 }}
          >
            <Text style={{ color: "#26241f", fontSize: 11.5, fontWeight: "600" }}>Nome</Text>
            <TextInput
              className="text-ink rounded-xl px-3 py-2.5"
              style={{
                marginTop: 7,
                backgroundColor: "#f4f2ee",
                borderWidth: 1,
                borderColor: nameError ? "#e8c9c5" : "#e7e4dc",
                fontSize: 14,
              }}
              placeholder="Nome da variação"
              placeholderTextColor="#bdb8aa"
              value={name}
              onChangeText={(t) => {
                setName(t);
                setNameError(null);
              }}
              autoFocus
            />
            {nameError ? (
              <Text style={{ color: "#bf3b30", fontSize: 10.5, marginTop: 5 }}>{nameError}</Text>
            ) : null}

            <View style={{ marginTop: 14 }}>
              <Text style={{ color: "#26241f", fontSize: 11.5, fontWeight: "600" }}>Equipamento</Text>
              <View className="flex-row flex-wrap" style={{ gap: 8, marginTop: 7 }}>
                {EQUIPMENT_OPTIONS.map((eq) => (
                  <Chip key={eq} label={EQUIPMENT_LABELS[eq]} active={equipment === eq} onPress={() => setEquipment(eq)} />
                ))}
              </View>
            </View>

            <View style={{ marginTop: 14 }}>
              <Text style={{ color: "#26241f", fontSize: 11.5, fontWeight: "600" }}>Padrão</Text>
              <View className="flex-row flex-wrap" style={{ gap: 8, marginTop: 7 }}>
                {TYPE_OPTIONS.map((t) => (
                  <Chip key={t} label={TYPE_LABELS[t]} active={type === t} onPress={() => setType(t)} />
                ))}
              </View>
            </View>

            <Text style={{ color: "#928d80", fontSize: 10.5, marginTop: 14, lineHeight: 15 }}>
              Grupos musculares e ficha técnica são clonados de "{parent.name}" e podem ser
              ajustados depois, na própria tela da variação.
            </Text>

            <View className="flex-row" style={{ gap: 8, marginTop: 14 }}>
              <Pressable
                onPress={() => setCreating(false)}
                className="flex-1 py-3 rounded-xl items-center"
                style={{ borderWidth: 1, borderColor: "#ddd8ce" }}
              >
                <Text style={{ color: "#5c594f", fontSize: 13, fontWeight: "600" }}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={handleCreate} className="flex-1 py-3 rounded-xl items-center bg-brand-500">
                <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "700" }}>Criar</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={startCreating}
            className="flex-row items-center justify-center rounded-2xl mb-4"
            style={{ borderWidth: 1, borderColor: "#ddd8ce", borderStyle: "dashed", paddingVertical: 14, gap: 6 }}
          >
            <MaterialCommunityIcons name="plus" size={16} color="#5c594f" />
            <Text style={{ color: "#5c594f", fontSize: 13, fontWeight: "600" }}>Nova variação</Text>
          </Pressable>
        )}

        {variations.length === 0 && !creating ? (
          <Text className="text-ink-mute text-sm" style={{ textAlign: "center", marginTop: 20 }}>
            "{parent.name}" ainda não tem variações.
          </Text>
        ) : (
          variations.map((v) => (
            <Pressable
              key={v.id}
              onPress={() => (v.is_default_variation ? router.push(`/exercises/${v.id}`) : setDefaultVariationOf(v.id))}
              className="flex-row items-center rounded-2xl mb-2"
              style={{ borderWidth: 1, borderColor: "#e7e4dc", padding: 12, gap: 10 }}
            >
              <View className="flex-1">
                <Text className="text-ink text-sm" style={v.is_archived ? { textDecorationLine: "line-through" } : undefined}>
                  {v.name}
                </Text>
                <Text className="text-ink-mute text-xs capitalize">
                  {[EQUIPMENT_LABELS[v.equipment], TYPE_LABELS[v.type]].join(" · ")}
                </Text>
              </View>
              {v.is_default_variation ? (
                <View
                  className="rounded-full"
                  style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: "#26241f" }}
                >
                  <Text style={{ color: "#ffffff", fontSize: 9.5, fontWeight: "700", letterSpacing: 0.4 }}>
                    PADRÃO
                  </Text>
                </View>
              ) : (
                <MaterialCommunityIcons name="chevron-right" size={18} color="#c9c3b6" />
              )}
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { hovered, handlers } = useInteractionState();

  return (
    <Pressable
      onPress={onPress}
      {...handlers}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className="px-3 py-1.5 rounded-full"
      style={{
        borderWidth: 1,
        borderColor: active ? "#26241f" : "#ddd8ce",
        backgroundColor: active ? "#26241f" : hovered ? "#f4f2ee" : "transparent",
      }}
    >
      <Text style={{ color: active ? "#ffffff" : "#928d80", fontSize: 12, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}
