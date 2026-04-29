export function Waveform(): JSX.Element {
  const heights = [12, 18, 24, 16, 28, 20, 14]

  return (
    <div className="waveform">
      {heights.map((height, i) => (
        <div
          key={i}
          className="wave-bar"
          style={{ height: `${height}px` }}
        />
      ))}
    </div>
  )
}
