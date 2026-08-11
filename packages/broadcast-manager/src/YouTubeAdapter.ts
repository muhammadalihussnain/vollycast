/**
 * YouTubeAdapter — Task 4.1
 *
 * Adapter for YouTube Live RTMP streaming.
 * Builds push URL: rtmp://a.rtmp.youtube.com/live2/<stream-key>
 *
 * Design pattern: Adapter — one interface, platform-specific implementation.
 * Security: stream key is never logged.
 */

import { PLATFORM_RTMP_URLS } from '@vollycast/shared';
import type { PlatformType } from '@vollycast/shared';
import type { IPlatformAdapter } from './IPlatformAdapter.js';

export class YouTubeAdapter implements IPlatformAdapter {
  public readonly platform: PlatformType = 'youtube';
  public readonly displayName = 'YouTube Live';

  /**
   * Builds the full YouTube RTMP push URL.
   * Format: rtmp://a.rtmp.youtube.com/live2/<stream-key>
   */
  public buildRtmpUrl(streamKey: string): string {
    return `${PLATFORM_RTMP_URLS.youtube}/${streamKey}`;
  }
}
