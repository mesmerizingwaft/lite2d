import { useState } from 'react'
import { useEditorStore } from '../editor/store'
import { exportSpriteSheet } from '../render/exportSpriteSheet'

export function ExportPanel() {
  const s = useEditorStore()
  const defaultFrames = Math.ceil(s.animation.fps * s.animation.duration)
  const [frames, setFrames] = useState(defaultFrames)
  const frameCount = Math.max(1, Math.floor(frames || defaultFrames))

  return <section className="panel export">
    <label className="export-frames">
      <span>Frames</span>
      <input
        aria-label="Sprite sheet frame count"
        min={1}
        max={240}
        type="number"
        value={frames}
        onChange={event => setFrames(Number(event.target.value))}
      />
    </label>
    <button disabled={!s.parts.length} onClick={() => exportSpriteSheet(s, { frames: frameCount })}>Export SpriteSheet ZIP</button>
  </section>
}
