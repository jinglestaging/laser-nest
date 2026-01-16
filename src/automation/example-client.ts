/**
 * Three-Agent Browser Automation Client Example
 *
 * This file demonstrates how to use the three-agent system programmatically
 * from a TypeScript/JavaScript application.
 */

interface AutomationJob {
  job_id: string;
  status: 'running' | 'completed' | 'failed' | 'stopped';
  started_at: string;
  finished_at: string | null;
  url: string;
  query: string;
  last_step: string | null;
  error: string | null;
  last_frame: { mime: string; at: string } | null;
}

interface AutomationEvent {
  type: string;
  payload: any;
}

class ThreeAgentAutomationClient {
  constructor(private baseUrl: string = 'http://localhost:3000') {}

  /**
   * Start a new three-agent automation job
   */
  async startJob(params: {
    prompt: string;
    start_url?: string;
    headless?: boolean;
    max_steps?: number;
  }): Promise<AutomationJob> {
    const response = await fetch(`${this.baseUrl}/automation/three-agent-run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`Failed to start job: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get current status of a job
   */
  async getStatus(jobId: string): Promise<AutomationJob> {
    const response = await fetch(`${this.baseUrl}/automation/status/${jobId}`);

    if (!response.ok) {
      throw new Error(`Failed to get status: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Stop a running job
   */
  async stopJob(jobId: string): Promise<AutomationJob> {
    const response = await fetch(`${this.baseUrl}/automation/stop/${jobId}`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Failed to stop job: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Stream real-time events from a job using Server-Sent Events
   */
  streamEvents(
    jobId: string,
    callbacks: {
      onAgentThinking?: (agent: string, message: string) => void;
      onPlanCreated?: (steps: string[]) => void;
      onPlanUpdated?: (steps: string[], reason: string) => void;
      onStep?: (message: string) => void;
      onActionExecuted?: (action: string, result: string) => void;
      onCritiqueResult?: (status: string, feedback: string) => void;
      onFrame?: (base64Image: string, mime: string) => void;
      onJobFinished?: (status: string) => void;
      onJobFailed?: (error: string) => void;
      onError?: (error: Error) => void;
    },
  ): EventSource {
    const eventSource = new EventSource(
      `${this.baseUrl}/automation/stream/${jobId}`,
    );

    eventSource.addEventListener('agent_thinking', (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      callbacks.onAgentThinking?.(data.payload.agent, data.payload.message);
    });

    eventSource.addEventListener('plan_created', (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      callbacks.onPlanCreated?.(data.payload.steps);
    });

    eventSource.addEventListener('plan_updated', (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      callbacks.onPlanUpdated?.(data.payload.steps, data.payload.reason);
    });

    eventSource.addEventListener('step', (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      callbacks.onStep?.(data.payload.message);
    });

    eventSource.addEventListener('action_executed', (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      callbacks.onActionExecuted?.(data.payload.action, data.payload.result);
    });

    eventSource.addEventListener('critique_result', (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      callbacks.onCritiqueResult?.(data.payload.status, data.payload.feedback);
    });

    eventSource.addEventListener('frame', (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      callbacks.onFrame?.(data.payload.base64, data.payload.mime);
    });

    eventSource.addEventListener('job_finished', (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      callbacks.onJobFinished?.(data.payload.status);
      eventSource.close();
    });

    eventSource.addEventListener('job_failed', (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      callbacks.onJobFailed?.(data.payload.error);
      eventSource.close();
    });

    eventSource.onerror = (error) => {
      callbacks.onError?.(new Error('EventSource error'));
      eventSource.close();
    };

    return eventSource;
  }

  /**
   * Wait for job to complete (Promise-based)
   */
  async waitForCompletion(
    jobId: string,
    options: {
      pollInterval?: number;
      timeout?: number;
      onProgress?: (job: AutomationJob) => void;
    } = {},
  ): Promise<AutomationJob> {
    const { pollInterval = 1000, timeout = 300000, onProgress } = options;
    const startTime = Date.now();

    while (true) {
      const job = await this.getStatus(jobId);
      onProgress?.(job);

      if (job.status === 'completed') {
        return job;
      }

      if (job.status === 'failed') {
        throw new Error(`Job failed: ${job.error}`);
      }

      if (job.status === 'stopped') {
        throw new Error('Job was stopped');
      }

      if (Date.now() - startTime > timeout) {
        throw new Error('Job timeout');
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }
}

// ============================================================================
// EXAMPLE USAGE
// ============================================================================

// Example 1: Simple usage with streaming
async function example1_SimpleStreaming() {
  const client = new ThreeAgentAutomationClient();

  // Start job
  const job = await client.startJob({
    prompt: 'Search for TypeScript tutorials on Google',
    start_url: 'https://www.google.com',
    headless: true,
  });

  console.log(`Job started: ${job.job_id}`);

  // Stream events
  client.streamEvents(job.job_id, {
    onAgentThinking: (agent, message) => {
      console.log(`🧠 [${agent.toUpperCase()}] ${message}`);
    },
    onPlanCreated: (steps) => {
      console.log('📋 Plan created:');
      steps.forEach((step) => console.log(`   ${step}`));
    },
    onActionExecuted: (action, result) => {
      console.log(`✓ Action: ${action} → ${result}`);
    },
    onJobFinished: (status) => {
      console.log(`✅ Job completed with status: ${status}`);
    },
    onJobFailed: (error) => {
      console.error(`❌ Job failed: ${error}`);
    },
  });
}

// Example 2: Wait for completion with polling
async function example2_WaitForCompletion() {
  const client = new ThreeAgentAutomationClient();

  const job = await client.startJob({
    prompt: 'Extract top 5 Hacker News post titles',
    start_url: 'https://news.ycombinator.com',
    headless: true,
  });

  console.log(`Job started: ${job.job_id}`);

  try {
    const completedJob = await client.waitForCompletion(job.job_id, {
      pollInterval: 2000,
      timeout: 120000,
      onProgress: (job) => {
        console.log(`Status: ${job.status}, Last step: ${job.last_step}`);
      },
    });

    console.log('Job completed:', completedJob);
  } catch (error) {
    console.error('Job failed:', error);
  }
}

// Example 3: Display screenshots in real-time
async function example3_RealTimeScreenshots() {
  const client = new ThreeAgentAutomationClient();

  const job = await client.startJob({
    prompt: 'Search for weather in New York',
    start_url: 'https://www.google.com',
    headless: true,
  });

  client.streamEvents(job.job_id, {
    onFrame: (base64Image, mime) => {
      // In a browser environment, you could display this
      console.log(
        `Screenshot received (${mime}): ${base64Image.substring(0, 50)}...`,
      );

      // Browser example:
      // const img = document.createElement('img');
      // img.src = `data:${mime};base64,${base64Image}`;
      // document.body.appendChild(img);
    },
    onJobFinished: () => {
      console.log('Job completed!');
    },
  });
}

// Example 4: Advanced usage with retry logic
async function example4_AdvancedWithRetry() {
  const client = new ThreeAgentAutomationClient();
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxRetries}`);

      const job = await client.startJob({
        prompt: 'Find the price of the latest iPhone on Apple website',
        start_url: 'https://www.apple.com',
        headless: true,
        max_steps: 20,
      });

      const result = await client.waitForCompletion(job.job_id, {
        timeout: 180000,
      });

      console.log('Success!', result);
      return result;
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error);

      if (attempt === maxRetries) {
        throw new Error('All retry attempts failed');
      }

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

// Example 5: Stop a running job
async function example5_StopJob() {
  const client = new ThreeAgentAutomationClient();

  const job = await client.startJob({
    prompt: 'This is a long running task...',
    start_url: 'https://www.google.com',
  });

  console.log(`Job started: ${job.job_id}`);

  // Stop after 10 seconds
  setTimeout(async () => {
    console.log('Stopping job...');
    const stoppedJob = await client.stopJob(job.job_id);
    console.log('Job stopped:', stoppedJob);
  }, 10000);
}

// Example 6: Multiple jobs sequentially
async function example6_MultipleJobs() {
  const client = new ThreeAgentAutomationClient();

  const tasks = [
    {
      prompt: 'Search for "AI news" and get first result',
      start_url: 'https://www.google.com',
    },
    {
      prompt: 'Go to Hacker News and get top story title',
      start_url: 'https://news.ycombinator.com',
    },
    {
      prompt: 'Search Wikipedia for "TypeScript"',
      start_url: 'https://www.wikipedia.org',
    },
  ];

  const results: AutomationJob[] = [];

  for (const task of tasks) {
    console.log(`\n🚀 Starting: ${task.prompt}`);

    const job = await client.startJob({
      ...task,
      headless: true,
    });

    const result = await client.waitForCompletion(job.job_id, {
      onProgress: (job) => {
        console.log(`  ⚙️  ${job.last_step || 'Processing...'}`);
      },
    });

    results.push(result);
    console.log(`✅ Completed: ${task.prompt}`);
  }

  return results;
}

// ============================================================================
// Export for use in other files
// ============================================================================

export { ThreeAgentAutomationClient };
export type { AutomationJob, AutomationEvent };

// ============================================================================
// Run examples (uncomment to test)
// ============================================================================

/*
// Run in Node.js environment:
if (require.main === module) {
  example1_SimpleStreaming().catch(console.error);
  // example2_WaitForCompletion().catch(console.error);
  // example3_RealTimeScreenshots().catch(console.error);
  // example4_AdvancedWithRetry().catch(console.error);
  // example5_StopJob().catch(console.error);
  // example6_MultipleJobs().catch(console.error);
}
*/
