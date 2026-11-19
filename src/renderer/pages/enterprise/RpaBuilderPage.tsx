import React, { useState, useEffect, useCallback } from 'react'
import { enterpriseService } from '../../services/enterpriseService'
import type { Profile } from '../../types'
import type { RpaActionType, RpaStep, RpaWorkflow, RpaExecutionRecord, ShowToastFn } from '../../types/enterprise'

const ACTION_PALETTE: Array<{ type: RpaActionType; label: string; icon: string }> = [
  { type: 'open_url', label: 'Open URL', icon: '🌐' },
  { type: 'wait', label: 'Wait (ms)', icon: '⏱️' },
  { type: 'click', label: 'Click Element', icon: '🖱️' },
  { type: 'type', label: 'Type Text', icon: '⌨️' },
  { type: 'select', label: 'Select Dropdown', icon: '📋' },
  { type: 'scroll', label: 'Scroll Page', icon: '↕️' },
  { type: 'screenshot', label: 'Screenshot', icon: '📸' },
  { type: 'extract', label: 'Extract Text', icon: '📤' },
  { type: 'back', label: 'Navigate Back', icon: '⬅️' },
  { type: 'forward', label: 'Navigate Forward', icon: '➡️' },
  { type: 'set_variable', label: 'Set Variable', icon: '🏷️' },
  { type: 'condition', label: 'Condition (If)', icon: '🔀' },
  { type: 'loop', label: 'Loop Block', icon: '🔁' }
]

