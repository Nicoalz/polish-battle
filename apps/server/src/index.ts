import { createServer } from 'node:http'
import process from 'node:process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { Server, matchMaker } from '@colyseus/core'
import { WebSocketTransport } from '@colyseus/ws-transport'
import { monitor } from '@colyseus/monitor'
import express from 'express'
import { GameRoom } from './GameRoom'

const PORT = Number(process.env.PORT ?? 2567)
const IS_PRODUCTION = process.env.NODE_ENV === 'production'
/** Origines autorisées pour le matchmaking HTTP (le WebSocket, lui, n'est pas soumis au CORS). */
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? '*'

const app = express()

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.sendStatus(204)
    return
  }
  next()
})

app.get('/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() })
})

/**
 * Salons publics joignables.
 *
 * Le client publié ne sait pas lister les salons, et Colyseus n'expose aucune route pour
 * le faire : cette liste est donc la seule qui existe. Un salon privé en est écarté ici,
 * ce qui suffit à le rendre introuvable autrement que par son code.
 */
app.get('/rooms', async (_req, res) => {
  try {
    const rooms = await matchMaker.query({ name: 'game', locked: false })
    res.json(
      rooms
        .map((room) => room.metadata as { code?: string; listed?: boolean })
        .filter((room) => Boolean(room?.code) && room.listed === true),
    )
  } catch {
    res.json([])
  }
})

if (!IS_PRODUCTION) {
  // Inspecteur des rooms en cours : http://localhost:2567/colyseus
  app.use('/colyseus', monitor())
}

/**
 * En production, le serveur de jeu sert aussi le client.
 *
 * Un seul déploiement, une seule origine : plus de CORS à accorder, plus d'URL de
 * serveur à configurer côté client, et le WebSocket part vers l'hôte courant. En
 * développement, Vite continue de servir le client à part, avec rechargement à chaud.
 */
const WEB_DIST =
  process.env.WEB_DIST ?? fileURLToPath(new URL('../../web/dist', import.meta.url))

if (IS_PRODUCTION && existsSync(WEB_DIST)) {
  app.use(express.static(WEB_DIST, { maxAge: '1h', index: false }))
  // Toutes les autres routes rendent la page : l'application gère ses propres URL.
  app.get(/^\/(?!matchmake|colyseus|health).*/, (_req, res) => {
    res.sendFile(path.join(WEB_DIST, 'index.html'))
  })
  console.log(`   client servi depuis ${WEB_DIST}`)
} else if (IS_PRODUCTION) {
  console.warn(`   ⚠ client introuvable dans ${WEB_DIST} — avez-vous lancé « pnpm build » ?`)
}

const httpServer = createServer(app)
const gameServer = new Server({ transport: new WebSocketTransport({ server: httpServer }) })

// `filterBy(['code'])` fait qu'un même code de salon mène toujours à la même room.
gameServer.define('game', GameRoom).filterBy(['code'])

gameServer
  .listen(PORT)
  .then(() => {
    console.log(`⚔  Polish Battle — serveur en écoute sur le port ${PORT}`)
    if (!IS_PRODUCTION) console.log(`   moniteur : http://localhost:${PORT}/colyseus`)
  })
  .catch((error: unknown) => {
    console.error('Démarrage impossible :', error)
    process.exit(1)
  })

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void gameServer.gracefullyShutdown().then(() => process.exit(0))
  })
}
