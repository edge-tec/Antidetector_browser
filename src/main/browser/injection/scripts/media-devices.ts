// ──────────────────────────────────────────────────────────────────
// ProfileVault — Media Devices Injection Script Builder
// Overrides navigator.mediaDevices.enumerateDevices()
// ──────────────────────────────────────────────────────────────────

import { MediaDevicesFingerprint } from '../../../fingerprint/types'

export function buildMediaDevicesScript(md: MediaDevicesFingerprint): string {
  const devices: any[] = []

  // Build video inputs
  for (let i = 0; i < md.videoInputs; i++) {
    devices.push({
      kind: 'videoinput',
      deviceId: md.deviceIds[i] || `video-${i}`,
      groupId: `group-video-${i}`,
      label: md.cameraLabels[i] || `Camera ${i + 1}`
    })
  }

  // Build audio inputs
  for (let i = 0; i < md.audioInputs; i++) {
    const idx = md.videoInputs + i
    devices.push({
      kind: 'audioinput',
      deviceId: md.deviceIds[idx] || `audio-in-${i}`,
      groupId: `group-audio-in-${i}`,
      label: md.microphoneLabels[i] || `Microphone ${i + 1}`
    })
  }

  // Build audio outputs
  for (let i = 0; i < md.audioOutputs; i++) {
    const idx = md.videoInputs + md.audioInputs + i
    devices.push({
      kind: 'audiooutput',
      deviceId: md.deviceIds[idx] || `audio-out-${i}`,
      groupId: `group-audio-out-${i}`,
      label: md.speakerLabels[i] || `Speaker ${i + 1}`
    })
  }

  return `
// ═══ Media Devices Override ═══
(function() {
  const DEVICES = ${JSON.stringify(devices)};

  if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
    navigator.mediaDevices.enumerateDevices = function() {
      return Promise.resolve(DEVICES.map(function(d) {
        return {
          kind: d.kind,
          deviceId: d.deviceId,
          groupId: d.groupId,
          label: d.label,
          toJSON: function() { return d; }
        };
      }));
    };
  }

  // Override MediaDevices.prototype.enumerateDevices as well
  try {
    Object.defineProperty(MediaDevices.prototype, 'enumerateDevices', {
      value: function() {
        return Promise.resolve(DEVICES.map(function(d) {
          return {
            kind: d.kind,
            deviceId: d.deviceId,
            groupId: d.groupId,
            label: d.label,
            toJSON: function() { return d; }
          };
        }));
      },
      configurable: true,
      writable: true
    });
  } catch(e) {}
})();`
}
