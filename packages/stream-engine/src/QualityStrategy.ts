/**
 * QualityStrategy — Task 2.2
 *
 * Strategy pattern: each quality profile is a separate strategy that
 * produces FFmpeg arguments. Swap profiles at runtime without touching
 * the core transcoding logic.
 */

import { QUALITY_PROFILES } from '@vollycast/shared';
import type { QualityProfile } from '@vollycast/shared';

export interface TranscodeArgs {
  /** FFmpeg video codec arguments */
  readonly videoArgs: readonly string[];
  /** FFmpeg audio codec arguments */
  readonly audioArgs: readonly string[];
  /** FFmpeg output format arguments */
  readonly formatArgs: readonly string[];
}

export interface QualityStrategy {
  readonly profile: QualityProfile;
  buildArgs(): TranscodeArgs;
}

/** Keyframe interval multiplier — keyframe every N seconds worth of frames */
const KEYFRAME_INTERVAL_MULTIPLIER = 2;

/**
 * Builds FFmpeg -vf scale filter value from width and height.
 */
function scaleFilter(width: number, height: number): string {
  return `scale=${width}:${height}`;
}

/**
 * Factory — creates the correct QualityStrategy for a given profile name.
 */
export function createQualityStrategy(profile: QualityProfile): QualityStrategy {
  const config = QUALITY_PROFILES[profile];

  return {
    profile,
    buildArgs(): TranscodeArgs {
      return {
        videoArgs: [
          '-c:v', 'libx264',
          '-b:v', `${config.videoBitrateKbps}k`,
          '-preset', config.preset,
          '-vf', scaleFilter(config.width, config.height),
          '-r', String(config.frameRate),
          '-g', String(config.frameRate * KEYFRAME_INTERVAL_MULTIPLIER),
        ],
        audioArgs: [
          '-c:a', 'aac',
          '-b:a', `${config.audioBitrateKbps}k`,
          '-ar', '44100',
        ],
        formatArgs: [
          '-f', 'flv',
        ],
      };
    },
  };
}

/**
 * Assembles a full FFmpeg argument list from input URL, output URL, and strategy.
 */
export function buildFfmpegArgs(
  inputUrl: string,
  outputUrl: string,
  strategy: QualityStrategy,
): string[] {
  const { videoArgs, audioArgs, formatArgs } = strategy.buildArgs();
  return [
    '-re',
    '-i', inputUrl,
    ...videoArgs,
    ...audioArgs,
    ...formatArgs,
    outputUrl,
  ];
}
