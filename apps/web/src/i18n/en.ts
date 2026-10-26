import type { Dict } from './types'

export const en: Dict = {
  localeName: 'English',

  app: {
    title: 'Polish Battle',
    devNotice: 'Development interface — the 3D scene lands in phase 3.',
  },

  home: {
    tagline: 'Commit to your move before seeing your card.',
    avatar: 'Your face',
    joinByCode: 'Join with a code',
    create: 'Create a room',
    createPublic: 'Public',
    createPrivate: 'Private',
    visibilityHint: 'A public room shows up in the list below.',
    openRooms: 'Open rooms',
    noRooms: 'No public room right now.',
    players: (count) => (count > 1 ? `${count} players` : `${count} player`),
    inProgress: 'in progress',
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
    secondsLeft: (seconds) => `${seconds}s`,
    chooseAction: 'Your move — commit first, the card shows after',
    chooseTarget: (action: string) => `${action} who?`,
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
    cursedCard: 'the cursed card: worth 0 in every role',
  },

  history: {
    title: 'History',
    empty: 'The game has not started yet.',
    started: '— the game begins —',
    skipped: 'turn skipped',
    attack: (from, to, cards) => `${from} attacks ${to} with ${cards}`,
    superAttack: (from, to, cards) => `💥 ${from} super-attacks ${to} with ${cards}`,
    damage: (amount) => ` — ${amount} damage`,
    blocked: ' — blocked',
    shield: (from, to, value, self) =>
      self ? `${from} shields up with ${value}` : `${from} puts a ${value} shield on ${to}`,
    superShield: (from, to, value, self) =>
      self
        ? `💥 ${from} super-shields up with ${value}`
        : `💥 ${from} puts a ${value} super shield on ${to}`,
    charge: (from, to, self) => (self ? `${from} charges up` : `${from} charges ${to}`),
    resurrect: (from, to) => `✨ ${from} resurrects ${to}`,
    eliminated: (who) => ` · ☠ ${who} is out`,
    won: (who) => ` · 🏆 ${who} wins`,
  },

  settings: {
    title: 'Settings',
    language: 'Language',
    sfx: 'Sound effects',
    music: 'Music',
    reducedMotion: 'Reduced motion',
    reducedMotionHint: 'Turns off camera moves and card drift.',
  },

  avatars: {
    buzz: 'Buzz cut',
    short: 'Short hair',
    curls: 'Curly hair',
    afro: 'Afro',
    waves: 'Wavy hair',
    long: 'Long hair',
    bob: 'Bob',
    bun: 'Bun',
    ponytail: 'Ponytail',
    locs: 'Locs',
    bald: 'Bald with beard',
    scarf: 'Headscarf',
  },

  options: {
    title: 'Game options',
    hostOnly: 'Only the host can change these.',
    labels: {
      mirrorStart: 'Same start for everyone',
    },
    hints: {
      mirrorStart: 'Everyone begins with the same life cards and the same shield.',
    },
  },

  actions: {
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
