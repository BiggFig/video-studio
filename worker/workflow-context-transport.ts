import type { WorkflowContext, WorkflowSnapshot } from "./workflow-coherence";

/** Lossless transport only: repeated effective elements are stored once. There
 * is no summarization, state inference, omitted field, or inherited verdict. */
export function serializeWorkflowContext(context: WorkflowContext): string {
  const canonical = JSON.stringify(context);
  if (context.version === 1) return canonical;
  const visibleRecords: WorkflowSnapshot["visible"] = [];
  const identities = new Map<string, number>();
  const scenes = context.scenes.map(scene => ({
    ...scene,
    snapshots: scene.snapshots.map(({ visible, ...snapshot }) => ({
      ...snapshot,
      visibleRecordIds: visible.map(element => {
        const identity = JSON.stringify(element);
        let index = identities.get(identity);
        if (index === undefined) {
          index = visibleRecords.length;
          visibleRecords.push(element);
          identities.set(identity, index);
        }
        return index;
      }),
    })),
  }));
  const pooled = JSON.stringify({
    transport: "workflow-context-interned-v1",
    explanation: "For each snapshot, visibleRecordIds lists zero-based indices into visibleRecords in the original visible order. Expand those exact records to read the complete effective UI at that moment. An index may be reused only for an identical full record. Changed text, style, selection, geometry, appearance or provenance has a distinct record. Every snapshot and action remains present. context.sha256 binds the expanded canonical context, not this transport. No entry is a quality verdict.",
    visibleRecords,
    context: { ...context, scenes },
  });
  // A small/all-unique context may not benefit. Preserve the existing raw-byte
  // reservation upper bound and avoid indirection when it saves nothing.
  return Buffer.byteLength(pooled, "utf8") < Buffer.byteLength(canonical, "utf8") ? pooled : canonical;
}
