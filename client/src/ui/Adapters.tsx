type AdapterStatus = {
  id: string
  name: string
  description: string
  icon: string
  connected: boolean
  connectedAt?: string | null
}

type Props = {
  adapters: AdapterStatus[]
  onConnect: (id: string) => void
  onDisconnect: (id: string) => void
}

export function Adapters({ adapters, onConnect, onDisconnect }: Props) {
  function confirmDisconnect(adapter: AdapterStatus) {
    const ok = window.confirm(`Disconnect ${adapter.name}?`)
    if (!ok) return
    onDisconnect(adapter.id)
  }
  return (
    <div className="selector">
      <div className="label">Data sources</div>
      <div className="adapter-list">
        {adapters.map(a => (
          <div key={a.id} className="adapter-card">
            <div className="adapter-meta">
              <div className="adapter-icon" aria-hidden>{a.icon}</div>
              <div className="adapter-text">
                <div className="adapter-name">{a.name}</div>
                <div className="adapter-desc">{a.description}</div>
              </div>
            </div>
            <div className="adapter-actions">
              {a.connected ? (
                <>
                  <span className="status-pill connected">Connected</span>
                  <button className="btn-icon danger" title={`Disconnect ${a.name}`} aria-label={`Disconnect ${a.name}`} onClick={() => confirmDisconnect(a)}>
                    ✕
                  </button>
                </>
              ) : (
                <button className="btn-connect" onClick={() => onConnect(a.id)}>Connect</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
