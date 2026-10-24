import type { Dict } from './types'

export const en: Dict = {
  localeName: 'English',

  app: {
    title: 'Polish Battle',
    devNotice: 'Development interface — the 3D scene lands in phase 3.',
  },

  lobby: {
    nickname: 'Your nickname',
    nicknamePlaceholder: 'Nico',
    roomCode: 'Room code',
    roomCodePlaceholder: 'ABCD',
    join: 'Join',
    joining: 'Connecting…',
    createRoom: 'or create a new room',
    connectionFailed: 'could not connect',
  },

  table: {
    waiting: 'lobby — waiting',
    turnOf: (name) => `${name} to play`,
    wins: (name) => `🏆 ${name} wins`,
    leave: 'leave',
    start: 'Start the game',
    restart: 'Restart',
    skipTurn: 'Skip turn',
    kick: 'kick',
    yourTurn: 'Your move',
    drawCard: 'Draw a card',
    log: 'Log',
    reducedMotion: 'Reduced motion',
    host: 'host',
    superPower: 'super power available',
    disconnected: 'disconnected',
    eliminated: 'eliminated',
    me: '(me)',
    shield: 'shield',
    life: 'life',
    battery: 'battery',
    drawn: 'drawn',
    cursedCard: 'the cursed card: worth 0 in every role',
  },

  settings: {
    title: 'Settings',
    language: 'Language',
    sfx: 'Sound effects',
    music: 'Music',
    reducedMotion: 'Reduced motion',
    reducedMotionHint: 'Turns off camera moves and card drift.',
  },

  actions: {
    draw: 'Draw',
    attack: 'Attack',
    shield: 'Replace the shield of',
    charge: 'Charge',
    'super-attack': '💥 Super attack on',
    'super-shield': '💥 Super shield on',
    resurrect: '✨ Resurrect',
  },

  events: {
    gameStarted: '— the game begins —',
    drawn: (who, value) => `${who} draws ${value}`,
    attack: (from, to, raw, shield, dealt) =>
      `${from} attacks ${to}: ${raw} − ${shield} shield = ${dealt}`,
    lifeDamaged: (who, from, to) => `  ${who}: life card ${from} → ${to}`,
    lifeDestroyed: (who) => `  ${who} loses a life card`,
    shieldSet: (by, who, value) => `${by} puts a ${value} shield on ${who}`,
    batterySet: (by, who) => `${by} puts a charge on ${who}`,
    batteryLost: (who, reason) =>
      `  ${who} loses their battery (${reason === 'spent' ? 'spent' : 'broken'})`,
    superUsed: (who) => `💥 ${who} uses their super power`,
    resurrected: (by, who) => `✨ ${by} resurrects ${who}`,
    playerDied: (who) => `☠ ${who} is eliminated`,
    turnChanged: (who) => `→ ${who} to play`,
    gameWon: (who) => `🏆 ${who} wins the game`,
  },

  rejections: {
    'game-already-started': 'a game is already running',
    'table-full': 'the table is full',
    'not-enough-players': 'at least two players are needed',
    'illegal-action': 'that move is not playable',
    'host-only': 'host only',
    'unknown-action': 'unknown action',
    'not-during-game': 'not while a game is running',
  },
}
