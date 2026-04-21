/**
 * Audio-tag sanitisers.
 *
 * The LLM is prompted to emit ElevenLabs-v3-style inline delivery cues
 * (`[shouting]`, `[dry]`, `[breathless]`) so it can shape the line for
 * future v3 rendering. v3 understands those tags and drops them from
 * the output; `eleven_turbo_v2_5` (current default) reads them aloud
 * verbatim ("bracket, dry, bracket") and they also look like noise on
 * the HUD. Strip them before both TTS input and on-screen display.
 */

// One leading tag like [shouting, breathless] — optionally followed by
// punctuation. Also catches interior tags that occasionally slip through.
const TAG_RE = /\[[^[\]\n]{1,80}\]/g;

export function stripAudioTags(text: string): string {
  return text.replace(TAG_RE, "").replace(/\s{2,}/g, " ").replace(/^\s+|\s+$/g, "");
}
