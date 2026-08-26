import React from 'react'

interface LogoProps {
  size?: number
  className?: string
  style?: React.CSSProperties
}

/**
 * High-precision Google Chrome / Chromium SVG Logo
 */
export const ChromeLogo: React.FC<LogoProps> = ({ size = 28, className, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
  >
    <circle cx="50" cy="50" r="48" fill="#F8FAFC" />
    {/* Red wedge (top-left) */}
    <path
      d="M50 50 L91.57 26 C82.8 10.8 67.5 2 50 2 C32.5 2 17.2 10.8 8.43 26 Z"
      fill="#EA4335"
    />
    {/* Green wedge (bottom-left) */}
    <path
      d="M50 50 L8.43 26 C2.6 36.1 0 47.8 1.4 59.8 C3.6 78.4 17.8 93.6 36.2 97.4 L57 61.4 Z"
      fill="#34A853"
    />
    {/* Yellow wedge (right/bottom) */}
    <path
      d="M50 50 L57 61.4 L36.2 97.4 C40.6 98.3 45.2 98.8 50 98.8 C76.9 98.8 98.8 76.9 98.8 50 C98.8 41.6 96.6 33.6 91.57 26 Z"
      fill="#FBBC05"
    />
    {/* White ring around center */}
    <circle cx="50" cy="50" r="23" fill="#FFFFFF" />
    {/* Blue center circle */}
    <circle cx="50" cy="50" r="18" fill="#1A73E8" />
  </svg>
)

/**
 * High-precision Mozilla Firefox Quantum SVG Logo
 */
export const FirefoxLogo: React.FC<LogoProps> = ({ size = 28, className, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
  >
    <defs>
      <linearGradient id="ffGlobe" x1="20" y1="20" x2="80" y2="80" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#2563EB" />
        <stop offset="50%" stopColor="#4F46E5" />
        <stop offset="100%" stopColor="#1E1B4B" />
      </linearGradient>
      <linearGradient id="ffFlame" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FDE047" />
        <stop offset="30%" stopColor="#F97316" />
        <stop offset="70%" stopColor="#EF4444" />
        <stop offset="100%" stopColor="#C026D3" />
      </linearGradient>
      <linearGradient id="ffHighlight" x1="10" y1="10" x2="60" y2="60" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FFEDD5" stopOpacity="0.8" />
        <stop offset="100%" stopColor="#FFEDD5" stopOpacity="0" />
      </linearGradient>
    </defs>
    {/* Firefox Inner Blue Planet/Globe */}
    <circle cx="52" cy="52" r="38" fill="url(#ffGlobe)" />
    {/* Continents / Swirl on Globe */}
    <path
      d="M32 40 C38 32, 54 30, 65 38 C76 46, 78 62, 70 72 C62 82, 44 84, 34 76 C24 68, 26 48, 32 40 Z"
      fill="#3B82F6"
      opacity="0.6"
    />
    {/* Firefox Outer Fiery Fox Swirl */}
    <path
      d="M50 3 C24.04 3 3 24.04 3 50 C3 75.96 24.04 97 50 97 C75.96 97 97 75.96 97 50 C97 38.6 92.9 28.1 86 19.9 C85 24 81.5 28 77 30 C72 32.2 65 30 63 25 C61 20 63 14 67 9 C56 5 44 6.5 36 12 C28 17.5 22 27 24 38 C26 49 35 57 46 58 C57 59 67 52 70 42 C72 35 70 29 67 25 C75 29 81 37 83 47 C85.5 60 76 73 63 76 C50 79 36 71 33 58 C30 45 37 32 47 25 C50 23 53 20 54 16 C48 18 42 22 38 27 C28 40 30 60 43 71 C56 82 76 80 87 67 C95 57 97 43 93 30 C90 20 83 11 74 6 C66.8 2 58.6 0 50 3 Z"
      fill="url(#ffFlame)"
    />
    {/* Fiery Ear & Top Highlight */}
    <path
      d="M67 9 C63 14 61 20 63 25 C65 30 72 32.2 77 30 C81.5 28 85 24 86 19.9 C80 14 74 10 67 9 Z"
      fill="#FDE047"
    />
    <circle cx="50" cy="50" r="46" fill="url(#ffHighlight)" />
  </svg>
)

/**
 * Universal Browser Engine Icon Resolver
 */
export const BrowserEngineIcon: React.FC<{
  type?: 'chrome' | 'firefox' | 'edge' | 'brave' | 'safari' | string
  size?: number
  style?: React.CSSProperties
  className?: string
}> = ({ type = 'chrome', size = 28, style, className }) => {
  const normType = (type || '').toLowerCase()

  if (normType.includes('firefox') || normType.includes('gecko')) {
    return <FirefoxLogo size={size} style={style} className={className} />
  }

  // Default to Chromium / Chrome
  return <ChromeLogo size={size} style={style} className={className} />
}
