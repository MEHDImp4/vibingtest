interface Props {
  title: string
}

export function TitleBar({ title }: Props): JSX.Element {
  return (
    <div className="drag flex items-center justify-between px-5 h-11 border-b border-zinc-800 flex-shrink-0">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-violet-500" />
        <span className="text-sm font-medium text-zinc-300">{title}</span>
      </div>
      <div className="no-drag flex items-center gap-1.5">
        <button
          onClick={() => window.close()}
          className="w-3 h-3 rounded-full bg-zinc-300 hover:bg-zinc-500 transition-colors"
        />
      </div>
    </div>
  )
}
