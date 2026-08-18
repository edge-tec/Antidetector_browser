// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Media Devices Injection Script Builder
// Overrides navigator.mediaDevices.enumerateDevices() preserving MediaDeviceInfo prototype
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
  'use strict';
  const DEVICES = ${JSON.stringify(devices)};

  function createDevice(d) {
    if (typeof MediaDeviceInfo !== 'undefined' && MediaDeviceInfo.prototype) {
      try {
        const obj = Object.create(MediaDeviceInfo.prototype);
        Object.defineProperties(obj, {
          deviceId: { value: d.deviceId, enumerable: true },
          groupId: { value: d.groupId, enumerable: true },
          kind: { value: d.kind, enumerable: true },
          label: { value: d.label, enumerable: true },
          toJSON: { value: function() { return d; }, enumerable: true }
        });
        return obj;
      } catch(e) {}
    }
    return d;
  }

  if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
    navigator.mediaDevices.enumerateDevices = function() {
      return Promise.resolve(DEVICES.map(createDevice));
    };
  }

  try {
    if (typeof MediaDevices !== 'undefined' && MediaDevices.prototype) {
      Object.defineProperty(MediaDevices.prototype, 'enumerateDevices', {
        value: function() {
          return Promise.resolve(DEVICES.map(createDevice));
        },
        configurable: true,
        writable: true
      });
    }
  } catch(e) {}
})();`
}
