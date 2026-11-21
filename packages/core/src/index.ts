// The public API of @mografy/core. Each area lives in its own module.
export * from './scene-meta.js';
export * from './export-settings.js';
export * from './project-schema.js';
export * from './scene-checks.js';
export * from './shot-stops.js';
export * from './requests.js';
export * from './parameters.js';
export * from './timing.js';
export * from './source-checks.js';
export * from './api.js';

export type * from './protocol.js';
export { sceneRuntimeKey } from './scene-inputs.js';
export { GUIDE, SKILL, SKILL_REFERENCES, sharedSkillFiles, obsoleteStoryboardFiles, projectGuide, isLegacyAgentFile } from './guide.js';
export type { MotionFrames } from './smoothness.js';
export { frameDiffs, smoothness, smoothnessReport, MOTION_LIMITS } from './smoothness.js';
export type { Smoothness, SmoothnessOptions, MotionEvent, MotionEventKind } from './smoothness.js';
