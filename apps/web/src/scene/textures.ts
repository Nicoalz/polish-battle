import * as THREE from 'three'
import type { Card } from '@pb/engine'
import { isCursed, isDamaged } from '@pb/engine'

/**
 * Dessin des cartes, propre au jeu.
 *
 * Polish Battle est né sur table avec un jeu de 52 cartes, mais la famille (♠♥♦♣) n'y
 * servait à rien : seul le chiffre compte. Ici la surface de la carte dit son **rôle** —
 * vie, bouclier, charge — qui est l'information que les joueurs cherchent vraiment du
 * regard, et le chiffre occupe tout le centre.
 *
 * Les faces sont peintes à la demande dans un canvas et mises en cache : aucun fichier à
 * charger, des cartes nettes à tous les zooms, et un style qui se modifie entièrement
 * depuis ce fichier.
 */

export const CARD_WIDTH = 0.72
export const CARD_HEIGHT = 1.08
export const CARD_THICKNESS = 0.02

export type Orientation = 'portrait' | 'landscape'
export type CardRole = 'life' | 'shield' | 'battery' | 'drawn' | 'deck'

const SHORT = 192
const LONG = 288

type Style = {
  /** Fond de la carte : c'est lui qui annonce le rôle. */
  bg: string
  /** Bord intérieur, pour détacher la carte du tapis sombre. */
  edge: string
  ink: string
  glyph: Glyph
}

type Glyph = 'heart' | 'shield' | 'bolt' | 'spark' | 'none'

const STYLES: Record<CardRole, Style> = {
  life: { bg: '#a81f3a', edge: '#e4718a', ink: '#fff2f4', glyph: 'heart' },
  shield: { bg: '#1a6397', edge: '#6cb6e4', ink: '#eef7fd', glyph: 'shield' },
  battery: { bg: '#a9740c', edge: '#f0c267', ink: '#fff8e8', glyph: 'bolt' },
  drawn: { bg: '#117a5c', edge: '#5fd8b0', ink: '#eefdf7', glyph: 'spark' },
  deck: { bg: '#1d2230', edge: '#5b6880', ink: '#dbe3f0', glyph: 'none' },
}

/** La carte maudite : noire, fêlée, et sans rôle — elle ne vaut rien où qu'elle aille. */
const CURSED: Style = { bg: '#140a10', edge: '#7d2338', ink: '#ff476c', glyph: 'spark' }

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Petits symboles de rôle, tracés à la main pour ne dépendre d'aucune police. */
function drawGlyph(ctx: CanvasRenderingContext2D, glyph: Glyph, size: number): void {
  const s = size
  ctx.beginPath()
  switch (glyph) {
    case 'heart':
      ctx.moveTo(0, s * 0.3)
      ctx.bezierCurveTo(0, s * 0.1, -s * 0.5, s * 0.05, -s * 0.5, -s * 0.2)
      ctx.bezierCurveTo(-s * 0.5, -s * 0.45, -s * 0.1, -s * 0.45, 0, -s * 0.2)
      ctx.bezierCurveTo(s * 0.1, -s * 0.45, s * 0.5, -s * 0.45, s * 0.5, -s * 0.2)
      ctx.bezierCurveTo(s * 0.5, s * 0.05, 0, s * 0.1, 0, s * 0.3)
      break
    case 'shield':
      ctx.moveTo(0, -s * 0.45)
      ctx.lineTo(s * 0.42, -s * 0.28)
      ctx.lineTo(s * 0.42, s * 0.05)
      ctx.quadraticCurveTo(s * 0.42, s * 0.38, 0, s * 0.48)
      ctx.quadraticCurveTo(-s * 0.42, s * 0.38, -s * 0.42, s * 0.05)
      ctx.lineTo(-s * 0.42, -s * 0.28)
      break
    case 'bolt':
      ctx.moveTo(s * 0.16, -s * 0.48)
      ctx.lineTo(-s * 0.3, s * 0.08)
      ctx.lineTo(-s * 0.02, s * 0.08)
      ctx.lineTo(-s * 0.16, s * 0.48)
      ctx.lineTo(s * 0.3, -s * 0.08)
      ctx.lineTo(s * 0.02, -s * 0.08)
      break
    case 'spark':
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2
        const b = a + Math.PI / 4
        ctx.lineTo(Math.cos(a) * s * 0.46, Math.sin(a) * s * 0.46)
        ctx.lineTo(Math.cos(b) * s * 0.13, Math.sin(b) * s * 0.13)
      }
      break
    case 'none':
      return
  }
  ctx.closePath()
  ctx.fill()
}

