import { generate } from "react-native-bootsplash/dist/commonjs/generate.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, "..");

await generate({
  android: {
    sourceDir: path.join(mobileRoot, "android"),
    appName: "app",
  },
  platforms: "android",
  flavor: "main",
  logo: path.join(mobileRoot, "tmp", "afribit-bootsplash-input.png"),
  background: "#171713",
  logoWidth: 200,
  assetsOutput: path.join(mobileRoot, "assets"),
});

console.log("Bootsplash assets generated successfully.");
