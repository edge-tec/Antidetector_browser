// ──────────────────────────────────────────────
// ProfileVault — User Live Support Chat Widget Component
// ──────────────────────────────────────────────

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { SupportConversation, SupportMessage } from '../types'

export const SupportChatWidget: React.FC = () => {
  const { sessionToken, currentUser } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [conversations, setConversations] = useState<SupportConversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [activeConv, setActiveConv] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  // New ticket state
  const [isCreatingTicket, setIsCreatingTicket] = useState(false)
  const [newSubject, setNewSubject] = useState('')
  const [newMessage, setNewMessage] = useState('')
  const [newPriority, setNewPriority] = useState('normal')

  // Chat message input state
  const [chatInput, setChatInput] = useState('')
  const [selectedFile, setSelectedFile] = useState<{ name: string; mime: string; size: number; dataBase64: string } | null>(null)
  const [isTyping, setIsTyping] = useState(false)
  const [supportIsTyping, setSupportIsTyping] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimerRef = useRef<any>(null)

  const unreadTotal = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0)

  // Load conversations list
  const loadConversations = useCallback(async () => {
    if (!sessionToken) return
    try {
      if (typeof window !== 'undefined' && (window as any).api?.getSupportConversations) {
        const res = await (window as any).api.getSupportConversations(sessionToken)
        if (res?.success && res.data) {
          setConversations(res.data)
        }
      }
    } catch {}
  }, [sessionToken])

  // Load single active conversation detail
  const loadActiveConversation = useCallback(async (convId: string) => {
    if (!sessionToken || !convId) return
    try {
      if (typeof window !== 'undefined' && (window as any).api?.getSupportConversation) {
        const res = await (window as any).api.getSupportConversation(sessionToken, convId)
        if (res?.success && res.data) {
          setActiveConv(res.data)
          // Mark messages read
          await (window as any).api.markSupportRead(sessionToken, convId)
          loadConversations()
        }
      }
    } catch {}
  }, [sessionToken, loadConversations])

  useEffect(() => {
    if (sessionToken && currentUser) {
      loadConversations()
      const interval = setInterval(loadConversations, 5000)
      return () => clearInterval(interval)
    }
  }, [sessionToken, currentUser, loadConversations])

  useEffect(() => {
    if (activeConvId) {
      loadActiveConversation(activeConvId)
    }
  }, [activeConvId, loadActiveConversation])

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (activeConv?.messages) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [activeConv?.messages, supportIsTyping])

  // Real-time IPC listeners
  useEffect(() => {
    if (typeof window === 'undefined' || !(window as any).api) return

    const unsubMsg = (window as any).api.onSupportNewMessage((_: any, data: any) => {
      if (data?.conversationId === activeConvId) {
        loadActiveConversation(activeConvId)
      } else {
        loadConversations()
      }
    })

    const unsubTyping = (window as any).api.onSupportTypingIndicator((_: any, data: any) => {
      if (data?.conversationId === activeConvId && data?.senderType === 'agent') {
        setSupportIsTyping(data.isTyping)
      }
    })

    const unsubStatus = (window as any).api.onSupportStatusUpdated((_: any, data: any) => {
      if (data?.conversationId === activeConvId) {
        loadActiveConversation(activeConvId)
      }
      loadConversations()
    })

    return () => {
      if (typeof unsubMsg === 'function') unsubMsg()
      if (typeof unsubTyping === 'function') unsubTyping()
      if (typeof unsubStatus === 'function') unsubStatus()
    }
  }, [activeConvId, loadActiveConversation, loadConversations])

  // Handle typing notification
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setChatInput(e.target.value)

    if (!sessionToken || !activeConvId) return

    if (!isTyping) {
      setIsTyping(true)
      if ((window as any).api?.sendSupportTyping) {
        (window as any).api.sendSupportTyping(sessionToken, activeConvId, true)
      }
    }

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    typingTimerRef.current = setTimeout(() => {
      setIsTyping(false)
      if ((window as any).api?.sendSupportTyping) {
        (window as any).api.sendSupportTyping(sessionToken, activeConvId, false)
      }
    }, 2000)
  }

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      alert('File size exceeds 10 MB limit.')
      return
    }

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

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sessionToken || !activeConvId || (!chatInput.trim() && !selectedFile)) return

    setLoading(true)
    try {
      if ((window as any).api?.sendSupportMessage) {
        const res = await (window as any).api.sendSupportMessage(sessionToken, activeConvId, chatInput.trim(), selectedFile)
        if (res?.success) {
          setChatInput('')
          setSelectedFile(null)
          loadActiveConversation(activeConvId)
        } else {
          alert(res?.error || 'Failed to send message.')
        }
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Create new conversation
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sessionToken || !newSubject.trim() || !newMessage.trim()) return

    setLoading(true)
    try {
      if ((window as any).api?.createSupportConversation) {
        const res = await (window as any).api.createSupportConversation(sessionToken, {
          subject: newSubject.trim(),
          initialMessage: newMessage.trim(),
          priority: newPriority,
          attachment: selectedFile
        })
        if (res?.success && res.data) {
          setNewSubject('')
          setNewMessage('')
          setSelectedFile(null)
          setIsCreatingTicket(false)
          setActiveConvId(res.data.id)
          loadConversations()
        } else {
          alert(res?.error || 'Failed to create support ticket.')
        }
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  if (!currentUser) return null

  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      
      {/* ── Floating Launcher Button ── */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '14px 22px',
            borderRadius: '30px',
            backgroundColor: '#2DD4BF',
            color: '#0F0F17',
            border: 'none',
            fontWeight: 800,
            fontSize: '14px',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(45,212,191,0.4)',
            transition: 'all 0.2s ease',
            position: 'relative'
          }}
        >
          <span style={{ fontSize: '18px' }}>💬</span>
          <span>Live Support</span>
          {unreadTotal > 0 && (
            <span style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              backgroundColor: '#EF4444',
              color: '#FFF',
              borderRadius: '10px',
              padding: '2px 7px',
              fontSize: '11px',
              fontWeight: 800
            }}>
              {unreadTotal}
            </span>
          )}
        </button>
      )}

      {/* ── Main Support Chat Modal Window ── */}
      {isOpen && (
        <div style={{
          width: '380px',
          height: '540px',
          backgroundColor: '#161622',
          border: '1px solid #2C2C3E',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
          overflow: 'hidden'
        }}>
          
          {/* Header */}
          <div style={{
            padding: '14px 18px',
            backgroundColor: '#14141F',
            borderBottom: '1px solid #2C2C3E',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ position: 'relative' }}>
                <span style={{ fontSize: '20px' }}>🛡️</span>
                <span style={{ position: 'absolute', bottom: 0, right: 0, width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#10B981', border: '2px solid #14141F' }} />
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#F1F5F9' }}>ProfileVault Support</div>
                <div style={{ fontSize: '11px', color: '#10B981', fontWeight: 600 }}>● Agents Online</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {activeConvId && (
                <button
                  type="button"
                  onClick={() => { setActiveConvId(null); setIsCreatingTicket(false) }}
                  style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '12px', cursor: 'pointer' }}
                >
                  ◀ Tickets
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column' }}>
            
            {/* View 1: Ticket List View */}
            {!activeConvId && !isCreatingTicket && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', height: '100%' }}>
                <button
                  type="button"
                  onClick={() => setIsCreatingTicket(true)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '10px',
                    backgroundColor: '#2DD4BF',
                    color: '#0F0F17',
                    fontWeight: 800,
                    fontSize: '13px',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <span>✏️</span> Start New Support Ticket
                </button>

                <div style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8', marginTop: '6px' }}>
                  YOUR RECENT TICKETS
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto' }}>
                  {conversations.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#64748B', fontSize: '13px', marginTop: '40px' }}>
                      No support conversations yet.<br />Click above to start a ticket!
                    </div>
                  ) : (
                    conversations.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => setActiveConvId(c.id)}
                        style={{
                          padding: '12px',
                          borderRadius: '10px',
                          backgroundColor: '#14141F',
                          border: '1px solid #2C2C3E',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 700, color: '#F1F5F9', fontSize: '13px' }}>{c.subject}</span>
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 700,
                            backgroundColor: c.status === 'open' ? '#3B82F620' : c.status === 'waiting_user' ? '#F59E0B20' : '#2C2C3E',
                            color: c.status === 'open' ? '#60A5FA' : c.status === 'waiting_user' ? '#F59E0B' : '#94A3B8'
                          }}>
                            {c.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#94A3B8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.last_message_preview || 'No messages yet'}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748B', marginTop: '6px' }}>
                          <span>{new Date(c.last_message_at).toLocaleDateString()}</span>
                          {(c.unread_count || 0) > 0 && (
                            <span style={{ backgroundColor: '#EF4444', color: '#FFF', padding: '1px 5px', borderRadius: '8px', fontWeight: 800 }}>
                              {c.unread_count} UNREAD
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* View 2: Create New Ticket Form */}
            {!activeConvId && isCreatingTicket && (
              <form onSubmit={handleCreateTicket} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#F1F5F9', marginBottom: '4px' }}>
                  Open New Support Ticket
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', display: 'block', marginBottom: '4px' }}>SUBJECT / ISSUE</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Proxy Connection Assistance"
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#F1F5F9', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', display: 'block', marginBottom: '4px' }}>PRIORITY</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#F1F5F9', fontSize: '13px' }}
                  >
                    <option value="low">Low Priority</option>
                    <option value="normal">Normal Priority</option>
                    <option value="high">High Priority</option>
                    <option value="urgent">Urgent Priority</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', display: 'block', marginBottom: '4px' }}>MESSAGE BODY</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Describe your issue or request in detail..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#F1F5F9', fontSize: '13px', resize: 'none' }}
                  />
                </div>

                {/* File Attachment Input */}
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', display: 'block', marginBottom: '4px' }}>ATTACH FILE (OPTIONAL)</label>
                  <input type="file" onChange={handleFileChange} style={{ fontSize: '12px', color: '#94A3B8' }} />
                  {selectedFile && <div style={{ fontSize: '11px', color: '#2DD4BF', marginTop: '4px' }}>✓ Attached: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)</div>}
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setIsCreatingTicket(false)}
                    style={{ flex: 1, padding: '10px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#94A3B8', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    style={{ flex: 1, padding: '10px', borderRadius: '8px', backgroundColor: '#2DD4BF', color: '#0F0F17', fontWeight: 800, border: 'none', cursor: 'pointer' }}
                  >
                    {loading ? 'Submitting...' : 'Submit Ticket'}
                  </button>
                </div>
              </form>
            )}

            {/* View 3: Active Live Chat Thread View */}
            {activeConvId && activeConv && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                
                {/* Subject Header */}
                <div style={{ padding: '8px 12px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', borderRadius: '8px', marginBottom: '12px', fontSize: '12px' }}>
                  <span style={{ fontWeight: 700, color: '#F1F5F9' }}>{activeConv.subject}</span>
                  <span style={{ fontSize: '10px', color: '#94A3B8', marginLeft: '8px' }}>({activeConv.status})</span>
                </div>

                {/* Messages Thread */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
                  {activeConv.messages?.map((m: SupportMessage) => {
                    const isUser = m.sender_type === 'user'
                    return (
                      <div
                        key={m.id}
                        style={{
                          alignSelf: isUser ? 'flex-end' : 'flex-start',
                          maxWidth: '82%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isUser ? 'flex-end' : 'flex-start'
                        }}
                      >
                        <div style={{ fontSize: '10px', color: '#64748B', marginBottom: '2px' }}>
                          {isUser ? 'You' : (m.sender_name || 'Support Agent')}
                        </div>

                        <div style={{
                          padding: '10px 14px',
                          borderRadius: isUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                          backgroundColor: isUser ? '#2DD4BF' : '#2C2C3E',
                          color: isUser ? '#0F0F17' : '#F1F5F9',
                          fontSize: '13px',
                          lineHeight: 1.5,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                          whiteSpace: 'pre-wrap'
                        }}>
                          {m.message}

                          {/* Attachment Link */}
                          {m.attachment_name && (
                            <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: isUser ? '1px solid #0F0F1730' : '1px solid #ffffff20', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>📎</span>
                              <span style={{ fontWeight: 700, textDecoration: 'underline' }}>{m.attachment_name}</span>
                            </div>
                          )}
                        </div>

                        <div style={{ fontSize: '9px', color: '#64748B', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {isUser && (
                            <span style={{ color: m.is_read ? '#10B981' : '#64748B', fontWeight: 800 }}>
                              {m.is_read ? '✓✓ Read' : '✓ Sent'}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {/* Support is Typing Indicator */}
                  {supportIsTyping && (
                    <div style={{ alignSelf: 'flex-start', fontSize: '11px', color: '#2DD4BF', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="typing-dots">Support is typing...</span>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Input Footer Form */}
                <form onSubmit={handleSendMessage} style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedFile && (
                    <div style={{ fontSize: '11px', color: '#2DD4BF', backgroundColor: '#14141F', padding: '4px 8px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>📎 {selectedFile.name}</span>
                      <button type="button" onClick={() => setSelectedFile(null)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer' }}>✕</button>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <label style={{ cursor: 'pointer', padding: '8px', color: '#94A3B8', fontSize: '16px' }} title="Attach file">
                      📎
                      <input type="file" onChange={handleFileChange} style={{ display: 'none' }} />
                    </label>

                    <input
                      type="text"
                      placeholder="Type a message..."
                      value={chatInput}
                      onChange={handleInputChange}
                      style={{ flex: 1, padding: '10px 14px', borderRadius: '20px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#F1F5F9', fontSize: '13px' }}
                    />

                    <button
                      type="submit"
                      disabled={loading || (!chatInput.trim() && !selectedFile)}
                      style={{
                        padding: '10px 16px',
                        borderRadius: '20px',
                        backgroundColor: '#2DD4BF',
                        color: '#0F0F17',
                        fontWeight: 800,
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      🚀
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
