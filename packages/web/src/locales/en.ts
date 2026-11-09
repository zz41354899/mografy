// English.
import type { Dict } from './zh.js';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export const en: Dict = {
  video: 'Video', present: 'Present', editorMode: 'Editor mode', export: 'Export', exporting: 'Exporting…', cancelling: 'Cancelling…', lastExport: 'Last export', exportFailed: 'Export failed', exportCancelled: 'Export cancelled',
  start: 'Start', exportHtml: 'Export HTML', live: 'Live', connecting: 'Connecting', reconnecting: 'Reconnecting', reconnectingDots: 'Reconnecting…', opening: 'Opening project…',
  language: 'Interface language', langOther: '繁中', langSwitch: '將介面切換為繁體中文',
  projects: 'Projects', showProjects: 'Show projects', hideProjects: 'Hide projects', slides: 'Slides', showSlides: 'Show slides', hideSlides: 'Hide slides',
  scene: 'Scene', effects: 'Effects', audio: 'Audio', inspector: 'Inspector',
  goStart: 'Go to start', goStartHelp: 'Start (Home)', prevFrame: 'Previous frame', prevFrameHelp: 'Previous frame (←)', play: 'Play', pause: 'Pause', playHelp: 'Play or pause (Space)', nextFrame: 'Next frame', nextFrameHelp: 'Next frame (→)', goEnd: 'Go to end', goEndHelp: 'End (End)',
  loop: 'Loop', loopHelp: 'Loop (L)', guides: 'Guides', guidesHelp: 'Show safe areas (G)', currentTime: 'Current time', timeline: 'Timeline', seconds: s => `${s} seconds`,
  addMusic: 'Add music in the Audio panel to see beats here', bpm: (bpm, per) => `${bpm} BPM, ${per} beats per bar`, loadingMusic: 'Loading music…', musicFailed: 'Music could not load',
  slideMark: (n, title, at) => `Slide ${n}: ${title} · stops at ${at}s`, slideMarkAria: (n, at) => `Slide ${n}, stops at ${at} seconds`, transition: 'Transition', transitionNamed: (n, a, b) => `${n}: ${a}–${b}s`, transitionN: i => `Transition ${i}`, reviewAt: t => `Review frame at ${t}s`,
  keyPlay: 'play', keyFrame: 'frame', keyBeat: 'beat', keySecond: 'second', keyLoop: 'loop', keyGuides: 'guides', keyProjects: 'projects', keyFull: 'full screen',
  pbSoundLabel: { loading: 'Loading music', locked: 'Turn on sound', on: 'Mute', muted: 'Unmute', error: 'Music could not load' },
  pbSoundText: { loading: 'Loading', locked: 'Sound off', on: 'Sound', muted: 'Muted', error: 'No sound' },
  pbCompiling: 'Compiling and test-rendering the scene…',

  zoomLabel: 'Preview zoom', zoomIn: 'Zoom in (+)', zoomOut: 'Zoom out (-)', zoomFit: 'Fit', fullscreen: 'Full screen (F)', exitFullscreen: 'Exit full screen (Esc)', resizeStage: 'Drag to resize the preview', resizeTimeline: 'Drag to resize the timeline, down to fold it away; double-click to restore', resizeProjects: 'Drag to resize the projects panel; double-click to restore', resizeInspector: 'Drag to resize the inspector; double-click to restore',

  apPresentHelp: 'Present full screen: → next, ← back, P speaker view, F full screen, Esc back to the editor',
  apHtmlHelp: 'Write one HTML file that presents offline, and download it',
  apLastExport: 'View last export', apActiveExport: 'View active export', apPublished: (time, reason) => `Published ${time} (${reason})`, apUpdated: v => `Updated to ${v}`,
  apNotApplied: "Your latest change didn't apply.", apStillPrevious: 'The player is still showing the previous version.', apNoVersion: 'There is no working version to show yet.', apFixBelow: 'Fix the file below, or ask Claude to fix it.', apStopped: 'The scene stopped while drawing.', apSettingsUpdated: 'Scene settings updated.', apCleared: 'Incompatible saved values were cleared:',
  apIssue: { removed: 'removed from the scene', 'type-changed': 'changed type', 'out-of-range': 'out of range' },
  apDismissSettings: 'Dismiss settings notice', apDismiss: 'Dismiss', apBlockedShort: "Built-in components can't be presented", apBlocked: "Built-in components can't be presented.", apBlockedHelp: 'They are ready-made references. Create your own project, or ask Claude to make one from this component, then switch to Present.',
  batch: 'Batch', batchExport: 'Batch export', batchHelp: 'Export several projects one after another', batchToGo: n => `Batch · ${n} to go`, batchToGoLabel: n => `Batch export, ${n} to go`,

  landscape169: 'Landscape 16:9', portrait916: 'Portrait 9:16', pvSquare: 'Square', pvLandscape: 'Landscape', pvPortrait: 'Portrait', pvFrame: f => `${f} frame preview`,
  close: 'Close', cancel: 'Cancel', settings: 'Settings', retry: 'Retry', auto: 'Auto', custom: 'Custom', on: 'On', off: 'Off',

  auMusic: 'Music', auAddTitle: 'Add a soundtrack', auAddHelp: 'Music plays with your animation and MP4/WebM exports.', auAdding: 'Adding…', auAdd: 'Add music', auMuted: 'Muted', auUploading: 'Uploading…', auReplace: 'Replace', auRemove: 'Remove', auVolume: 'Volume', auLocked: 'Click Play to hear your music.', auBeat: 'Beat sync', auBeatHelp: 'Align the timeline beat markers to your music.', auFirstBeat: 'First beat (s)', auPerBar: 'Beats per bar',

  fxTitle: 'Image effects', fxClear: 'Clear effects', fxHelp: 'Applied to your exports.', fxGlow: 'Glow', fxGrain: 'Grain', fxGlowHelp: 'Light around bright edges', fxGrainHelp: 'Film texture', fxAmount: n => `${n} amount`, fxReset: n => `Reset ${n}`, fxRemove: n => `Remove ${n.toLowerCase()}`, fxPreview: 'Frame preview', fxOriginal: 'Original', fxWith: 'With effects', fxPlaying: 'Playback shows the original. Pause to see effects.', fxPaused: 'Showing effects on the paused frame.', fxPreviewOnly: 'Preview only. Exports use your saved effects.', fxPause: 'Pause to preview', fxNotSaved: 'Not saved', fxSaving: 'Saving…', fxSaved: 'Saved automatically',

  frTitle: 'Frame review', frHelp: 'Create sheets of key frames to check the animation.', frMaking: 'Making sheets…', frCreate: 'Create review sheets',

  paReset: 'Reset', paResetHelp: "Back to the scene's default", subtitles: 'Subtitles', autoSave: 'Auto-save', askAiText: 'Ask AI to change other text.', colours: 'Colors', controls: 'Controls', sceneSettings: 'Scene settings', sceneEmpty: 'This scene has no adjustable settings. Ask AI to change its content.',

  newProject: 'New project', projectName: 'Project name', newProjectName: 'New project name', create: 'Create', creating: 'Creating…', openingShort: 'Opening…', savedIn: p => `Saved in ${p}`, needsFix: 'mografy.json needs fixing', openNow: 'Open now', readyMade: 'Ready-to-use animation', justNow: 'just now', minAgo: n => `${n} min ago`, hAgo: n => `${n} h ago`,
  groups: { component: 'Built-in components', recent: 'Recent', library: 'Projects folder', example: 'Examples' },

  slLoops: 'Loops', slGuessed: from => `Slides guessed from ${from === 'storyboard' ? 'the storyboard' : 'the picture'}. To set them exactly, ask Claude to “mark the shots for Present mode”.`, slFinding: "Finding this scene's shots…", slPlayback: 'Slide playback', slPrev: 'Previous slide', slPrevHelp: 'Previous slide (←)', slNext: 'Next slide', slNextHelp: 'Next slide (→)', slPlayInto: 'Play into this slide as the audience will see it (Space)', slMute: 'Mute', slNoMusic: 'This project has no music', slMutedHelp: 'Muted: the presentation plays without music', slMuteHelp: 'Mute the presentation music',
  prTitle: 'Presentation · Mografy', prError: 'The scene has an error. Fix it in the editor.',

  xpTitle: 'Export animation', xdBatch: 'Export several projects…', xdClose: 'Close export',
  stage: { Exporting: 'Exporting', Encoding: 'Encoding', Packaging: 'Packaging', Capturing: 'Capturing', Starting: 'Starting' },
  xjReady: 'Export ready', xjCancelling: 'Cancelling', xjVideo: 'Exported video', xjFramePreview: 'Export frame preview', xjFrames: 'frames', xjElapsed: 'Elapsed time', xjUnplayable: 'This browser cannot play the video here. The file is fine: open it in QuickTime, a phone or a video player, or export with the Share (H.264) encoder for this browser.', xjEncoder: e => `Encoder: ${e}.`, xjCancelExport: 'Cancel export', xjHideExport: 'Hide export', xjHideHelp: 'Continue exporting in the background', xjHide: 'Hide', xjDone: 'Done', xjDownload: 'Download', xjEditSettings: 'Edit settings', xjRetryExport: 'Retry export', xjStarting: 'Starting…', xjProgress: 'Export progress', xjViewExport: 'View export', xjView: 'View', xjFinalizing: 'Finalizing export', xjCapture: 'Frame capture', xjMascot: 'Export loading animation',

  xfVideo: 'Video', xfVp9: 'VP9 video', xfProres: 'ProRes master', xfWeb: 'Web animation', xfApp: 'App animation', xfOutput: 'Output format',
  xsPresets: {
    share: ['Share · H.264', 'Plays everywhere: every browser, Windows PCs, chat apps and social uploads. 8-bit, about twice the size of H.265 at the same quality.'],
    high: ['High quality · H.265 10-bit', 'Same quality in about half the file, 10-bit gradients. Plays in QuickTime, Safari, Chrome and Edge with hardware decoding, phones and social uploads; choose Share for Firefox or older PCs.'],
    fast: ['Fast high quality · hardware', 'H.265 10-bit from the graphics card (VideoToolbox on Mac; NVIDIA, Intel or AMD on Windows), encoded while frames are drawn. Several times faster; edges may differ a little. Falls back to software where no hardware encoder works.'],
  },
  xsSettings: f => `${f} settings`, xpOrientation: 'Orientation', xpOrientationOf: f => `${f} orientation`, xpResolution: 'Resolution', xsSizeNames: {},
  xpFit: 'Fit', xsFitContain: 'Fit entire scene', xsFitCover: 'Fill and crop', xsFitReflow: 'Adapt layout', xsReflowNote: 'Rearranges responsive scenes for the output canvas. Built-in components support landscape and portrait layouts.', xsContainNote: 'Keeps the entire scene centered. Extra space uses the scene background color.', xsCoverNote: 'Fills the output and crops the edges. The scene stays centered.',
  xpRate: 'Frame rate', xpQuality: 'Quality', xsDraft: 'Draft', xsStandard: 'Standard', xsHigh: 'High', xsEncoder: 'Encoder', xsTwoPass: c => `Two-pass · ${c}`, xsBitrateNote: 'Target bitrate from a lossless master: slower, for an exact file size.',
  xsMovNote: 'ProRes 422 HQ, 10-bit, with uncompressed audio: a master for editing in Final Cut, Premiere or DaVinci Resolve. Large files.', xsWebmNote: 'VP9 video with Opus audio. Constant quality keeps detail consistent; file size varies with the scene.', xsRasterNote: 'Embedded image frames preserve the Canvas scene. No audio or editable vector layers. Smaller sizes keep playback lighter.',
  xpAdvanced: 'Advanced settings', xpSamples: 'Motion samples', xpMixing: 'Color mixing', xpLinear: 'Linear light', xpWorkers: 'Parallel workers', xsShutter: 'Shutter', xsLongest: '360° · longest trails', xsFilm: '180° · film look', xsDither: 'Dither gradients', xpEncoding: 'Encoding', xsCrfMode: 'Constant quality · one-pass', xsBitrateMode: 'Target bitrate · two-pass', xsHardwareMode: 'Hardware encoder', xsHwQuality: 'Hardware quality', xsHwHelp: 'Higher keeps more detail in a larger file. 65 looks like H.265 CRF 14.', xpBitrate: 'Bitrate', xsBitrateHint: 'For example 12M or 8000k', xsCrfH265: 'Lower values keep more detail. H.264 scale: H.265 matches the look in a smaller file.', xsCrf: 'Lower values keep more detail.', xpSpeed: 'Encoder speed',
  xsSpeeds: { ultrafast: 'Ultrafast', veryfast: 'Very fast', fast: 'Fast', medium: 'Medium', slow: 'Slow' },
  xsIncludeAudio: 'Include audio', xsNoAudio: 'No audio track added.', xsSummary: (d, f) => `${d} seconds · ${f} frames`, xsExport: f => `Export ${f}`,

  films: n => plural(n, 'film'), bxSpecs: {}, bxOwn: 'Own', bxOwnSize: 'own size', bxEncoderShare: 'Share · H.264', bxEncoderHigh: 'High · H.265', bxEncoderFast: 'Fast · GPU',
  bxExportingOf: (i, n) => `Exporting · ${i} of ${n}`, bxFrame: (d, t) => `Frame ${d} / ${t}`, bxPercent: n => `${n} percent`, bxLeft: t => `~${t} left`, bxWaiting: f => `${f} waiting`, bxDone: f => `${f} done`, bxNothing: 'Nothing exported', bxFailed: n => `${n} failed. `, bxSaved: "Saved in each project's renders folder", bxQueue: 'Queue', bxClose: 'Close batch export', bxJobWaiting: 'Waiting', bxJobCancelled: 'Cancelled', bxJobFailed: 'Failed', bxCancelName: n => `Cancel ${n}`, bxEmpty: 'Nothing in the queue.', bxNote: 'You can close this and keep working.', bxToGo: f => `${f} to go`, bxCancelAll: 'Cancel all', bxClear: 'Clear', bxAddFilms: 'Add films', bxBackground: 'Run in background', bxPicker: 'Films to export', bxChoose: 'Choose films', bxLoading: 'Loading projects…', bxNoProjects: 'No projects yet. Create one first.', bxProjects: n => `${n} projects`, bxSelectNone: 'Select none', bxSelectAll: 'Select all', bxFormat: 'Format', bxQueueLink: n => n ? `Queue · ${n} to go` : 'Queue', bxLowMemory: 'Use less memory', bxIncludeMusic: 'Include music', bxAdvanced: 'Advanced', bxYoullGet: "You'll get", bxOutput: (n, f) => `${n} ${f} · saved in each project's renders folder`, bxMore: n => `+ ${n} more`, bxTick: 'Tick films on the left.', bxOneAfter: f => `${f}, one after another`, bxNone: 'No films selected', bxAdding: 'Adding…', bxExportFilms: f => `Export ${f ?? 'films'}`, bxProgress: 'Batch export progress', bxOf: (i, n) => `${i} of ${n}`, bxFrameLc: (d, t) => `frame ${d} / ${t}`, bxNext: 'Next: ', bxLast: 'Last one', bxOpenQueue: 'Open queue',
};
