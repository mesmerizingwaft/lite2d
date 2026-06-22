import type { Project } from '../editor/types'
export function loadProject(json: string): Project { return JSON.parse(json) as Project }
