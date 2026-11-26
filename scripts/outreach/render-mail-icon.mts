/**
 * Rasterize mail avatar → PNG 2048 / 1024 / 512
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const svgPath = path.join(root, "public", "brand", "rs-mail-avatar.svg");
const outDir = path.join(root, "public", "brand");
const sizes = [2048, 1024, 512] as const;

async function main() {
  const svg = fs.readFileSync(svgPath, "utf8");
  const svgBody = svg
    .replace(/\swidth="[^"]*"/, "")
    .replace(/\sheight="[^"]*"/, "");

  const browser = await chromium.launch({ headless: true });

  for (const size of sizes) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    await page.setContent(
      `<!doctype html><html><head><meta charset="utf-8"><style>
        *{box-sizing:border-box}
        html,body{margin:0;padding:0;width:${size}px;height:${size}px;overflow:hidden;background:#0d7377}
        svg{display:block;width:${size}px;height:${size}px}
      </style></head><body>${svgBody}</body></html>`,
      { waitUntil: "networkidle" },
    );
    await page.waitForTimeout(80);
    const out = path.join(outDir, `rs-mail-avatar-${size}.png`);
    await page.screenshot({
      path: out,
      type: "png",
      clip: { x: 0, y: 0, width: size, height: size },
    });
    console.log("wrote", out);
    await page.close();
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
