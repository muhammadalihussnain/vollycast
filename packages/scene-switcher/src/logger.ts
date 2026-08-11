type LogLevel = 'info' | 'warn' | 'error' | 'debug';
interface LogFields { [key: string]: unknown; }
const isSilent = process.env['NODE_ENV'] === 'test';
function log(level: LogLevel, fields: LogFields, message: string): void {
  if (isSilent) return;
  const entry = JSON.stringify({ level, name: 'scene-switcher', ...fields, msg: message });
  if (level === 'error' || level === 'warn') { process.stderr.write(entry + '\n'); }
  else { process.stdout.write(entry + '\n'); }
}
export const logger = {
  info:  (fields: LogFields, msg: string): void => log('info',  fields, msg),
  warn:  (fields: LogFields, msg: string): void => log('warn',  fields, msg),
  error: (fields: LogFields, msg: string): void => log('error', fields, msg),
  debug: (fields: LogFields, msg: string): void => log('debug', fields, msg),
};
