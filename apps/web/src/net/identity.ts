const PLAYER_ID_KEY = 'pb.playerId'
const NAME_KEY = 'pb.name'

/**
 * Permet d'incarner plusieurs joueurs depuis un même navigateur.
 *
 * L'identité vit dans le stockage local, qui est partagé par tous les onglets d'une même
 * origine : sans cela, deux onglets se présentent avec le même identifiant et le second
 * reprend le siège du premier — la reprise de siège faisant exactement son travail.
 * `?joueur=2` donne à cet onglet son propre identifiant, stable d'un rechargement à
 * l'autre. Indispensable pour tester une partie seul, et sans incidence sur la sécurité :
 * le serveur n'accorde jamais une action à un identifiant, mais à une session.
 */
function storageKey(base: string): string {
  const seat = new URLSearchParams(window.location.search).get('joueur')
  return seat ? `${base}.${seat.slice(0, 8)}` : base
}

/**
 * Identifiant stable du joueur, conservé dans le navigateur.
 *
 * C'est lui qui permet de retrouver son siège après un rechargement ou une coupure
 * réseau. La v1 reconnaissait les joueurs à leur pseudo, ce qui cassait dès que deux
 * personnes choisissaient le même.
 */
export function getPlayerId(): string {
  const key = storageKey(PLAYER_ID_KEY)
  let id = localStorage.getItem(key)
  if (!id) {
    id = randomId()
    localStorage.setItem(key, id)
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
  return localStorage.getItem(storageKey(NAME_KEY)) ?? ''
}

export function saveName(name: string): void {
  localStorage.setItem(storageKey(NAME_KEY), name)
}
