/**
 * Cena 3D (three.js): desenha os volumes de solids.ts, orbita a câmera, destaca/seleciona ao passar o mouse
 * e clicar, e permite puxar/empurrar a altura de um sólido pela seta que aparece sobre ele.
 * Sem React: a tela (View3D.tsx) só entrega dados e recebe eventos.
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { boundsOf, snapHeight } from './solids'
import type { LayerKind, Solid3D } from './solids'

export interface HoverInfo { solid: Solid3D; x: number; y: number }
export interface SceneCallbacks {
  onPick(markupId: string | null, additive: boolean): void
  onHover(info: HoverInfo | null): void
  /** puxar/empurrar: 'start' uma vez (para o desfazer), 'move' a cada passo, 'end' ao soltar */
  onHeight(markupId: string, height: number, phase: 'start' | 'move' | 'end'): void
}

interface Item {
  solid: Solid3D
  mesh: THREE.Mesh
  edges: THREE.LineSegments
  key: string
}

const THEME = {
  dark: { bg: 0x16181d, grid: 0x3a3f4b, grid2: 0x262a33, edge: 0x0b0c0f },
  light: { bg: 0xeef0f4, grid: 0xb6bcc8, grid2: 0xd5d9e1, edge: 0x2b2f38 },
}

const ACCENT = 0x3e63dd
const HANDLE = 0xff8a1f

const keyOf = (s: Solid3D) => JSON.stringify([s.ring, s.holes, s.base, s.height, s.color, s.opacity])

function shapeOf(s: Solid3D) {
  // o mesh é girado -90° em X: ponto (x, y) da forma vira (x, ·, -y); por isso y = -Z da planta
  const shape = new THREE.Shape(s.ring.map((p) => new THREE.Vector2(p.x, -p.y)))
  for (const h of s.holes) if (h.length >= 3) shape.holes.push(new THREE.Path(h.map((p) => new THREE.Vector2(p.x, -p.y))))
  return shape
}

export class Scene3D {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(42, 1, 0.05, 5000)
  private controls: OrbitControls
  private raycaster = new THREE.Raycaster()
  private items = new Map<string, Item>()
  private group = new THREE.Group()
  private grid: THREE.GridHelper | null = null
  private handle: THREE.Mesh | null = null
  private handleOf: { solid: Solid3D; size: number } | null = null
  private selected = new Set<string>()
  private hovered: string | null = null
  private dark: boolean
  private raf = 0
  private dirty = true
  private disposed = false
  private ro: ResizeObserver
  private down: { x: number; y: number } | null = null
  private drag: { id: string; base: number; grabDy: number; plane: THREE.Plane; fine: boolean } | null = null
  private extent = 10
  private touched = false // o usuário já mexeu na câmera: não enquadramos mais sozinhos
  private lastKey = ''

  private host: HTMLElement
  private cb: SceneCallbacks

