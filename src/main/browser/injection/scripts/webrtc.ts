// ──────────────────────────────────────────────────────────────────
// AntiProfiles — WebRTC Privacy & Leak Prevention Script Builder
// Protects host public/private IPs from STUN/ICE leaks when using proxies
// ──────────────────────────────────────────────────────────────────

import { WebRTCFingerprint } from '../../../fingerprint/types'

export function buildWebRTCScript(webrtcFp?: WebRTCFingerprint): string {
  const isOff = webrtcFp?.mode === 'disabled'
  const publicIp = webrtcFp?.publicIp || ''

  if (isOff) {
    return `
// ═══ WebRTC Disabled ═══
(function() {
  'use strict';
  try {
    if (typeof window !== 'undefined') {
      window.RTCPeerConnection = undefined;
      window.webkitRTCPeerConnection = undefined;
      window.mozRTCPeerConnection = undefined;
      window.RTCSessionDescription = undefined;
      window.RTCIceCandidate = undefined;
    }
  } catch(e) {}
})();`
  }

  // Active protection when WebRTC is enabled (or altered) with proxy
  return `
// ═══ WebRTC Comprehensive IP Leak Shield ═══
(function() {
  'use strict';
  const SPOOFED_PUBLIC_IP = ${JSON.stringify(publicIp)};

  try {
    const OrigRTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
    if (!OrigRTCPeerConnection) return;

    // Pattern to identify private IPv4, IPv6, and loopback
    const privateIpRegex = /^(?:10\\.\\d+|172\\.(?:1[6-9]|2\\d|3[01])\\.\\d+|192\\.168\\.\\d+|127\\.\\d+|169\\.254\\.\\d+|0\\.\\d+|fc00:|fe80:|::1)/i;

    function sanitizeCandidateLine(candidateStr) {
      if (!candidateStr || typeof candidateStr !== 'string') return candidateStr;
      const parts = candidateStr.split(' ');
      if (parts.length >= 8 && parts[0].indexOf('candidate:') !== -1) {
        const ip = parts[4];
        const typ = parts[7];
        // If candidate type is host (local physical network interface) or is a private/local IP, eliminate or spoof it
        if (typ === 'host' || privateIpRegex.test(ip)) {
          if (SPOOFED_PUBLIC_IP) {
            parts[4] = SPOOFED_PUBLIC_IP;
            return parts.join(' ');
          }
          return null;
        }
      }
      return candidateStr;
    }

    function sanitizeSdp(sdp) {
      if (!sdp || typeof sdp !== 'string') return sdp;
      const lines = sdp.split('\\r\\n');
      const filtered = lines.map(line => {
        if (line.startsWith('a=candidate:')) {
          const cleaned = sanitizeCandidateLine(line.slice(2));
          return cleaned ? 'a=' + cleaned : null;
        }
        if (line.startsWith('c=IN IP4 ') || line.startsWith('c=IN IP6 ')) {
          if (SPOOFED_PUBLIC_IP) {
            return 'c=IN IP4 ' + SPOOFED_PUBLIC_IP;
          }
        }
        return line;
      }).filter(Boolean);
      return filtered.join('\\r\\n');
    }

    const OrigRTCIceCandidate = window.RTCIceCandidate;
    if (OrigRTCIceCandidate) {
      const PatchedRTCIceCandidate = function(candidateInitDict) {
        if (candidateInitDict && typeof candidateInitDict === 'object' && candidateInitDict.candidate) {
          const sanitized = sanitizeCandidateLine(candidateInitDict.candidate);
          if (!sanitized) {
            candidateInitDict = Object.assign({}, candidateInitDict, { candidate: '' });
          } else {
            candidateInitDict = Object.assign({}, candidateInitDict, { candidate: sanitized });
          }
        }
        return new OrigRTCIceCandidate(candidateInitDict);
      };
      PatchedRTCIceCandidate.prototype = OrigRTCIceCandidate.prototype;
      window.RTCIceCandidate = PatchedRTCIceCandidate;
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
                return; // Drop host leak candidate
              }
            }
            return listener.apply(this, arguments);
          };
          return origAddEventListener.call(this, type, wrapped, options);
        }
        return origAddEventListener.apply(this, arguments);
      };

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
                if (!sanitized) return; // Drop host leak candidate
              }
              handler.apply(this, arguments);
            };
            pc.addEventListener('icecandidate', internalIceWrap);
          }
        },
        configurable: true,
        enumerable: true
      });

      // Wrap createOffer (both Promise & callback versions)
      const origCreateOffer = pc.createOffer;
      pc.createOffer = function(arg1, arg2, arg3) {
        if (typeof arg1 === 'function') {
          return origCreateOffer.call(this, function(offer) {
            if (offer && offer.sdp) offer.sdp = sanitizeSdp(offer.sdp);
            arg1(offer);
          }, arg2, arg3);
        }
        return origCreateOffer.apply(this, arguments).then(offer => {
          if (offer && offer.sdp) offer.sdp = sanitizeSdp(offer.sdp);
          return offer;
        });
      };

      // Wrap createAnswer (both Promise & callback versions)
      const origCreateAnswer = pc.createAnswer;
      pc.createAnswer = function(arg1, arg2, arg3) {
        if (typeof arg1 === 'function') {
          return origCreateAnswer.call(this, function(answer) {
            if (answer && answer.sdp) answer.sdp = sanitizeSdp(answer.sdp);
            arg1(answer);
          }, arg2, arg3);
        }
        return origCreateAnswer.apply(this, arguments).then(answer => {
          if (answer && answer.sdp) answer.sdp = sanitizeSdp(answer.sdp);
          return answer;
        });
      };

      // Wrap setLocalDescription
      const origSetLocalDescription = pc.setLocalDescription;
      pc.setLocalDescription = function(desc) {
        if (desc && desc.sdp) {
          desc.sdp = sanitizeSdp(desc.sdp);
        }
        return origSetLocalDescription.apply(this, arguments);
      };

      // Wrap localDescription getters
      ['localDescription', 'currentLocalDescription', 'pendingLocalDescription'].forEach(prop => {
        Object.defineProperty(pc, prop, {
          get: function() {
            const desc = pc.__proto__ ? Object.getOwnPropertyDescriptor(OrigRTCPeerConnection.prototype, prop)?.get?.call(this) : null;
            if (desc && desc.sdp) {
              return { type: desc.type, sdp: sanitizeSdp(desc.sdp) };
            }
            return desc;
          },
          configurable: true,
          enumerable: true
        });
      });

      // Wrap getStats to eliminate candidate IP leaks
      const origGetStats = pc.getStats;
      pc.getStats = async function(selector) {
        try {
          const stats = await origGetStats.apply(this, arguments);
          if (stats && typeof stats.forEach === 'function') {
            const safeStats = new Map();
            stats.forEach((report, key) => {
              if (report.type === 'local-candidate' || report.type === 'remote-candidate') {
                if (report.candidateType === 'host' || privateIpRegex.test(report.ip || report.address)) {
                  if (SPOOFED_PUBLIC_IP) {
                    report.ip = SPOOFED_PUBLIC_IP;
                    report.address = SPOOFED_PUBLIC_IP;
                  } else {
                    return; // Drop leaked candidate from stats report
                  }
                }
              }
              safeStats.set(key, report);
            });
            return safeStats;
          }
          return stats;
        } catch(e) {
          return origGetStats.apply(this, arguments);
        }
      };

      return pc;
    };

    PatchedRTCPeerConnection.prototype = OrigRTCPeerConnection.prototype;
    if (OrigRTCPeerConnection.generateCertificate) {
      PatchedRTCPeerConnection.generateCertificate = OrigRTCPeerConnection.generateCertificate;
    }

    window.RTCPeerConnection = PatchedRTCPeerConnection;
    if (window.webkitRTCPeerConnection) window.webkitRTCPeerConnection = PatchedRTCPeerConnection;
    if (window.mozRTCPeerConnection) window.mozRTCPeerConnection = PatchedRTCPeerConnection;
  } catch(e) {}
})();`
}

