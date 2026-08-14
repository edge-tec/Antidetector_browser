// ──────────────────────────────────────────────────────────────────
// ProfileVault — Geolocation Injection Script Builder
// Overrides navigator.geolocation API
// ──────────────────────────────────────────────────────────────────

import { GeolocationFingerprint } from '../../../fingerprint/types'

export function buildGeolocationScript(geo: GeolocationFingerprint): string {
  if (geo.mode === 'block') {
    return `
// ═══ Geolocation Blocked ═══
(function() {
  navigator.geolocation.getCurrentPosition = function(success, error) {
    if (error) error({ code: 1, message: 'User denied Geolocation', PERMISSION_DENIED: 1 });
  };
  navigator.geolocation.watchPosition = function(success, error) {
    if (error) error({ code: 1, message: 'User denied Geolocation', PERMISSION_DENIED: 1 });
    return 0;
  };
  navigator.geolocation.clearWatch = function() {};
})();`
  }

  if (geo.mode === 'ask') {
    return '// Geolocation: Prompt (browser default)'
  }

  // Custom or IP-based — return configured coordinates
  return `
// ═══ Geolocation Override ═══
(function() {
  const GEO_POSITION = {
    coords: {
      latitude: ${geo.latitude},
      longitude: ${geo.longitude},
      accuracy: ${geo.accuracy},
      altitude: ${geo.altitude === null ? 'null' : geo.altitude},
      altitudeAccuracy: ${geo.altitudeAccuracy === null ? 'null' : geo.altitudeAccuracy},
      heading: ${geo.heading === null ? 'null' : geo.heading},
      speed: ${geo.speed === null ? 'null' : geo.speed}
    },
    timestamp: Date.now()
  };

  navigator.geolocation.getCurrentPosition = function(success, error, options) {
    setTimeout(function() {
      success({
        coords: GEO_POSITION.coords,
        timestamp: Date.now()
      });
    }, 100 + Math.random() * 200); // Simulate realistic delay
  };

  let watchId = 0;
  navigator.geolocation.watchPosition = function(success, error, options) {
    const id = ++watchId;
    setTimeout(function() {
      success({
        coords: GEO_POSITION.coords,
        timestamp: Date.now()
      });
    }, 100 + Math.random() * 200);
    return id;
  };

  navigator.geolocation.clearWatch = function(id) {};
})();`
}
