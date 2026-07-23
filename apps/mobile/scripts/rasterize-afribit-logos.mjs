import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.resolve(__dirname, "..", "app", "assets", "logo", "afribit");
const resDir = path.resolve(__dirname, "..", "android", "app", "src", "main", "res");
const tmpDir = path.resolve(__dirname, "..", "tmp");

const monogramSvg = path.join(assetsDir, "afribit-monogram.svg");
const monogramWhiteSvg = path.join(assetsDir, "afribit-monogram-white.svg");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function rasterizeMonogramCentered(inputSvg, outputPng, canvasSize, iconSize) {
  const buf = await sharp(inputSvg)
    .resize(iconSize, iconSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const offset = Math.floor((canvasSize - iconSize) / 2);
  await sharp({
    create: { width: canvasSize, height: canvasSize, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: buf, left: offset, top: offset }])
    .png()
    .toFile(outputPng);
}

async function rasterizeSvg(inputSvg, outputPng, width, height) {
  ensureDir(path.dirname(outputPng));
  await sharp(inputSvg)
    .resize(width, height, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outputPng);
}

async function main() {
  ensureDir(tmpDir);

  // ── Foreground adaptive-icon layers (monogram with safe-zone padding ~63%) ──
  const foregroundTargets = [
    { dir: "mipmap-mdpi", canvas: 108, iconPct: 0.63 },
    { dir: "mipmap-hdpi", canvas: 162, iconPct: 0.63 },
    { dir: "mipmap-xhdpi", canvas: 216, iconPct: 0.63 },
    { dir: "mipmap-xxhdpi", canvas: 324, iconPct: 0.63 },
    { dir: "mipmap-xxxhdpi", canvas: 432, iconPct: 0.63 },
  ];

  for (const t of foregroundTargets) {
    const iconSize = Math.round(t.canvas * t.iconPct);
    await rasterizeMonogramCentered(
      monogramSvg,
      path.join(resDir, t.dir, "ic_launcher_foreground.png"),
      t.canvas,
      iconSize,
    );
    console.log(`✓ ${t.dir}/ic_launcher_foreground.png (${t.canvas}x${t.canvas}, icon ${iconSize}x${iconSize})`);
  }

  // ── Full launcher icons (ic_launcher.png and ic_launcher_round.png) ──
  // These are the LEGACY flat icons for launchers that don't support
  // adaptive-icon (pre-Android 8, or third-party launchers that ignore it).
  // Unlike the foreground layer above, they must be fully opaque - there is
  // no separate background layer for the OS to composite behind them - so
  // the brand near-black is baked in here, not left transparent.
  const fullIconTargets = [
    { dir: "mipmap-mdpi", size: 48 },
    { dir: "mipmap-hdpi", size: 72 },
    { dir: "mipmap-xhdpi", size: 96 },
    { dir: "mipmap-xxhdpi", size: 144 },
    { dir: "mipmap-xxxhdpi", size: 192 },
  ];
  const launcherBg = { r: 0x17, g: 0x17, b: 0x13, alpha: 1 };

  async function rasterizeFlatIconWithBg(inputSvg, outputPng, canvasSize, iconPct) {
    const iconSize = Math.round(canvasSize * iconPct);
    const iconBuf = await sharp(inputSvg)
      .resize(iconSize, iconSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    const offset = Math.floor((canvasSize - iconSize) / 2);
    await sharp({
      create: { width: canvasSize, height: canvasSize, channels: 4, background: launcherBg },
    })
      .composite([{ input: iconBuf, left: offset, top: offset }])
      .png()
      .toFile(outputPng);
  }

  for (const t of fullIconTargets) {
    await rasterizeFlatIconWithBg(
      monogramSvg,
      path.join(resDir, t.dir, "ic_launcher.png"),
      t.size,
      0.63,
    );
    await rasterizeFlatIconWithBg(
      monogramSvg,
      path.join(resDir, t.dir, "ic_launcher_round.png"),
      t.size,
      0.63,
    );
    console.log(`✓ ${t.dir}/ic_launcher.png (${t.size}x${t.size}, opaque bg)`);
    console.log(`✓ ${t.dir}/ic_launcher_round.png (${t.size}x${t.size}, opaque bg)`);
  }

  // ── QR code logo PNG (for use inside QR codes) ──
  const qrOutput = path.join(assetsDir, "afribit-monogram-qr.png");
  await rasterizeSvg(monogramSvg, qrOutput, 200, 200);
  console.log(`✓ QR logo: afribit-monogram-qr.png (200x200)`);

  // ── Bootsplash input PNG (white monogram, large, for bootsplash generator) ──
  const bootsplashInput = path.join(tmpDir, "afribit-bootsplash-input.png");
  await rasterizeSvg(monogramWhiteSvg, bootsplashInput, 1024, 1024);
  console.log(`✓ Bootsplash input PNG: tmp/afribit-bootsplash-input.png (1024x1024)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
