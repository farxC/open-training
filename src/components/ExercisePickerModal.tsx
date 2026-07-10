import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useExercises } from "@/hooks/useExercises";
import { MODALITIES, modalityLabel } from "@/data/modalities";
import type { Exercise, Modality, MuscleGroup } from "@/types";

interface Props {
  visible: boolean;
  onConfirm: (exercises: Exercise[]) => void;
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

export function ExercisePickerModal({ visible, onConfirm, onClose, modality }: Props) {
  const [search, setSearch] = useState("");
  const { exercises, createCustom } = useExercises();

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [formMuscle, setFormMuscle] = useState<MuscleGroup>("chest");
  const [formModality, setFormModality] = useState<Modality>("musculacao");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const effModality: Modality = modality ?? formModality;

  // Mount/animate the sheet in response to `visible` so the exit transition can
  // finish playing before the Modal actually unmounts.
  const [mounted, setMounted] = useState(visible);
  const translateY = useRef(new Animated.Value(48)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setSelectedIds(new Set());
      setSearch("");
      setCreating(false);
      translateY.setValue(48);
      backdropOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          damping: 20,
          stiffness: 260,
          mass: 0.9,
          useNativeDriver: false,
        }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 160,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(translateY, {
          toValue: 48,
          duration: 180,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: false,
        }),
      ]).start(() => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

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

  const toggleExercise = (ex: Exercise) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(ex.id)) next.delete(ex.id);
      else next.add(ex.id);
      return next;
    });
  };

  const handleCreate = () => {
    const nm = name.trim();
    if (!nm) return;
    // Avoid a UNIQUE-name crash: if it already exists, just select it.
    const existing = exercises.find((e) => e.name.toLowerCase() === nm.toLowerCase());
    if (existing) {
      setSelectedIds((prev) => new Set(prev).add(existing.id));
      resetForm();
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
    setSelectedIds((prev) => new Set(prev).add(created.id));
    resetForm();
  };

  const handleConfirm = () => {
    const chosen = exercises.filter((e) => selectedIds.has(e.id));
    if (chosen.length === 0) return;
    onConfirm(chosen);
    onClose();
  };

  if (!mounted) return null;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          onPress={onClose}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <Animated.View
            style={{ flex: 1, backgroundColor: "#26241f", opacity: backdropOpacity.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.45],
            }) }}
          />
        </Pressable>

        <Animated.View
          style={{
            transform: [{ translateY: translateY.interpolate({ inputRange: [0, 48], outputRange: [0, 420] }) }],
            opacity: backdropOpacity.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
            backgroundColor: "#f4f2ee",
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            maxHeight: "88%",
            minHeight: "62%",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -8 },
            shadowOpacity: 0.16,
            shadowRadius: 28,
            elevation: 16,
          }}
        >
          <SafeAreaView edges={["bottom"]} style={{ flex: 1 }}>
            <View style={{ alignItems: "center", paddingTop: 10, paddingBottom: 2 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "#ddd8ce" }} />
            </View>

            <View className="flex-row items-center px-4 pt-3 pb-2">
              <View className="flex-1">
                <Text className="text-ink font-display font-semibold text-2xl" style={{ letterSpacing: -0.4 }}>
                  {creating ? "Novo exercício" : "Selecionar exercícios"}
                </Text>
                {!creating && (
                  <Text className="text-ink-mute text-xs mt-0.5">
                    Toque para escolher — pode selecionar vários
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={creating ? resetForm : onClose} hitSlop={10} style={{ padding: 4 }}>
                <Text className="text-ink-soft text-base">{creating ? "Voltar" : "Fechar"}</Text>
              </TouchableOpacity>
            </View>

            {creating ? (
              <View className="mx-4 flex-1">
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
                  <Text className="text-white font-semibold text-sm">Criar e selecionar</Text>
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
                    const selected = selectedIds.has(item.exercise.id);
                    return (
                      <TouchableOpacity
                        className="flex-row items-center px-4 py-3"
                        style={{
                          gap: 12,
                          borderBottomWidth: 1,
                          borderBottomColor: "#ddd8ce",
                          backgroundColor: selected ? "#ebe7df" : "transparent",
                        }}
                        onPress={() => toggleExercise(item.exercise)}
                        activeOpacity={0.6}
                      >
                        <View
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 11,
                            borderWidth: selected ? 0 : 1.5,
                            borderColor: "#c9c3b6",
                            backgroundColor: selected ? "#26241f" : "transparent",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {selected && <MaterialCommunityIcons name="check" size={13} color="#ffffff" />}
                        </View>
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

                {selectedIds.size > 0 && (
                  <View
                    style={{
                      paddingHorizontal: 16,
                      paddingTop: 10,
                      paddingBottom: 14,
                      borderTopWidth: 1,
                      borderTopColor: "#ddd8ce",
                      backgroundColor: "#f4f2ee",
                    }}
                  >
                    <TouchableOpacity
                      className="py-3 rounded-xl items-center bg-brand-500"
                      onPress={handleConfirm}
                      activeOpacity={0.85}
                    >
                      <Text className="text-white font-semibold text-sm">
                        Adicionar {selectedIds.size} exercício{selectedIds.size > 1 ? "s" : ""}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}
