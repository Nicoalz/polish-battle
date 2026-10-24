import type { Dict } from './types'

export const fr: Dict = {
  localeName: 'Français',

  app: {
    title: 'Polish Battle',
    devNotice: 'Interface de développement — la scène 3D arrive en phase 3.',
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
    drawCard: 'Piocher une carte',
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
    drawn: 'piochée',
    cursedCard: 'la carte maudite : elle vaut 0 dans tous ses rôles',
  },

  settings: {
    title: 'Réglages',
    language: 'Langue',
    sfx: 'Effets sonores',
    music: 'Musique',
    reducedMotion: 'Animations réduites',
    reducedMotionHint: 'Coupe les mouvements de caméra et le flottement des cartes.',
  },

  actions: {
    draw: 'Piocher',
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
