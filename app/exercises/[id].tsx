import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Modal, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { VolumeChart } from "@/components/VolumeChart";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ResistanceCurveChart } from "@/components/ResistanceCurveChart";
import { ExerciseConfigEditor } from "@/components/ExerciseConfigEditor";
import { fromMuscleMap, MuscleGroupEditor, toMuscleMap } from "@/components/MuscleGroupEditor";
import { confirmAction } from "@/components/AppModal";
import { useExercises } from "@/hooks/useExercises";
import { ExerciseNameTakenError, getExerciseSets } from "@/db/queries";
import { muscleGroupLabel } from "@/data/muscleGroups";
import {
  formatDistanceValue,
  formatEffort,
  isDistanceModality,
  isStrengthCategory,
} from "@/data/modalities";
import { exerciseConfigSummary } from "@/data/exerciseConfig";
import type { Equipment, ExerciseConfig, ExerciseType, MuscleGroup } from "@/types";

const EQUIPMENT_OPTIONS: Equipment[] = [
  "barbell",
  "dumbbell",
  "machine",
  "cable",
  "bodyweight",
  "kettlebell",
  "band",
  "other",
];

const TYPE_OPTIONS: ExerciseType[] = ["compound", "isolation"];

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      className="px-3 py-1.5 rounded-full"
      style={{
        borderWidth: 1,
        borderColor: active ? "#26241f" : "#ddd8ce",
        backgroundColor: active ? "#26241f" : "transparent",
      }}
      onPress={onPress}
    >
      <Text
        className="capitalize"
        style={{ color: active ? "#ffffff" : "#928d80", fontSize: 12, fontWeight: "600" }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const exerciseId = Number(id);
  const { exercises, updateConfig, updateMuscleGroups, updateIdentity, archive } = useExercises({
    include_archived: true,
  });

  const [editVisible, setEditVisible] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftEquipment, setDraftEquipment] = useState<Equipment>("other");
  const [draftType, setDraftType] = useState<ExerciseType>("compound");
  const [draftMuscles, setDraftMuscles] = useState<Map<MuscleGroup, number>>(new Map());
  const [draftConfig, setDraftConfig] = useState<ExerciseConfig | null>(null);
  const [applyToHistory, setApplyToHistory] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const exercise = exercises.find((e) => e.id === exerciseId);
  const sets = getExerciseSets(exerciseId);

  // Distance modalities have no load to peak at — their PR is the longest effort,
  // and volume-by-week (Σ reps × kg) would be a flat zero, so it's hidden below.
  const isDistance = exercise != null && isDistanceModality(exercise.modality);
  // Physical configuration (resistance curve, bench angle, pulley…) describes a
  // strength movement — a separate question from how the sets are measured.
  const isStrength = exercise != null && isStrengthCategory(exercise.modality);

  const prSet = sets.reduce<(typeof sets)[0] | null>((best, s) => {
    if (isDistance) {
      if ((s.distance_km ?? 0) <= 0) return best;
      return !best || (s.distance_km ?? 0) > (best.distance_km ?? 0) ? s : best;
    }
    if (!best || s.weight_kg > best.weight_kg) return s;
    return best;
  }, null);

  const volumeByWeek = sets.reduce<Record<string, number>>((acc, s) => {
    const week = s.date.slice(0, 7);
    acc[week] = (acc[week] ?? 0) + s.reps * s.weight_kg;
    return acc;
  }, {});

  const chartData = Object.entries(volumeByWeek)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, volume_kg]) => ({ week, volume_kg }));

  if (!exercise) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader title="Exercise" fallbackHref="/" />
        <View className="flex-1 items-center justify-center">
          <Text className="text-ink-mute">Exercise not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const openEditor = () => {
    setDraftName(exercise.name);
    setDraftEquipment(exercise.equipment);
    setDraftType(exercise.type);
    setDraftMuscles(toMuscleMap(exercise.muscle_groups));
    setDraftConfig(exercise.config);
    setApplyToHistory(false);
    setNameError(null);
    setEditVisible(true);
  };

  const persist = (rewriteHistory: boolean) => {
    updateMuscleGroups(exercise.id, fromMuscleMap(draftMuscles), { applyToHistory: rewriteHistory });
    if (draftConfig) updateConfig(exercise.id, draftConfig, { applyToHistory: rewriteHistory });
    setEditVisible(false);
  };

  const handleSave = () => {
    const name = draftName.trim();
    if (!name) {
      setNameError("O nome não pode ficar vazio.");
      return;
    }
    // Identity fields propagate to history unconditionally — it's the same
    // exercise under a better name.
    try {
      updateIdentity(exercise.id, {
        name,
        equipment: draftEquipment,
        type: draftType,
        modality: exercise.modality,
      });
    } catch (err) {
      if (err instanceof ExerciseNameTakenError) {
        setNameError(`Já existe um exercício chamado "${name}".`);
        return;
      }
      throw err;
    }

    // Rewriting recorded sessions is the one destructive branch, so it gets a
    // confirmation. Saving going-forward — the default — must never depend on a
    // dialog: Alert.alert is a no-op on web, which silently ate the whole save.
    if (applyToHistory && sets.length > 0) {
      confirmAction(
        "Reescrever o histórico?",
        "As sessões já registradas guardam a configuração com que foram feitas. Elas serão substituídas pela configuração nova.",
        "Aplicar ao histórico",
        () => persist(true)
      );
      return;
    }
    persist(applyToHistory);
  };

  const handleArchive = () => {
    confirmAction(
      "Arquivar exercício",
      "Ele some das listas de seleção, mas continua no histórico das sessões já registradas.",
      "Arquivar",
      () => {
        archive(exercise.id);
        setEditVisible(false);
        router.back();
      }
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader title={exercise.name} fallbackHref="/" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View className="mb-4 flex-row items-start">
          <View className="flex-1">
            {/* Endurance exercises carry no muscle groups, so the parts are joined
                rather than concatenated — otherwise the line opens with a stray " · ". */}
            <Text className="text-ink-mute text-sm capitalize mt-0.5">
              {[
                exercise.muscle_groups.map((g) => muscleGroupLabel(g.muscle_group)).join(", "),
                exercise.equipment,
                exercise.type,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
            {!!exercise.is_archived && (
              <Text className="text-ink-faint text-xs mt-1">Arquivado</Text>
            )}
          </View>
          <TouchableOpacity onPress={openEditor} hitSlop={10}>
            <Text className="text-ink-soft text-sm">Editar</Text>
          </TouchableOpacity>
        </View>

        {prSet && (
          <View className="bg-surface-card rounded-2xl p-4 flex-row items-center mb-4">
            <View className="bg-brand-600 rounded-lg px-2 py-1 mr-3">
              <Text className="text-white text-xs font-bold">PR</Text>
            </View>
            <Text className="text-ink text-sm">
              {prSet.weight_kg} kg × {prSet.reps} reps
            </Text>
          </View>
        )}

        {isStrength && (
          <TouchableOpacity className="bg-surface-card rounded-2xl p-4 mb-4" onPress={openEditor}>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-ink-mute text-xs uppercase tracking-wider">Configuração</Text>
              <Text className="text-ink-soft text-xs">Editar</Text>
            </View>
            <ResistanceCurveChart variant={exercise.config.resistance_curve} />
            <Text className="text-ink-mute text-xs mt-2">{exerciseConfigSummary(exercise.config)}</Text>
          </TouchableOpacity>
        )}

        {!isDistance && (
          <>
            <Text className="text-ink-mute text-xs uppercase tracking-wider mb-3">
              Volume history
            </Text>
            <VolumeChart data={chartData} />
          </>
        )}

        <Text className="text-ink-mute text-xs uppercase tracking-wider mt-6 mb-3">
          All sets ({sets.length})
        </Text>

        {sets.length === 0 ? (
          <Text className="text-ink-mute text-center py-8">
            No sets logged for this exercise.
          </Text>
        ) : (
          sets.map((s) => (
            <View
              key={s.id}
              className="flex-row items-center py-2 border-b border-surface-border"
            >
              <Text className="text-ink-mute text-xs w-24">{s.date}</Text>
              <Text className="text-ink text-sm flex-1">
                {isDistance
                  ? [
                      formatDistanceValue(s.distance_km, exercise.modality),
                      formatEffort(s.pace_sec, exercise.modality),
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"
                  : `${s.weight_kg} kg × ${s.reps}`}
              </Text>
              {s.rpe != null && (
                <Text className="text-ink-mute text-xs">RPE {s.rpe}</Text>
              )}
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={editVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditVisible(false)}
      >
        <SafeAreaView className="flex-1 bg-surface">
          <View className="flex-row items-center px-4 py-3">
            <Text
              className="text-ink font-display font-semibold text-2xl flex-1"
              style={{ letterSpacing: -0.4 }}
            >
              Editar exercício
            </Text>
            <TouchableOpacity onPress={() => setEditVisible(false)}>
              <Text className="text-ink-soft text-base">Cancelar</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <Text className="text-ink-mute text-xs mb-2" style={{ letterSpacing: 1, fontWeight: "700" }}>
              NOME
            </Text>
            <TextInput
              className="bg-surface-card text-ink rounded-xl px-3 py-3 mb-1"
              placeholder="Nome do exercício"
              placeholderTextColor="#bdb8aa"
              value={draftName}
              onChangeText={(t) => {
                setDraftName(t);
                setNameError(null);
              }}
            />
            {nameError && <Text className="text-red-600 text-xs mb-2">{nameError}</Text>}

            <Text
              className="text-ink-mute text-xs mb-2 mt-3"
              style={{ letterSpacing: 1, fontWeight: "700" }}
            >
              EQUIPAMENTO
            </Text>
            <View className="flex-row flex-wrap mb-4" style={{ gap: 8 }}>
              {EQUIPMENT_OPTIONS.map((eq) => (
                <Chip
                  key={eq}
                  label={eq}
                  active={draftEquipment === eq}
                  onPress={() => setDraftEquipment(eq)}
                />
              ))}
            </View>

            <Text className="text-ink-mute text-xs mb-2" style={{ letterSpacing: 1, fontWeight: "700" }}>
              TIPO
            </Text>
            <View className="flex-row flex-wrap mb-4" style={{ gap: 8 }}>
              {TYPE_OPTIONS.map((t) => (
                <Chip key={t} label={t} active={draftType === t} onPress={() => setDraftType(t)} />
              ))}
            </View>

            {isStrength && (
              <>
                <MuscleGroupEditor value={draftMuscles} onChange={setDraftMuscles} />
                {draftConfig && (
                  <ExerciseConfigEditor value={draftConfig} onChange={setDraftConfig} />
                )}
              </>
            )}

            {sets.length > 0 && (
              <View className="bg-surface-card rounded-2xl p-4 mb-2 flex-row items-center">
                <View className="flex-1 pr-3">
                  <Text className="text-ink text-sm">Aplicar às sessões já registradas</Text>
                  <Text className="text-ink-mute text-xs mt-1">
                    Por padrão a configuração nova vale só das próximas sessões em diante — o
                    histórico guarda a configuração com que foi treinado.
                  </Text>
                </View>
                <Switch value={applyToHistory} onValueChange={setApplyToHistory} />
              </View>
            )}

            <TouchableOpacity
              className="mt-4 py-3 rounded-xl items-center bg-brand-500"
              onPress={handleSave}
            >
              <Text className="text-white font-semibold text-sm">Salvar</Text>
            </TouchableOpacity>

            {!exercise.is_archived && (
              <TouchableOpacity className="mt-2 py-3 items-center" onPress={handleArchive}>
                <Text className="text-red-600 text-sm">Arquivar exercício</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
