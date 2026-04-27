import type { ProviderClient, ChatMessage } from '@solar-code/core';
import type { AgentManifest } from './manifests.js';

export interface AgentRunOptions {
  agent: AgentManifest;
  goal: string;
  context?: string;
  provider: ProviderClient;
  onChunk?: (text: string) => void;
}

export interface AgentRunResult {
  output: string;
  agentName: string;
}

export async function runAgent(opts: AgentRunOptions): Promise<AgentRunResult> {
  const { agent, goal, context, provider, onChunk } = opts;

  const systemPrompt = buildSystemPrompt(agent);
  const userMessage = context
    ? `Context:\n${context}\n\n---\n\nGoal: ${goal}`
    : `Goal: ${goal}`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  let output = '';

  await provider.stream(
    { model: agent.model, messages, stream: true },
    {
      onChunk: (text) => {
        output += text;
        onChunk?.(text);
      },
      onDone: (full) => {
        output = full;
      },
      onError: (err) => {
        throw err;
      },
    }
  );

  return { output, agentName: agent.name };
}

function buildSystemPrompt(agent: AgentManifest): string {
  return `You are the ${agent.name} agent.

Description: ${agent.description}

Your output contract: ${agent.outputContract}

Failure handling: ${agent.failureHandling}

Available tools (conceptual): ${agent.tools.join(', ')}

Be focused, thorough, and produce exactly what is described in your output contract.`;
}
