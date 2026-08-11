/**
 * IPlatformAdapter — Task 4.1
 *
 * Interface for all platform adapters (Adapter pattern).
 * Each platform adapter knows how to build the full RTMP push URL
 * from a decrypted stream key.
 *
 * Adding a new platform = implementing this interface. No other code changes.
 */

import type { PlatformType } from '@vollycast/shared';

export interface IPlatformAdapter {
  /** The platform this adapter handles */
  readonly platform: PlatformType;

  /**
   * Build the full RTMP URL to push the stream to.
   * The stream key is passed in decrypted — never log it.
   * @param streamKey - decrypted stream key
   * @returns full RTMP URL including stream key
   */
  buildRtmpUrl(streamKey: string): string;

  /**
   * Human-readable name for logging (must not include the stream key).
   */
  readonly displayName: string;
}