export function RpaBuilderPage({ showToast }: { showToast: ShowToastFn }) {
  const [workflows, setWorkflows] = useState<RpaWorkflow[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('New QA Workflow')
  const [description, setDescription] = useState('')
  const [scheduleCron, setScheduleCron] = useState('')
  const [scheduleTz, setScheduleTz] = useState('UTC')
  const [maxRetries, setMaxRetries] = useState(1)
  const [steps, setSteps] = useState<RpaStep[]>([
    { id: 'step-1', type: 'open_url', label: 'Open target page', url: 'https://example.com' },
    { id: 'step-2', type: 'wait', label: 'Wait 1.5s', ms: 1500 }
  ])
  const [selectedStepId, setSelectedStepId] = useState<string>('step-1')
  const [targetProfileId, setTargetProfileId] = useState('')
  const [lastExecution, setLastExecution] = useState<RpaExecutionRecord | null>(null)
  const [running, setRunning] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [wfList, profRes] = await Promise.all([
        enterpriseService.listWorkflows(),
        window.api.getProfiles()
      ])
      setWorkflows(wfList || [])
      if (profRes?.success && Array.isArray(profRes.data)) setProfiles(profRes.data)
    } catch (err: any) {
      showToast('error', `Failed to load RPA workflows: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const addStep = (type: RpaActionType) => {
    const id = `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const newStep: RpaStep = {
      id,
      type,
      label: ACTION_PALETTE.find((a) => a.type === type)?.label || type,
      ...(type === 'open_url' ? { url: 'https://example.com' } : {}),
      ...(type === 'wait' ? { ms: 1000 } : {}),
      ...(type === 'scroll' ? { deltaY: 400 } : {}),
      ...(type === 'loop' ? { loopCount: 2, children: [] } : {})
    }
    setSteps((prev) => [...prev, newStep])
    setSelectedStepId(id)
  }

  const updateStep = (id: string, patch: Partial<RpaStep>) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  const moveStep = (index: number, delta: -1 | 1) => {
    const next = index + delta
    if (next < 0 || next >= steps.length) return
    const copy = [...steps]
    const [item] = copy.splice(index, 1)
    copy.splice(next, 0, item)
    setSteps(copy)
  }

  const removeStep = (id: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== id))
  }

  const handleSaveWorkflow = async () => {
    if (!name.trim()) return showToast('warning', 'Workflow name is required.')
    try {
      await enterpriseService.createWorkflow({
        name: name.trim(),
        description,
        steps,
        scheduleCron,
        scheduleTz,
        scheduleActive: !!scheduleCron.trim(),
        maxRetries
      })
      showToast('success', `Saved workflow "${name.trim()}"`)
      await loadData()
    } catch (err: any) {
      showToast('error', err.message)
    }
  }

  const handleExecute = async (workflowId: string) => {
    if (!targetProfileId) return showToast('warning', 'Select a running target profile first.')
    setRunning(true)
    try {
      const exec = await enterpriseService.executeWorkflow(workflowId, targetProfileId)
      setLastExecution(exec)
      showToast(exec.status === 'completed' ? 'success' : 'warning', `Workflow finished with status: ${exec.status}`)
    } catch (err: any) {
      showToast('error', err.message)
    } finally {
      setRunning(false)
    }
  }

  const handleDeleteWorkflow = async (id: string) => {
    try {
      await enterpriseService.deleteWorkflow(id)
      showToast('success', 'Workflow deleted')
      await loadData()
    } catch (err: any) {
      showToast('error', err.message)
    }
  }

  const handleExportJson = () => {
    const json = JSON.stringify({ name, description, steps, scheduleCron, scheduleTz, maxRetries }, null, 2)
    navigator.clipboard.writeText(json)
    showToast('success', 'Workflow JSON copied to clipboard')
  }

  const selectedStep = steps.find((s) => s.id === selectedStepId) || null

  if (loading) {
    return <div className="loading-state"><div className="loading-spinner" /><span>Loading Visual RPA Builder...</span></div>
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Visual RPA Automation Builder</h1>
          <p className="page-subtitle">Build, schedule, and run authorized browser workflows on active profiles</p>
        </div>
        <div className="page-actions" style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={handleExportJson}>Export JSON</button>
          <button className="btn btn-primary" onClick={handleSaveWorkflow}>Save Workflow</button>
        </div>
      </div>

      {/* Editor 3-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 290px', gap: 16, marginBottom: 20 }}>
        {/* Action Palette */}
        <div className="card" style={{ padding: 14 }}>
          <h4 style={{ margin: '0 0 10px', fontSize: 13 }}>Action Library</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {ACTION_PALETTE.map((a) => (
              <button
                key={a.type}
                className="btn btn-secondary btn-sm"
                style={{ justifyContent: 'flex-start', gap: 8 }}
                onClick={() => addStep(a.type)}
              >
                <span>{a.icon}</span>
                <span>{a.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Workflow Canvas */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Workflow Name" style={{ flex: 1 }} />
            <input className="form-input" value={scheduleCron} onChange={(e) => setScheduleCron(e.target.value)} placeholder="Cron (e.g. 0 9 * * *)" style={{ width: 170 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 280 }}>
            {steps.length === 0 ? (
              <div className="empty-state">Click an action from the left library to add steps to your workflow.</div>
            ) : (
              steps.map((step, idx) => (
                <div
                  key={step.id}
                  onClick={() => setSelectedStepId(step.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    border: `1px solid ${selectedStepId === step.id ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    background: selectedStepId === step.id ? 'var(--color-accent-subtle)' : 'var(--color-bg-tertiary)'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                      {idx + 1}. [{step.type}] {step.label || step.url || step.selector || ''}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                      {step.url || step.selector || (step.ms ? `${step.ms}ms` : '') || step.value || ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); moveStep(idx, -1) }}>↑</button>
                    <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); moveStep(idx, 1) }}>↓</button>
                    <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); removeStep(step.id) }}>✕</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Step Configuration Sidebar */}
        <div className="card" style={{ padding: 14 }}>
          <h4 style={{ margin: '0 0 10px', fontSize: 13 }}>Step Configuration</h4>
          {!selectedStep ? (
            <div className="text-secondary" style={{ fontSize: 12 }}>Select a step on the canvas to configure it.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label className="form-label">Label</label>
                <input className="form-input" value={selectedStep.label || ''} onChange={(e) => updateStep(selectedStep.id, { label: e.target.value })} />
              </div>
              {selectedStep.type === 'open_url' && (
                <div>
                  <label className="form-label">Target URL</label>
                  <input className="form-input" value={selectedStep.url || ''} onChange={(e) => updateStep(selectedStep.id, { url: e.target.value })} />
                </div>
              )}
              {(['click', 'type', 'select', 'extract'].includes(selectedStep.type)) && (
                <div>
                  <label className="form-label">CSS Selector</label>
                  <input className="form-input" value={selectedStep.selector || ''} onChange={(e) => updateStep(selectedStep.id, { selector: e.target.value })} placeholder="#submit-btn" />
                </div>
              )}
              {(['type', 'select', 'set_variable'].includes(selectedStep.type)) && (
                <div>
                  <label className="form-label">Value</label>
                  <input className="form-input" value={selectedStep.value || ''} onChange={(e) => updateStep(selectedStep.id, { value: e.target.value })} />
                </div>
              )}
              {selectedStep.type === 'wait' && (
                <div>
                  <label className="form-label">Duration (ms)</label>
                  <input type="number" className="form-input" value={selectedStep.ms || 1000} onChange={(e) => updateStep(selectedStep.id, { ms: Number(e.target.value) })} />
                </div>
              )}
              {selectedStep.type === 'scroll' && (
                <div>
                  <label className="form-label">Scroll Delta Y (px)</label>
                  <input type="number" className="form-input" value={selectedStep.deltaY || 400} onChange={(e) => updateStep(selectedStep.id, { deltaY: Number(e.target.value) })} />
                </div>
              )}
              {(['extract', 'set_variable', 'screenshot'].includes(selectedStep.type)) && (
                <div>
                  <label className="form-label">Variable Name</label>
                  <input className="form-input" value={selectedStep.variableName || ''} onChange={(e) => updateStep(selectedStep.id, { variableName: e.target.value })} />
                </div>
              )}
              {selectedStep.type === 'loop' && (
                <div>
                  <label className="form-label">Loop Count</label>
                  <input type="number" className="form-input" value={selectedStep.loopCount || 2} onChange={(e) => updateStep(selectedStep.id, { loopCount: Number(e.target.value) })} />
                </div>
              )}
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 10 }}>
                <label className="form-label">Scheduler Timezone & Retries</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="form-input" value={scheduleTz} onChange={(e) => setScheduleTz(e.target.value)} style={{ flex: 1 }} />
                  <input type="number" className="form-input" value={maxRetries} onChange={(e) => setMaxRetries(Number(e.target.value))} style={{ width: 64 }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Saved Workflows & Execution Runner */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>Saved Workflows ({workflows.length})</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select className="form-select" value={targetProfileId} onChange={(e) => setTargetProfileId(e.target.value)} style={{ width: 220 }}>
              <option value="">— Target Running Profile —</option>
              {profiles.filter((p) => p.status === 'running').map((p) => (
                <option key={p.id} value={p.id}>{p.name} (Running)</option>
              ))}
            </select>
          </div>
        </div>
        {workflows.length === 0 ? (
          <div className="text-secondary">No saved workflows yet. Build one above and click Save Workflow.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {workflows.map((wf) => (
              <div key={wf.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{wf.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    {wf.steps.length} steps {wf.scheduleCron ? `• Cron: ${wf.scheduleCron} (${wf.scheduleTz})` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary btn-sm" disabled={running || !targetProfileId} onClick={() => handleExecute(wf.id)}>
                    {running ? 'Running...' : '▶ Run'}
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setName(wf.name); setSteps(wf.steps); setScheduleCron(wf.scheduleCron) }}>Load</button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDeleteWorkflow(wf.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {lastExecution && (
          <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: 'var(--color-bg-tertiary)', fontFamily: 'monospace', fontSize: 12 }}>
            <div><strong>Last Execution:</strong> {lastExecution.id.slice(0, 8)} • Status: <strong>{lastExecution.status.toUpperCase()}</strong> {lastExecution.error ? `• Error: ${lastExecution.error}` : ''}</div>
            {lastExecution.logs.map((l, i) => (
              <div key={i} style={{ color: 'var(--color-text-secondary)' }}>[{new Date(l.timestamp).toLocaleTimeString()}] {l.message}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
