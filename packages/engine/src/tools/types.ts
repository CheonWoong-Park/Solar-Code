import type { ToolDefinition } from '@solar-code/core';

export type ToolPermission = 'read' | 'write' | 'execute';

export interface ToolExecutionContext {
  cwd: string;
}

export interface ToolResult {
  ok: boolean;
  output: string;
  error?: string;
}

export interface ToolExecutor {
  name: string;
  permission: ToolPermission;
  definition: ToolDefinition;
  describe(args: Record<string, unknown>): string;
  execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult>;
}

export interface AgentToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  rawArguments: string;
}
