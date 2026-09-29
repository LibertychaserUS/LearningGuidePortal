import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";

// Home slides paint one HTML headline over these photos. The pictures must stay
// photographs: an earlier export flattened a second English headline into the pixels.
test("homepage banner photos do not flatten a second headline into the picture", async () => {
  for (const file of ["banner2.png", "banner3.png"]) {
    const source = await readFile(path.join(process.cwd(), "public/portal", file));
    const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let bright = 0;
    let total = 0;
    for (let y = 90; y < 170; y++) {
      for (let x = 120; x < 640; x++) {
        const index = (y * info.width + x) * info.channels;
        total += 1;
        if (data[index] > 220 && data[index + 1] > 220 && data[index + 2] > 220) bright += 1;
      }
    }
    assert.ok(bright / total < 0.01, `${file} still has a flattened white headline (${bright} of ${total} pixels)`);
  }
});
