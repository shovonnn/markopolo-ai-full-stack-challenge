type Props = {
  allChannels: string[]
  selected: string[]
  onChange: (s: string[]) => void
}

export function ChannelSelector({ allChannels, selected, onChange }: Props) {
  function toggle(s: string) {
    const set = new Set(selected)
    if (set.has(s)) set.delete(s); else set.add(s)
    onChange(Array.from(set).slice(0,4))
  }
  return (
    <div className="selector">
      <div className="label">Channels</div>
      {allChannels.map(s => (
        <label key={s} className="row">
          <input type="checkbox" checked={selected.includes(s)} onChange={() => toggle(s)} />
          <span>{s}</span>
        </label>
      ))}
    </div>
  )
}
