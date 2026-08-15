// ──────────────────────────────────────────────
// ProfileVault — Admin Live Support Dashboard Manager Component
// ──────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { SupportConversation, SupportMessage, SupportInternalNote } from '../types'

export const AdminSupportManager: React.FC = () => {
  const { sessionToken } = useAuth()

  const [activeTab, setActiveTab] = useState<'conversations' | 'settings'>('conversations')

  // Conversations state
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [conversations, setConversations] = useState<SupportConversation[]>([])
  const [unreadTotal, setUnreadTotal] = useState(0)

  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [selectedConv, setSelectedConv] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  // Reply & internal notes state
  const [replyText, setReplyText] = useState('')
  const [selectedFile, setSelectedFile] = useState<{ name: string; mime: string; size: number; dataBase64: string } | null>(null)
  const [internalNoteText, setInternalNoteText] = useState('')
  const [showAddNoteModal, setShowAddNoteModal] = useState(false)

  // Settings state
  const [settings, setSettings] = useState<Record<string, string>>({
    support_enabled: 'true',
    support_available: 'true',
    business_hours: 'Mon-Fri 09:00 - 18:00 UTC',
    welcome_message: 'Hello! How can our support team assist you today?',
    offline_message: 'Our support team is currently offline. Please leave a message and we will respond shortly.',
    auto_reply_enabled: 'true',
    auto_reply_message: 'Thanks for contacting ProfileVault support! An agent has been notified and will reply shortly.',
    max_attachment_size_mb: '10',
    allowed_file_types: 'jpg,jpeg,png,gif,webp,pdf,txt,zip',
    notification_sound_enabled: 'true',
    max_open_conversations_per_user: '3',
    rate_limit_messages_per_min: '15'
  })
  const [settingsSaved, setSettingsSaved] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load conversations list for admin
  const loadConversations = useCallback(async () => {
    if (!sessionToken) return
    try {
      if (typeof window !== 'undefined' && (window as any).api?.adminGetSupportConversations) {
        const res = await (window as any).api.adminGetSupportConversations(sessionToken, {
          status: statusFilter,
          priority: priorityFilter,
          search: searchQuery
        })
        if (res?.success && res.data) {
          setConversations(res.data.conversations || [])
          setUnreadTotal(res.data.unreadTotal || 0)
        }
      }
    } catch {}
  }, [sessionToken, statusFilter, priorityFilter, searchQuery])

  // Load selected conversation details
  const loadSelectedConversation = useCallback(async (convId: string) => {
    if (!sessionToken || !convId) return
    try {
      if (typeof window !== 'undefined' && (window as any).api?.getSupportConversation) {
        const res = await (window as any).api.getSupportConversation(sessionToken, convId)
        if (res?.success && res.data) {
          setSelectedConv(res.data)
          // Mark read as agent
          await (window as any).api.markSupportRead(sessionToken, convId)
          loadConversations()
        }
      }
    } catch {}
  }, [sessionToken, loadConversations])

  // Load support settings
  const loadSettings = useCallback(async () => {
    if (!sessionToken) return
    try {
      if (typeof window !== 'undefined' && (window as any).api?.adminGetSupportSettings) {
        const res = await (window as any).api.adminGetSupportSettings(sessionToken)
        if (res?.success && res.data) {
          setSettings((prev) => ({ ...prev, ...res.data }))
        }
      }
    } catch {}
  }, [sessionToken])

  useEffect(() => {
    loadConversations()
    const timer = setInterval(loadConversations, 5000)
    return () => clearInterval(timer)
  }, [loadConversations])

  useEffect(() => {
    if (selectedConvId) {
      loadSelectedConversation(selectedConvId)
    }
  }, [selectedConvId, loadSelectedConversation])

  useEffect(() => {
    if (activeTab === 'settings') {
      loadSettings()
    }
  }, [activeTab, loadSettings])

  useEffect(() => {
    if (selectedConv?.messages) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [selectedConv?.messages])

  // Send admin reply
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sessionToken || !selectedConvId || (!replyText.trim() && !selectedFile)) return

    setLoading(true)
    try {
      if ((window as any).api?.sendSupportMessage) {
        const res = await (window as any).api.sendSupportMessage(sessionToken, selectedConvId, replyText.trim(), selectedFile)
        if (res?.success) {
          setReplyText('')
          setSelectedFile(null)
          loadSelectedConversation(selectedConvId)
        } else {
          alert(res?.error || 'Failed to send reply.')
        }
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Add internal note
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sessionToken || !selectedConvId || !internalNoteText.trim()) return

    setLoading(true)
    try {
      if ((window as any).api?.adminAddSupportInternalNote) {
        const res = await (window as any).api.adminAddSupportInternalNote(sessionToken, selectedConvId, internalNoteText.trim())
        if (res?.success) {
          setInternalNoteText('')
          setShowAddNoteModal(false)
          loadSelectedConversation(selectedConvId)
        } else {
          alert(res?.error || 'Failed to add internal note.')
        }
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Update status
  const handleUpdateStatus = async (status: string) => {
    if (!sessionToken || !selectedConvId) return
    try {
      if ((window as any).api?.adminUpdateSupportStatus) {
        await (window as any).api.adminUpdateSupportStatus(sessionToken, selectedConvId, status)
        loadSelectedConversation(selectedConvId)
      }
    } catch {}
  }

  // File upload handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1]
      setSelectedFile({
        name: file.name,
        mime: file.type || 'application/octet-stream',
        size: file.size,
        dataBase64: base64
      })
    }
    reader.readAsDataURL(file)
  }

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sessionToken) return
    setLoading(true)
    try {
      if ((window as any).api?.adminSaveSupportSettings) {
        const res = await (window as any).api.adminSaveSupportSettings(sessionToken, settings)
        if (res?.success) {
          setSettingsSaved(true)
          setTimeout(() => setSettingsSaved(false), 4000)
        } else {
          alert(res?.error || 'Failed to save support settings.')
        }
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0F0F14', color: '#CBD5E1', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      
      {/* ── Top Bar Navigation ── */}
      <div style={{ padding: '16px 24px', backgroundColor: '#14141F', borderBottom: '1px solid #2C2C3E', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ fontSize: '24px' }}>💬</span>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#F1F5F9' }}>Live Support Control Center</h2>
            <span style={{ fontSize: '12px', color: '#94A3B8' }}>Real-time user messaging, ticket assignment & support policies</span>
          </div>
        </div>

        {/* Tab Selector Buttons */}
        <div style={{ display: 'flex', gap: '8px', backgroundColor: '#161622', padding: '4px', borderRadius: '8px', border: '1px solid #2C2C3E' }}>
          <button
            type="button"
            onClick={() => setActiveTab('conversations')}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: activeTab === 'conversations' ? '#2DD4BF' : 'transparent',
              color: activeTab === 'conversations' ? '#0F0F17' : '#94A3B8',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            💬 Conversations ({unreadTotal > 0 ? `${unreadTotal} New` : conversations.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: activeTab === 'settings' ? '#2DD4BF' : 'transparent',
              color: activeTab === 'settings' ? '#0F0F17' : '#94A3B8',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            ⚙️ Support Settings
          </button>
        </div>
      </div>

      {/* ── Tab 1: Conversations Management View ── */}
      {activeTab === 'conversations' && (
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '320px 1fr 280px', height: 'calc(100vh - 120px)', overflow: 'hidden' }}>
          
          {/* Column 1: Conversations List & Search */}
          <div style={{ backgroundColor: '#14141F', borderRight: '1px solid #2C2C3E', display: 'flex', flexDirection: 'column' }}>
            
            {/* Search & Filters */}
            <div style={{ padding: '16px', borderBottom: '1px solid #2C2C3E', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                type="text"
                placeholder="🔍 Search user, email, ticket ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', backgroundColor: '#161622', border: '1px solid #2C2C3E', color: '#F1F5F9', fontSize: '13px' }}
              />

              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
                {['all', 'open', 'waiting_support', 'waiting_user', 'closed'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 700,
                      border: 'none',
                      backgroundColor: statusFilter === st ? '#2DD4BF25' : '#161622',
                      color: statusFilter === st ? '#2DD4BF' : '#94A3B8',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {st.replace('_', ' ').toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Conversations List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {conversations.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#64748B', fontSize: '13px', marginTop: '40px' }}>
                  No support tickets found matching your filter.
                </div>
              ) : (
                conversations.map((c) => {
                  const isSelected = c.id === selectedConvId
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedConvId(c.id)}
                      style={{
                        padding: '12px',
                        borderRadius: '10px',
                        backgroundColor: isSelected ? '#161622' : '#0F0F14',
                        border: isSelected ? '1px solid #2DD4BF' : '1px solid #2C2C3E',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 700, color: '#F1F5F9', fontSize: '13px' }}>{c.user_name || c.user_email}</span>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 700,
                          backgroundColor: c.status === 'open' ? '#3B82F620' : c.status === 'waiting_support' ? '#EF444420' : '#2C2C3E',
                          color: c.status === 'open' ? '#60A5FA' : c.status === 'waiting_support' ? '#F87171' : '#94A3B8'
                        }}>
                          {c.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>

                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#CBD5E1', marginBottom: '4px' }}>
                        {c.subject}
                      </div>

                      <div style={{ fontSize: '11px', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.last_message_preview || 'No messages'}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748B', marginTop: '8px' }}>
                        <span>{new Date(c.last_message_at).toLocaleDateString()}</span>
                        {(c.unread_count || 0) > 0 && (
                          <span style={{ backgroundColor: '#EF4444', color: '#FFF', padding: '1px 6px', borderRadius: '8px', fontWeight: 800 }}>
                            {c.unread_count} UNREAD
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Column 2: Selected Conversation Messages Thread */}
          <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#0F0F14', overflow: 'hidden' }}>
            {!selectedConvId || !selectedConv ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B', fontSize: '15px' }}>
                👈 Select a support conversation to reply
              </div>
            ) : (
              <>
                {/* Chat Header Controls */}
                <div style={{ padding: '16px 20px', backgroundColor: '#14141F', borderBottom: '1px solid #2C2C3E', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px', fontSize: '16px', color: '#F1F5F9' }}>{selectedConv.subject}</h3>
                    <span style={{ fontSize: '12px', color: '#94A3B8' }}>Ticket #{selectedConv.id} • User: {selectedConv.user_name} ({selectedConv.user_email})</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <select
                      value={selectedConv.status}
                      onChange={(e) => handleUpdateStatus(e.target.value)}
                      style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: '#161622', border: '1px solid #2C2C3E', color: '#2DD4BF', fontWeight: 700, fontSize: '12px' }}
                    >
                      <option value="open">Status: Open</option>
                      <option value="pending">Status: Pending</option>
                      <option value="waiting_user">Status: Waiting User</option>
                      <option value="waiting_support">Status: Waiting Support</option>
                      <option value="closed">Status: Closed</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => setShowAddNoteModal(true)}
                      style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: '#F59E0B20', border: '1px solid #F59E0B50', color: '#F59E0B', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
                    >
                      🔒 Add Internal Note
                    </button>
                  </div>
                </div>

                {/* Internal Notes Banner Display */}
                {selectedConv.internal_notes && selectedConv.internal_notes.length > 0 && (
                  <div style={{ backgroundColor: '#F59E0B10', borderBottom: '1px solid #F59E0B30', padding: '10px 20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#F59E0B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>🔒 INTERNAL STAFF NOTES ({selectedConv.internal_notes.length})</span>
                    </div>
                    {selectedConv.internal_notes.map((n: SupportInternalNote) => (
                      <div key={n.id} style={{ fontSize: '12px', color: '#CBD5E1', backgroundColor: '#14141F', padding: '8px 12px', borderRadius: '6px', border: '1px solid #F59E0B40' }}>
                        <span style={{ fontWeight: 700, color: '#F59E0B' }}>{n.agent_name}:</span> {n.note}
                        <span style={{ fontSize: '10px', color: '#64748B', float: 'right' }}>{new Date(n.created_at).toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Messages Thread */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {selectedConv.messages?.map((m: SupportMessage) => {
                    const isAgent = m.sender_type === 'agent'
                    return (
                      <div
                        key={m.id}
                        style={{
                          alignSelf: isAgent ? 'flex-end' : 'flex-start',
                          maxWidth: '75%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isAgent ? 'flex-end' : 'flex-start'
                        }}
                      >
                        <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '3px' }}>
                          {isAgent ? 'Support Agent' : selectedConv.user_name}
                        </div>

                        <div style={{
                          padding: '12px 16px',
                          borderRadius: isAgent ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                          backgroundColor: isAgent ? '#2DD4BF' : '#161622',
                          color: isAgent ? '#0F0F17' : '#F1F5F9',
                          fontSize: '13.5px',
                          lineHeight: 1.5,
                          border: isAgent ? 'none' : '1px solid #2C2C3E',
                          boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
                          whiteSpace: 'pre-wrap'
                        }}>
                          {m.message}

                          {m.attachment_name && (
                            <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: isAgent ? '1px solid #0F0F1730' : '1px solid #2C2C3E', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>📎</span>
                              <span style={{ fontWeight: 700, textDecoration: 'underline' }}>{m.attachment_name}</span>
                              <span style={{ fontSize: '10px' }}>({((m.attachment_size || 0) / 1024).toFixed(1)} KB)</span>
                            </div>
                          )}
                        </div>

                        <div style={{ fontSize: '10px', color: '#64748B', marginTop: '4px' }}>
                          {new Date(m.created_at).toLocaleString()}
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply Form */}
                <form onSubmit={handleSendReply} style={{ padding: '16px', backgroundColor: '#14141F', borderTop: '1px solid #2C2C3E', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {selectedFile && (
                    <div style={{ fontSize: '12px', color: '#2DD4BF', backgroundColor: '#161622', padding: '6px 12px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>📎 Attached: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                      <button type="button" onClick={() => setSelectedFile(null)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer' }}>✕</button>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <label style={{ cursor: 'pointer', padding: '10px', color: '#94A3B8', fontSize: '18px' }} title="Attach file">
                      📎
                      <input type="file" onChange={handleFileChange} style={{ display: 'none' }} />
                    </label>

                    <textarea
                      rows={2}
                      placeholder="Type a support response to the user..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', backgroundColor: '#161622', border: '1px solid #2C2C3E', color: '#F1F5F9', fontSize: '13px', resize: 'none' }}
                    />

                    <button
                      type="submit"
                      disabled={loading || (!replyText.trim() && !selectedFile)}
                      style={{
                        padding: '12px 24px',
                        borderRadius: '10px',
                        backgroundColor: '#2DD4BF',
                        color: '#0F0F17',
                        fontWeight: 800,
                        fontSize: '13px',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      {loading ? 'Sending...' : 'Send Reply'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>

          {/* Column 3: User Info Sidebar Panel */}
          <div style={{ backgroundColor: '#14141F', borderLeft: '1px solid #2C2C3E', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {!selectedConv ? (
              <div style={{ color: '#64748B', fontSize: '13px' }}>Select a ticket to view user profile data.</div>
            ) : (
              <>
                <div style={{ borderBottom: '1px solid #2C2C3E', paddingBottom: '14px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', marginBottom: '4px' }}>USER ACCOUNT</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#F1F5F9' }}>{selectedConv.user_name}</div>
                  <div style={{ fontSize: '12px', color: '#2DD4BF' }}>{selectedConv.user_email}</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748B', display: 'block' }}>SUBSCRIPTION PLAN</span>
                    <span style={{ fontWeight: 800, color: '#A5B4FC' }}>💳 {selectedConv.user_plan || 'Starter Plan'}</span>
                  </div>

                  <div>
                    <span style={{ fontSize: '11px', color: '#64748B', display: 'block' }}>ACCOUNT STATUS</span>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: selectedConv.user_status === 'active' ? '#10B98120' : '#EF444420',
                      color: selectedConv.user_status === 'active' ? '#10B981' : '#F87171'
                    }}>
                      {selectedConv.user_status?.toUpperCase() || 'ACTIVE'}
                    </span>
                  </div>

                  <div>
                    <span style={{ fontSize: '11px', color: '#64748B', display: 'block' }}>MEMBER SINCE</span>
                    <span style={{ fontWeight: 600, color: '#F1F5F9' }}>{new Date(selectedConv.user_created_at || Date.now()).toLocaleDateString()}</span>
                  </div>

                  <div>
                    <span style={{ fontSize: '11px', color: '#64748B', display: 'block' }}>TICKET PRIORITY</span>
                    <span style={{ fontWeight: 700, color: '#F59E0B' }}>🔥 {selectedConv.priority.toUpperCase()}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Tab 2: Live Support Settings View ── */}
      {activeTab === 'settings' && (
        <div style={{ flex: 1, padding: '32px', overflowY: 'auto', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
          
          {settingsSaved && (
            <div style={{ backgroundColor: '#10B98120', border: '1px solid #10B98150', color: '#34D399', padding: '12px 20px', borderRadius: '10px', marginBottom: '24px', fontWeight: 700, fontSize: '14px' }}>
              ✓ Support System Settings updated successfully!
            </div>
          )}

          <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* General Availability Settings */}
            <div style={{ backgroundColor: '#14141F', border: '1px solid #2C2C3E', borderRadius: '14px', padding: '24px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#F1F5F9' }}>🌐 Availability & Operations</h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8', display: 'block', marginBottom: '6px' }}>ENABLE LIVE SUPPORT SYSTEM</label>
                  <select
                    value={settings.support_enabled}
                    onChange={(e) => setSettings({ ...settings, support_enabled: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#161622', border: '1px solid #2C2C3E', color: '#F1F5F9', fontSize: '13px' }}
                  >
                    <option value="true">Enabled (Widget Visible)</option>
                    <option value="false">Disabled (Widget Hidden)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8', display: 'block', marginBottom: '6px' }}>BUSINESS HOURS</label>
                  <input
                    type="text"
                    value={settings.business_hours}
                    onChange={(e) => setSettings({ ...settings, business_hours: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#161622', border: '1px solid #2C2C3E', color: '#F1F5F9', fontSize: '13px' }}
                  />
                </div>
              </div>
            </div>

            {/* Messages & Auto-Reply Settings */}
            <div style={{ backgroundColor: '#14141F', border: '1px solid #2C2C3E', borderRadius: '14px', padding: '24px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#F1F5F9' }}>🤖 Automated Responses & Messaging</h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8', display: 'block', marginBottom: '6px' }}>WELCOME MESSAGE</label>
                  <input
                    type="text"
                    value={settings.welcome_message}
                    onChange={(e) => setSettings({ ...settings, welcome_message: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#161622', border: '1px solid #2C2C3E', color: '#F1F5F9', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8', display: 'block', marginBottom: '6px' }}>AUTOMATIC FIRST RESPONSE</label>
                  <textarea
                    rows={3}
                    value={settings.auto_reply_message}
                    onChange={(e) => setSettings({ ...settings, auto_reply_message: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#161622', border: '1px solid #2C2C3E', color: '#F1F5F9', fontSize: '13px', resize: 'none' }}
                  />
                </div>
              </div>
            </div>

            {/* File Attachments & Anti-Spam Security */}
            <div style={{ backgroundColor: '#14141F', border: '1px solid #2C2C3E', borderRadius: '14px', padding: '24px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#F1F5F9' }}>🔒 File Attachments & Anti-Spam Limits</h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8', display: 'block', marginBottom: '6px' }}>MAX ATTACHMENT SIZE (MB)</label>
                  <input
                    type="number"
                    value={settings.max_attachment_size_mb}
                    onChange={(e) => setSettings({ ...settings, max_attachment_size_mb: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#161622', border: '1px solid #2C2C3E', color: '#F1F5F9', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8', display: 'block', marginBottom: '6px' }}>MAX OPEN TICKETS PER USER</label>
                  <input
                    type="number"
                    value={settings.max_open_conversations_per_user}
                    onChange={(e) => setSettings({ ...settings, max_open_conversations_per_user: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#161622', border: '1px solid #2C2C3E', color: '#F1F5F9', fontSize: '13px' }}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '14px 28px',
                borderRadius: '10px',
                backgroundColor: '#2DD4BF',
                color: '#0F0F17',
                fontWeight: 800,
                fontSize: '15px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(45,212,191,0.3)'
              }}
            >
              {loading ? 'Saving...' : '💾 Save Support Settings'}
            </button>
          </form>
        </div>
      )}

      {/* ── Internal Staff Note Modal ── */}
      {showAddNoteModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div style={{ width: '90%', maxWidth: '440px', backgroundColor: '#161622', border: '1px solid #2C2C3E', borderRadius: '16px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: '16px', color: '#F59E0B' }}>🔒 Add Internal Staff Note</h3>
            <p style={{ fontSize: '12px', color: '#94A3B8', margin: '0 0 16px' }}>Internal notes are visible ONLY to administrators and support staff. Users cannot see internal notes.</p>
            
            <form onSubmit={handleAddNote} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <textarea
                required
                rows={4}
                placeholder="Type internal note details..."
                value={internalNoteText}
                onChange={(e) => setInternalNoteText(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#F1F5F9', fontSize: '13px', resize: 'none' }}
              />

              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={() => setShowAddNoteModal(false)} style={{ flex: 1, padding: '10px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#94A3B8', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={loading} style={{ flex: 1, padding: '10px', borderRadius: '8px', backgroundColor: '#F59E0B', color: '#0F0F17', fontWeight: 800, border: 'none', cursor: 'pointer' }}>Save Note</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
