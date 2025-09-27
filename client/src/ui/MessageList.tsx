type StepFrame = { decision_id: string; step: number; name: string; payload: unknown; kind?: 'step'|'final' }
type Msg = { role: 'user'|'assistant', content?: string, json?: boolean, stream?: boolean, kind?: 'json'|'steps', steps?: StepFrame[] }

export function MessageList({ messages }: { messages: Msg[] }) {
  return (
    <div className="messages">
      {messages.map((m, i) => (
        <div key={i} className={`msg ${m.role}`}>
          {m.kind === 'steps' && m.steps ? (
            <StepsBubble frames={m.steps} streaming={!!m.stream} />
          ) : m.json ? (
            <JsonBubble content={m.content || ''} streaming={!!m.stream} />
          ) : (
            <div className="bubble">{m.content}</div>
          )}
        </div>
      ))}
    </div>
  )
}

function StepsBubble({ frames, streaming }: { frames: StepFrame[], streaming: boolean }) {
  const steps = frames.filter(f => f.kind === 'step')
  const final = frames.find(f => f.kind === 'final')
  const uniqueStepCount = Array.from(new Set(steps.map(s => s.step))).length
  const doneSlots = Math.min(uniqueStepCount, 4) + (final ? 1 : 0)
  const percent = Math.round((doneSlots / 5) * 100)
  return (
    <div className="bubble steps">
      <div className="steps-header">
        <div className="progress">
          <div className="bar" style={{ width: `${percent}%` }} />
        </div>
        <div className="steps-title">Building campaign · {percent}%</div>
      </div>
      <ul className="steps-list">
        {steps.map((s, idx) => (
          <li key={`${s.step}-${idx}`} className="step-item">
            <div className="step-line">
              <span className="badge">Step {s.step}</span>
              <span className="label">{labelFor(s.name)}</span>
              <details className="expand">
                <summary>Details</summary>
                <pre className="code">{pretty(s)}</pre>
              </details>
            </div>
          </li>
        ))}
      </ul>
      {final && (
        <div className="final-block">
          <div className="final-title">Executable campaign generated</div>
          <JsonBubble content={JSON.stringify(final.payload)} streaming={false} />
        </div>
      )}
      {streaming && <div className="spinner">Processing…</div>}
    </div>
  )
}

function labelFor(name?: string) {
  switch (name) {
    case 'context_audience': return 'Context & audience';
    case 'right_time': return 'Right time';
    case 'right_channel': return 'Right channel';
    case 'right_message': return 'Right message';
    case 'final_executable': return 'Final executable';
    default: return name || 'Step';
  }
}

function pretty(frame: StepFrame) {
  try { return JSON.stringify(frame, null, 2) } catch { return String(frame) }
}

function JsonBubble({ content, streaming }: { content: string, streaming: boolean }) {
  // For streaming, show raw frame lines; once done, try to pretty-print if it parses as JSON
  let display = content
  if (!streaming) {
    try { display = JSON.stringify(JSON.parse(content), null, 2) } catch { /* keep as assembled NDJSON */ }
  }
  async function copyAll() {
    try { await navigator.clipboard.writeText(display) } catch {}
  }
  return (
    <div className="bubble json">
      <div className="json-toolbar">
        <span className="json-title">Campaign JSON</span>
        <button className="copy" onClick={copyAll} title="Copy JSON">⧉ Copy</button>
      </div>
      <pre className={`code ${streaming ? 'streaming' : ''}`}>
        {display}
        {streaming && <span className="cursor">▍</span>}
      </pre>
      {!streaming && <LaunchBar jsonText={display} />}
    </div>
  )
}

function LaunchBar({ jsonText }: { jsonText: string }) {
  async function launch() {
    try {
      const body = JSON.parse(jsonText)
      const res = await fetch('/api/launch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const out = await res.json()
      alert(out.ok ? `Launched campaign ${out.campaignId ?? ''} with ${out.actions} actions across ${out.channels?.join(', ')}` : 'Launch failed')
    } catch (e) {
      alert('Invalid JSON payload; cannot launch')
    }
  }
  return (
    <div className="launchbar">
      <button className="launch" onClick={launch}>Launch Campaign</button>
    </div>
  )
}
