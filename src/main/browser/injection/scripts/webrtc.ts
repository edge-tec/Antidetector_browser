// ──────────────────────────────────────────────────────────────────
// AntiProfiles — WebRTC Privacy & Leak Prevention Script Builder
// Protects host public/private IPs from STUN/ICE leaks when using proxies
// ──────────────────────────────────────────────────────────────────

import { WebRTCFingerprint } from '../../../fingerprint/types'

export function buildWebRTCScript(webrtcFp?: WebRTCFingerprint): string {
  const isOff = webrtcFp?.mode === 'disabled'

  if (isOff) {
    return `
// ═══ WebRTC Disabled ═══
(function() {
  'use strict';
  try {
    if (typeof window !== 'undefined') {
      window.RTCPeerConnection = undefined;
      window.webkitRTCPeerConnection = undefined;
      window.RTCSessionDescription = undefined;
      window.RTCIceCandidate = undefined;
    }
  } catch(e) {}
})();`
  }

  // Active protection when WebRTC is enabled (or altered) with proxy
  return `
// ═══ WebRTC IP Leak Shield ═══
(function() {
  'use strict';
  try {
    const OrigRTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection;
    if (!OrigRTCPeerConnection) return;

    // Pattern to identify private IPv4, IPv6, and localhost
    const privateIpRegex = /^(?:10\\.\\d+|172\\.(?:1[6-9]|2\\d|3[01])\\.\\d+|192\\.168\\.\\d+|127\\.\\d+|169\\.254\\.\\d+|0\\.\\d+|fc00:|fe80:|::1)/i;

    function sanitizeCandidateLine(candidateStr) {
      if (!candidateStr || typeof candidateStr !== 'string') return candidateStr;
      // SDP candidate format: candidate:... <foundation> <component> <transport> <priority> <connection-address> <port> typ <candidate-type> ...
      const parts = candidateStr.split(' ');
      if (parts.length >= 8 && parts[0].indexOf('candidate:') !== -1) {
        const ip = parts[4];
        const typ = parts[7];
        // If candidate type is host (local physical network interface), suppress it to eliminate leak
        if (typ === 'host' || privateIpRegex.test(ip)) {
          return null;
        }
      }
      return candidateStr;
    }

    const PatchedRTCPeerConnection = function(config, constraints) {
      const pc = new OrigRTCPeerConnection(config, constraints);

      const origAddEventListener = pc.addEventListener;
      pc.addEventListener = function(type, listener, options) {
        if (type === 'icecandidate') {
          const wrapped = function(event) {
            if (event && event.candidate && event.candidate.candidate) {
              const sanitized = sanitizeCandidateLine(event.candidate.candidate);
              if (!sanitized) {
                // Drop local IP leak candidate
                return;
              }
            }
            return listener.apply(this, arguments);
          };
          return origAddEventListener.call(this, type, wrapped, options);
        }
        return origAddEventListener.apply(this, arguments);
      };

      // Wrap onicecandidate getter/setter
      let customIceCandidateHandler = null;
      let internalIceWrap = null;

      Object.defineProperty(pc, 'onicecandidate', {
        get: function() { return customIceCandidateHandler; },
        set: function(handler) {
          if (internalIceWrap) {
            pc.removeEventListener('icecandidate', internalIceWrap);
            internalIceWrap = null;
          }
          customIceCandidateHandler = handler;
          if (typeof handler === 'function') {
            internalIceWrap = function(event) {
              if (event && event.candidate && event.candidate.candidate) {
                const sanitized = sanitizeCandidateLine(event.candidate.candidate);
                if (!sanitized) return; // Drop leak candidate
              }
              handler.apply(this, arguments);
            };
            pc.addEventListener('icecandidate', internalIceWrap);
          }
        },
        configurable: true,
        enumerable: true
      });

      // Wrap createOffer to strip host IP lines from SDP
      const origCreateOffer = pc.createOffer;
      pc.createOffer = async function() {
        const offer = await origCreateOffer.apply(this, arguments);
        if (offer && offer.sdp) {
          const lines = offer.sdp.split('\\r\\n');
          const filtered = lines.filter(line => {
            if (line.startsWith('a=candidate:')) {
              const cleaned = sanitizeCandidateLine(line.slice(2));
              return cleaned !== null;
            }
            return true;
          });
          offer.sdp = filtered.join('\\r\\n');
        }
        return offer;
      };

      return pc;
    };

    PatchedRTCPeerConnection.prototype = OrigRTCPeerConnection.prototype;
    if (OrigRTCPeerConnection.generateCertificate) {
      PatchedRTCPeerConnection.generateCertificate = OrigRTCPeerConnection.generateCertificate;
    }

    window.RTCPeerConnection = PatchedRTCPeerConnection;
    if (window.webkitRTCPeerConnection) {
      window.webkitRTCPeerConnection = PatchedRTCPeerConnection;
    }
  } catch(e) {}
})();`
}
