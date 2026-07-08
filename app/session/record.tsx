import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ExercisePickerModal } from "@/components/ExercisePickerModal";
import { PhotoAttachment } from "@/components/PhotoAttachment";
import { SetLogger } from "@/components/SetLogger";
import { useSessionRecorder } from "@/hooks/useSessionRecorder";
import { confirmAction, notify } from "@/utils/confirm";

export default function RecordScreen() {
  const recorder = useSessionRecorder();
  const [pickerVisible, setPickerVisible] = useState(false);
  const [notes, setNotes] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!started.current) {
      started.current = true;
      recorder.startSession();
    }
  }, []);

  const handleFinish = () => {
    if (recorder.selectedExercises.length === 0) {
      notify("No exercises", "Add at least one exercise before finishing.");
      return;
    }
    recorder.finishSession(notes, photoUri ?? undefined);
    router.dismiss();
  };

  const hasData =
    recorder.selectedExercises.length > 0 || notes.trim().length > 0 || photoUri != null;

  const handleDiscard = () => {
    if (!hasData) {
      recorder.discardSession();
      router.dismiss();
      return;
    }
    confirmAction("Discard session?", "All data will be lost.", "Discard", () => {
      recorder.discardSession();
      router.dismiss();
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["top", "bottom"]}>
      {/* Header */}
      <View
        className="px-4 py-4"
        style={{ borderBottomWidth: 1, borderBottomColor: '#ddd8ce' }}
      >
        <View className="flex-row items-center">
          {/* Discard */}
          <TouchableOpacity onPress={handleDiscard} style={{ paddingVertical: 4, paddingRight: 16 }}>
            <Text className="text-ink-mute text-sm">Discard</Text>
          </TouchableOpacity>

          {/* Center: title */}
          <View className="flex-1 items-center">
            <Text className="font-display font-medium" style={{ color: '#26241f', fontSize: 18, letterSpacing: -0.2 }}>
              New Session
            </Text>
          </View>

          {/* Finish */}
          <TouchableOpacity
            onPress={handleFinish}
            style={{
              backgroundColor: '#26241f',
              paddingHorizontal: 18,
              paddingVertical: 10,
              borderRadius: 12,
            }}
          >
            <Text className="text-white font-semibold text-sm">Finish</Text>
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {recorder.sessionId != null &&
            recorder.selectedExercises.map((exercise) => (
              <SetLogger
                key={exercise.id}
                exerciseId={exercise.id}
                exerciseName={exercise.name}
                sessionId={recorder.sessionId!}
                onRemoveExercise={() =>
                  recorder.removeExerciseFromSession(exercise.id)
                }
              />
            ))}

          <TouchableOpacity
            className="py-3 rounded-xl items-center mb-6"
            style={{ borderWidth: 1, borderColor: '#c9c3b6', borderStyle: 'dashed' }}
            onPress={() => setPickerVisible(true)}
          >
            <Text className="text-ink text-sm font-medium">+ Add Exercise</Text>
          </TouchableOpacity>

          <PhotoAttachment
            uri={photoUri}
            onPick={setPhotoUri}
            onRemove={() => setPhotoUri(null)}
          />

          <TextInput
            className="bg-surface-card text-ink rounded-xl px-4 py-3 mt-4"
            placeholder="Session notes…"
            placeholderTextColor="#bdb8aa"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            style={{ borderWidth: 1, borderColor: '#ddd8ce' }}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <ExercisePickerModal
        visible={pickerVisible}
        onSelect={(ex) => recorder.addExerciseToSession(ex)}
        onClose={() => setPickerVisible(false)}
      />
    </SafeAreaView>
  );
}
