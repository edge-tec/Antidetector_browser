// ──────────────────────────────────────────────────────────────────
// AntiProfiles — SpeechSynthesis Voices Consistency Script Builder
// Returns OS-appropriate speech voices instead of leaking host OS voices
// ──────────────────────────────────────────────────────────────────

import { NavigatorFingerprint, LocaleFingerprint } from '../../../fingerprint/types'

interface SyntheticVoice {
  name: string
  lang: string
  voiceURI: string
  localService: boolean
  default: boolean
}

function getVoicesForOS(osFamily: 'windows' | 'macos' | 'linux' | 'android' | 'ios', primaryLang: string): SyntheticVoice[] {
  const lang = primaryLang || 'en-US'
  switch (osFamily) {
    case 'windows':
      return [
        { name: 'Microsoft David - English (United States)', lang: 'en-US', voiceURI: 'Microsoft David - English (United States)', localService: true, default: lang.startsWith('en') },
        { name: 'Microsoft Zira - English (United States)', lang: 'en-US', voiceURI: 'Microsoft Zira - English (United States)', localService: true, default: false },
        { name: 'Microsoft Mark - English (United States)', lang: 'en-US', voiceURI: 'Microsoft Mark - English (United States)', localService: true, default: false },
        { name: 'Google US English', lang: 'en-US', voiceURI: 'Google US English', localService: false, default: false },
        { name: 'Google UK English Female', lang: 'en-GB', voiceURI: 'Google UK English Female', localService: false, default: false }
      ]
    case 'macos':
      return [
        { name: 'Samantha', lang: 'en-US', voiceURI: 'Samantha', localService: true, default: lang.startsWith('en') },
        { name: 'Alex', lang: 'en-US', voiceURI: 'Alex', localService: true, default: false },
        { name: 'Victoria', lang: 'en-US', voiceURI: 'Victoria', localService: true, default: false },
        { name: 'Daniel', lang: 'en-GB', voiceURI: 'Daniel', localService: true, default: false }
      ]
    case 'android':
      return [
        { name: 'English United States', lang: 'en-US', voiceURI: 'English United States', localService: true, default: true },
        { name: 'English United Kingdom', lang: 'en-GB', voiceURI: 'English United Kingdom', localService: true, default: false }
      ]
    case 'ios':
      return [
        { name: 'Samantha', lang: 'en-US', voiceURI: 'com.apple.ttsbundle.Samantha-compact', localService: true, default: true },
        { name: 'Karen', lang: 'en-AU', voiceURI: 'com.apple.ttsbundle.Karen-compact', localService: true, default: false },
        { name: 'Daniel', lang: 'en-GB', voiceURI: 'com.apple.ttsbundle.Daniel-compact', localService: true, default: false }
      ]
    case 'linux':
    default:
      return [
        { name: 'Google US English', lang: 'en-US', voiceURI: 'Google US English', localService: false, default: true },
        { name: 'Google UK English Male', lang: 'en-GB', voiceURI: 'Google UK English Male', localService: false, default: false }
      ]
  }
}

export function buildSpeechSynthesisScript(nav?: NavigatorFingerprint, locale?: LocaleFingerprint): string {
  const plat = (nav?.platform || '').toLowerCase()
  const ua = (nav?.userAgent || '').toLowerCase()
  const osFamily: 'windows' | 'macos' | 'linux' | 'android' | 'ios' =
    plat === 'iphone' || ua.includes('iphone') ? 'ios'
      : plat.includes('arm') || ua.includes('android') ? 'android'
        : plat.includes('win') || ua.includes('windows') ? 'windows'
          : plat.includes('mac') || ua.includes('macintosh') ? 'macos'
            : 'linux'

  const voices = getVoicesForOS(osFamily, locale?.language || nav?.languages?.[0] || 'en-US')

  return `
// ═══ SpeechSynthesis Voices Consistency ═══
(function() {
  'use strict';
  const cloak = window.__cloakFunction || function(f) { return f; };
  try {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const rawVoices = ${JSON.stringify(voices)};
    const proto = (typeof SpeechSynthesisVoice !== 'undefined' && SpeechSynthesisVoice.prototype) || Object.prototype;
    const syntheticVoices = rawVoices.map(function(v) {
      const obj = Object.create(proto);
      Object.defineProperties(obj, {
        name: { get: function() { return v.name; }, enumerable: true },
        lang: { get: function() { return v.lang; }, enumerable: true },
        voiceURI: { get: function() { return v.voiceURI; }, enumerable: true },
        localService: { get: function() { return v.localService; }, enumerable: true },
        default: { get: function() { return v.default; }, enumerable: true }
      });
      return obj;
    });

    const getVoicesFn = cloak(function() {
      return syntheticVoices.slice();
    }, 'getVoices');

    Object.defineProperty(window.speechSynthesis, 'getVoices', {
      value: getVoicesFn,
      configurable: true
    });
    if (typeof SpeechSynthesis !== 'undefined' && SpeechSynthesis.prototype) {
      Object.defineProperty(SpeechSynthesis.prototype, 'getVoices', {
        value: getVoicesFn,
        configurable: true
      });
    }
  } catch (e) {}
})();`
}