function cornerGlyphs(ctx: CanvasRenderingContext2D, w: number, h: number, style: Style): void {
  if (style.glyph === 'none') return
  ctx.save()
  ctx.fillStyle = style.ink
  ctx.globalAlpha = 0.55
  ctx.translate(26, 26)
  drawGlyph(ctx, style.glyph, 28)
  ctx.restore()

  // Pas de rotation pour le second symbole : une carte classique tourne son index de
  // coin, mais un cœur ou un éclair à l'envers ne se lit plus comme tel.
  ctx.save()
  ctx.fillStyle = style.ink
  ctx.globalAlpha = 0.55
  ctx.translate(w - 26, h - 26)
  drawGlyph(ctx, style.glyph, 28)
  ctx.restore()
}

/** Fêlure d'une carte de vie entamée : on voit qu'elle a déjà encaissé. */
function drawCrack(ctx: CanvasRenderingContext2D, w: number, h: number, color: string): void {
  ctx.save()
  ctx.strokeStyle = color
  ctx.globalAlpha = 0.5
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(w * 0.1, h * 0.78)
  ctx.lineTo(w * 0.34, h * 0.56)
  ctx.lineTo(w * 0.26, h * 0.44)
  ctx.lineTo(w * 0.52, h * 0.2)
  ctx.stroke()
  ctx.restore()
}

function body(canvas: HTMLCanvasElement, style: Style): [CanvasRenderingContext2D, number, number] {
  const ctx = canvas.getContext('2d')!
  const pad = 8
  const w = canvas.width - pad * 2
  const h = canvas.height - pad * 2

  ctx.translate(pad, pad)
  roundedRect(ctx, 0, 0, w, h, 18)
  ctx.fillStyle = style.bg
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = style.edge
  ctx.stroke()
  return [ctx, w, h]
}

function paintFace(canvas: HTMLCanvasElement, card: Card, role: CardRole): void {
  const cursed = isCursed(card)
  const style = cursed ? CURSED : STYLES[role]
  const [ctx, w, h] = body(canvas, style)

  cornerGlyphs(ctx, w, h, style)
  if (cursed) drawCrack(ctx, w, h, '#ff476c')
  else if (role === 'life' && isDamaged(card)) drawCrack(ctx, w, h, style.ink)

  ctx.fillStyle = style.ink
  ctx.font = `700 ${Math.round(Math.min(w, h) * 0.62)}px ui-sans-serif, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(card.value), w / 2, h / 2)
}

/**
 * Dos de carte, teinté par le rôle.
 *
 * Une charge se pose face cachée : on doit savoir qu'elle est là sans connaître sa
 * valeur. Le dos annonce donc le rôle, et rien d'autre.
 */
function paintBack(canvas: HTMLCanvasElement, role: CardRole): void {
  const style = STYLES[role]
  const [ctx, w, h] = body(canvas, { ...style, bg: '#171b26' })

  ctx.save()
  roundedRect(ctx, 0, 0, w, h, 18)
  ctx.clip()
  ctx.strokeStyle = style.edge
  ctx.globalAlpha = 0.22
  ctx.lineWidth = 2
  for (let i = -h; i < w; i += 14) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i + h, h)
    ctx.stroke()
  }
  ctx.restore()

  if (style.glyph !== 'none') {
    ctx.save()
    ctx.fillStyle = style.edge
    ctx.globalAlpha = 0.85
    ctx.translate(w / 2, h / 2)
    drawGlyph(ctx, style.glyph, Math.min(w, h) * 0.52)
    ctx.restore()
  }
}

const cache = new Map<string, THREE.CanvasTexture>()

function texture(
  key: string,
  orientation: Orientation,
  paint: (canvas: HTMLCanvasElement) => void,
): THREE.Texture {
  const cached = cache.get(key)
  if (cached) return cached

  const canvas = document.createElement('canvas')
  canvas.width = orientation === 'portrait' ? SHORT : LONG
  canvas.height = orientation === 'portrait' ? LONG : SHORT
  paint(canvas)

  const made = new THREE.CanvasTexture(canvas)
  made.colorSpace = THREE.SRGBColorSpace
  made.anisotropy = 4
  cache.set(key, made)
  return made
}

export function faceTexture(card: Card, role: CardRole, orientation: Orientation): THREE.Texture {
  const damaged = role === 'life' && isDamaged(card) ? 'd' : ''
  return texture(`f:${card.value}:${card.rank}:${role}:${orientation}:${damaged}`, orientation, (canvas) =>
    paintFace(canvas, card, role),
  )
}

export function backTexture(role: CardRole, orientation: Orientation): THREE.Texture {
  return texture(`b:${role}:${orientation}`, orientation, (canvas) => paintBack(canvas, role))
}

/** Teinte vive du rôle, réutilisée par le halo 3D et le HUD. */
export function roleColor(role: CardRole): string {
  return STYLES[role].edge
}
