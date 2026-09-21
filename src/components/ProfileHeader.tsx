import { useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { AvatarPicker } from "@/components/AvatarPicker";
import { CoverPhotoPicker } from "@/components/CoverPhotoPicker";
import { DateField } from "@/components/DateField";
import { daysBetween, todayISO } from "@/utils/cycle";
import type { UserProfile } from "@/types";

const MONTHS_LONG = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function formatLongDate(dateISO: string): string {
  const d = new Date(dateISO + "T00:00:00");
  return `${d.getDate()} de ${MONTHS_LONG[d.getMonth()]} de ${d.getFullYear()}`;
}

function formatShortDate(dateISO: string): string {
  const [year, month, day] = dateISO.split("-");
  return `${day}/${month}/${year}`;
}

function formatDurationSince(fromISO: string): string {
  const days = daysBetween(fromISO, todayISO());
  if (days < 0) return "data futura";
  if (days < 31) return `${days} dia${days !== 1 ? "s" : ""}`;
  const totalMonths = Math.floor(days / 30.44);
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years === 0) return `${months} ${months !== 1 ? "meses" : "mês"}`;
  if (months === 0) return `${years} ano${years !== 1 ? "s" : ""}`;
  return `${years} ano${years !== 1 ? "s" : ""} e ${months} ${months !== 1 ? "meses" : "mês"}`;
}

interface Props {
  profile: UserProfile;
  onUpdate: (
    patch: Partial<
      Pick<UserProfile, "name" | "username" | "photo_uri" | "cover_photo_uri" | "birthdate" | "training_start_date">
    >
  ) => void;
}

export function ProfileHeader({ profile, onUpdate }: Props) {
  const [editing, setEditing] = useState(false);

  return (
    <View style={{ marginBottom: 16 }}>
      <View>
        <CoverPhotoPicker
          uri={profile.cover_photo_uri}
          onChange={(uri) => onUpdate({ cover_photo_uri: uri })}
          editable={editing}
        />
        <TouchableOpacity
          onPress={() => setEditing((v) => !v)}
          hitSlop={8}
          style={{
            position: "absolute",
            top: 10,
            right: 16,
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: "rgba(38,36,31,0.78)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MaterialCommunityIcons name={editing ? "check" : "pencil-outline"} size={editing ? 18 : 16} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <View className="px-4" style={{ marginTop: -36 }}>
        <AvatarPicker uri={profile.photo_uri} onChange={(uri) => onUpdate({ photo_uri: uri })} editable={editing} />

        <View style={{ marginTop: 10 }}>
          {editing ? (
            <>
              <Text className="text-ink-mute" style={{ fontSize: 10.5, fontWeight: "600", marginBottom: 4 }}>
                Nome
              </Text>
              <TextInput
                value={profile.name ?? ""}
                onChangeText={(v) => onUpdate({ name: v })}
                placeholder="Seu nome"
                placeholderTextColor="#bdb8aa"
                className="text-ink rounded-xl px-3 py-2"
                style={{ backgroundColor: "#f4f2ee", borderWidth: 1, borderColor: "#e7e4dc", fontSize: 15 }}
              />
            </>
          ) : (
            <Text
              className="font-display font-semibold text-2xl"
              style={{ letterSpacing: -0.6, color: profile.name ? "#26241f" : "#928d80" }}
            >
              {profile.name || "Sem nome definido"}
            </Text>
          )}
        </View>

        <View style={{ marginTop: editing ? 10 : 2 }}>
          {editing ? (
            <>
              <Text className="text-ink-mute" style={{ fontSize: 10.5, fontWeight: "600", marginBottom: 4 }}>
                Usuário
              </Text>
              <View
                className="flex-row items-center rounded-xl px-3"
                style={{ backgroundColor: "#f4f2ee", borderWidth: 1, borderColor: "#e7e4dc" }}
              >
                <Text className="text-ink-mute text-sm">@</Text>
                <TextInput
                  value={profile.username ?? ""}
                  onChangeText={(v) => onUpdate({ username: v })}
                  placeholder="usuario"
                  placeholderTextColor="#bdb8aa"
                  autoCapitalize="none"
                  className="text-ink flex-1 py-2"
                  style={{ fontSize: 14 }}
                />
              </View>
            </>
          ) : profile.username ? (
            <Text className="text-ink-mute text-sm">@{profile.username}</Text>
          ) : null}
        </View>

        <View style={{ marginTop: 14, gap: 10 }}>
          <View className="flex-row items-center justify-between">
            <Text className="text-ink-mute text-xs">Data de nascimento</Text>
            {editing ? (
              <DateField value={profile.birthdate} onChange={(iso) => onUpdate({ birthdate: iso })} />
            ) : (
              <Text className="text-ink-soft text-sm font-medium">
                {profile.birthdate
                  ? `${formatShortDate(profile.birthdate)} · ${formatDurationSince(profile.birthdate)}`
                  : "Não informado"}
              </Text>
            )}
          </View>

          <View className="flex-row items-center justify-between">
            <Text className="text-ink-mute text-xs">Treinando desde</Text>
            {editing ? (
              <DateField
                value={profile.training_start_date}
                onChange={(iso) => onUpdate({ training_start_date: iso })}
              />
            ) : (
              <Text className="text-ink-soft text-sm font-medium">
                {profile.training_start_date
                  ? `${formatShortDate(profile.training_start_date)} · ${formatDurationSince(profile.training_start_date)}`
                  : "Não informado"}
              </Text>
            )}
          </View>

          <View className="flex-row items-center justify-between">
            <Text className="text-ink-mute text-xs">Usando o app desde</Text>
            <Text className="text-ink-soft text-sm">{formatLongDate(profile.created_at.slice(0, 10))}</Text>
          </View>
        </View>
      </View>

      <View style={{ height: 1, backgroundColor: "#ddd8ce", marginHorizontal: 16, marginTop: 16 }} />
    </View>
  );
}
