/**
 * FacebookAdapter — Task 4.1
 *
 * Adapter for Facebook Live RTMP streaming.
 * Builds push URL: rtmps://live-api-s.facebook.com:443/rtmp/<stream-key>
 *
 * Note: Facebook uses RTMPS (TLS) — FFmpeg supports this natively.
 * Security: stream key is never logged.
 */

import { PLATFORM_RTMP_URLS } from '@vollycast/shared';
import type { PlatformType } from '@vollycast/shared';
import type { IPlatformAdapter } from './IPlatformAdapter.js';

export class FacebookAdapter implements IPlatformAdapter {
  public readonly platform: PlatformType = 'facebook';
  public readonly displayName = 'Facebook Live';

  /**
   * Builds the full Facebook RTMP push URL.
   * Format: rtmps://live-api-s.facebook.com:443/rtmp/<stream-key>
   */
  public buildRtmpUrl(streamKey: string): string {
    return `${PLATFORM_RTMP_URLS.facebook}/${streamKey}`;
  }
}
