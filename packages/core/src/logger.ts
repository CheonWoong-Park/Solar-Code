import { appendLog } from './state.js';
import { join } from 'path';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface Logger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
  debug(msg: string): void;
}

export function createLogger(omsDir?: string, name = 'oms'): Logger {
  const logFile = omsDir ? join(omsDir, 'logs', `${name}.log`) : null;

  function write(level: LogLevel, msg: string) {
    if (logFile) {
      appendLog(logFile, `[${level.toUpperCase()}] ${msg}`);
    }
  }

  return {
    info(msg) { write('info', msg); },
    warn(msg) { write('warn', msg); },
    error(msg) { write('error', msg); },
    debug(msg) {
      if (process.env['OMS_DEBUG']) write('debug', msg);
    },
  };
}

/** Redact any string value that looks like an API key. */
export function redactSecrets(text: string): string {
  return text
    .replace(/\bup_[A-Za-z0-9_-]{20,}/g, '[REDACTED_UPSTAGE_KEY]')
    .replace(/\bsk-[A-Za-z0-9_-]{20,}/g, '[REDACTED_API_KEY]')
    .replace(/\banthropic-[A-Za-z0-9_-]{20,}/g, '[REDACTED_ANTHROPIC_KEY]');
}
