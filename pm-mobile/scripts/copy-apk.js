// Copies the gradle release APK to dist/PrevenTech-v<version>.apk (run by `npm run build:apk`).
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const { expo } = JSON.parse(fs.readFileSync(path.join(root, "app.json"), "utf8"));
const apk = path.join(root, "android", "app", "build", "outputs", "apk", "release", "app-release.apk");
if (!fs.existsSync(apk)) {
  console.error("APK tidak ditemukan:", apk);
  process.exit(1);
}
fs.mkdirSync(path.join(root, "dist"), { recursive: true });
const target = path.join(root, "dist", `PrevenTech-v${expo.version}.apk`);
fs.copyFileSync(apk, target);
console.log("APK:", target, `(${(fs.statSync(target).size / 1024 / 1024).toFixed(1)} MB)`);
