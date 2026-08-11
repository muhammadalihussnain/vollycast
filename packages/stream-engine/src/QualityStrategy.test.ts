import { describe, it, expect } from 'vitest';
import { createQualityStrategy, buildFfmpegArgs } from './QualityStrategy.js';

describe('QualityStrategy', () => {
  const INPUT = 'rtmp://localhost/live/cam1';
  const OUTPUT = 'rtmp://localhost:1935/live/cam1-out';

  describe('createQualityStrategy', () => {
    it('creates a low quality strategy with correct profile name', () => {
      const s = createQualityStrategy('low');
      expect(s.profile).toBe('low');
    });

    it('creates a medium quality strategy with correct profile name', () => {
      const s = createQualityStrategy('medium');
      expect(s.profile).toBe('medium');
    });

    it('creates a high quality strategy with correct profile name', () => {
      const s = createQualityStrategy('high');
      expect(s.profile).toBe('high');
    });

    it('low strategy produces lower bitrate than medium', () => {
      const low = createQualityStrategy('low').buildArgs();
      const medium = createQualityStrategy('medium').buildArgs();
      const lowBitrateIdx = low.videoArgs.indexOf('-b:v') + 1;
      const medBitrateIdx = medium.videoArgs.indexOf('-b:v') + 1;
      const lowVal = parseInt(String(low.videoArgs[lowBitrateIdx]), 10);
      const medVal = parseInt(String(medium.videoArgs[medBitrateIdx]), 10);
      expect(lowVal).toBeLessThan(medVal);
    });

    it('high strategy produces higher bitrate than medium', () => {
      const medium = createQualityStrategy('medium').buildArgs();
      const high = createQualityStrategy('high').buildArgs();
      const medIdx = medium.videoArgs.indexOf('-b:v') + 1;
      const highIdx = high.videoArgs.indexOf('-b:v') + 1;
      const medVal = parseInt(String(medium.videoArgs[medIdx]), 10);
      const highVal = parseInt(String(high.videoArgs[highIdx]), 10);
      expect(highVal).toBeGreaterThan(medVal);
    });

    it('all strategies include libx264 video codec', () => {
      for (const profile of ['low', 'medium', 'high'] as const) {
        const args = createQualityStrategy(profile).buildArgs();
        expect(args.videoArgs).toContain('libx264');
      }
    });

    it('all strategies include aac audio codec', () => {
      for (const profile of ['low', 'medium', 'high'] as const) {
        const args = createQualityStrategy(profile).buildArgs();
        expect(args.audioArgs).toContain('aac');
      }
    });

    it('all strategies include flv output format', () => {
      for (const profile of ['low', 'medium', 'high'] as const) {
        const args = createQualityStrategy(profile).buildArgs();
        expect(args.formatArgs).toContain('flv');
      }
    });

    it('strategy includes scale filter with correct dimensions for low', () => {
      const args = createQualityStrategy('low').buildArgs();
      const vfIdx = args.videoArgs.indexOf('-vf') + 1;
      expect(String(args.videoArgs[vfIdx])).toContain('854');
      expect(String(args.videoArgs[vfIdx])).toContain('480');
    });
  });

  describe('buildFfmpegArgs', () => {
    it('starts with -re and -i flags', () => {
      const strategy = createQualityStrategy('medium');
      const args = buildFfmpegArgs(INPUT, OUTPUT, strategy);
      expect(args[0]).toBe('-re');
      expect(args[1]).toBe('-i');
      expect(args[2]).toBe(INPUT);
    });

    it('ends with the output URL', () => {
      const strategy = createQualityStrategy('medium');
      const args = buildFfmpegArgs(INPUT, OUTPUT, strategy);
      expect(args[args.length - 1]).toBe(OUTPUT);
    });

    it('contains all video, audio, and format args', () => {
      const strategy = createQualityStrategy('medium');
      const args = buildFfmpegArgs(INPUT, OUTPUT, strategy);
      expect(args).toContain('libx264');
      expect(args).toContain('aac');
      expect(args).toContain('flv');
    });

    it('produces different args for different profiles', () => {
      const lowArgs = buildFfmpegArgs(INPUT, OUTPUT, createQualityStrategy('low'));
      const highArgs = buildFfmpegArgs(INPUT, OUTPUT, createQualityStrategy('high'));
      expect(lowArgs).not.toEqual(highArgs);
    });
  });
});
