import { Application } from 'pixi.js'
export async function createPixiApp(width = 512, height = 512) {
  const app = new Application()
  await app.init({ width, height, background: '#262a33', antialias: true, preference: 'webgl', preserveDrawingBuffer: true })
  app.stage.sortableChildren = true
  return app
}
