export class WorkflowResponseDto {
  type: string;
  workflowId: string;
  workflowName: string;
  prompt: string;
  is_ready: boolean;
  clarification_questions: string[];
  url?: string;
}
