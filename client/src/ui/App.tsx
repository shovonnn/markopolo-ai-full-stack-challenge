import { useEffect, useRef, useState } from 'react'
import { MessageList } from './MessageList'
// import { ChannelSelector } from './ChannelSelector'
import { Adapters } from './Adapters'
import { Channels } from './Channels'
import './styles.css'

// const ALL_CHANNELS = ['Email', 'SMS', 'WhatsApp', 'Ads'] as const

export function App() {
  type StepFrame = { decision_id: string; step: number; name: string; payload: unknown; kind?: 'step'|'final' }
  type Msg = { role: 'user'|'assistant', content?: string, json?: boolean, stream?: boolean, kind?: 'json'|'steps', steps?: StepFrame[] }
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'assistant', content: 'Hi! Connect your data sources and pick channels. Ask me what campaign to build.' }
  ])
  const [input, setInput] = useState('Create a campaign to re-engage users and drive repeat purchases.')
  // Adapters from server
  type AdapterStatus = { id: string; name: string; description: string; icon: string; connected: boolean }
  const [adapters, setAdapters] = useState<AdapterStatus[]>([])
  const connectedSources = adapters.filter(a => a.connected).map(a => a.name)
  type ChannelStatus = { id: string; name: string; description: string; icon: string; connected: boolean }
  const [channels, setChannels] = useState<ChannelStatus[]>([])
  const [streaming, setStreaming] = useState(false)
  const streamIdxRef = useRef<number | null>(null)

  async function refreshAdapters() {
    const res = await fetch('/api/adapters')
    const json = await res.json()
    setAdapters(json.adapters || [])
  }
  async function refreshChannels() {
    const res = await fetch('/api/channels')
    const json = await res.json()
    setChannels(json.channels || [])
  }

  useEffect(() => {
    refreshAdapters();
    refreshChannels();
  }, [])

  async function connectAdapter(id: string) {
    await fetch(`/api/adapters/${id}/connect`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    await refreshAdapters()
  }
  async function disconnectAdapter(id: string) {
    await fetch(`/api/adapters/${id}/disconnect`, { method: 'POST' })
    await refreshAdapters()
  }
  async function connectChannel(id: string) {
    await fetch(`/api/channels/${id}/connect`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    await refreshChannels()
  }
  async function disconnectChannel(id: string) {
    await fetch(`/api/channels/${id}/disconnect`, { method: 'POST' })
    await refreshChannels()
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
        <Adapters adapters={adapters} onConnect={connectAdapter} onDisconnect={disconnectAdapter} />
        <Channels channels={channels} onConnect={connectChannel} onDisconnect={disconnectChannel} />
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
