type ChannelStatus = {
  id: string
  name: string
  description: string
  icon: string
  connected: boolean
  connectedAt?: string | null
}

type Props = {
  channels: ChannelStatus[]
  onConnect: (id: string) => void
  onDisconnect: (id: string) => void
}

export function Channels({ channels, onConnect, onDisconnect }: Props) {
  function confirmDisconnect(ch: ChannelStatus) {
    const ok = window.confirm(`Disconnect ${ch.name}?`)
    if (!ok) return
    onDisconnect(ch.id)
  }
  return (
    <div className="selector">
      <div className="label">Channels</div>
      <div className="adapter-list">
        {channels.map(c => (
          <div key={c.id} className="adapter-card">
            <div className="adapter-meta">
              <div className="adapter-icon" aria-hidden>{c.icon}</div>
              <div className="adapter-text">
                <div className="adapter-name">{c.name}</div>
                <div className="adapter-desc">{c.description}</div>
              </div>
            </div>
            <div className="adapter-actions">
              {c.connected ? (
                <>
                  <span className="status-pill connected">Connected</span>
                  <button className="btn-icon danger" title={`Disconnect ${c.name}`} aria-label={`Disconnect ${c.name}`} onClick={() => confirmDisconnect(c)}>
                    ✕
                  </button>
                </>
              ) : (
                <button className="btn-connect" onClick={() => onConnect(c.id)}>Connect</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
