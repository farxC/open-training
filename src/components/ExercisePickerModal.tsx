import { useState } from "react";
import {
  FlatList,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useExercises } from "@/hooks/useExercises";
import { MODALITIES, modalityLabel } from "@/data/modalities";
import type { Exercise, Modality, MuscleGroup } from "@/types";

interface Props {
  visible: boolean;
  onSelect: (exercise: Exercise) => void;
  onClose: () => void;
  modality?: Modality; // when set, list is filtered and new exercises inherit this modality
}

const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  legs: "Legs",
  glutes: "Glutes",
  core: "Core",
  cardio: "Cardio",
  full_body: "Full Body",
  femoral: "Femoral"
};

// Muscle groups offered when creating a strength exercise (cardio is implied for corrida).
const MUSCLE_OPTIONS: MuscleGroup[] = [
  "chest", "back", "shoulders", "biceps", "triceps", "legs", "femoral", "glutes", "core", "full_body",
];

export function ExercisePickerModal({ visible, onSelect, onClose, modality }: Props) {
  const [search, setSearch] = useState("");
  const { exercises, createCustom } = useExercises();

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [formMuscle, setFormMuscle] = useState<MuscleGroup>("chest");
  const [formModality, setFormModality] = useState<Modality>("musculacao");
  const effModality: Modality = modality ?? formModality;

  const filtered = exercises.filter(
    (e) =>
      (!modality || e.modality === modality) &&
      e.name.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = filtered.reduce<Record<string, Exercise[]>>((acc, ex) => {
    const group = MUSCLE_LABELS[ex.muscle_group] ?? ex.muscle_group;
    if (!acc[group]) acc[group] = [];
    acc[group].push(ex);
    return acc;
  }, {});

  type ListItem =
    | { kind: "header"; label: string }
    | { kind: "exercise"; exercise: Exercise };

  const listData: ListItem[] = search
    ? filtered.map((ex) => ({ kind: "exercise" as const, exercise: ex }))
    : Object.entries(grouped).flatMap(([label, exs]) => [
        { kind: "header" as const, label },
        ...exs.map((ex) => ({ kind: "exercise" as const, exercise: ex })),
      ]);

  const resetForm = () => {
    setCreating(false);
    setName("");
  };

  const handleCreate = () => {
    const nm = name.trim();
    if (!nm) return;
    // Avoid a UNIQUE-name crash: if it already exists, just select it.
    const existing = exercises.find((e) => e.name.toLowerCase() === nm.toLowerCase());
    if (existing) {
      resetForm();
      onSelect(existing);
      onClose();
      return;
    }
    const isCorrida = effModality === "corrida";
    const created = createCustom({
      name: nm,
      muscle_group: isCorrida ? "cardio" : formMuscle,
      equipment: isCorrida ? "bodyweight" : "other",
      type: "compound",
      is_custom: 0, // createExercise forces is_custom = 1
      modality: effModality,
    });
    resetForm();
    onSelect(created);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-surface">
        <View className="flex-row items-center px-4 py-3">
          <Text className="text-ink font-display font-semibold text-2xl flex-1" style={{ letterSpacing: -0.4 }}>
            {creating ? "Novo exercício" : "Selecionar exercício"}
          </Text>
          <TouchableOpacity onPress={creating ? resetForm : onClose}>
            <Text className="text-ink-soft text-base">Cancelar</Text>
          </TouchableOpacity>
        </View>

        {creating ? (
          <View className="mx-4">
            <TextInput
              className="bg-surface-card text-ink rounded-xl px-4 py-3 mb-3"
              placeholder="Nome do exercício"
              placeholderTextColor="#bdb8aa"
              value={name}
              onChangeText={setName}
              autoFocus
            />

            {!modality && (
              <>
                <Text className="text-ink-mute text-xs mb-2" style={{ letterSpacing: 1, fontWeight: "700" }}>
                  MODALIDADE
                </Text>
                <View className="flex-row mb-3" style={{ gap: 8 }}>
                  {MODALITIES.map((m) => {
                    const on = formModality === m.key;
                    return (
                      <TouchableOpacity
                        key={m.key}
                        className="flex-1 py-2 rounded-xl items-center"
                        style={{
                          borderWidth: 1,
                          borderColor: on ? "#26241f" : "#ddd8ce",
                          backgroundColor: on ? "#26241f" : "transparent",
                        }}
                        onPress={() => setFormModality(m.key)}
                      >
                        <Text style={{ color: on ? "#ffffff" : "#928d80", fontSize: 13, fontWeight: "600" }}>
                          {m.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {effModality === "musculacao" && (
              <>
                <Text className="text-ink-mute text-xs mb-2" style={{ letterSpacing: 1, fontWeight: "700" }}>
                  GRUPO MUSCULAR
                </Text>
                <View className="flex-row flex-wrap mb-4" style={{ gap: 8 }}>
                  {MUSCLE_OPTIONS.map((mg) => {
                    const on = formMuscle === mg;
                    return (
                      <TouchableOpacity
                        key={mg}
                        className="px-3 py-1.5 rounded-full"
                        style={{
                          borderWidth: 1,
                          borderColor: on ? "#26241f" : "#ddd8ce",
                          backgroundColor: on ? "#26241f" : "transparent",
                        }}
                        onPress={() => setFormMuscle(mg)}
                      >
                        <Text style={{ color: on ? "#ffffff" : "#928d80", fontSize: 12, fontWeight: "600" }}>
                          {MUSCLE_LABELS[mg]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            <Text className="text-ink-faint text-xs mb-4">
              Modalidade: {modalityLabel(effModality)}
            </Text>

            <TouchableOpacity
              className="py-3 rounded-xl items-center bg-brand-500"
              style={{ opacity: name.trim() ? 1 : 0.5 }}
              disabled={!name.trim()}
              onPress={handleCreate}
            >
              <Text className="text-white font-semibold text-sm">Criar e adicionar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View className="mx-4 mb-3 flex-row" style={{ gap: 8 }}>
              <TextInput
                className="bg-surface-card text-ink rounded-xl px-4 py-3 flex-1"
                placeholder="Buscar…"
                placeholderTextColor="#bdb8aa"
                value={search}
                onChangeText={setSearch}
              />
              <TouchableOpacity
                className="rounded-xl items-center justify-center px-4 bg-brand-500"
                onPress={() => setCreating(true)}
              >
                <Text className="text-white text-sm font-medium">+ Novo</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={listData}
              keyExtractor={(item, i) =>
                item.kind === "header" ? `h-${item.label}` : String(item.exercise.id) + i
              }
              renderItem={({ item }) => {
                if (item.kind === "header") {
                  return (
                    <Text className="text-ink-mute text-xs font-semibold uppercase tracking-wider px-4 pt-4 pb-1">
                      {item.label}
                    </Text>
                  );
                }
                return (
                  <TouchableOpacity
                    className="flex-row items-center px-4 py-3 border-b border-surface-border"
                    onPress={() => {
                      onSelect(item.exercise);
                      onClose();
                    }}
                  >
                    <View className="flex-1">
                      <Text className="text-ink text-sm">{item.exercise.name}</Text>
                      <Text className="text-ink-mute text-xs capitalize">
                        {item.exercise.equipment} · {item.exercise.type}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
              keyboardShouldPersistTaps="handled"
            />
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}
