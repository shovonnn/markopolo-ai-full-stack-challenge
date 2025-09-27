import { useMemo, useRef, useState } from 'react'
import { MessageList } from './MessageList'
import { SourceSelector } from './SourceSelector'
import { ChannelSelector } from './ChannelSelector'
import './styles.css'

const ALL_SOURCES = ['Website', 'Shopify', 'Facebook Page'] as const
const ALL_CHANNELS = ['Email', 'SMS', 'WhatsApp', 'Ads'] as const

export function App() {
  type StepFrame = { decision_id: string; step: number; name: string; payload: unknown; kind?: 'step'|'final' }
  type Msg = { role: 'user'|'assistant', content?: string, json?: boolean, stream?: boolean, kind?: 'json'|'steps', steps?: StepFrame[] }
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'assistant', content: 'Hi! Connect your data sources and pick channels. Ask me what campaign to build.' }
  ])
  const [input, setInput] = useState('Create a campaign to re-engage users and drive repeat purchases.')
  const [connectedSources, setConnectedSources] = useState<string[]>([])
  const [selectedChannels, setSelectedChannels] = useState<string[]>([])
  const [streaming, setStreaming] = useState(false)
  const streamIdxRef = useRef<number | null>(null)

  const canConnect = useMemo(() => connectedSources.length > 0 && selectedChannels.length > 0, [connectedSources, selectedChannels])

  async function handleConnect() {
  const res = await fetch('/api/connect', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataSources: connectedSources, channels: selectedChannels })
    })
    const json = await res.json()
    setConnectedSources(json.dataSources)
    setSelectedChannels(json.channels)
  }

  async function handleSend() {
    if (!input.trim()) return
    setMessages((m: Msg[]) => [...m, { role: 'user', content: input }])
    setInput('')

    // Start stream
    setStreaming(true)
    // Insert placeholder assistant Steps message and track its index
    setMessages((m: Msg[]) => {
      const next: Msg[] = [...m, { role: 'assistant' as const, kind: 'steps', steps: [], stream: true }]
      streamIdxRef.current = next.length - 1
      return next
    })

    const ev = new EventSource('/api/stream-campaign')
    const appendFrame = (e: MessageEvent, kind: 'step'|'final') => {
        console.log('Received stream frame:', e.data)
      try {
        const obj = JSON.parse(e.data)
        setMessages((m: Msg[]) => {
          const idx = streamIdxRef.current
          if (idx == null || !m[idx]) return m
          const next = [...m]
          const current = next[idx]
          const steps = current.steps ? [...current.steps] : []
          steps.push({ ...(obj as any), kind })
          next[idx] = { ...current, steps }
          return next
        })
      } catch(e) {
        console.error('Error parsing stream frame:', e)
      }
    }
    ev.addEventListener('step', (e: MessageEvent) => appendFrame(e, 'step'))
    ev.addEventListener('final', (e: MessageEvent) => {
      appendFrame(e, 'final')
      // Mark stream complete immediately on final
      setStreaming(false)
      setMessages((m: Msg[]) => {
        const idx = streamIdxRef.current
        if (idx == null || !m[idx]) return m
        const next = [...m]
        next[idx] = { ...next[idx], stream: false }
        return next
      })
    })
    ev.addEventListener('end', () => {
      setStreaming(false)
      setMessages((m: Msg[]) => {
        const idx = streamIdxRef.current
        if (idx == null || !m[idx]) return m
        const next = [...m]
        next[idx] = { ...next[idx], stream: false }
        return next
      })
      streamIdxRef.current = null
      ev.close()
    })
    ev.onerror = () => {
      setStreaming(false)
      ev.close()
    }
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <h2>Connections</h2>
        <SourceSelector
          allSources={ALL_SOURCES as unknown as string[]}
          selected={connectedSources}
          onChange={setConnectedSources}
        />
        <ChannelSelector
          allChannels={ALL_CHANNELS as unknown as string[]}
          selected={selectedChannels}
          onChange={setSelectedChannels}
        />
        <button className="connect" disabled={!canConnect} onClick={handleConnect}>Connect</button>
        <div className="hint">Pick up to 3 data sources and up to 4 channels.</div>
      </aside>
      <main className="chat">
        <header className="topbar">Campaignity</header>
        <MessageList messages={messages} />
        <div className="composer">
          <input
            value={input}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
            placeholder="Ask for a campaign strategy…"
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') handleSend() }}
          />
          <button onClick={handleSend}>Send</button>
        </div>
      </main>
    </div>
  )
}
