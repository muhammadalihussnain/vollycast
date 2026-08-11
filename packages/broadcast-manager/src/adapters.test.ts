/**
 * Adapter tests — Task 4.1
 * Tests for YouTubeAdapter, FacebookAdapter, CustomAdapter.
 */

import { describe, it, expect } from 'vitest';
import { YouTubeAdapter } from './YouTubeAdapter.js';
import { FacebookAdapter } from './FacebookAdapter.js';
import { CustomAdapter } from './CustomAdapter.js';

describe('YouTubeAdapter', () => {
  const adapter = new YouTubeAdapter();

  it('has platform = youtube', () => {
    expect(adapter.platform).toBe('youtube');
  });

  it('builds correct RTMP URL with stream key', () => {
    const url = adapter.buildRtmpUrl('abc123-test-key');
    expect(url).toBe('rtmp://a.rtmp.youtube.com/live2/abc123-test-key');
  });

  it('URL starts with rtmp://', () => {
    const url = adapter.buildRtmpUrl('somekey');
    expect(url).toMatch(/^rtmp:\/\//);
  });

  it('has a display name that does not contain the stream key', () => {
    expect(adapter.displayName).toBe('YouTube Live');
    expect(adapter.displayName).not.toContain('abc123');
  });
});

describe('FacebookAdapter', () => {
  const adapter = new FacebookAdapter();

  it('has platform = facebook', () => {
    expect(adapter.platform).toBe('facebook');
  });

  it('builds correct RTMPS URL with stream key', () => {
    const url = adapter.buildRtmpUrl('fb-key-xyz');
    expect(url).toBe('rtmps://live-api-s.facebook.com:443/rtmp/fb-key-xyz');
  });

  it('URL starts with rtmps:// (Facebook uses TLS)', () => {
    const url = adapter.buildRtmpUrl('somekey');
    expect(url).toMatch(/^rtmps:\/\//);
  });

  it('has a display name that does not contain the stream key', () => {
    expect(adapter.displayName).toBe('Facebook Live');
  });
});

describe('CustomAdapter', () => {
  it('has platform = custom', () => {
    const adapter = new CustomAdapter('rtmp://myserver.com/live');
    expect(adapter.platform).toBe('custom');
  });

  it('appends stream key to base URL', () => {
    const adapter = new CustomAdapter('rtmp://myserver.com/live');
    expect(adapter.buildRtmpUrl('mykey')).toBe('rtmp://myserver.com/live/mykey');
  });

  it('returns base URL when stream key is empty', () => {
    const adapter = new CustomAdapter('rtmp://myserver.com/live');
    expect(adapter.buildRtmpUrl('')).toBe('rtmp://myserver.com/live');
  });

  it('uses custom display name when provided', () => {
    const adapter = new CustomAdapter('rtmp://myserver.com/live', 'My Server');
    expect(adapter.displayName).toBe('My Server');
  });

  it('uses default display name when not provided', () => {
    const adapter = new CustomAdapter('rtmp://myserver.com/live');
    expect(adapter.displayName).toBe('Custom RTMP');
  });
});
