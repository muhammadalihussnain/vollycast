/**
 * StreamKeyStore tests — Task 4.2
 * Tests for AES-256-GCM stream key encryption/decryption.
 */

import { describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { StreamKeyStore } from './StreamKeyStore.js';

/** Generate a valid 32-byte hex key for testing */
function makeKey(): string {
  return randomBytes(32).toString('hex');
}

describe('StreamKeyStore', () => {
  describe('constructor', () => {
    it('accepts a valid 32-byte hex key string', () => {
      expect(() => new StreamKeyStore(makeKey())).not.toThrow();
    });

    it('accepts a Buffer key', () => {
      const keyBuffer = randomBytes(32);
      expect(() => new StreamKeyStore(keyBuffer)).not.toThrow();
    });

    it('throws for a key that is too short', () => {
      const shortKey = randomBytes(16).toString('hex');
      expect(() => new StreamKeyStore(shortKey)).toThrow('32 bytes');
    });

    it('throws for a key that is too long', () => {
      const longKey = randomBytes(64).toString('hex');
      expect(() => new StreamKeyStore(longKey)).toThrow('32 bytes');
    });
  });

  describe('encrypt', () => {
    it('returns a non-empty string', () => {
      const store = new StreamKeyStore(makeKey());
      const encrypted = store.encrypt('my-stream-key');
      expect(encrypted).toBeTruthy();
      expect(typeof encrypted).toBe('string');
    });

    it('returns a colon-separated string with 3 parts (iv:authTag:ciphertext)', () => {
      const store = new StreamKeyStore(makeKey());
      const encrypted = store.encrypt('my-stream-key');
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3);
    });

    it('does not contain the plain-text key in the output', () => {
      const store = new StreamKeyStore(makeKey());
      const plainKey = 'super-secret-stream-key-1234';
      const encrypted = store.encrypt(plainKey);
      expect(encrypted).not.toContain(plainKey);
    });

    it('produces different ciphertext each time (random IV)', () => {
      const store = new StreamKeyStore(makeKey());
      const enc1 = store.encrypt('same-key');
      const enc2 = store.encrypt('same-key');
      expect(enc1).not.toBe(enc2);
    });
  });

  describe('decrypt', () => {
    it('round-trips a stream key correctly', () => {
      const store = new StreamKeyStore(makeKey());
      const original = 'abcd-1234-efgh-5678';
      const encrypted = store.encrypt(original);
      const decrypted = store.decrypt(encrypted);
      expect(decrypted).toBe(original);
    });

    it('round-trips keys with special characters', () => {
      const store = new StreamKeyStore(makeKey());
      const original = 'key-with-special!@#$%^&*()_+-=';
      expect(store.decrypt(store.encrypt(original))).toBe(original);
    });

    it('throws for malformed stored string', () => {
      const store = new StreamKeyStore(makeKey());
      expect(() => store.decrypt('notvalidformat')).toThrow('Invalid encrypted key format');
    });

    it('throws when tampered ciphertext is decrypted (GCM auth tag check)', () => {
      const store = new StreamKeyStore(makeKey());
      const encrypted = store.encrypt('original-key');
      const parts = encrypted.split(':');
      // Tamper with the ciphertext
      parts[2] = 'deadbeef';
      expect(() => store.decrypt(parts.join(':'))).toThrow();
    });

    it('throws with wrong key', () => {
      const store1 = new StreamKeyStore(makeKey());
      const store2 = new StreamKeyStore(makeKey());
      const encrypted = store1.encrypt('some-key');
      expect(() => store2.decrypt(encrypted)).toThrow();
    });

    it('throws when IV hex decodes to wrong length', () => {
      const store = new StreamKeyStore(makeKey());
      // Build a stored string with a short IV (less than 12 bytes)
      const shortIvHex = Buffer.alloc(8).toString('hex'); // 8 bytes, not 12
      const authTagHex = Buffer.alloc(16).toString('hex');
      const ciphertextHex = Buffer.alloc(8).toString('hex');
      expect(() =>
        store.decrypt(`${shortIvHex}:${authTagHex}:${ciphertextHex}`),
      ).toThrow('Invalid IV length');
    });

    it('throws when auth tag hex decodes to wrong length', () => {
      const store = new StreamKeyStore(makeKey());
      // Build a stored string with a short auth tag (less than 16 bytes)
      const ivHex = Buffer.alloc(12).toString('hex'); // correct 12 bytes
      const shortAuthTagHex = Buffer.alloc(8).toString('hex'); // 8 bytes, not 16
      const ciphertextHex = Buffer.alloc(8).toString('hex');
      expect(() =>
        store.decrypt(`${ivHex}:${shortAuthTagHex}:${ciphertextHex}`),
      ).toThrow('Invalid auth tag length');
    });
  });
});
