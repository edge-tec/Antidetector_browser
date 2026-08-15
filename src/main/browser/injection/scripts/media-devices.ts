// ──────────────────────────────────────────────────────────────────
// ProfileVault — Media Devices Injection Script Builder
// Overrides navigator.mediaDevices.enumerateDevices() safely
// ──────────────────────────────────────────────────────────────────

import { MediaDevicesFingerprint } from '../../../fingerprint/types'

export function buildMediaDevicesScript(md: MediaDevicesFingerprint): string {
  const safe = {
    videoInputs: md?.videoInputs ?? 1,
    audioInputs: md?.audioInputs ?? 1,
    audioOutputs: md?.audioOutputs ?? 1,
    deviceIds: md?.deviceIds || [],
    groupIds: md?.groupIds || [],
    cameraLabels: md?.cameraLabels || [],
    microphoneLabels: md?.microphoneLabels || [],
    speakerLabels: md?.speakerLabels || []
  }

  const devices: any[] = []

  // Build video inputs
  for (let i = 0; i < safe.videoInputs; i++) {
    devices.push({
      kind: 'videoinput',
      deviceId: safe.deviceIds[i] || `video-${i}`,
      groupId: safe.groupIds[i] || `group-video-${i}`,
      label: safe.cameraLabels[i] || `HD Web Camera ${i + 1}`
    })
  }

  // Build audio inputs
  for (let i = 0; i < safe.audioInputs; i++) {
    const idx = safe.videoInputs + i
    devices.push({
      kind: 'audioinput',
      deviceId: safe.deviceIds[idx] || `audio-in-${i}`,
      groupId: safe.groupIds[idx] || `group-audio-in-${i}`,
      label: safe.microphoneLabels[i] || `Internal Microphone ${i + 1}`
    })
  }

  // Build audio outputs
  for (let i = 0; i < safe.audioOutputs; i++) {
    const idx = safe.videoInputs + safe.audioInputs + i
    devices.push({
      kind: 'audiooutput',
      deviceId: safe.deviceIds[idx] || `audio-out-${i}`,
      groupId: safe.groupIds[idx] || `group-audio-out-${i}`,
      label: safe.speakerLabels[i] || `Internal Speaker ${i + 1}`
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
