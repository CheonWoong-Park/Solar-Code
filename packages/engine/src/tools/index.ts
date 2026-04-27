import { bashTool } from './bash.js';
import { editFileTool } from './edit-file.js';
import { globTool } from './glob.js';
import { grepTool } from './grep.js';
import { listFilesTool } from './list-files.js';
import { readFileTool } from './read-file.js';
import { writeFileTool } from './write-file.js';
import type { ToolDefinition } from '@solar-code/core';
import type { AgentToolCall, ToolExecutionContext, ToolExecutor, ToolResult } from './types.js';

export const toolExecutors: ToolExecutor[] = [
  bashTool,
  readFileTool,
  writeFileTool,
  editFileTool,
  globTool,
  grepTool,
  listFilesTool,
];

const toolMap = new Map(toolExecutors.map((tool) => [tool.name, tool]));

export function getToolDefinitions(): ToolDefinition[] {
  return toolExecutors.map((tool) => tool.definition);
}

export function getToolExecutor(name: string): ToolExecutor | undefined {
  return toolMap.get(name);
}

export async function executeToolCall(call: AgentToolCall, context: ToolExecutionContext): Promise<ToolResult> {
  const executor = getToolExecutor(call.name);
  if (!executor) return { ok: false, output: '', error: `Unknown tool: ${call.name}` };
  try {
    return await executor.execute(call.arguments, context);
  } catch (err) {
    return { ok: false, output: '', error: err instanceof Error ? err.message : String(err) };
  }
}

export type { AgentToolCall, ToolExecutor, ToolPermission, ToolResult } from './types.js';
