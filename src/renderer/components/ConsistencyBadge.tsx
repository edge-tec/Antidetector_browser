import React, { useState } from 'react'

export interface ConsistencyCheck {
  id: string
  category: string
  left: string
  right: string
  status: 'pass' | 'warn' | 'fail'
  message: string
  severity: number
}

export interface ConsistencyResult {
  score: number
  totalChecks: number
  passedChecks: number
  warnings: number
  failures: number
  checks: ConsistencyCheck[]
}

interface Props {
  score: number
  result?: ConsistencyResult | null
  onRecheck?: () => void
}

export const ConsistencyBadge: React.FC<Props> = ({ score, result, onRecheck }) => {
  const [showModal, setShowModal] = useState(false)

  let badgeColor = '#10B981' // Green
  let badgeLabel = 'Pass'
  if (score < 70) {
    badgeColor = '#EF4444' // Red
    badgeLabel = 'Fail'
  } else if (score < 90) {
    badgeColor = '#F59E0B' // Yellow
    badgeLabel = 'Warning'
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          borderRadius: '20px',
          background: `${badgeColor}15`,
          border: `1px solid ${badgeColor}40`,
          color: badgeColor,
          fontSize: '12px',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.15s ease'
        }}
        title="Click to view detailed fingerprint consistency report"
      >
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: badgeColor,
            boxShadow: `0 0 6px ${badgeColor}`
          }}
        />
        Consistency: {score}% ({badgeLabel})
      </button>

      {showModal && result && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              backgroundColor: '#181824',
              border: '1px solid #2A2A3C',
              borderRadius: '12px',
              padding: '24px',
              width: '640px',
              maxHeight: '80vh',
              overflowY: 'auto',
              color: '#E2E8F0',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Fingerprint Consistency Report</h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94A3B8' }}>
                  Score: <strong style={{ color: badgeColor }}>{result.score}%</strong> — {result.passedChecks} Passed, {result.warnings} Warnings, {result.failures} Failures
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94A3B8',
                  fontSize: '20px',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {result.checks.map((check) => {
                const color = check.status === 'pass' ? '#10B981' : check.status === 'warn' ? '#F59E0B' : '#EF4444'
                const bg = check.status === 'pass' ? '#10B98110' : check.status === 'warn' ? '#F59E0B10' : '#EF444410'
                const icon = check.status === 'pass' ? '✓' : check.status === 'warn' ? '⚠' : '✕'

                return (
                  <div
                    key={check.id}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      backgroundColor: bg,
                      border: `1px solid ${color}30`,
                      fontSize: '13px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600 }}>
                      <span style={{ color }}>{icon} {check.category}</span>
                      <span style={{ fontSize: '11px', opacity: 0.7 }}>Severity: {check.severity}/10</span>
                    </div>
                    <p style={{ margin: '4px 0 0', color: '#CBD5E1', fontSize: '12px' }}>{check.message}</p>
                    <div style={{ margin: '4px 0 0', fontSize: '11px', color: '#64748B' }}>
                      Left: {check.left} | Right: {check.right}
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              {onRecheck && (
                <button
                  type="button"
                  onClick={onRecheck}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    backgroundColor: '#6366F1',
                    color: '#FFF',
                    border: 'none',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Re-validate
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  backgroundColor: '#2A2A3C',
                  color: '#CBD5E1',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
