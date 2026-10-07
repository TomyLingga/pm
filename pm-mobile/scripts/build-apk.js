// Builds the release APK locally: expo prebuild -> gradle assembleRelease -> copy to dist/.
// Run with `npm run build:apk`. Works from PowerShell, cmd, and Git Bash (gradlew is
// resolved per platform, so no "'gradlew' is not recognized" surprises on Windows).
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const isWin = process.platform === "win32";

function run(cmd, args, cwd) {
  console.log(`\n> ${cmd} ${args.join(" ")}`);
  // With a shell (needed for .cmd/.bat on Windows) a path that contains spaces must be quoted.
  const quote = (value) => (isWin && /\s/.test(value) ? `"${value}"` : value);
  const result = spawnSync(quote(cmd), args.map(quote), { cwd, stdio: "inherit", shell: isWin });
  if (result.status !== 0) {
    console.error(`${cmd} gagal (exit ${result.status ?? "signal"})`);
    process.exit(result.status ?? 1);
  }
}

if (!process.env.ANDROID_HOME && !process.env.ANDROID_SDK_ROOT) {
  const guess = isWin ? "C:\\Android" : path.join(process.env.HOME ?? "", "Android/Sdk");
  if (fs.existsSync(guess)) {
    process.env.ANDROID_HOME = guess;
    process.env.ANDROID_SDK_ROOT = guess;
    console.log(`ANDROID_HOME tidak diset, memakai ${guess}`);
  }
}

run(isWin ? "npm.cmd" : "npm", ["run", "prebuild:android"], root);

const androidDir = path.join(root, "android");
const gradlew = path.join(androidDir, isWin ? "gradlew.bat" : "gradlew");
run(gradlew, ["assembleRelease"], androidDir);

run(process.execPath, [path.join(__dirname, "copy-apk.js")], root);
