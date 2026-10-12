import test from "node:test";
import assert from "node:assert/strict";
import { dimensions } from "./planning";
import { layout } from "./render";
import type { Plan } from "./types";

test("4:5 feed keeps the full legacy proof card inside the 1350px canvas", () => {
  const output = { ...dimensions("4:5"), fps: 30 as const, duration_frames: 180 };
  assert.deepEqual([output.width, output.height], [1080, 1350]);
  const feed = layout({ output } as Plan);
  assert.ok(feed.x >= 14 && feed.y >= 14);
  assert.ok(feed.x + feed.width + 14 < output.width);
  assert.ok(feed.y + feed.height + 14 < output.height - 52);
  assert.ok(feed.textX + feed.textWidth < output.width);
  assert.ok(feed.textY + 3 * feed.font * 1.035 + 3 * feed.detail * 1.4 + 64 < feed.y - 14);
  const reels = layout({ output: { ...output, height: 1920 } } as Plan);
  assert.ok(reels.height > feed.height);
  assert.equal(reels.y, 720);
});
