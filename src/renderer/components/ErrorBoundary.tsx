import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallbackTitle?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in UI component:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0A0A0F',
          padding: '24px'
        }}>
          <div style={{
            maxWidth: '560px',
            width: '100%',
            backgroundColor: '#161622',
            border: '1px solid #EF444450',
            borderRadius: '16px',
            padding: '32px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontSize: '28px' }}>⚠️</div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#F87171' }}>
                  {this.props.fallbackTitle || 'AntiProfiles Application Notice'}
                </h3>
                <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>
                  A UI component encountered an exception during render.
                </div>
              </div>
            </div>

            <div style={{
              backgroundColor: '#09090D',
              border: '1px solid #2C2C3E',
              borderRadius: '8px',
              padding: '14px',
              fontFamily: 'monospace',
              fontSize: '12px',
              color: '#FCA5A5',
              maxHeight: '160px',
              overflowY: 'auto',
              wordBreak: 'break-all'
            }}>
              {this.state.error?.message || 'Unknown component render exception'}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => this.setState({ hasError: false, error: null })}
                style={{
                  flex: 1,
                  minWidth: '120px',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  backgroundColor: '#2DD4BF',
                  color: '#0F0F17',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                ✓ Try Again
              </button>

              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                  flex: 1,
                  minWidth: '140px',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  backgroundColor: '#3B82F6',
                  color: '#FFF',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                🔄 Reload App Window
              </button>

              <button
                type="button"
                onClick={() => {
                  try {
                    navigator.clipboard.writeText(this.state.error?.stack || this.state.error?.message || '')
                    alert('✓ Error log copied to clipboard!')
                  } catch {}
                }}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#14141F',
                  border: '1px solid #2C2C3E',
                  color: '#94A3B8',
                  fontWeight: 600,
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                📋 Copy Error
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
