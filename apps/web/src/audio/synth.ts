/**
 * Bruitages synthétisés à la volée, en Web Audio.
 *
 * Plutôt que de charger des fichiers — à sourcer, à héberger, à licencier — chaque son
 * est fabriqué par quelques oscillateurs et un peu de bruit filtré. Le coût est nul au
 * chargement, rien ne part sur le réseau, et le caractère d'un son se règle en changeant
 * un chiffre ici.
 *
 * Un navigateur refuse de produire du son avant un geste de l'utilisateur : le contexte
 * n'est donc créé qu'au premier clic réel (le bouton « Rejoindre »).
 */

export type Sfx =
  | 'draw'
  | 'place'
  | 'charge'
  | 'attack'
  | 'impact'
  | 'blocked'
  | 'destroy'
  | 'super'
  | 'death'
  | 'win'

type Nodes = {
  ctx: AudioContext
  sfx: GainNode
  music: GainNode
}

let nodes: Nodes | undefined
let musicTimer: number | undefined

function create(): Nodes | undefined {
  if (nodes) return nodes
  const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return undefined

  const ctx = new Ctor()
  const sfx = ctx.createGain()
  const music = ctx.createGain()
  sfx.connect(ctx.destination)
  music.connect(ctx.destination)
  nodes = { ctx, sfx, music }
  return nodes
}

/** À appeler depuis un vrai geste utilisateur, sinon le navigateur reste muet. */
export function unlockAudio(): void {
  const made = create()
  if (made && made.ctx.state === 'suspended') void made.ctx.resume()
}

export function setSfxVolume(value: number): void {
  const made = create()
  if (made) made.sfx.gain.value = value
}

export function setMusicVolume(value: number): void {
  const made = create()
  if (made) made.music.gain.value = value
}

let sharedNoise: AudioBuffer | undefined

/**
 * Bruit blanc, matière première des sons de carte et d'impact.
 *
 * Une seule seconde, fabriquée une fois : la régénérer à chaque effet remplissait des
 * dizaines de milliers d'échantillons sur le fil principal, au moment précis où
 * l'animation a besoin de lui.
 */
function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (!sharedNoise) {
    sharedNoise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const data = sharedNoise.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  return sharedNoise
}

type NoiseOptions = {
  duration: number
  from: number
  to: number
  q?: number
  gain?: number
  type?: BiquadFilterType
}

function noise(target: GainNode, ctx: AudioContext, options: NoiseOptions): void {
  const { duration, from, to, q = 1, gain = 0.3, type = 'bandpass' } = options
  const source = ctx.createBufferSource()
  source.buffer = noiseBuffer(ctx)
  // Point de départ au hasard dans le tampon partagé : deux sons successifs ne se
  // superposent donc pas à l'identique.
  const offset = Math.random() * Math.max(0, source.buffer.duration - duration)

  const filter = ctx.createBiquadFilter()
  filter.type = type
  filter.Q.value = q
  filter.frequency.setValueAtTime(from, ctx.currentTime)
  filter.frequency.exponentialRampToValueAtTime(Math.max(40, to), ctx.currentTime + duration)

  const envelope = ctx.createGain()
  envelope.gain.setValueAtTime(gain, ctx.currentTime)
  envelope.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)

  source.connect(filter).connect(envelope).connect(target)
  source.start(ctx.currentTime, offset, duration)
  source.stop(ctx.currentTime + duration)
}

type ToneOptions = {
  from: number
  to?: number
  duration: number
  gain?: number
  type?: OscillatorType
  delay?: number
}

function tone(target: GainNode, ctx: AudioContext, options: ToneOptions): void {
  const { from, to = from, duration, gain = 0.2, type = 'sine', delay = 0 } = options
  const start = ctx.currentTime + delay

  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(from, start)
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + duration)

  const envelope = ctx.createGain()
  envelope.gain.setValueAtTime(0.0001, start)
  envelope.gain.exponentialRampToValueAtTime(gain, start + duration * 0.12)
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration)

  osc.connect(envelope).connect(target)
  osc.start(start)
  osc.stop(start + duration)
}

