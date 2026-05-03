export function Waveform(): JSX.Element {
  const bars = Array.from({ length: 12 }, (_, i) => i)

  return (
    <div className="flex items-center justify-center gap-[3px] h-8">
      {bars.map((i) => (
        <div
          key={i}
          className="wave-bar w-[3px] bg-[var(--text-tertiary)] rounded-full"
          style={{ 
            height: `${Math.random() * 16 + 8}px`,
            animationDelay: `${i * 0.1}s` 
          }}
        />
      ))}
    </div>
  )
}
