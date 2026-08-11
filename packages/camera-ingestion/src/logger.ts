/**
 * Structured logger for the camera-ingestion module.
 * Wraps console methods with log-level control.
 * Silent in test environment — no noise during test runs.
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogFields {
  [key: string]: unknown;
}

const isSilent = process.env['NODE_ENV'] === 'test';

function log(level: LogLevel, fields: LogFields, message: string): void {
  if (isSilent) return;
  const entry = JSON.stringify({ level, name: 'camera-ingestion', ...fields, msg: message });
  if (level === 'error' || level === 'warn') {
    process.stderr.write(entry + '\n');
  } else {
    process.stdout.write(entry + '\n');
  }
}

export const logger = {
  info: (fields: LogFields, message: string): void => log('info', fields, message),
  warn: (fields: LogFields, message: string): void => log('warn', fields, message),
  error: (fields: LogFields, message: string): void => log('error', fields, message),
  debug: (fields: LogFields, message: string): void => log('debug', fields, message),
};
