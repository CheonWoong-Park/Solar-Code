import { describe, it, expect } from 'vitest';
import { parseArgs } from '../../packages/cli/src/args.js';

describe('parseArgs', () => {
  it('returns default command with no args', () => {
    const result = parseArgs([]);
    expect(result.command).toBe('default');
    expect(result.args).toEqual([]);
    expect(result.flags).toEqual({});
  });

  it('parses --version flag', () => {
    expect(parseArgs(['--version']).command).toBe('version');
    expect(parseArgs(['-v']).command).toBe('version');
  });

  it('parses --help flag', () => {
    expect(parseArgs(['--help']).command).toBe('help');
    expect(parseArgs(['-h']).command).toBe('help');
  });

  it('parses known commands', () => {
    expect(parseArgs(['setup']).command).toBe('setup');
    expect(parseArgs(['doctor']).command).toBe('doctor');
    expect(parseArgs(['chat']).command).toBe('chat');
    expect(parseArgs(['code']).command).toBe('code');
    expect(parseArgs(['plan']).command).toBe('plan');
    expect(parseArgs(['review']).command).toBe('review');
    expect(parseArgs(['parse']).command).toBe('parse');
    expect(parseArgs(['team']).command).toBe('team');
    expect(parseArgs(['login']).command).toBe('login');
    expect(parseArgs(['logout']).command).toBe('logout');
    expect(parseArgs(['uninstall']).command).toBe('uninstall');
  });

  it('parses command with positional args', () => {
    const result = parseArgs(['chat', 'hello world']);
    expect(result.command).toBe('chat');
    expect(result.args).toEqual(['hello world']);
  });

  it('parses flags with values', () => {
    const result = parseArgs(['chat', '--model', 'solar-pro3']);
    expect(result.flags['model']).toBe('solar-pro3');
  });

  it('parses boolean flags', () => {
    const result = parseArgs(['tdd', '--implement']);
    expect(result.flags['implement']).toBe(true);
  });

  it('keeps args after boolean flags', () => {
    const result = parseArgs(['code', '--yes', '파일 목록 보여줘']);
    expect(result.flags['yes']).toBe(true);
    expect(result.args).toEqual(['파일 목록 보여줘']);
  });

  it('keeps args after short boolean flags', () => {
    const result = parseArgs(['code', '-y', '파일 목록 보여줘']);
    expect(result.flags['y']).toBe(true);
    expect(result.args).toEqual(['파일 목록 보여줘']);
  });

  it('parses --ask flag', () => {
    const result = parseArgs(['parse', './file.pdf', '--ask', '요약해줘']);
    expect(result.command).toBe('parse');
    expect(result.args[0]).toBe('./file.pdf');
    expect(result.flags['ask']).toBe('요약해줘');
  });

  it('treats unknown first token as default command', () => {
    const result = parseArgs(['my-prompt']);
    expect(result.command).toBe('default');
    expect(result.args).toContain('my-prompt');
  });
});
