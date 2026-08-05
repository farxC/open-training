import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { confirmAction } from "@/components/AppModal";
import { ExerciseConfigEditor } from "@/components/ExerciseConfigEditor";
import { fromMuscleMap, MuscleGroupEditor, toMuscleMap } from "@/components/MuscleGroupEditor";
import { SectionHeader } from "@/components/SectionHeader";
import { EQUIPMENT_LABELS, EQUIPMENT_OPTIONS, TYPE_LABELS, TYPE_OPTIONS } from "@/data/exerciseMeta";
import { isStrengthCategory } from "@/data/modalities";
import { ExerciseNameTakenError } from "@/db/queries";
import { useInteractionState } from "@/hooks/useInteractionState";
import type {
  Equipment,
  Exercise,
  ExerciseConfig,
  ExerciseMuscleGroup,
  ExerciseType,
  MuscleGroup,
} from "@/types";

interface PropagationOptions {
  applyToHistory?: boolean;
}

/** The mutators, handed down rather than re-hooked: the screen owns the
 *  useExercises instance whose list has to refresh after a save. */
export interface ExerciseEditActions {
  updateIdentity: (
    id: number,
    fields: Pick<Exercise, "name" | "equipment" | "type" | "modality">
  ) => void;
  updateMuscleGroups: (
    id: number,
    groups: ExerciseMuscleGroup[],
    options?: PropagationOptions
  ) => void;
  updateConfig: (id: number, config: ExerciseConfig, options?: PropagationOptions) => void;
  archive: (id: number) => void;
}

interface Props {
  visible: boolean;
  exercise: Exercise;
  /** How many sets already reference this exercise — decides whether rewriting
   *  history is even a question. */
  setCount: number;
  actions: ExerciseEditActions;
  onClose: () => void;
  onArchived: () => void;
}

/**
 * Editing an exercise, as a sheet of grouped questions: who it is, what it
 * trains, how it's executed. The save action is pinned to the bottom rather than
 * buried under the last chip group — a form this tall can't ask you to scroll to
 * the end to find out there was a button.
 */
