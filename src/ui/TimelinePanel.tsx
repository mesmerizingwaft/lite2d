import { useEditorStore } from '../editor/store'
export function TimelinePanel() { const s = useEditorStore(); return <section className="panel timeline"><h2>Timeline</h2><button onClick={s.play}>Play</button><button onClick={s.stop}>Stop</button><span>time: {s.currentTime.toFixed(2)}s</span><span>fps: {s.animation.fps}</span><span>duration: {s.animation.duration.toFixed(1)}s</span></section> }