export function playSfx(name: Sfx): void {
  const made = nodes
  if (!made || made.ctx.state !== 'running' || made.sfx.gain.value === 0) return
  const { ctx, sfx } = made

  switch (name) {
    case 'draw':
      // Frottement d'une carte qu'on tire du paquet.
      noise(sfx, ctx, { duration: 0.22, from: 900, to: 2600, q: 0.8, gain: 0.22 })
      break
    case 'place':
      noise(sfx, ctx, { duration: 0.09, from: 2400, to: 700, q: 1.2, gain: 0.3 })
      tone(sfx, ctx, { from: 180, to: 90, duration: 0.09, gain: 0.12 })
      break
    case 'charge':
      tone(sfx, ctx, { from: 320, to: 820, duration: 0.2, gain: 0.1, type: 'triangle' })
      noise(sfx, ctx, { duration: 0.14, from: 1800, to: 5200, q: 2.5, gain: 0.12 })
      break
    case 'attack':
      // Souffle de la carte lancée : le filtre descend pendant le vol.
      noise(sfx, ctx, { duration: 0.42, from: 3200, to: 500, q: 0.7, gain: 0.2 })
      break
    case 'impact':
      tone(sfx, ctx, { from: 160, to: 45, duration: 0.3, gain: 0.38 })
      noise(sfx, ctx, { duration: 0.16, from: 1600, to: 200, q: 0.6, gain: 0.3 })
      break
    case 'blocked':
      // Coup encaissé par le bouclier : mat, sans grave.
      noise(sfx, ctx, { duration: 0.12, from: 1200, to: 2400, q: 3, gain: 0.18 })
      tone(sfx, ctx, { from: 420, to: 380, duration: 0.1, gain: 0.08, type: 'square' })
      break
    case 'destroy':
      noise(sfx, ctx, { duration: 0.35, from: 2600, to: 120, q: 0.5, gain: 0.32 })
      tone(sfx, ctx, { from: 220, to: 60, duration: 0.35, gain: 0.2, type: 'sawtooth' })
      break
    case 'super':
      tone(sfx, ctx, { from: 180, to: 1400, duration: 0.5, gain: 0.16, type: 'sawtooth' })
      tone(sfx, ctx, { from: 360, to: 2800, duration: 0.5, gain: 0.08, type: 'triangle' })
      noise(sfx, ctx, { duration: 0.5, from: 400, to: 6000, q: 1.5, gain: 0.14 })
      break
    case 'death':
      tone(sfx, ctx, { from: 300, to: 55, duration: 0.7, gain: 0.22, type: 'triangle' })
      break
    case 'win':
      // Petit arpège majeur, sans grandiloquence.
      ;[523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => {
        tone(sfx, ctx, { from: freq, duration: 0.45, gain: 0.14, type: 'triangle', delay: index * 0.1 })
      })
      break
  }
}

/** Vibration sur l'impact, sur les appareils qui la gèrent. */
export function vibrate(pattern: number | number[]): void {
  if (typeof navigator.vibrate === 'function') navigator.vibrate(pattern)
}

const CHORDS = [
  [110, 164.81, 220],
  [98, 146.83, 196],
  [123.47, 164.81, 246.94],
  [87.31, 130.81, 174.61],
]

/**
 * Nappe d'ambiance générative : quatre accords graves qui se succèdent lentement.
 * Coupée par défaut — une boucle qui tourne toute la soirée se coupe vite dans la vraie vie.
 */
export function startMusic(): void {
  const made = create()
  if (!made || musicTimer !== undefined) return
  const { ctx, music } = made

  let index = 0
  const step = () => {
    const chord = CHORDS[index % CHORDS.length]!
    index++
    for (const freq of chord) {
      tone(music, ctx, { from: freq, duration: 7.5, gain: 0.05, type: 'sine' })
      tone(music, ctx, { from: freq * 2.005, duration: 7.5, gain: 0.02, type: 'sine' })
    }
  }

  step()
  musicTimer = window.setInterval(step, 7000)
}

export function stopMusic(): void {
  if (musicTimer !== undefined) window.clearInterval(musicTimer)
  musicTimer = undefined
}