export function ExerciseEditSheet({
  visible,
  exercise,
  setCount,
  actions,
  onClose,
  onArchived,
}: Props) {
  const isStrength = isStrengthCategory(exercise.modality);

  const [name, setName] = useState(exercise.name);
  const [equipment, setEquipment] = useState<Equipment>(exercise.equipment);
  const [type, setType] = useState<ExerciseType>(exercise.type);
  const [muscles, setMuscles] = useState<Map<MuscleGroup, number>>(() =>
    toMuscleMap(exercise.muscle_groups)
  );
  const [config, setConfig] = useState<ExerciseConfig>(exercise.config);
  const [applyToHistory, setApplyToHistory] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  // Every open starts from what's currently stored, so a cancelled edit leaves
  // nothing behind for the next one.
  useEffect(() => {
    if (!visible) return;
    setName(exercise.name);
    setEquipment(exercise.equipment);
    setType(exercise.type);
    setMuscles(toMuscleMap(exercise.muscle_groups));
    setConfig(exercise.config);
    setApplyToHistory(false);
    setNameError(null);
  }, [visible, exercise]);

  const persist = (rewriteHistory: boolean) => {
    actions.updateMuscleGroups(exercise.id, fromMuscleMap(muscles), {
      applyToHistory: rewriteHistory,
    });
    // Endurance modalities have no physical config to speak of — the editor for
    // it isn't even shown — so nothing is written back for them.
    if (isStrength) actions.updateConfig(exercise.id, config, { applyToHistory: rewriteHistory });
    onClose();
  };

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("O nome não pode ficar vazio.");
      return;
    }

    // Identity fields propagate to history unconditionally — it's the same
    // exercise under a better name.
    try {
      actions.updateIdentity(exercise.id, {
        name: trimmed,
        equipment,
        type,
        modality: exercise.modality,
      });
    } catch (err) {
      if (err instanceof ExerciseNameTakenError) {
        setNameError(`Já existe um exercício chamado "${trimmed}".`);
        return;
      }
      throw err;
    }

    // Rewriting recorded sessions is the one destructive branch, so it gets a
    // confirmation. Saving going-forward — the default — must never depend on a
    // dialog: Alert.alert is a no-op on web, which silently ate the whole save.
    if (applyToHistory && setCount > 0) {
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
        actions.archive(exercise.id);
        onClose();
        onArchived();
      }
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-surface">
        <View className="flex-row items-center px-4 py-3" style={{ gap: 8 }}>
          <Text
            className="text-ink font-display font-semibold text-2xl flex-1"
            style={{ letterSpacing: -0.4 }}
            numberOfLines={1}
          >
            Editar exercício
          </Text>
          <IconButton icon="close" label="Cancelar a edição" onPress={onClose} />
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28 }}>
          <SectionHeader title="Identidade" />
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
              placeholder="Nome do exercício"
              placeholderTextColor="#bdb8aa"
              value={name}
              onChangeText={(t) => {
                setName(t);
                setNameError(null);
              }}
            />
            {nameError ? (
              <Text style={{ color: "#bf3b30", fontSize: 10.5, marginTop: 5 }}>{nameError}</Text>
            ) : null}

            <View style={{ marginTop: 14 }}>
              <Text style={{ color: "#26241f", fontSize: 11.5, fontWeight: "600" }}>
                Equipamento
              </Text>
              <View className="flex-row flex-wrap" style={{ gap: 8, marginTop: 7 }}>
                {EQUIPMENT_OPTIONS.map((eq) => (
                  <Chip
                    key={eq}
                    label={EQUIPMENT_LABELS[eq]}
                    active={equipment === eq}
                    onPress={() => setEquipment(eq)}
                  />
                ))}
              </View>
            </View>

            <View style={{ marginTop: 14 }}>
              <Text style={{ color: "#26241f", fontSize: 11.5, fontWeight: "600" }}>Padrão</Text>
              <Text style={{ color: "#a8a293", fontSize: 10, marginTop: 1 }}>
                Composto move mais de uma articulação; isolado, uma só.
              </Text>
              <View className="flex-row flex-wrap" style={{ gap: 8, marginTop: 7 }}>
                {TYPE_OPTIONS.map((t) => (
                  <Chip
                    key={t}
                    label={TYPE_LABELS[t]}
                    active={type === t}
                    onPress={() => setType(t)}
                  />
                ))}
              </View>
            </View>
          </View>

          {isStrength ? (
            <>
              <SectionHeader title="Grupos musculares" />
              <View
                className="bg-surface-card rounded-2xl mb-4"
                style={{ borderWidth: 1, borderColor: "#e7e4dc", padding: 12, paddingBottom: 0 }}
              >
                <MuscleGroupEditor
                  value={muscles}
                  onChange={setMuscles}
                  title="Grupos e fator de contagem"
                />
              </View>

              <SectionHeader title="Ficha técnica" />
              <ExerciseConfigEditor value={config} onChange={setConfig} />
            </>
          ) : null}

          {setCount > 0 ? (
            <View
              className="rounded-2xl flex-row items-center"
              style={{
                marginTop: 8,
                padding: 12,
                gap: 12,
                backgroundColor: applyToHistory ? "#fbf5e9" : "#efece5",
                borderWidth: 1,
                borderColor: applyToHistory ? "#eadfbe" : "#e7e4dc",
              }}
            >
              <View className="flex-1">
                <Text style={{ color: "#26241f", fontSize: 12, fontWeight: "600" }}>
                  Aplicar às sessões já registradas
                </Text>
                <Text style={{ color: "#928d80", fontSize: 10.5, marginTop: 3, lineHeight: 15 }}>
                  Por padrão a configuração nova vale só das próximas sessões em diante — o
                  histórico guarda a configuração com que foi treinado.
                </Text>
              </View>
              <Switch value={applyToHistory} onValueChange={setApplyToHistory} />
            </View>
          ) : null}

          {!exercise.is_archived ? (
            <Pressable
              onPress={handleArchive}
              accessibilityRole="button"
              className="rounded-2xl flex-row items-center justify-center"
              style={{ marginTop: 10, paddingVertical: 12, gap: 6 }}
            >
              <MaterialCommunityIcons name="archive-outline" size={14} color="#bf3b30" />
              <Text style={{ color: "#bf3b30", fontSize: 12, fontWeight: "600" }}>
                Arquivar exercício
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>

        {/* Pinned: the form is tall enough that a save button at the end of the
            scroll would be undiscoverable. */}
        <View
          className="px-4"
          style={{
            paddingTop: 10,
            paddingBottom: 10,
            borderTopWidth: 1,
            borderTopColor: "#e7e4dc",
            backgroundColor: "#f4f2ee",
          }}
        >
          <SaveButton onPress={handleSave} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function SaveButton({ onPress }: { onPress: () => void }) {
  const { pressed, handlers } = useInteractionState();

  return (
    <Pressable
      onPress={onPress}
      {...handlers}
      accessibilityRole="button"
      className="rounded-xl items-center justify-center"
      style={{
        paddingVertical: 13,
        backgroundColor: pressed ? "#1a1815" : "#26241f",
      }}
    >
      <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "700", letterSpacing: 0.2 }}>
        Salvar
      </Text>
    </Pressable>
  );
}

function IconButton({
  icon,
  label,
  onPress,
}: {
  icon: "close";
  label: string;
  onPress: () => void;
}) {
  const { hovered, handlers } = useInteractionState();

  return (
    <Pressable
      onPress={onPress}
      {...handlers}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="items-center justify-center rounded-full"
      style={{
        width: 32,
        height: 32,
        borderWidth: 1,
        borderColor: "#e7e4dc",
        backgroundColor: hovered ? "#ebe7df" : "#ffffff",
      }}
    >
      <MaterialCommunityIcons name={icon} size={17} color="#5c594f" />
    </Pressable>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
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
      <Text style={{ color: active ? "#ffffff" : "#928d80", fontSize: 12, fontWeight: "600" }}>
        {label}
      </Text>
    </Pressable>
  );
}
