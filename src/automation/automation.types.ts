export type AutomationJobStatus =
  | 'running'
  | 'completed'
  | 'failed'
  | 'stopped';

export type AutomationStreamEvent =
  | {
      type: 'job_started';
      payload: {
        job_id: string;
        started_at: string;
        query: string;
        url: string;
      };
    }
  | {
      type: 'step';
      payload: { message: string; at: string };
    }
  | {
      type: 'frame';
      payload: { mime: 'image/jpeg'; base64: string; at: string };
    }
  | {
      type: 'job_finished';
      payload: {
        job_id: string;
        finished_at: string;
        status: AutomationJobStatus;
      };
    }
  | {
      type: 'job_failed';
      payload: { job_id: string; failed_at: string; error: string };
    }
  | {
      type: 'agent_thinking';
      payload: {
        agent: 'planner' | 'browser' | 'critique';
        message: string;
        at: string;
      };
    }
  | {
      type: 'plan_created';
      payload: { steps: string[]; at: string };
    }
  | {
      type: 'plan_updated';
      payload: { steps: string[]; reason: string; at: string };
    }
  | {
      type: 'action_executed';
      payload: { action: string; result: string; at: string };
    }
  | {
      type: 'critique_result';
      payload: {
        status: 'success' | 'continue' | 'replan';
        feedback: string;
        at: string;
      };
    };

// Three-Agent System Types

export type PlannerStep = {
  step_number: number;
  description: string;
  action_type: 'navigate' | 'click' | 'fill' | 'extract' | 'verify' | 'wait';
  expected_outcome: string;
};

export type PlannerResponse = {
  goal_understanding: string;
  strategy: string;
  steps: PlannerStep[];
  success_criteria: string;
};

export type BrowserAction = {
  type: 'goto' | 'click' | 'fill' | 'press' | 'wait' | 'extract' | 'done';
  url?: string;
  text?: string;
  selector?: string;
  field?: string;
  value?: string;
  key?: string;
  ms?: number;
  extract_target?: string;
};

export type BrowserAgentResponse = {
  action: BrowserAction;
  reasoning: string;
  expected_result: string;
};

export type CritiqueDecision =
  | 'task_complete'
  | 'continue_plan'
  | 'replan_needed'
  | 'action_failed';

export type CritiqueResponse = {
  decision: CritiqueDecision;
  analysis: string;
  success_indicators: string[];
  issues_found: string[];
  recommendation: string;
  extracted_data?: any;
};
