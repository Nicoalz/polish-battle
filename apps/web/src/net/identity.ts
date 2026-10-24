const PLAYER_ID_KEY = 'pb.playerId'
const NAME_KEY = 'pb.name'

/**
 * Identifiant stable du joueur, conservé dans le navigateur.
 *
 * C'est lui qui permet de retrouver son siège après un rechargement ou une coupure
 * réseau. La v1 reconnaissait les joueurs à leur pseudo, ce qui cassait dès que deux
 * personnes choisissaient le même.
 */
export function getPlayerId(): string {
  let id = localStorage.getItem(PLAYER_ID_KEY)
  if (!id) {
    id = randomId()
    localStorage.setItem(PLAYER_ID_KEY, id)
  }
  return id
}

/**
 * `crypto.randomUUID` n'existe pas hors contexte sécurisé : tester depuis un téléphone
 * sur `http://192.168.x.x` ferait échouer la création du store au chargement du module,
 * et la page resterait blanche. On n'a besoin ici que d'unicité, pas de cryptographie.
 */
function randomId(): string {
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID()

  if (typeof crypto?.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

export function getSavedName(): string {
  return localStorage.getItem(NAME_KEY) ?? ''
}

export function saveName(name: string): void {
  localStorage.setItem(NAME_KEY, name)
}
