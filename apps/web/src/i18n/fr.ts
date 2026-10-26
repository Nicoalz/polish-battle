import type { Dict } from './types'

export const fr: Dict = {
  localeName: 'Français',

  app: {
    title: 'Polish Battle',
    devNotice: 'Interface de développement — la scène 3D arrive en phase 3.',
  },

  home: {
    tagline: 'On choisit son coup avant de voir sa carte.',
    avatar: 'Ton visage',
    joinByCode: 'Rejoindre par code',
    create: 'Créer un salon',
    createPublic: 'Public',
    createPrivate: 'Privé',
    visibilityHint: 'Un salon public apparaît dans la liste ci-dessous.',
    openRooms: 'Salons ouverts',
    noRooms: 'Aucun salon public pour l’instant.',
    players: (count) => (count > 1 ? `${count} joueurs` : `${count} joueur`),
    inProgress: 'en cours',
  },

  lobby: {
    nickname: 'Ton pseudo',
    nicknamePlaceholder: 'Nico',
    roomCode: 'Code du salon',
    roomCodePlaceholder: 'ABCD',
    join: 'Rejoindre',
    joining: 'Connexion…',
    createRoom: 'ou créer un nouveau salon',
    connectionFailed: 'connexion impossible',
  },

  table: {
    waiting: 'salon — en attente',
    turnOf: (name) => `au tour de ${name}`,
    wins: (name) => `🏆 ${name} gagne`,
    leave: 'quitter',
    start: 'Lancer la partie',
    restart: 'Relancer',
    skipTurn: 'Passer le tour',
    kick: 'exclure',
    yourTurn: 'À toi de jouer',
    secondsLeft: (seconds) => `${seconds} s`,
    chooseAction: 'À toi de jouer — choisis ton coup, la carte se révèle ensuite',
    chooseTarget: (action: string) => `${action} qui ?`,
    log: 'Journal',
    reducedMotion: 'Animations réduites',
    host: 'hôte',
    superPower: 'super-pouvoir disponible',
    disconnected: 'déconnecté',
    eliminated: 'éliminé',
    me: '(moi)',
    shield: 'bouclier',
    life: 'vie',
    battery: 'batterie',
    cursedCard: 'la carte maudite : elle vaut 0 dans tous ses rôles',
  },

  history: {
    title: 'Historique',
    empty: 'La partie n’a pas encore commencé.',
    started: '— la partie commence —',
    skipped: 'tour passé',
    attack: (from, to, cards) => `${from} attaque ${to} avec ${cards}`,
    superAttack: (from, to, cards) => `💥 ${from} super-attaque ${to} avec ${cards}`,
    damage: (amount) => ` — ${amount} de dégâts`,
    blocked: ' — bloqué',
    shield: (from, to, value, self) =>
      self ? `${from} se protège avec ${value}` : `${from} pose un bouclier ${value} sur ${to}`,
    superShield: (from, to, value, self) =>
      self
        ? `💥 ${from} se blinde avec ${value}`
        : `💥 ${from} pose un super-bouclier ${value} sur ${to}`,
    charge: (from, to, self) => (self ? `${from} se charge` : `${from} charge ${to}`),
    resurrect: (from, to) => `✨ ${from} ressuscite ${to}`,
    eliminated: (who) => ` · ☠ ${who} est éliminé`,
    won: (who) => ` · 🏆 ${who} gagne`,
  },

  settings: {
    title: 'Réglages',
    language: 'Langue',
    sfx: 'Effets sonores',
    music: 'Musique',
    reducedMotion: 'Animations réduites',
    reducedMotionHint: 'Coupe les mouvements de caméra et le flottement des cartes.',
  },

  avatars: {
    buzz: 'Coupe rasée',
    short: 'Cheveux courts',
    curls: 'Cheveux bouclés',
    afro: 'Coupe afro',
    waves: 'Cheveux ondulés',
    long: 'Cheveux longs',
    bob: 'Carré',
    bun: 'Chignon',
    ponytail: 'Queue-de-cheval',
    locs: 'Locks',
    bald: 'Crâne rasé et barbe',
    scarf: 'Foulard',
  },

  actions: {
    attack: 'Attaquer',
    shield: 'Changer le bouclier de',
    charge: 'Charger',
    'super-attack': '💥 Super-attaque sur',
    'super-shield': '💥 Super-bouclier sur',
    resurrect: '✨ Ressusciter',
  },

  events: {
    gameStarted: '— la partie commence —',
    drawn: (who, value) => `${who} pioche ${value}`,
    attack: (from, to, raw, shield, dealt) =>
      `${from} attaque ${to} : ${raw} − ${shield} de bouclier = ${dealt}`,
    lifeDamaged: (who, from, to) => `  ${who} : carte de vie ${from} → ${to}`,
    lifeDestroyed: (who) => `  ${who} perd une carte de vie`,
    shieldSet: (by, who, value) => `${by} pose un bouclier ${value} sur ${who}`,
    batterySet: (by, who) => `${by} pose une charge sur ${who}`,
    batteryLost: (who, reason) =>
      `  ${who} perd sa batterie (${reason === 'spent' ? 'dépensée' : 'cassée'})`,
    superUsed: (who) => `💥 ${who} utilise son super-pouvoir`,
    resurrected: (by, who) => `✨ ${by} ressuscite ${who}`,
    playerDied: (who) => `☠ ${who} est éliminé`,
    turnChanged: (who) => `→ au tour de ${who}`,
    gameWon: (who) => `🏆 ${who} gagne la partie`,
  },

  rejections: {
    'game-already-started': 'la partie est en cours',
    'table-full': 'la table est pleine',
    'not-enough-players': 'il faut au moins deux joueurs',
    'illegal-action': 'ce coup n’est pas jouable',
    'host-only': 'réservé à l’hôte',
    'unknown-action': 'action inconnue',
    'not-during-game': 'impossible pendant une partie',
  },
}
