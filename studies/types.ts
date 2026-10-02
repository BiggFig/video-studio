/** Authored reference studies, never provider-generated executable code. */
export interface MotionStudy {
  id: string;
  title: string;
  width: number;
  height: number;
  fps: 30;
  durationFrames: number;
  reference: { path: string; startSeconds: number; durationSeconds: number };
  html: string;
  css: string;
  /** Trusted repository source declaring a deterministic function draw(frame). */
  script: string;
  reviewFrames: number[];
  notes: string[];
}
