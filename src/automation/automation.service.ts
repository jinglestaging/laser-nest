import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { chromium, type Browser, type Page } from 'playwright';
import { Subject } from 'rxjs';
import { OpenAiService } from '../openai/openai.service';
import type { MessageEvent } from '@nestjs/common';
import type {
  AutomationJobStatus,
  AutomationStreamEvent,
  PlannerResponse,
  BrowserAgentResponse,
  CritiqueResponse,
  PlannerStep,
} from './automation.types';
import type { RunAiAutomationDto } from './dto/run-ai-automation.dto';

type JobInternal = {
  id: string;
  status: AutomationJobStatus;
  started_at: string;
  finished_at?: string;
  url: string;
  query: string;
  last_step?: string;
  error?: string;
  subject: Subject<MessageEvent>;
  last_frame?: { mime: 'image/jpeg'; base64: string; at: string };
  browser?: Browser;
  stop_requested: boolean;
};

@Injectable()
export class AutomationService {
  constructor(private readonly openAiService: OpenAiService) {}

  private readonly jobs = new Map<string, JobInternal>();

  private emit(job: JobInternal, event: AutomationStreamEvent) {
    job.subject.next({
      type: event.type,
      data: event,
    });
  }

  private getJobOrThrow(jobId: string): JobInternal {
    const job = this.jobs.get(jobId);
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  getStatus(jobId: string) {
    const job = this.getJobOrThrow(jobId);
    return {
      job_id: job.id,
      status: job.status,
      started_at: job.started_at,
      finished_at: job.finished_at ?? null,
      url: job.url,
      query: job.query,
      last_step: job.last_step ?? null,
      error: job.error ?? null,
      last_frame: job.last_frame
        ? { mime: job.last_frame.mime, at: job.last_frame.at }
        : null,
    };
  }

  getStream(jobId: string) {
    return this.getJobOrThrow(jobId).subject.asObservable();
  }

  async stop(jobId: string) {
    const job = this.getJobOrThrow(jobId);
    job.stop_requested = true;
    job.status = job.status === 'running' ? 'stopped' : job.status;
    try {
      await job.browser?.close();
    } catch {
      // ignore
    }
    return this.getStatus(jobId);
  }

  async run(params: { url?: string; query?: string }) {
    const runningJob = [...this.jobs.values()].find((j) => j.status === 'running');
    if (runningJob) {
      throw new BadRequestException(`Another job is already running: ${runningJob.id}`);
    }

    const jobId = randomUUID();
    const url = params.url?.trim() || 'https://www.google.com';
    const query = params.query?.trim() || 'New Your City';

    const job: JobInternal = {
      id: jobId,
      status: 'running',
      started_at: new Date().toISOString(),
      url,
      query,
      subject: new Subject<MessageEvent>(),
      stop_requested: false,
    };

    this.jobs.set(jobId, job);
    this.emit(job, {
      type: 'job_started',
      payload: { job_id: jobId, started_at: job.started_at, query, url },
    });

    void this.runWorkflow(job).catch((err: unknown) => {
      job.status = job.status === 'stopped' ? 'stopped' : 'failed';
      job.error = err instanceof Error ? err.message : 'Unknown error';
      this.emit(job, {
        type: 'job_failed',
        payload: {
          job_id: job.id,
          failed_at: new Date().toISOString(),
          error: job.error,
        },
      });
      job.subject.complete();
      try {
        void job.browser?.close();
      } catch {
        // ignore
      }
    });

    return this.getStatus(jobId);
  }

  async runAi(dto: RunAiAutomationDto) {
    console.log('runAi called with dto:', dto);
    const runningJob = [...this.jobs.values()].find((j) => j.status === 'running');
    if (runningJob) {
      throw new BadRequestException(`Another job is already running: ${runningJob.id}`);
    }

    const jobId = randomUUID();
    const prompt = dto.prompt?.trim();
    if (!prompt) throw new BadRequestException('prompt is required');

    const startUrl = dto.start_url?.trim() || '';

    const job: JobInternal = {
      id: jobId,
      status: 'running',
      started_at: new Date().toISOString(),
      url: startUrl || 'about:blank',
      query: prompt,
      subject: new Subject<MessageEvent>(),
      stop_requested: false,
    };

    this.jobs.set(jobId, job);
    this.emit(job, {
      type: 'job_started',
      payload: { job_id: jobId, started_at: job.started_at, query: prompt, url: job.url },
    });

    void this.runAiWorkflow(job, {
      prompt,
      start_url: startUrl || undefined,
      headless: dto.headless ?? true,
      max_steps: dto.max_steps ?? 20,
    }).catch((err: unknown) => {
      job.status = job.status === 'stopped' ? 'stopped' : 'failed';
      job.error = err instanceof Error ? err.message : 'Unknown error';
      this.emit(job, {
        type: 'job_failed',
        payload: {
          job_id: job.id,
          failed_at: new Date().toISOString(),
          error: job.error,
        },
      });
      job.subject.complete();
      try {
        void job.browser?.close();
      } catch {
        // ignore
      }
    });

    return this.getStatus(jobId);
  }

  /**
   * Run Three-Agent AI Automation
   * Uses Planner, Browser, and Critique agents working in harmony
   */
  async runThreeAgentAi(dto: RunAiAutomationDto) {
    console.log('runThreeAgentAi called with dto:', dto);
    const runningJob = [...this.jobs.values()].find((j) => j.status === 'running');
    if (runningJob) {
      throw new BadRequestException(`Another job is already running: ${runningJob.id}`);
    }

    const jobId = randomUUID();
    const prompt = dto.prompt?.trim();
    if (!prompt) throw new BadRequestException('prompt is required');

    const startUrl = dto.start_url?.trim() || '';

    const job: JobInternal = {
      id: jobId,
      status: 'running',
      started_at: new Date().toISOString(),
      url: startUrl || 'about:blank',
      query: prompt,
      subject: new Subject<MessageEvent>(),
      stop_requested: false,
    };

    this.jobs.set(jobId, job);
    this.emit(job, {
      type: 'job_started',
      payload: { job_id: jobId, started_at: job.started_at, query: prompt, url: job.url },
    });

    void this.runThreeAgentWorkflow(job, {
      prompt,
      start_url: startUrl || undefined,
      headless: dto.headless ?? true,
      max_iterations: dto.max_steps ?? 15, // Use max_steps as max_iterations
    }).catch((err: unknown) => {
      job.status = job.status === 'stopped' ? 'stopped' : 'failed';
      job.error = err instanceof Error ? err.message : 'Unknown error';
      this.emit(job, {
        type: 'job_failed',
        payload: {
          job_id: job.id,
          failed_at: new Date().toISOString(),
          error: job.error,
        },
      });
      job.subject.complete();
      try {
        void job.browser?.close();
      } catch {
        // ignore
      }
    });

    return this.getStatus(jobId);
  }

  private async runWorkflow(job: JobInternal) {
    const step = (message: string) => {
      job.last_step = message;
      this.emit(job, {
        type: 'step',
        payload: { message, at: new Date().toISOString() },
      });
    };

    const capture = async (page: Page) => {
      try {
        const buf = await page.screenshot({
          type: 'jpeg',
          quality: 60,
          fullPage: false,
        });
        const frame = {
          mime: 'image/jpeg' as const,
          base64: Buffer.from(buf).toString('base64'),
          at: new Date().toISOString(),
        };
        job.last_frame = frame;
        this.emit(job, { type: 'frame', payload: frame });
      } catch {
        // ignore capture errors (e.g. if browser already closed)
      }
    };

    step('Launching browser');
    job.browser = await chromium.launch({
      headless: true,
    });
    const context = await job.browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();

    const interval = setInterval(() => {
      if (job.stop_requested) return;
      void capture(page);
    }, 700);

    try {
      step(`Navigating to ${job.url}`);
      await page.goto(job.url, { waitUntil: 'domcontentloaded' });
      await capture(page);
      if (job.stop_requested) throw new Error('Job stopped');

      step(`Typing query: ${job.query}`);
      await page.waitForSelector('textarea[name="q"], input[name="q"]', {
        timeout: 15_000,
      });
      const input = (await page.$('textarea[name="q"]')) || (await page.$('input[name="q"]'));
      if (!input) throw new Error('Google search input not found');
      await input.fill(job.query);
      await capture(page);
      if (job.stop_requested) throw new Error('Job stopped');

      step('Submitting search');
      await page.keyboard.press('Enter');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);
      await capture(page);

      if (job.stop_requested) throw new Error('Job stopped');

      step('Finished');
      job.status = 'completed';
      job.finished_at = new Date().toISOString();
      this.emit(job, {
        type: 'job_finished',
        payload: {
          job_id: job.id,
          finished_at: job.finished_at,
          status: job.status,
        },
      });
      job.subject.complete();
    } finally {
      clearInterval(interval);
      await context.close().catch(() => undefined);
      await job.browser?.close().catch(() => undefined);
    }
  }

