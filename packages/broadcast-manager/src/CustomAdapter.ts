/**
 * CustomAdapter — Task 4.1
 *
 * Adapter for custom RTMP endpoints (any server).
 * The full RTMP URL is provided directly — stream key appended if supplied.
 */

import type { PlatformType } from '@vollycast/shared';
import type { IPlatformAdapter } from './IPlatformAdapter.js';

export class CustomAdapter implements IPlatformAdapter {
  public readonly platform: PlatformType = 'custom';
  public readonly displayName: string;
  private readonly rtmpBase: string;

  public constructor(rtmpBase: string, displayName = 'Custom RTMP') {
    this.rtmpBase = rtmpBase;
    this.displayName = displayName;
  }

  /**
   * Builds the RTMP push URL.
   * If a stream key is provided, appends it to the base URL.
   */
  public buildRtmpUrl(streamKey: string): string {
    if (streamKey.length === 0) return this.rtmpBase;
    return `${this.rtmpBase}/${streamKey}`;
  }
}
