/**
 * StreamKeyStore — Task 4.2
 *
 * Encrypts and decrypts stream keys at rest using AES-256-GCM.
 *
 * Security guarantees:
 * - Keys are never stored in plain text
 * - Keys are never logged (callers must not log the return value of decrypt())
 * - A random 12-byte IV is generated per encryption — same key encrypted twice
 *   produces different ciphertext
 * - GCM auth tag (16 bytes) prevents ciphertext tampering
 *
 * Storage format (all hex, colon-separated):
 *   <iv-hex>:<authTag-hex>:<ciphertext-hex>
 *
 * The encryption key is a 32-byte (256-bit) secret passed at construction.
 * Load it from an environment variable — never hard-code it.
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto';

/** AES-GCM IV length in bytes */
const IV_LENGTH_BYTES = 12;

/** AES-GCM auth tag length in bytes */
const AUTH_TAG_LENGTH_BYTES = 16;

/** Expected encryption key length in bytes (256 bits) */
const KEY_LENGTH_BYTES = 32;

/** Separator used in stored format */
const STORED_SEPARATOR = ':';

/** Number of parts in stored format: iv:authTag:ciphertext */
const STORED_PARTS_COUNT = 3;

/** Bits per byte — used to compute key size description */
const BITS_PER_BYTE = 8;

export class StreamKeyStore {
  private readonly key: Buffer;

  /**
   * @param encryptionKey - 32-byte (256-bit) hex string or Buffer.
   *   Load from environment: process.env['STREAM_KEY_SECRET']
   *   Generate a key: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   */
  public constructor(encryptionKey: string | Buffer) {
    const keyBuffer =
      typeof encryptionKey === 'string'
        ? Buffer.from(encryptionKey, 'hex')
        : encryptionKey;

    if (keyBuffer.length !== KEY_LENGTH_BYTES) {
      throw new Error(
        `Encryption key must be ${String(KEY_LENGTH_BYTES)} bytes (${String(KEY_LENGTH_BYTES * BITS_PER_BYTE)} bits). Got ${String(keyBuffer.length)} bytes.`,
      );
    }

    this.key = keyBuffer;
  }

  /**
   * Encrypt a stream key.
   * Returns a storable string — safe to persist in a database or .env file.
   * Never log the input streamKey.
   *
   * @param streamKey - plain-text stream key from YouTube/Facebook
   * @returns encrypted string in format: iv:authTag:ciphertext (all hex)
   */
  public encrypt(streamKey: string): string {
    const iv = randomBytes(IV_LENGTH_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);

    const encrypted = Buffer.concat([
      cipher.update(streamKey, 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return [
      iv.toString('hex'),
      authTag.toString('hex'),
      encrypted.toString('hex'),
    ].join(STORED_SEPARATOR);
  }

  /**
   * Decrypt a stored encrypted stream key.
   * Never log the return value.
   *
   * @param stored - string previously returned by encrypt()
   * @returns plain-text stream key
   * @throws if the stored string is malformed or tampered with
   */
  public decrypt(stored: string): string {
    const parts = stored.split(STORED_SEPARATOR);

    if (parts.length !== STORED_PARTS_COUNT) {
      throw new Error('Invalid encrypted key format');
    }

    const [ivHex, authTagHex, ciphertextHex] = parts as [string, string, string];

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');

    if (iv.length !== IV_LENGTH_BYTES) {
      throw new Error('Invalid IV length in stored key');
    }

    if (authTag.length !== AUTH_TAG_LENGTH_BYTES) {
      throw new Error('Invalid auth tag length in stored key');
    }

    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }
}
