import { assertWorkflowContext, type WorkflowContext } from "./workflow-coherence";
import { serializeWorkflowContext } from "./workflow-context-transport";

/** Validated lossless transport; legacy contexts preserve their exact bytes. */
export function qualityWorkflowContext(context: WorkflowContext): string {
  assertWorkflowContext(context);
  return serializeWorkflowContext(context);
}
