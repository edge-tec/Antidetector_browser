import React, { useState, useEffect } from 'react'

export interface AutomationRuleConfig {
  profileId: string
  enabled: boolean
  autoReplyTemplate: string
  autoReplySubjectPrefix?: string
  followUpTemplates: string[]
  followUpDelaysMinutes: number[]
  maxRepliesPerThread: number
  maxFollowUpsPerThread: number
  dailyRepliesLimit: number
  dailyFollowUpsLimit: number
  dailyTotalLimit: number
  timezone: string
}

export interface ScheduledJob {
  id: string
  profileId: string
  threadId: string
  recipientEmail: string
  stepIndex: number
  template: string
  scheduledAt: number
  status: 'PENDING' | 'EXECUTED' | 'CANCELLED_RECIPIENT_REPLIED' | 'FAILED' | 'LIMIT_EXCEEDED'
  attempts: number
  lastError?: string
}

interface Props {
  profileId: string
  profileName: string
  googleAccount?: { email: string; name?: string }
  onClose: () => void
  showToast: (type: 'success' | 'error' | 'info' | 'warn', msg: string) => void
}

const COMMON_TIMEZONES = [
  'Asia/Dhaka',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'UTC'
]

export const GmailAutomationModal: React.FC<Props> = ({
  profileId,
  profileName,
  googleAccount,
  onClose,
  showToast
}) => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'rules' | 'followups' | 'limits' | 'queue'>('rules')

  const [enabled, setEnabled] = useState(true)
  const [autoReplyTemplate, setAutoReplyTemplate] = useState('Thank you for reaching out. We received your message and will reply shortly.')
  const [autoReplySubjectPrefix, setAutoReplySubjectPrefix] = useState('Re: ')
  const [maxRepliesPerThread, setMaxRepliesPerThread] = useState(2)

  const [followUpTemplates, setFollowUpTemplates] = useState<string[]>([
    'Hi, just following up on our previous email to see if you have any questions.',
    'Checking in one last time regarding our conversation.'
  ])
  const [followUpDelaysMinutes, setFollowUpDelaysMinutes] = useState<number[]>([1440, 2880]) // 1 day, 2 days

  const [dailyRepliesLimit, setDailyRepliesLimit] = useState(50)
  const [dailyFollowUpsLimit, setDailyFollowUpsLimit] = useState(30)
  const [dailyTotalLimit, setDailyTotalLimit] = useState(80)
  const [timezone, setTimezone] = useState('Asia/Dhaka')

  const [jobs, setJobs] = useState<ScheduledJob[]>([])

  useEffect(() => {
    const loadConfig = async () => {
      setLoading(true)
      try {
        const res = await (window.api as any).getGmailAutomationConfig(profileId)
        if (res?.success && res.data) {
          const cfg = res.data
          setEnabled(cfg.enabled ?? true)
          setAutoReplyTemplate(cfg.autoReplyTemplate || '')
          setAutoReplySubjectPrefix(cfg.autoReplySubjectPrefix || 'Re: ')
          setMaxRepliesPerThread(cfg.maxRepliesPerThread ?? 2)
          setFollowUpTemplates(cfg.followUpTemplates || [])
          setFollowUpDelaysMinutes(cfg.followUpDelaysMinutes || [1440])
          setDailyRepliesLimit(cfg.dailyRepliesLimit ?? 50)
          setDailyFollowUpsLimit(cfg.dailyFollowUpsLimit ?? 30)
          setDailyTotalLimit(cfg.dailyTotalLimit ?? 80)
          setTimezone(cfg.timezone || 'Asia/Dhaka')
        }

        const jobRes = await (window.api as any).getGmailJobs(profileId)
        if (jobRes?.success && jobRes.data) {
          setJobs(jobRes.data)
        }
      } catch (err: any) {
        showToast('error', `Failed to load automation settings: ${err.message}`)
      } finally {
        setLoading(false)
      }
    }

    loadConfig()
  }, [profileId])

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload: AutomationRuleConfig = {
        profileId,
        enabled,
        autoReplyTemplate,
        autoReplySubjectPrefix,
        followUpTemplates,
        followUpDelaysMinutes,
        maxRepliesPerThread,
        maxFollowUpsPerThread: followUpTemplates.length,
        dailyRepliesLimit,
        dailyFollowUpsLimit,
        dailyTotalLimit,
        timezone
      }

      const res = await (window.api as any).saveGmailAutomationConfig(payload)
      if (res?.success) {
        showToast('success', '✓ Gmail automation settings saved successfully!')
        onClose()
      } else {
        showToast('error', res?.error || 'Failed to save settings')
      }
    } catch (err: any) {
      showToast('error', `Save error: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleAddFollowUp = () => {
    if (followUpTemplates.length >= 5) {
      showToast('warn', 'Maximum 5 follow-up steps allowed.')
      return
    }
    const nextStep = followUpTemplates.length + 1
    const defaultDelay = nextStep * 1440 // 1 day, 2 days, 3 days
    setFollowUpTemplates([...followUpTemplates, `Follow-up #${nextStep} message...`])
    setFollowUpDelaysMinutes([...followUpDelaysMinutes, defaultDelay])
  }

  const handleRemoveFollowUp = (index: number) => {
    setFollowUpTemplates(followUpTemplates.filter((_, i) => i !== index))
    setFollowUpDelaysMinutes(followUpDelaysMinutes.filter((_, i) => i !== index))
  }

  const handleCancelJob = async (threadId: string) => {
    try {
      const res = await (window.api as any).cancelGmailFollowUps(profileId, threadId, 'Manually cancelled by user')
      if (res?.success) {
        showToast('success', `Cancelled follow-ups for thread: ${threadId.substring(0, 8)}...`)
        const jobRes = await (window.api as any).getGmailJobs(profileId)
        if (jobRes?.success && jobRes.data) setJobs(jobRes.data)
      }
    } catch (err: any) {
      showToast('error', `Cancel failed: ${err.message}`)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 680,
          maxHeight: '90vh',
          backgroundColor: '#181825',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 16,
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#cdd6f4'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(180deg, rgba(234, 67, 53, 0.08) 0%, transparent 100%)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24, padding: 6, background: 'rgba(234, 67, 53, 0.15)', borderRadius: 10 }}>📧</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#f5f5f7' }}>
                Gmail Auto-Reply & Follow-up Settings
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#a6adc8' }}>
                Profile: <strong style={{ color: '#89b4fa' }}>{profileName}</strong> • {googleAccount?.email || 'No Gmail Linked'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#a6adc8',
              fontSize: 20,
              cursor: 'pointer',
              padding: 6,
              borderRadius: 6
            }}
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            padding: '10px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            background: '#1e1e2e'
          }}
        >
          <button
            onClick={() => setActiveTab('rules')}
            style={{
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === 'rules' ? 'rgba(234, 67, 53, 0.2)' : 'transparent',
              color: activeTab === 'rules' ? '#f38ba8' : '#a6adc8'
            }}
          >
            💬 Auto-Reply
          </button>
          <button
            onClick={() => setActiveTab('followups')}
            style={{
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === 'followups' ? 'rgba(234, 67, 53, 0.2)' : 'transparent',
              color: activeTab === 'followups' ? '#f38ba8' : '#a6adc8'
            }}
          >
            ⏳ Follow-Ups ({followUpTemplates.length})
          </button>
          <button
            onClick={() => setActiveTab('limits')}
            style={{
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === 'limits' ? 'rgba(234, 67, 53, 0.2)' : 'transparent',
              color: activeTab === 'limits' ? '#f38ba8' : '#a6adc8'
            }}
          >
            🛡️ Quotas & Limits
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            style={{
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === 'queue' ? 'rgba(234, 67, 53, 0.2)' : 'transparent',
              color: activeTab === 'queue' ? '#f38ba8' : '#a6adc8'
            }}
          >
            📋 Queue ({jobs.filter(j => j.status === 'PENDING').length})
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#a6adc8' }}>Loading automation configuration...</div>
          ) : (
            <>
              {/* Tab 1: Auto-Reply Rule */}
              {activeTab === 'rules' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Enabled Toggle */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 14,
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: 10,
                      border: '1px solid rgba(255, 255, 255, 0.08)'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#f5f5f7' }}>Enable Auto-Reply Engine</div>
                      <div style={{ fontSize: 12, color: '#a6adc8' }}>
                        Automatically reply to incoming messages in the same conversation thread.
                      </div>
                    </div>
                    <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => setEnabled(e.target.checked)}
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: enabled ? '#a6e3a1' : '#45475a',
                          borderRadius: 24,
                          transition: '0.3s'
                        }}
                      >
                        <span
                          style={{
                            position: 'absolute',
                            content: '',
                            height: 18,
                            width: 18,
                            left: enabled ? 22 : 3,
                            bottom: 3,
                            backgroundColor: '#181825',
                            borderRadius: '50%',
                            transition: '0.3s'
                          }}
                        />
                      </span>
                    </label>
                  </div>

                  {/* Auto-Reply Message Template */}
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#cdd6f4' }}>
                      Auto-Reply Message Template
                    </label>
                    <textarea
                      rows={5}
                      value={autoReplyTemplate}
                      onChange={(e) => setAutoReplyTemplate(e.target.value)}
                      placeholder="Write your automated email response here..."
                      style={{
                        width: '100%',
                        padding: 12,
                        backgroundColor: '#1e1e2e',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 8,
                        color: '#cdd6f4',
                        fontSize: 13,
                        fontFamily: 'inherit',
                        resize: 'vertical'
                      }}
                    />
                    <span style={{ fontSize: 11, color: '#a6adc8' }}>
                      Sent automatically when a new inquiry or customer email arrives.
                    </span>
                  </div>

                  {/* Max Replies per Thread */}
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#cdd6f4' }}>
                      Maximum Auto-Replies per Conversation Thread
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={maxRepliesPerThread}
                      onChange={(e) => setMaxRepliesPerThread(parseInt(e.target.value) || 1)}
                      style={{
                        width: 120,
                        padding: '8px 12px',
                        backgroundColor: '#1e1e2e',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 8,
                        color: '#cdd6f4',
                        fontSize: 13
                      }}
                    />
                    <div style={{ fontSize: 11, color: '#a6adc8', marginTop: 4 }}>
                      Limits automated responses to prevent replying endlessly on active customer conversations.
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Follow-Up Sequence */}
              {activeTab === 'followups' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ fontSize: 12, color: '#a6adc8', background: 'rgba(137, 180, 250, 0.08)', padding: 10, borderRadius: 8, border: '1px solid rgba(137, 180, 250, 0.2)' }}>
                    💡 <strong>Smart Cancellation:</strong> If the recipient replies to your email at any point, all future scheduled follow-ups for that thread are <strong>instantly cancelled</strong>.
                  </div>

                  {followUpTemplates.map((template, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: 14,
                        background: '#1e1e2e',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: 10,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: 13, color: '#89b4fa' }}>
                          Follow-Up #{idx + 1}
                        </strong>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, color: '#a6adc8' }}>Wait:</span>
                          <select
                            value={followUpDelaysMinutes[idx] || 1440}
                            onChange={(e) => {
                              const updated = [...followUpDelaysMinutes]
                              updated[idx] = parseInt(e.target.value)
                              setFollowUpDelaysMinutes(updated)
                            }}
                            style={{
                              padding: '4px 8px',
                              backgroundColor: '#181825',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              borderRadius: 6,
                              color: '#cdd6f4',
                              fontSize: 12
                            }}
                          >
                            <option value={1}>1 Minute (Test Mode)</option>
                            <option value={60}>1 Hour</option>
                            <option value={360}>6 Hours</option>
                            <option value={720}>12 Hours</option>
                            <option value={1440}>1 Day (24 Hours)</option>
                            <option value={2880}>2 Days (48 Hours)</option>
                            <option value={4320}>3 Days (72 Hours)</option>
                            <option value={7200}>5 Days</option>
                          </select>
                          <button
                            onClick={() => handleRemoveFollowUp(idx)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#f38ba8',
                              cursor: 'pointer',
                              fontSize: 14,
                              padding: '2px 6px'
                            }}
                            title="Remove step"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      <textarea
                        rows={3}
                        value={template}
                        onChange={(e) => {
                          const updated = [...followUpTemplates]
                          updated[idx] = e.target.value
                          setFollowUpTemplates(updated)
                        }}
                        placeholder={`Message for Follow-Up #${idx + 1}...`}
                        style={{
                          width: '100%',
                          padding: 10,
                          backgroundColor: '#181825',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: 6,
                          color: '#cdd6f4',
                          fontSize: 12,
                          fontFamily: 'inherit',
                          resize: 'vertical'
                        }}
                      />
                    </div>
                  ))}

                  {followUpTemplates.length < 5 && (
                    <button
                      onClick={handleAddFollowUp}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 8,
                        border: '1px dashed rgba(255, 255, 255, 0.2)',
                        backgroundColor: 'transparent',
                        color: '#89b4fa',
                        fontSize: 13,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6
                      }}
                    >
                      + Add Next Follow-Up Step
                    </button>
                  )}
                </div>
              )}

              {/* Tab 3: Limits & Quotas */}
              {activeTab === 'limits' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#cdd6f4' }}>
                        Daily Auto-Replies Limit
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={dailyRepliesLimit}
                        onChange={(e) => setDailyRepliesLimit(parseInt(e.target.value) || 1)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          backgroundColor: '#1e1e2e',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: 8,
                          color: '#cdd6f4',
                          fontSize: 13
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#cdd6f4' }}>
                        Daily Follow-Ups Limit
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={dailyFollowUpsLimit}
                        onChange={(e) => setDailyFollowUpsLimit(parseInt(e.target.value) || 1)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          backgroundColor: '#1e1e2e',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: 8,
                          color: '#cdd6f4',
                          fontSize: 13
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#cdd6f4' }}>
                      Global Daily Total Send Limit (Safety Ceiling)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={dailyTotalLimit}
                      onChange={(e) => setDailyTotalLimit(parseInt(e.target.value) || 1)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        backgroundColor: '#1e1e2e',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 8,
                        color: '#cdd6f4',
                        fontSize: 13
                      }}
                    />
                    <span style={{ fontSize: 11, color: '#a6adc8' }}>
                      Combined ceiling for auto-replies + follow-ups to protect Gmail account reputation.
                    </span>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#cdd6f4' }}>
                      Timezone (Daily Quota Midnight Reset)
                    </label>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        backgroundColor: '#1e1e2e',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 8,
                        color: '#cdd6f4',
                        fontSize: 13
                      }}
                    >
                      {COMMON_TIMEZONES.map((tz) => (
                        <option key={tz} value={tz}>{tz}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Tab 4: Live Queue */}
              {activeTab === 'queue' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {jobs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 30, color: '#a6adc8', fontSize: 13 }}>
                      No scheduled follow-up jobs active for this profile.
                    </div>
                  ) : (
                    jobs.map((j) => (
                      <div
                        key={j.id}
                        style={{
                          padding: 12,
                          background: '#1e1e2e',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: 8,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#f5f5f7' }}>
                            To: {j.recipientEmail} (Step #{j.stepIndex + 1})
                          </div>
                          <div style={{ fontSize: 11, color: '#a6adc8', marginTop: 2 }}>
                            Scheduled: {new Date(j.scheduledAt).toLocaleString()} • Status:{' '}
                            <span
                              style={{
                                color:
                                  j.status === 'PENDING'
                                    ? '#89b4fa'
                                    : j.status === 'EXECUTED'
                                    ? '#a6e3a1'
                                    : j.status.includes('CANCELLED')
                                    ? '#f9e2af'
                                    : '#f38ba8',
                                fontWeight: 600
                              }}
                            >
                              {j.status}
                            </span>
                          </div>
                        </div>
                        {j.status === 'PENDING' && (
                          <button
                            onClick={() => handleCancelJob(j.threadId)}
                            style={{
                              padding: '4px 10px',
                              fontSize: 11,
                              borderRadius: 6,
                              border: '1px solid rgba(243, 139, 168, 0.3)',
                              backgroundColor: 'rgba(243, 139, 168, 0.1)',
                              color: '#f38ba8',
                              cursor: 'pointer'
                            }}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 12,
            background: '#181825'
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px',
              borderRadius: 8,
              border: '1px solid rgba(255, 255, 255, 0.12)',
              backgroundColor: 'transparent',
              color: '#cdd6f4',
              fontSize: 13,
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '8px 22px',
              borderRadius: 8,
              border: 'none',
              backgroundColor: '#EA4335',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 600,
              cursor: saving ? 'wait' : 'pointer',
              boxShadow: '0 4px 14px rgba(234, 67, 53, 0.3)'
            }}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}
