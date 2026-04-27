#!/usr/bin/env node
/**
 * @solar-code/mcp-server
 * Exposes Solar Code capabilities via the Model Context Protocol (MCP).
 *
 * Capabilities:
 *   oms_state_read       — read .oms/ state
 *   oms_state_write      — write .oms/ state
 *   oms_memory_search    — search .oms/memory/
 *   oms_plan_create      — create a plan via Solar
 *   oms_parse_document   — parse a document via Upstage
 *   oms_team_status      — get team session status
 *   oms_agent_list       — list available agents
 *
 * This server implements the MCP stdio transport (JSON-RPC 2.0 over stdin/stdout).
 * It does NOT require MCP for basic CLI usage.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import {
  getOmsDir,
  parseDocument,
  getLastTeamSession,
  getUpstageApiKey,
} from '@solar-code/core';
import { BUILT_IN_AGENTS } from '@solar-code/agents';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string };
}

const TOOLS = [
  {
    name: 'oms_state_read',
    description: 'Read a file from the .oms/ state directory',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path within .oms/' },
      },
      required: ['path'],
    },
  },
  {
    name: 'oms_state_write',
    description: 'Write a file to the .oms/ state directory',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path within .oms/' },
        content: { type: 'string', description: 'Content to write' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'oms_memory_search',
    description: 'Search .oms/memory/ files for a query string',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term' },
      },
      required: ['query'],
    },
  },
  {
    name: 'oms_plan_create',
    description: 'Create a plan using the Solar planner agent',
    inputSchema: {
      type: 'object',
      properties: {
        goal: { type: 'string', description: 'Planning goal' },
        model: { type: 'string', description: 'Model override (default: solar-pro3)' },
      },
      required: ['goal'],
    },
  },
  {
    name: 'oms_parse_document',
    description: 'Parse a document using Upstage Document Parse',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Path to document file' },
        outputFormat: { type: 'string', enum: ['markdown', 'html', 'text'] },
      },
      required: ['filePath'],
    },
  },
  {
    name: 'oms_team_status',
    description: 'Get current team session status',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'oms_agent_list',
    description: 'List available Solar Code agents',
    inputSchema: { type: 'object', properties: {} },
  },
];

async function handleTool(name: string, params: Record<string, unknown>): Promise<unknown> {
  const cwd = process.cwd();
  const omsDir = getOmsDir(cwd);

  switch (name) {
    case 'oms_state_read': {
      const path = join(omsDir, params['path'] as string);
      if (!path.startsWith(omsDir)) throw new Error('Path traversal not allowed');
      if (!existsSync(path)) return { error: 'File not found' };
      return { content: readFileSync(path, 'utf-8') };
    }
    case 'oms_state_write': {
      const path = join(omsDir, params['path'] as string);
      if (!path.startsWith(omsDir)) throw new Error('Path traversal not allowed');
      writeFileSync(path, params['content'] as string, 'utf-8');
      return { success: true };
    }
    case 'oms_memory_search': {
      const memDir = join(omsDir, 'memory');
      if (!existsSync(memDir)) return { results: [] };
      const query = (params['query'] as string).toLowerCase();
      const results: Array<{ file: string; excerpt: string }> = [];
      for (const file of readdirSync(memDir)) {
        const content = readFileSync(join(memDir, file), 'utf-8');
        if (content.toLowerCase().includes(query)) {
          const idx = content.toLowerCase().indexOf(query);
          results.push({ file, excerpt: content.slice(Math.max(0, idx - 50), idx + 100) });
        }
      }
      return { results };
    }
    case 'oms_parse_document': {
      const apiKey = getUpstageApiKey();
      if (!apiKey) return { error: 'UPSTAGE_API_KEY not set' };
      const result = await parseDocument({
        filePath: params['filePath'] as string,
        outputFormat: (params['outputFormat'] as 'markdown' | 'html' | 'text') ?? 'markdown',
        omsDir,
        apiKey,
      });
      return { content: result.content.slice(0, 5000), savedPath: result.savedPath };
    }
    case 'oms_team_status': {
      const session = getLastTeamSession(omsDir);
      return session ?? { status: 'no_active_session' };
    }
    case 'oms_agent_list': {
      return { agents: BUILT_IN_AGENTS.map(({ name: n, description }) => ({ name: n, description })) };
    }
    case 'oms_plan_create': {
      return { message: 'Use the oms CLI: oms plan <goal>', goal: params['goal'] };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function respond(res: JsonRpcResponse): void {
  process.stdout.write(JSON.stringify(res) + '\n');
}

async function main(): Promise<void> {
  process.stderr.write('[solar-code-mcp] Solar Code MCP server started\n');

  let buffer = '';

  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', async (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let req: JsonRpcRequest;
      try {
        req = JSON.parse(trimmed) as JsonRpcRequest;
      } catch {
        continue;
      }

      if (req.method === 'initialize') {
        respond({
          jsonrpc: '2.0',
          id: req.id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: { name: 'solar-code', version: '0.1.0' },
          },
        });
      } else if (req.method === 'tools/list') {
        respond({ jsonrpc: '2.0', id: req.id, result: { tools: TOOLS } });
      } else if (req.method === 'tools/call') {
        const p = req.params as { name: string; arguments: Record<string, unknown> };
        try {
          const result = await handleTool(p.name, p.arguments ?? {});
          respond({
            jsonrpc: '2.0',
            id: req.id,
            result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] },
          });
        } catch (err) {
          respond({
            jsonrpc: '2.0',
            id: req.id,
            error: { code: -32603, message: (err as Error).message },
          });
        }
      } else {
        respond({
          jsonrpc: '2.0',
          id: req.id,
          error: { code: -32601, message: `Method not found: ${req.method}` },
        });
      }
    }
  });

  process.stdin.on('end', () => {
    process.stderr.write('[solar-code-mcp] stdin closed, shutting down\n');
    process.exit(0);
  });
}

main().catch((err) => {
  process.stderr.write(`[solar-code-mcp] Fatal: ${err}\n`);
  process.exit(1);
});
