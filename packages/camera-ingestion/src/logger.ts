/**
 * Structured logger for the camera-ingestion module.
 * Uses pino — never use console.log in production code.
 */
import pino from 'pino';

const logger = pino({
  name: 'camera-ingestion',
  level: process.env['NODE_ENV'] === 'test' ? 'silent' : 'info',
});

export { logger };