  private extractJsonObject(text: string): string {
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first === -1 || last === -1 || last <= first) return '';
    return text.slice(first, last + 1);
  }

  private isSafeHttpUrl(url: string): boolean {
    try {
      const u = new URL(url);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private async callAiOnce(args: {
    prompt: string;
    observation: any;
  }): Promise<{ thought?: string; action?: any; raw: string }> {
    const system = `You are an intelligent browser automation agent. Be smart and efficient.

You must output ONLY valid JSON (no markdown, no extra text) with this shape:
{
  "thought": "brief reasoning about what to do next",
  "action": {
    "type": "goto|click|fill|press|wait|done",
    "url": "https://..."?,            // for goto
    "text": "visible text"?,          // for click (preferred)
    "selector": "css/xpath/text=..."?,// optional for click/fill if needed
    "field": "label/placeholder"?,    // for fill (preferred)
    "value": "text to type"?,         // for fill
    "key": "Enter|Tab|Escape|Control+L"?, // for press
    "ms": 500?                        // for wait (max 5000)
  }
}

Intelligence Rules:
- Cookies are handled automatically - don't worry about them
- Be efficient: Do ONE action per response - don't plan multiple steps
- Be direct: For search tasks, either fill the input OR submit the search, not both
- Be sequential: Complete one action, then think about the next
- Be observant: Use page elements to understand what you're looking at
- Complete when done: Use type="done" when the main task is finished

Action Priority (ONE per response):
1. First: Find and fill form inputs for the main task
2. Then: Submit forms by pressing Enter or clicking submit buttons
3. Finally: Use "done" when complete - don't leave tasks half-done

Wait Strategy:
- If clicking fails because an element isn't visible, try waiting first
- Use short waits (500-2000ms) for dynamic content to load
- Don't waste steps - be efficient but patient

Never use file:// or local paths.`;

    const response = await this.openAiService.createChatCompletion({
      temperature: 0.3,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: args.prompt },
        { role: 'user', content: `OBSERVATION:\n${JSON.stringify(args.observation)}` },
      ],
    });

    console.log("AHOJ", response)

    const messageContent =
      response?.choices?.[0]?.message?.content;

    if (!messageContent) {
      const errorMessage =
        (response as any)?.error?.message || 'AI returned no content';
      throw new Error(errorMessage);
    }

    console.log('AI raw response:', messageContent);

    let parsed: any;
    const extracted = this.extractJsonObject(messageContent);
    console.log('Extracted JSON:', extracted);

    // Try parsing the extracted JSON first
    if (extracted) {
      try {
        parsed = JSON.parse(extracted);
      } catch (extractError) {
        console.log('Extracted JSON parse failed, trying raw response');
      }
    }

    // If extraction failed, try parsing the raw response directly
    if (!parsed) {
      try {
        parsed = JSON.parse(messageContent.trim());
      } catch (rawError) {
        console.error('Raw JSON parse error:', rawError);
        throw new Error(`AI returned malformed JSON. Raw: ${messageContent.substring(0, 300)}...`);
      }
    }

    if (!parsed.action || typeof parsed.action !== 'object') {
      throw new Error(`AI returned invalid action structure: ${JSON.stringify(parsed)}`);
    }

    return { thought: parsed?.thought, action: parsed?.action, raw: messageContent };
  }

  private async describePage(page: Page) {
    const title = await page.title().catch(() => '');
    const url = page.url();

    const elements = await page
      .$$eval(
        'a,button,input,textarea,select,[role="button"],[role="link"]',
        (els) =>
          els
            .slice(0, 80)
            .map((el) => {
              const anyEl = el as any;
              const text =
                (anyEl.innerText || '').trim() ||
                (anyEl.getAttribute?.('aria-label') || '').trim() ||
                (anyEl.getAttribute?.('placeholder') || '').trim() ||
                (anyEl.getAttribute?.('name') || '').trim() ||
                '';
              return {
                tag: (el as HTMLElement).tagName?.toLowerCase?.() || '',
                text: text.slice(0, 120),
                id: (anyEl.id || '').toString().slice(0, 80),
                name: (anyEl.getAttribute?.('name') || '').toString().slice(0, 80),
                role: (anyEl.getAttribute?.('role') || '').toString().slice(0, 40),
                placeholder: (anyEl.getAttribute?.('placeholder') || '').toString().slice(0, 80),
                type: (anyEl.getAttribute?.('type') || '').toString().slice(0, 20),
              };
            })
            .filter((e) => e.text || e.id || e.name || e.placeholder),
      )
      .catch(() => []);

    const bodyText = await page
      .evaluate(() => (document.body?.innerText || '').slice(0, 2000))
      .catch(() => '');


    return { title, url, elements, body_text: bodyText };
  }

  private async handleCookiesModal(page: Page): Promise<void> {
    try {
      console.log('Starting cookie modal handling');
      // Wait for page to be fully loaded
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000); // Brief wait for modal to appear

      // Simple, reliable cookie acceptance - just try common patterns
      const cookieSelectors = [
        'button:has-text("accept")',
        'button:has-text("accept all")',
        'button:has-text("agree")',
        'button:has-text("ok")',
        'button:has-text("přijmout")',
        'button:has-text("přijmout vše")',
        '[data-testid="cookie-accept"]',
        '#cookieConsent button'
      ];

      for (const selector of cookieSelectors) {
        try {
          const button = page.locator(selector).first();
          if (await button.isVisible({ timeout: 2000 })) {
            await button.click({ timeout: 2000 });
            await page.waitForTimeout(500);
            console.log('Successfully handled cookies with:', selector);
            return;
          }
        } catch {
          // Continue to next selector
        }
      }

      console.log('No cookies modal found or needed handling');
    } catch (error) {
      console.log('Cookie handling failed (non-critical):', error);
    }
  }

  private async clickByBestEffort(page: Page, text?: string, selector?: string) {
    if (selector?.trim()) {
      await page.locator(selector).first().click({ timeout: 15_000 });
      return;
    }
    const t = (text || '').trim();
    if (!t) throw new Error('click requires text or selector');

    const attempts: Array<() => Promise<void>> = [
      async () => page.getByRole('button', { name: t }).first().click({ timeout: 2_500 }),
      async () => page.getByRole('link', { name: t }).first().click({ timeout: 2_500 }),
      async () => page.getByText(t, { exact: false }).first().click({ timeout: 2_500 }),
      async () => page.locator(`text=${t}`).first().click({ timeout: 2_500 }),
    ];

    let lastErr: unknown;
    for (const fn of attempts) {
      try {
        await fn();
        return;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('Click failed');
  }

  private async fillByBestEffort(page: Page, field?: string, value?: string, selector?: string) {
    const v = value ?? '';
    if (selector?.trim()) {
      await page.locator(selector).first().fill(v, { timeout: 15_000 });
      return;
    }
    const f = (field || '').trim();
    if (!f) throw new Error('fill requires field or selector');

    const attempts: Array<() => Promise<void>> = [
      async () => page.getByLabel(f, { exact: false }).first().fill(v, { timeout: 2_500 }),
      async () => page.getByPlaceholder(f, { exact: false }).first().fill(v, { timeout: 2_500 }),
      async () => page.getByRole('textbox', { name: f }).first().fill(v, { timeout: 2_500 }),
      async () => page.locator(`input[name="${f}"], textarea[name="${f}"]`).first().fill(v, { timeout: 2_500 }),
      async () => page.locator(`input[placeholder*="${f}"], textarea[placeholder*="${f}"]`).first().fill(v, { timeout: 2_500 }),
      // Smart fallback: find first visible text input/textarea (language-agnostic)
      async () => {
        const input = page.locator('input[type="text"]:visible, input:not([type]):visible, textarea:visible, input[type="search"]:visible').first();
        await input.waitFor({ state: 'visible', timeout: 2_500 });
        await input.fill(v, { timeout: 2_500 });
      },
    ];

    let lastErr: unknown;
    for (const fn of attempts) {
      try {
        await fn();
        return;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('Fill failed');
  }

  // ========================================
  // THREE-AGENT SYSTEM: Planner, Browser, Critique
  // ========================================

  /**
   * PLANNER AGENT: Creates and adapts execution plans
   * Breaks down user requests into clear, executable steps
   */
  private async callPlannerAgent(args: {
    user_goal: string;
    current_context?: string;
    previous_plan?: PlannerStep[];
    feedback?: string;
  }): Promise<PlannerResponse> {
    const systemPrompt = `You are the PLANNER AGENT in a three-agent browser automation system.

Your role: Break down user goals into clear, executable steps for the Browser Agent.

You must output ONLY valid JSON with this structure:
{
  "goal_understanding": "Brief statement of what the user wants to achieve",
  "strategy": "High-level approach to accomplish the goal",
  "steps": [
    {
      "step_number": 1,
      "description": "Clear description of what to do",
      "action_type": "navigate|click|fill|extract|verify|wait",
      "expected_outcome": "What should happen after this step"
    }
  ],
  "success_criteria": "How to know when the task is complete"
}

Planning Principles:
- Be specific and actionable - the Browser Agent needs clear instructions
- Break complex tasks into simple steps
- Consider the current page state when planning
- Plan for verification and data extraction where needed
- Keep plans focused - typically 3-8 steps
- If replanning, learn from previous feedback

Action Types:
- navigate: Go to a URL
- click: Click on elements (buttons, links)
- fill: Enter text into input fields
- extract: Get specific information from the page
- verify: Check if something is present or correct
- wait: Wait for page to load or element to appear`;

    const userPrompt = args.previous_plan
      ? `REPLANNING REQUEST:
Original Goal: ${args.user_goal}
Previous Plan Failed. Feedback: ${args.feedback || 'No feedback'}
Current Context: ${args.current_context || 'Not available'}

Please create an improved plan that addresses the issues.`
      : `USER GOAL: ${args.user_goal}
${args.current_context ? `\nCurrent Context: ${args.current_context}` : ''}

Please create a step-by-step plan to achieve this goal.`;

    const response = await this.openAiService.createChatCompletion({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const content = response?.choices?.[0]?.message?.content;
    if (!content) throw new Error('Planner Agent returned no content');

    const extracted = this.extractJsonObject(content);
    const parsed = JSON.parse(extracted || content.trim());

    if (!parsed.steps || !Array.isArray(parsed.steps)) {
      throw new Error('Planner Agent returned invalid plan structure');
    }

    return parsed as PlannerResponse;
  }

  /**
   * BROWSER AGENT: Executes browser actions
   * Translates plan steps into precise browser operations
   */
  private async callBrowserAgent(args: {
    current_step: PlannerStep;
    page_state: any;
    user_goal: string;
  }): Promise<BrowserAgentResponse> {
    const systemPrompt = `You are the BROWSER AGENT in a three-agent browser automation system.

Your role: Execute precise browser actions based on the Planner's step and current page state.

You must output ONLY valid JSON with this structure:
{
  "action": {
    "type": "goto|click|fill|press|wait|extract|done",
    "url": "https://...",           // for goto
    "text": "visible text",          // for click (preferred)
    "selector": "css selector",      // optional, for click/fill
    "field": "input label/placeholder", // for fill (preferred)
    "value": "text to enter",        // for fill
    "key": "Enter|Tab|Escape",       // for press
    "ms": 1000,                      // for wait
    "extract_target": "description"  // for extract - what to extract
  },
  "reasoning": "Why you chose this specific action",
  "expected_result": "What should happen after this action"
}

Execution Principles:
- Use page state to find the right elements
- For fill actions: Use generic terms like "search" or "input" for field name (handles any language)
- If page is in foreign language, use simple generic field names - system has smart fallback
- Prefer text/label matching over CSS selectors (more reliable)
- Be patient - use waits when needed
- For extract actions, describe what data to pull from the page
- Use "done" type only when explicitly told task is complete
- One action at a time - keep it simple`;

    const userPrompt = `CURRENT STEP TO EXECUTE:
Step ${args.current_step.step_number}: ${args.current_step.description}
Action Type: ${args.current_step.action_type}
Expected Outcome: ${args.current_step.expected_outcome}

USER GOAL: ${args.user_goal}

PAGE STATE:
${JSON.stringify(args.page_state, null, 2)}

Provide the precise browser action to execute this step.`;

    const response = await this.openAiService.createChatCompletion({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const content = response?.choices?.[0]?.message?.content;
    if (!content) throw new Error('Browser Agent returned no content');

    const extracted = this.extractJsonObject(content);
    const parsed = JSON.parse(extracted || content.trim());

    if (!parsed.action || !parsed.action.type) {
      throw new Error('Browser Agent returned invalid action structure');
    }

    return parsed as BrowserAgentResponse;
  }

  /**
   * CRITIQUE AGENT: Evaluates results and guides next steps
   * Analyzes actions, verifies results, and determines if tasks are complete
   */
  private async callCritiqueAgent(args: {
    user_goal: string;
    executed_step: PlannerStep;
    action_taken: BrowserAgentResponse;
    page_state_before: any;
    page_state_after: any;
    remaining_steps: PlannerStep[];
  }): Promise<CritiqueResponse> {
    const systemPrompt = `You are the CRITIQUE AGENT in a three-agent browser automation system.

Your role: Analyze execution results, verify success, and guide the workflow.

You must output ONLY valid JSON with this structure:
{
  "decision": "task_complete|continue_plan|replan_needed|action_failed",
  "analysis": "What happened and why",
  "success_indicators": ["Positive observations"],
  "issues_found": ["Problems or concerns"],
  "recommendation": "What should happen next",
  "extracted_data": {} // Optional: if data was extracted, include it here
}

Decision Types:
- task_complete: User's goal is fully achieved, return results
- continue_plan: Step succeeded, proceed to next step in plan
- replan_needed: Current approach isn't working, need new strategy
- action_failed: Action failed but can be retried or adjusted

Evaluation Criteria:
- Compare page state before/after action
- Check if expected outcome was achieved
- Verify progress toward user goal
- Identify any errors or unexpected results
- Be critical but constructive
- Extract data when appropriate`;

    const userPrompt = `EVALUATION REQUEST:
User Goal: ${args.user_goal}

Executed Step ${args.executed_step.step_number}: ${args.executed_step.description}
Expected Outcome: ${args.executed_step.expected_outcome}

Action Taken:
${JSON.stringify(args.action_taken, null, 2)}

Page State Before:
${JSON.stringify(args.page_state_before, null, 2).slice(0, 1500)}

Page State After:
${JSON.stringify(args.page_state_after, null, 2).slice(0, 1500)}

Remaining Steps: ${args.remaining_steps.length > 0 ? args.remaining_steps.map((s) => s.description).join(', ') : 'None - this was the final step'}

Analyze the results and decide next action.`;

    const response = await this.openAiService.createChatCompletion({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const content = response?.choices?.[0]?.message?.content;
    if (!content) throw new Error('Critique Agent returned no content');

    const extracted = this.extractJsonObject(content);
    const parsed = JSON.parse(extracted || content.trim());

    if (!parsed.decision || !parsed.analysis) {
      throw new Error('Critique Agent returned invalid response structure');
    }

    return parsed as CritiqueResponse;
  }


  /**
   * THREE-AGENT ORCHESTRATION WORKFLOW
   * Coordinates Planner, Browser, and Critique agents in a feedback loop
   */
  private async runThreeAgentWorkflow(
    job: JobInternal,
    args: { prompt: string; start_url?: string; headless: boolean; max_iterations: number },
  ) {
    const step = (message: string) => {
      job.last_step = message;
      this.emit(job, {
        type: 'step',
        payload: { message, at: new Date().toISOString() },
      });
    };

    const agentThinking = (agent: 'planner' | 'browser' | 'critique', message: string) => {
      this.emit(job, {
        type: 'agent_thinking',
        payload: { agent, message, at: new Date().toISOString() },
      });
    };

    const capture = async (page: Page) => {
      try {
        const buf = await page.screenshot({
          type: 'jpeg',
          quality: 60,
          fullPage: false,
        });
        const frame = {
          mime: 'image/jpeg' as const,
          base64: Buffer.from(buf).toString('base64'),
          at: new Date().toISOString(),
        };
        job.last_frame = frame;
        this.emit(job, { type: 'frame', payload: frame });
      } catch {
        // ignore capture errors
      }
    };

    step('Launching browser (Three-Agent Mode)');
    job.browser = await chromium.launch({ headless: args.headless });
    const context = await job.browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();

    const interval = setInterval(() => {
      if (job.stop_requested) return;
      void capture(page);
    }, 700);

    try {
      // Navigate to start URL if provided
      if (args.start_url) {
        if (!this.isSafeHttpUrl(args.start_url)) {
          throw new BadRequestException('start_url must be http(s)');
        }
        step(`Navigating to ${args.start_url}`);
        await page.goto(args.start_url, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000);
        await capture(page);
        await this.handleCookiesModal(page);
        await capture(page);
      }

      // PHASE 1: PLANNER AGENT - Create initial plan
      agentThinking('planner', 'Analyzing goal and creating execution plan...');
      step('Planner Agent: Creating execution plan');

      const initialContext = await this.describePage(page);
      const plan = await this.callPlannerAgent({
        user_goal: args.prompt,
        current_context: JSON.stringify(initialContext).slice(0, 500),
      });

      this.emit(job, {
        type: 'plan_created',
        payload: {
          steps: plan.steps.map((s) => `${s.step_number}. ${s.description}`),
          at: new Date().toISOString(),
        },
      });

      step(`Plan created: ${plan.steps.length} steps`);

      let currentPlan = plan;
      let currentStepIndex = 0;
      let maxReplanAttempts = 2;
      let replanCount = 0;

      // MAIN AGENT LOOP
      for (let iteration = 0; iteration < args.max_iterations; iteration++) {
        if (job.stop_requested) throw new Error('Job stopped');

        // Check if all steps completed
        if (currentStepIndex >= currentPlan.steps.length) {
          step('All planned steps completed');
          break;
        }

        const currentStep = currentPlan.steps[currentStepIndex];
        step(`Executing step ${currentStep.step_number}/${currentPlan.steps.length}: ${currentStep.description}`);

        // Get page state before action
        const pageStateBefore = await this.describePage(page);

        // PHASE 2: BROWSER AGENT - Execute current step
        agentThinking('browser', `Executing: ${currentStep.description}`);

        const browserResponse = await this.callBrowserAgent({
          current_step: currentStep,
          page_state: pageStateBefore,
          user_goal: args.prompt,
        });

        step(`Action: ${browserResponse.action.type} - ${browserResponse.reasoning}`);

        // Execute the browser action
        const action = browserResponse.action;
        try {
          if (action.type === 'goto' && action.url) {
            if (!this.isSafeHttpUrl(action.url)) {
              throw new Error('Invalid URL');
            }
            await page.goto(action.url, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2000);
          } else if (action.type === 'click') {
            await this.clickByBestEffort(page, action.text, action.selector);
            await page.waitForTimeout(500);
          } else if (action.type === 'fill') {
            await this.fillByBestEffort(page, action.field, action.value, action.selector);
            await page.waitForTimeout(300);
            
            // Auto-submit: After filling, look for submit button in the same form and click it
            try {
              const submitButton = page.locator('button[type="submit"]:visible, input[type="submit"]:visible').first();
              const isVisible = await submitButton.isVisible({ timeout: 1000 }).catch(() => false);
              if (isVisible) {
                step('Auto-submitting form (found submit button)');
                await submitButton.click({ timeout: 2000 });
                await page.waitForTimeout(1000); // Wait for form submission
              }
            } catch {
              // No submit button found or click failed - that's OK, continue
            }
          } else if (action.type === 'press' && action.key) {
            await page.keyboard.press(action.key);
            await page.waitForTimeout(500);
          } else if (action.type === 'wait') {
            const ms = Math.max(0, Math.min(5000, action.ms || 1000));
            await page.waitForTimeout(ms);
          } else if (action.type === 'extract') {
            // Extract action - just continue to critique for analysis
          } else if (action.type === 'done') {
            step('Browser Agent signaled completion');
          }

          await capture(page);

          this.emit(job, {
            type: 'action_executed',
            payload: {
              action: `${action.type}: ${JSON.stringify(action).slice(0, 100)}`,
              result: 'executed',
              at: new Date().toISOString(),
            },
          });
        } catch (actionError: unknown) {
          const errorMsg = actionError instanceof Error ? actionError.message : 'Action failed';
          step(`Action failed: ${errorMsg}`);
          this.emit(job, {
            type: 'action_executed',
            payload: {
              action: `${action.type}`,
              result: `failed: ${errorMsg}`,
              at: new Date().toISOString(),
            },
          });
        }

        // Get page state after action
        await page.waitForTimeout(500);
        const pageStateAfter = await this.describePage(page);

        // PHASE 3: CRITIQUE AGENT - Evaluate results
        agentThinking('critique', 'Analyzing results and determining next action...');

        const critique = await this.callCritiqueAgent({
          user_goal: args.prompt,
          executed_step: currentStep,
          action_taken: browserResponse,
          page_state_before: pageStateBefore,
          page_state_after: pageStateAfter,
          remaining_steps: currentPlan.steps.slice(currentStepIndex + 1),
        });

        step(`Critique: ${critique.analysis}`);

        this.emit(job, {
          type: 'critique_result',
          payload: {
            status: critique.decision === 'task_complete' ? 'success' : critique.decision === 'continue_plan' ? 'continue' : 'replan',
            feedback: critique.analysis,
            at: new Date().toISOString(),
          },
        });

        // Act on critique decision
        if (critique.decision === 'task_complete') {
          step('✅ Task completed successfully!');
          if (critique.extracted_data) {
            step(`Extracted data: ${JSON.stringify(critique.extracted_data).slice(0, 200)}`);
          }
          job.status = 'completed';
          job.finished_at = new Date().toISOString();
          this.emit(job, {
            type: 'job_finished',
            payload: {
              job_id: job.id,
              finished_at: job.finished_at,
              status: job.status,
            },
          });
          job.subject.complete();
          return;
        } else if (critique.decision === 'continue_plan') {
          step('✓ Step successful, continuing to next step');
          currentStepIndex++;
        } else if (critique.decision === 'replan_needed') {
          if (replanCount >= maxReplanAttempts) {
            throw new Error(`Max replan attempts (${maxReplanAttempts}) reached`);
          }
          step('⚠️ Replanning needed');
          agentThinking('planner', 'Creating new plan based on feedback...');

          const newContext = await this.describePage(page);
          const newPlan = await this.callPlannerAgent({
            user_goal: args.prompt,
            current_context: JSON.stringify(newContext).slice(0, 500),
            previous_plan: currentPlan.steps,
            feedback: critique.recommendation,
          });

          this.emit(job, {
            type: 'plan_updated',
            payload: {
              steps: newPlan.steps.map((s) => `${s.step_number}. ${s.description}`),
              reason: critique.recommendation,
              at: new Date().toISOString(),
            },
          });

          currentPlan = newPlan;
          currentStepIndex = 0;
          replanCount++;
          step(`New plan created: ${newPlan.steps.length} steps`);
        } else if (critique.decision === 'action_failed') {
          step('⚠️ Action failed, retrying current step');
          // Stay on current step, it will retry in next iteration
        }
      }

      // If we exit loop without completion
      if (job.status !== 'completed') {
        throw new Error(`Max iterations (${args.max_iterations}) reached without task completion`);
      }
    } finally {
      clearInterval(interval);
      await context.close().catch(() => undefined);
      await job.browser?.close().catch(() => undefined);
    }
  }

  private async runAiWorkflow(
    job: JobInternal,
    args: { prompt: string; start_url?: string; headless: boolean; max_steps: number },
  ) {
    console.log('runAiWorkflow called with args:', args);
    const step = (message: string) => {
      job.last_step = message;
      this.emit(job, {
        type: 'step',
        payload: { message, at: new Date().toISOString() },
      });
    };

    const capture = async (page: Page) => {
      try {
        const buf = await page.screenshot({
          type: 'jpeg',
          quality: 60,
          fullPage: false,
        });
        const frame = {
          mime: 'image/jpeg' as const,
          base64: Buffer.from(buf).toString('base64'),
          at: new Date().toISOString(),
        };
        job.last_frame = frame;
        this.emit(job, { type: 'frame', payload: frame });
      } catch {
        // ignore capture errors
      }
    };

    step('Launching browser (AI mode)');
    job.browser = await chromium.launch({ headless: args.headless });
    const context = await job.browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();

    const interval = setInterval(() => {
      if (job.stop_requested) return;
      void capture(page);
    }, 700);

    try {
      if (args.start_url) {
        if (!this.isSafeHttpUrl(args.start_url)) {
          throw new BadRequestException('start_url must be http(s)');
        }
        step(`Navigating to ${args.start_url}`);
        await page.goto(args.start_url, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000); // Wait for dynamic content to load
        await capture(page);

        // Handle cookies automatically before AI takes over
        await this.handleCookiesModal(page);
        await capture(page);
      }

      for (let i = 0; i < args.max_steps; i++) {
        if (job.stop_requested) throw new Error('Job stopped');

        const observation = await this.describePage(page);
        step(`AI thinking (step ${i + 1}/${args.max_steps})`);
        console.log(`About to call AI for step ${i + 1}`);

        const ai = await this.callAiOnce({
          prompt: args.prompt,
          observation,
        }).catch((e: unknown) => {
          const msg = e instanceof Error ? e.message : 'AI call failed';
          console.log('AI call failed:', msg);
          throw new Error(msg);
        });

        const action = ai.action || {};
        const type = (action.type || '').toString();
        step(`AI action: ${type}`);

        if (type === 'done') {
          const result = (action.value || '').toString().slice(0, 500);
          if (result) step(`Result: ${result}`);
          step('Finished');
          job.status = 'completed';
          job.finished_at = new Date().toISOString();
          this.emit(job, {
            type: 'job_finished',
            payload: {
              job_id: job.id,
              finished_at: job.finished_at,
              status: job.status,
            },
          });
          job.subject.complete();
          return;
        }

        if (type === 'goto') {
          const url = (action.url || '').toString();
          if (!this.isSafeHttpUrl(url)) throw new Error('Blocked navigation: only http(s) URLs allowed');
          step(`Goto: ${url}`);
          await page.goto(url, { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(2000); // Wait for dynamic content
          await capture(page);
          continue;
        }

        if (type === 'click') {
          await this.clickByBestEffort(page, action.text, action.selector);
          await page.waitForTimeout(300);
          await capture(page);
          continue;
        }

        if (type === 'fill') {
          await this.fillByBestEffort(page, action.field, action.value, action.selector);
          await capture(page);
          continue;
        }

        if (type === 'press') {
          const key = (action.key || '').toString().slice(0, 40);
          if (!key) throw new Error('press requires key');
          await page.keyboard.press(key);
          await page.waitForTimeout(200);
          await capture(page);
          continue;
        }

        if (type === 'wait') {
          const ms = Math.max(0, Math.min(5000, Number(action.ms || 0)));
          await page.waitForTimeout(ms);
          await capture(page);
          continue;
        }

        throw new Error(`Unknown AI action type: ${type}`);
      }

      throw new Error(`Max steps reached (${args.max_steps}) without completing`);
    } finally {
      clearInterval(interval);
      await context.close().catch(() => undefined);
      await job.browser?.close().catch(() => undefined);
    }
  }
}