  constructor(host: HTMLElement, cb: SceneCallbacks, dark: boolean) {
    this.host = host
    this.cb = cb
    this.dark = dark
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    host.appendChild(this.renderer.domElement)
    Object.assign(this.renderer.domElement.style, { display: 'block', width: '100%', height: '100%', touchAction: 'none' })
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x556070, 1.15))
    const sun = new THREE.DirectionalLight(0xffffff, 1.6)
    sun.position.set(30, 60, 20)
    this.scene.add(sun)
    this.scene.add(this.group)
    this.camera.position.set(12, 10, 12)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = false
    this.controls.screenSpacePanning = true
    // navegação estilo Revit: botão do meio move, Shift + botão do meio gira (o OrbitControls troca pan/rotate com Shift),
    // roda dá zoom na direção do cursor; o botão esquerdo fica livre para selecionar e puxar a altura
    this.controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.PAN, RIGHT: null }
    this.controls.zoomToCursor = true
    this.controls.addEventListener('change', () => this.invalidate())
    this.controls.addEventListener('start', () => (this.touched = true))
    this.applyTheme()
    const el = this.renderer.domElement
    el.addEventListener('mousedown', this.noAutoscroll)
    el.addEventListener('pointerdown', this.onDown)
    el.addEventListener('pointermove', this.onMove)
    el.addEventListener('pointerup', this.onUp)
    el.addEventListener('pointerleave', this.onLeave)
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(host)
    this.resize()
    const loop = () => {
      if (this.disposed) return
      if (this.dirty) {
        this.dirty = false
        this.renderer.render(this.scene, this.camera)
      }
      this.raf = requestAnimationFrame(loop)
    }
    loop()
  }

  private invalidate() {
    this.dirty = true
  }

  private resize() {
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight)
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.invalidate()
  }

  private applyTheme() {
    const t = this.dark ? THEME.dark : THEME.light
    this.scene.background = new THREE.Color(t.bg)
    for (const it of this.items.values()) (it.edges.material as THREE.LineBasicMaterial).color.setHex(t.edge)
    this.buildGrid()
    this.invalidate()
  }

  private buildGrid() {
    if (this.grid) {
      this.scene.remove(this.grid)
      this.grid.geometry.dispose()
      ;(this.grid.material as THREE.Material).dispose()
    }
    const t = this.dark ? THEME.dark : THEME.light
    const size = Math.max(10, Math.ceil((this.extent * 3) / 10) * 10)
    this.grid = new THREE.GridHelper(size, size, t.grid, t.grid2)
    this.scene.add(this.grid)
  }

  setDark(dark: boolean) {
    if (dark === this.dark) return
    this.dark = dark
    this.applyTheme()
  }

  /** Atualiza os volumes (reaproveita o que não mudou), a seleção e as camadas visíveis. */
  setSolids(solids: Solid3D[], selected: string[], visible: Record<LayerKind, boolean>) {
    this.selected = new Set(selected)
    const edgeColor = (this.dark ? THEME.dark : THEME.light).edge
    const alive = new Set(solids.map((s) => s.id))
    for (const [id, it] of this.items) {
      if (alive.has(id)) continue
      this.group.remove(it.mesh, it.edges)
      it.mesh.geometry.dispose()
      it.edges.geometry.dispose()
      this.items.delete(id)
    }
    for (const s of solids) {
      if (s.ring.length < 3) continue
      const key = keyOf(s)
      let it = this.items.get(s.id)
      if (it && it.key !== key) {
        this.group.remove(it.mesh, it.edges)
        it.mesh.geometry.dispose()
        it.edges.geometry.dispose()
        it = undefined
      }
      if (!it) {
        const geo = new THREE.ExtrudeGeometry(shapeOf(s), { depth: Math.max(s.height, 0.001), bevelEnabled: false })
        geo.rotateX(-Math.PI / 2)
        const mat = new THREE.MeshStandardMaterial({ color: s.color, transparent: s.opacity < 1, opacity: s.opacity, side: THREE.DoubleSide, depthWrite: s.opacity >= 0.85, roughness: 0.75, metalness: 0.05 })
        const mesh = new THREE.Mesh(geo, mat)
        mesh.position.y = s.base
        mesh.userData.id = s.id
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: s.kind === 'space' ? 0.35 : 0.8 }))
        edges.position.y = s.base
        this.group.add(mesh, edges)
        it = { solid: s, mesh, edges, key }
        this.items.set(s.id, it)
      } else it.solid = s
      it.mesh.visible = it.edges.visible = visible[s.kind]
      this.paint(it)
    }
    this.updateHandle()
    this.invalidate()
  }

  private paint(it: Item) {
    const mat = it.mesh.material as THREE.MeshStandardMaterial
    const sel = this.selected.has(it.solid.markupId)
    const hov = this.hovered === it.solid.id || (this.hovered !== null && this.items.get(this.hovered)?.solid.markupId === it.solid.markupId)
    mat.emissive.setHex(sel ? ACCENT : hov ? 0xffffff : 0x000000)
    mat.emissiveIntensity = sel ? 0.45 : hov ? 0.22 : 0
    ;(it.edges.material as THREE.LineBasicMaterial).color.setHex(sel ? ACCENT : (this.dark ? THEME.dark : THEME.light).edge)
  }

  /** A seta de puxar/empurrar aparece quando há exatamente um sólido editável selecionado e visível. */
  private updateHandle() {
    const editable = [...this.items.values()].filter((i) => i.solid.editable && i.mesh.visible && this.selected.has(i.solid.markupId))
    const target = editable.length === 1 ? editable[0].solid : null
    if (!target) {
      this.removeHandle()
      return
    }
    const size = Math.max(0.12, this.extent * 0.025)
    if (!this.handle || this.handleOf?.size !== size) {
      this.removeHandle()
      const geo = new THREE.ConeGeometry(size * 0.9, size * 2.2, 20)
      const mat = new THREE.MeshBasicMaterial({ color: HANDLE, depthTest: false, transparent: true })
      this.handle = new THREE.Mesh(geo, mat)
      this.handle.renderOrder = 20
      this.scene.add(this.handle)
    }
    this.handleOf = { solid: target, size }
    const c = target.ring.reduce((a, p) => ({ x: a.x + p.x / target.ring.length, y: a.y + p.y / target.ring.length }), { x: 0, y: 0 })
    this.handle.position.set(c.x, target.base + target.height + size * 1.4, c.y)
  }

  private removeHandle() {
    if (!this.handle) return
    this.scene.remove(this.handle)
    this.handle.geometry.dispose()
    ;(this.handle.material as THREE.Material).dispose()
    this.handle = null
    this.handleOf = null
  }

  /**
   * Enquadra sozinho quando a planta dos volumes muda (novo sólido, vértice movido), mas só enquanto o usuário
   * não mexeu na câmera. `key` identifica a planta atual; mudar a altura não muda a chave.
   */
  autoFrame(key: string) {
    if (key === this.lastKey) return
    this.lastKey = key
    if (!this.touched) this.frame('iso')
  }

  /** Enquadra a câmera nos volumes: isométrica, de cima, frente ou lateral direita. */
  frame(view: 'iso' | 'top' | 'front' | 'right' = 'iso') {
    this.touched = false // pedido explícito: a câmera volta a ser automática
    const visible = [...this.items.values()].filter((i) => i.mesh.visible).map((i) => i.solid)
    const b = boundsOf(visible.length ? visible : [...this.items.values()].map((i) => i.solid))
    if (!b) return
    this.extent = b.size
    this.buildGrid()
    const d = b.size * 1.6
    this.controls.target.set(b.cx, b.maxY / 2, b.cz)
    if (view === 'top') this.camera.position.set(b.cx, d * 1.4, b.cz + 0.001)
    else if (view === 'front') this.camera.position.set(b.cx, b.maxY / 2, b.cz + d * 1.3)
    else if (view === 'right') this.camera.position.set(b.cx + d * 1.3, b.maxY / 2, b.cz)
    else this.camera.position.set(b.cx + d * 0.8, b.maxY / 2 + d * 0.7, b.cz + d * 0.9)
    this.camera.near = Math.max(0.01, b.size / 500)
    this.camera.far = b.size * 60
    this.camera.updateProjectionMatrix()
    this.controls.update()
    this.updateHandle()
    this.invalidate()
  }

  // ---------------------------------------------------------------- ponteiro
  private ndc(e: PointerEvent) {
    const r = this.renderer.domElement.getBoundingClientRect()
    this.raycaster.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera)
  }

  private hit(e: PointerEvent): Item | null {
    this.ndc(e)
    const meshes = [...this.items.values()].filter((i) => i.mesh.visible).map((i) => i.mesh)
    const h = this.raycaster.intersectObjects(meshes, false)[0]
    return h ? this.items.get(h.object.userData.id as string) ?? null : null
  }

  /** O botão do meio abre o "autoscroll" do Windows; aqui ele é de navegação. */
  private noAutoscroll = (e: MouseEvent) => {
    if (e.button === 1) e.preventDefault()
  }

  /** Posição da câmera e alvo, e onde está a seta de puxar na tela (para testes e diagnóstico). */
  state() {
    const p = this.camera.position, t = this.controls.target
    let handle: [number, number] | null = null
    if (this.handle) {
      const v = this.handle.position.clone().project(this.camera)
      const r = this.renderer.domElement.getBoundingClientRect()
      handle = [r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height]
    }
    return { position: [p.x, p.y, p.z], target: [t.x, t.y, t.z], handle }
  }

  private onDown = (e: PointerEvent) => {
    this.down = { x: e.clientX, y: e.clientY }
    if (e.button !== 0 || !this.handle || !this.handleOf) return
    this.ndc(e)
    if (!this.raycaster.intersectObject(this.handle, false).length) return
    const s = this.handleOf.solid
    const dir = new THREE.Vector3()
    this.camera.getWorldDirection(dir)
    dir.y = 0
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1)
    // plano vertical voltado para a câmera, passando pela seta: o mouse sobe/desce em Y sem depender do ângulo
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(dir.normalize().negate(), this.handle.position)
    const p = new THREE.Vector3()
    if (!this.raycaster.ray.intersectPlane(plane, p)) return
    this.drag = { id: s.markupId, base: s.base, grabDy: p.y - (s.base + s.height), plane, fine: e.altKey }
    this.controls.enabled = false
    this.capture(e.pointerId, true)
    this.cb.onHeight(s.markupId, s.height, 'start')
  }

  /** Captura o ponteiro durante o arrasto; pode falhar (ponteiro inexistente) sem prejudicar o resto. */
  private capture(id: number, on: boolean) {
    try {
      if (on) this.renderer.domElement.setPointerCapture(id)
      else this.renderer.domElement.releasePointerCapture(id)
    } catch {
      /* sem captura: o arrasto continua pelos eventos do canvas */
    }
  }

  private onMove = (e: PointerEvent) => {
    if (this.drag) {
      this.ndc(e)
      const p = new THREE.Vector3()
      if (this.raycaster.ray.intersectPlane(this.drag.plane, p)) {
        const h = snapHeight(p.y - this.drag.grabDy - this.drag.base, e.altKey || this.drag.fine ? 0.01 : 0.05)
        this.cb.onHeight(this.drag.id, h, 'move')
      }
      return
    }
    if (e.buttons) {
      this.setHover(null, e)
      return
    }
    this.setHover(this.hit(e), e)
  }

  private onUp = (e: PointerEvent) => {
    if (this.drag) {
      const id = this.drag.id
      this.drag = null
      this.controls.enabled = true
      this.capture(e.pointerId, false)
      const it = [...this.items.values()].find((i) => i.solid.markupId === id)
      this.cb.onHeight(id, it?.solid.height ?? 0, 'end')
      return
    }
    const d = this.down
    this.down = null
    if (!d || e.button !== 0 || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return // arrastou: era órbita
    const it = this.hit(e)
    this.cb.onPick(it ? it.solid.markupId : null, e.shiftKey)
  }

  private onLeave = () => this.setHover(null)

  private setHover(it: Item | null, e?: PointerEvent) {
    const id = it?.solid.id ?? null
    if (id !== this.hovered) {
      const prev = this.hovered
      this.hovered = id
      for (const x of this.items.values()) if (x.solid.id === prev || x.solid.id === id || x.solid.markupId === it?.solid.markupId || x.solid.markupId === (prev ? this.items.get(prev)?.solid.markupId : undefined)) this.paint(x)
      this.invalidate()
    }
    const r = this.renderer.domElement.getBoundingClientRect()
    this.cb.onHover(it && e ? { solid: it.solid, x: e.clientX - r.left, y: e.clientY - r.top } : null)
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.ro.disconnect()
    const el = this.renderer.domElement
    el.removeEventListener('mousedown', this.noAutoscroll)
    el.removeEventListener('pointerdown', this.onDown)
    el.removeEventListener('pointermove', this.onMove)
    el.removeEventListener('pointerup', this.onUp)
    el.removeEventListener('pointerleave', this.onLeave)
    this.controls.dispose()
    for (const it of this.items.values()) {
      it.mesh.geometry.dispose()
      ;(it.mesh.material as THREE.Material).dispose()
      it.edges.geometry.dispose()
      ;(it.edges.material as THREE.Material).dispose()
    }
    this.removeHandle()
    this.grid?.geometry.dispose()
    this.renderer.dispose()
    el.remove()
  }
}
