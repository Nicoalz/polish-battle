# Polish Battle

Jeu de cartes multijoueur en temps réel, joué à l'origine sur table et porté à l'écran
avec une scène 3D. De 2 à 8 joueurs, par salon, sans compte ni installation.

Le principe tient en une phrase : **on choisit son coup et sa cible avant de connaître sa
carte**. Attaquer est un pari, changer un bouclier aussi — la carte tirée peut blinder la
cible autant que la mettre à nu.

Les règles complètes et les arbitrages de cette version sont dans **[GAME_RULES.md](GAME_RULES.md)**.

## Démarrer

```bash
pnpm install
pnpm dev          # serveur de jeu sur 2567, client sur 5173
```

Ouvre <http://localhost:5173>, choisis un pseudo, crée un salon. Le code du salon vit
dans l'URL : partager le lien suffit à inviter. Ferme un onglet en pleine partie et
rouvre-le, tu retrouveras ta place et tes cartes.

Les places changent à chaque manche : enchaîner les parties ne rejoue pas la même table.

**Pour jouer plusieurs joueurs depuis un seul navigateur**, ajoute `&joueur=2`,
`&joueur=3`… à l'URL de chaque onglet supplémentaire. Sans ce paramètre, tous les
onglets partagent la même identité — c'est le stockage local qui veut ça — et le second
reprend simplement le siège du premier.

| Commande | Effet |
|---|---|
| `pnpm dev` | serveur + client, rechargement à chaud |
| `pnpm test` | les règles du moteur (66 tests) |
| `pnpm sim` | simulation d'équilibrage sur des milliers de parties |
| `pnpm smoke` | partie complète jouée en réseau, sans navigateur |
| `pnpm verify` | typage + tests + partie réseau |
| `pnpm build` | compile le client |

Deux adresses utiles en développement : `http://localhost:2567/colyseus` (inspecteur des
salons) et `?debug` sur le client (interface de développement, sans 3D).

## Organisation

```
packages/engine/   règles pures, sans réseau ni rendu — c'est ici que vit le jeu
apps/server/       salon autoritaire (Colyseus) : valide, applique, diffuse
apps/web/          client (Vite + React + React Three Fiber)
```

Trois principes structurent le tout :

**Le moteur ne connaît rien d'autre que les règles.** Des fonctions pures, état → état,
sans `Math.random` ni horloge ni réseau. Chaque règle de `GAME_RULES.md` a son test, et la
suite complète tourne en quelques millisecondes.

**Le serveur est seul juge.** L'identité de l'acteur vient de sa session, jamais d'un
index envoyé par le client, et toute action passe par `legalActions()` — la même fonction
qui grise les boutons côté client. L'interface ne peut donc pas proposer un coup que le
serveur refuserait.

**Le client raconte avant de montrer.** Le serveur diffuse, pour chaque action, le récit
de ce qui s'est passé. L'affichage n'avance qu'au rythme de ce récit : la carte de vie ne
tombe pas pendant que la carte d'attaque est encore en l'air. La mise en scène reste un
confort, jamais une condition — onglet masqué, minuterie bridée ou exception, l'affichage
rattrape toujours.

## Déployer

Le serveur de jeu sert aussi le client compilé : **une seule application**, une seule
origine, rien à configurer côté client.

### Render

`render.yaml` décrit le service. En créant un **Web Service** depuis le dépôt :

| Champ | Valeur |
|---|---|
| Runtime | Node |
| Build command | `pnpm install --frozen-lockfile && pnpm --filter @pb/web build` |
| Start command | `pnpm --filter @pb/server start` |
| Health check path | `/health` |
| Variables | `NODE_ENV=production`, `NODE_VERSION=24`, `PNPM_VERSION=11.9.0` |

`NODE_ENV=production` n'est pas optionnel : c'est lui qui déclenche le service des
fichiers du client. Sans lui, le serveur répond mais la page est vide.

N'ajoute pas `corepack enable` à la commande de build : corepack écrit ses raccourcis
dans `/usr/bin`, en lecture seule sur l'hôte, et le build échoue avec `EROFS`. Render
fournit pnpm de lui-même dès qu'il repère le lockfile. Sans `NODE_VERSION`, il installe
la dernière version satisfaisant `engines`, ce qui peut être une majeure jamais testée
ici — d'où aussi le fichier `.node-version` à la racine.

Garde **une seule instance** : les parties vivent en mémoire, et deux instances
enverraient deux joueurs du même salon sur deux tables différentes. Sur le plan gratuit,
le service s'endort après quinze minutes sans trafic — les parties en cours sont alors
perdues, et le premier visiteur attend le réveil.

### Fly.io

```bash
fly launch --no-deploy   # une fois
fly deploy
```

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | `2567` | port d'écoute |
| `NODE_ENV` | — | `production` active le service du client et coupe l'inspecteur |
| `ALLOWED_ORIGIN` | `*` | origines autorisées, si le client est hébergé ailleurs |
| `VITE_SERVER_URL` | même origine | adresse du serveur, à la compilation du client |

Les parties vivent en mémoire : il n'y a pas de base de données, et une seule machine
doit tourner pour qu'un salon reste joignable (`min_machines_running = 1` dans
`fly.toml`).
