const { withAndroidManifest, withDangerousMod, AndroidConfig } = require("@expo/config-plugins");
const fs = require("fs/promises");
const path = require("path");

module.exports = function withHealthConnect(config) {
  const packageName = config.android.package;
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest.queries ??= [];
    const queries = manifest.queries[0] ?? (manifest.queries[0] = {});
    queries.package ??= [];
    if (!queries.package.some((p) => p.$["android:name"] === "com.google.android.apps.healthdata")) {
      queries.package.push({ $: { "android:name": "com.google.android.apps.healthdata" } });
    }
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    const main = AndroidConfig.Manifest.getMainActivityOrThrow(config.modResults);
    main["intent-filter"] = (main["intent-filter"] ?? []).filter((f) =>
      !f.action?.some((a) => a.$["android:name"] === "androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE"));
    app.activity ??= [];
    if (!app.activity.some((a) => a.$["android:name"] === ".HealthConnectRationaleActivity")) {
      app.activity.push({
        $: { "android:name": ".HealthConnectRationaleActivity", "android:exported": "true" },
        "intent-filter": [{ action: [{ $: { "android:name": "androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE" } }] }],
      });
    }
    app["activity-alias"] ??= [];
    if (!app["activity-alias"].some((a) => a.$["android:name"] === "ViewPermissionUsageActivity")) {
      app["activity-alias"].push({
        $: { "android:name": "ViewPermissionUsageActivity", "android:exported": "true",
          "android:targetActivity": ".HealthConnectRationaleActivity", "android:permission": "android.permission.START_VIEW_PERMISSION_USAGE" },
        "intent-filter": [{
          action: [{ $: { "android:name": "android.intent.action.VIEW_PERMISSION_USAGE" } }],
          category: [{ $: { "android:name": "android.intent.category.HEALTH_PERMISSIONS" } }],
        }],
      });
    }
    for (const alias of app["activity-alias"] ?? []) {
      if (alias.$["android:name"] === "ViewPermissionUsageActivity") {
        alias.$["android:targetActivity"] = ".HealthConnectRationaleActivity";
      }
    }
    return config;
  });
  return withDangerousMod(config, ["android", async (config) => {
    const dir = path.join(config.modRequest.platformProjectRoot, "app/src/main/java", ...packageName.split("."));
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "HealthConnectRationaleActivity.kt"), `package ${packageName}

import android.app.Activity
import android.os.Bundle
import android.widget.ScrollView
import android.widget.TextView

class HealthConnectRationaleActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val content = TextView(this).apply {
      text = "Health Connect — open-training\\n\\nLemos corridas, distância, frequência cardíaca e cadência apenas quando você solicita a importação.\\n\\nVocê escolhe a corrida e pode vinculá-la a uma sessão existente. Não escrevemos dados no Health Connect.\\n\\nOs dados importados ficam no banco local e são incluídos nos arquivos de backup que você exportar. Não enviamos dados a um servidor do open-training.\\n\\nVocê pode revogar o acesso nas configurações do Health Connect. Revogar o acesso não apaga cópias já importadas; para removê-las, exclua a sessão no open-training."
      textSize = 18f
      setPadding(32, 48, 32, 48)
    }
    setContentView(ScrollView(this).apply { addView(content) })
  }
}
`);
    return config;
  }]);
};
