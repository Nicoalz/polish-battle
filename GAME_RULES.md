# 🃏 Polish Battle — Spécification des règles

> Synthèse des règles **telles qu'implémentées** dans la v1 (commit `7c93a37`), établie pour servir
> de référence à la réécriture from scratch. Les numéros de ligne renvoient au code d'origine.

## 1. Vue d'ensemble

Jeu de cartes multijoueur temps réel, en salon (room).

Stack v1 : Express + Socket.io côté serveur ([back/server.ts](back/server.ts)), Next.js 13 (pages
router) + Tailwind côté client. **Toute la logique de jeu est dans [back/game.ts](back/game.ts)**
(3 classes : `Game`, `Player`, `Card`) ; le front n'est qu'un afficheur + émetteur d'events.

Principe : chaque joueur a des **points de vie matérialisés par des cartes** et un **bouclier
matérialisé par une carte**. À son tour, on tire une carte au hasard et on décide de ce qu'on en
fait : taper, changer un bouclier, ou charger une batterie.

## 2. Les cartes

| Règle | Détail |
|---|---|
| Tirage | **Aucun deck.** Chaque tirage est indépendant. Pioche infinie, doublons possibles. |
| Valeurs | as = 1, 2→10 = faciale, valet = 11, dame = 12, roi = 13 |
| Carte spéciale | **Roi de cœur = valeur 0** (carte nulle). `king_of_hearts` sert aussi de « carte vide » explicite via `setValue(0)`. |
| Mutabilité | `setValue(n)` change la valeur **et** renomme la carte. C'est ce qui permet à une carte de vie de « descendre » : une carte 7 qui prend 3 dégâts devient visuellement un 3 de la même couleur. |

## 3. Mise en place

- Le **1ᵉʳ joueur qui rejoint la room est le chef** 👑 ([back/server.ts:37-41](back/server.ts#L37-L41)).
  La partie est créée à ce moment-là.
- On peut rejoindre **tant que `isStarted === false`**.
- Le chef lance la partie (le front exige ≥ 2 joueurs, [front/pages/game.tsx:49](front/pages/game.tsx#L49)).
- Chaque joueur démarre avec :
  - **2 cartes de vie** tirées au hasard
  - **1 carte bouclier** tirée au hasard
  - **1 super-pouvoir** disponible 💥 (une seule charge pour toute la partie)
  - pas de batterie 🔋

## 4. Déroulement d'un tour

L'ordre est l'ordre d'arrivée, **en sautant les morts**.

> **⚠ La v1 avait inversé le cœur du jeu.** Elle faisait piocher d'abord, puis choisir quoi
> faire de la carte. C'est l'inverse : **on s'engage sans connaître sa carte**. Voir
> l'annexe v2.

À son tour, le joueur choisit un coup et une cible. **Ensuite seulement** la carte se tire
et se révèle à toute la table.

```
Mon tour — je choisis, à l'aveugle :
├─ Attaquer <joueur vivant>
├─ Changer le bouclier de <joueur vivant>
├─ Charger <joueur vivant sans charge>
└─ et si mon super-pouvoir est intact (1× par partie)
   ├─ Super Attaque sur <joueur vivant>
   ├─ Super Bouclier sur <joueur vivant>
   └─ Ressusciter <joueur mort>

… puis la carte se dévoile et le coup se résout.
```

**Chaque action termine le tour.** Attaquer est donc un pari, et changer un bouclier aussi,
dans les deux sens : la carte peut blinder la cible comme la mettre à nu.

## 5. Les 3 actions normales

Chacune tire sa propre carte au moment de se résoudre.

### ⚔️ Attaquer — `attack(player, target)`

```
dégâts = carteTirée + (maBatterie ?? 0) − bouclierDeLaCible
```

Les dégâts sont appliqués à la vie (cf. §6). **Ma batterie est consommée**, ma carte piochée est
défaussée. Le bouclier de la cible, lui, **n'est jamais consommé** : il est permanent jusqu'à ce
qu'on le remplace.

### 🛡️ Changer un bouclier — `changeShield(player, target)`

La carte piochée **remplace** le bouclier de la cible. Sur soi-même (se protéger) ou sur un
adversaire — ce qui permet aussi de **saboter** : remplacer un roi (13) par un as (1).

### 🔋 Charger — `chargeCard(player, target)`

La carte tirée devient la **charge** de la cible, **sans jamais être révélée**. Elle s'ajoute
aux dégâts de la prochaine attaque de son porteur, et ne se découvre qu'à ce moment-là.
**Une seule charge à la fois** : une cible déjà chargée n'est pas proposée.

## 6. Résolution des dégâts (le cœur du jeu)

`applyDamageToLife` ([back/game.ts:67-80](back/game.ts#L67-L80)) — les cartes de vie sont une
**file FIFO** : on tape toujours la carte de vie la plus ancienne.

```
tant que dégâts > 0 et qu'il reste des cartes de vie :
   si dégâts >= vie[0].valeur :
       → la cible PERD SA BATTERIE 🔋
       → la carte de vie est détruite (retirée)
       → dégâts -= valeur de la carte détruite   (le reste déborde sur la carte suivante)
   sinon :
       → vie[0].valeur -= dégâts   (la carte est « entamée » et change de visuel)
       → fin
```

Points importants :

- Si `dégâts <= 0` (bouclier ≥ attaque), **il ne se passe rien du tout**.
- Les dégâts **débordent** d'une carte de vie à l'autre, mais le surplus final est perdu (pas de
  report sur un autre joueur).
- **La batterie de la cible saute uniquement si une carte de vie est détruite**, pas à chaque coup
  encaissé (c'est ce qu'a corrigé le commit `fix charge when dmg`).
- **Mort = somme des valeurs des cartes de vie == 0** ([back/game.ts:202-204](back/game.ts#L202-L204)).

## 7. Les super-pouvoirs (1× par partie, sans piocher)

| Pouvoir | Effet |
|---|---|
| 💥 **Super Attaque** | Tire une carte, **valeur forcée à minimum 8**. Dégâts = carte + batterie − bouclier cible. La cible perd sa batterie **systématiquement** (même sans carte de vie détruite). |
| 🛡️ **Super Bouclier** | Tire une carte, **valeur forcée à minimum 8**, et l'installe comme bouclier sur la cible (soi ou un autre). |
| ✨ **Résurrection** | Uniquement sur un joueur **mort**. Il récupère **1 carte de vie** + **1 nouveau bouclier** (tirés au hasard). Coût : le lanceur **et** le ressuscité perdent leur super-pouvoir. |

## 8. Fin de partie

- Après chaque attaque / super-attaque / résurrection, on recalcule `alivePlayers` / `deadPlayers`.
- **Il reste 1 joueur vivant → il est déclaré vainqueur**
  ([back/game.ts:177-179](back/game.ts#L177-L179)). Le front affiche une overlay, mais **la partie
  ne s'arrête pas réellement** côté serveur.
- **Restart** : réservé au chef. Reconstruit tout à neuf (mêmes noms, nouvelles vies / boucliers /
  pouvoirs) et relance immédiatement.

## 9. Protocole réseau (v1)

Client → serveur : `join-room`, `start-game`, `draw-card`, `attack`, `change-shield`,
`charge-attack`, `resurrect`, `super-attack`, `super-shield`, `restart-game`.

Serveur → clients (broadcast room) : `game-state` (l'objet `Game` complet) et `action`
(`{ text, cards[] }`, le texte narratif + les cartes à illustrer). Le serveur attend **1 s** entre
l'event `action` et le `game-state` qui applique le coup, pour laisser le temps à l'animation.

## 10. Bugs & zones floues à trancher avant la réécriture — *(archive v1)*

### Règles ambiguës (décider : bug ou règle ?)

1. `Card` teste **deux fois la même condition** `king && hearts`
   ([back/game.ts:243-246](back/game.ts#L243-L246)) — l'intention était sûrement « les deux rois
   rouges valent 0 », ou roi de cœur seulement.
2. `setValue(0)` met le nom à `""` → le front demande `/cards_img/_of_hearts.png` → **image cassée**.
3. Un joueur qui démarre avec 2 rois de cœur (vie = 0+0) est **mort dès le début**.
4. **Super Attaque ne consomme pas la batterie de l'attaquant** (contrairement à l'attaque normale)
   → la batterie reste et resservira.
5. Charger un **adversaire** est autorisé par l'UI, alors que ça l'aide. Volontaire ?
6. Un bouclier à 13 rend quasi-invulnérable (il faut 14+ de dégâts), et il n'est jamais usé.
7. `chargeCard` refusé (cible déjà chargée) → **le tour n'est pas passé**, mais la carte piochée
   reste : le joueur est coincé, il doit rejouer une action.
8. La résurrection ne rend qu'**1** carte de vie (vs 2 au départ) — volontaire ?

### Problèmes techniques (à corriger d'office en v2)

9. **Aucune validation serveur du tour ni de l'identité** : n'importe quel client peut émettre
   `attack` avec n'importe quel `playerIndex`. Triche triviale.
10. **`draw-card` n'est pas idempotent** : spammer le bouton re-tire une carte à l'infini jusqu'à
    avoir un roi.
11. L'identité du joueur est déduite par **comparaison de pseudo**
    ([front/pages/game.tsx:29-31](front/pages/game.tsx#L29-L31)) : deux joueurs homonymes cassent
    tout. Pas d'ID stable.
12. **Zéro gestion de la déconnexion** : un joueur qui part bloque le tour pour toujours. Et si le
    1ᵉʳ socket quitte, `games[roomId]` peut être `undefined` pour les suivants.
13. `socket.on("game-state")` est enregistré **dans le corps du render** React → listeners empilés à
    chaque render ([front/pages/game.tsx:55](front/pages/game.tsx#L55),
    [front/components/Gameboard.tsx:49](front/components/Gameboard.tsx#L49)).
14. `getNextAlivePlayerIndex` **boucle à l'infini** si plus personne n'est vivant.
15. L'objet `Game` complet est broadcasté à tout le monde (sans gravité ici — aucune information
    cachée — mais à acter explicitement).
16. CORS en dur sur l'URL de prod ([back/server.ts:20](back/server.ts#L20)).

## 11. Décisions à prendre pour la v2

- **Règles** : on garde les points 1→8 tels quels, ou on nettoie ?
- **Pioche** : vrai deck de 52 cartes avec défausse et reshuffle, ou on reste sur du tirage
  aléatoire infini ?
- **Stack** : on garde Next + Socket.io, ou autre chose ?
- **Architecture** : isoler un **moteur de jeu pur** (fonctions pures état → état), testable sans
  réseau, avec le serveur comme simple couche de transport + validation. Fortement recommandé :
  ça rend chaque règle ci-dessus vérifiable par un test.

---

# Annexe — arbitrages de la v2

Les règles ci-dessus décrivent la **v1**. Voici ce qui change dans la réécriture, et ce qui
ne change pas. Chaque ligne correspond à un test dans `packages/engine/test/`.

## Les cartes : un dessin propre au jeu

Le jeu est né sur table, avec un paquet de 52 cartes classique. À l'écran, la famille
(♠♥♦♣) ne servait plus à rien : sur 52 cartes, une seule la rendait signifiante — le roi
de cœur, qui valait 0. Elle a donc disparu.

Une carte v2 porte un **chiffre** et un **rôle**, et c'est le rôle qui colore toute sa
surface : rouge pour la vie, bleu pour le bouclier, ambre pour la charge, vert pour la
carte qu'on vient de piocher. C'est l'information que les joueurs cherchent vraiment du
regard, là où la v1 la reléguait à un liseré.

L'ancien roi de cœur devient **la carte maudite** : une carte noire fêlée marquée 0.

**La distribution des valeurs est rigoureusement conservée**, pour ne pas déplacer
l'équilibre en changeant l'habillage (vérifié par un test sur 520 000 tirages) :

| Valeur | Chances | Origine |
|---|---|---|
| 0 | 1 / 52 | le roi de cœur |
| 13 | 3 / 52 | les trois autres rois |
| 1 à 12 | 4 / 52 chacune | les quatre familles |

## La correction majeure : on joue à l'aveugle

La v1 faisait **piocher d'abord**, puis choisir quoi faire de la carte révélée. C'est
exactement l'inverse du jeu de table : **tout l'intérêt est de s'engager sans connaître sa
carte**. Un code qui ne fait que retranscrire un comportement ne peut pas distinguer un
choix de conception d'une erreur — celle-ci n'a été vue qu'en jouant.

Conséquences, en cascade :

- **Il n'existe plus d'action « piocher ».** Chaque coup tire sa propre carte en se résolvant.
- **Plus personne ne détient de carte.** `drawn` disparaît de l'état des joueurs, du schéma
  réseau et du client.
- **Le super-pouvoir n'est plus une alternative à la pioche**, mais un coup parmi les autres.
- **La charge redevient simplement secrète.** Comme aucune carte n'est détenue, il n'y a plus
  rien à cacher en amont : la charge se pose sans révélation, et c'est tout.
- **Les parties s'allongent d'environ 40 %** (8 tours à 2 joueurs, 23 à 4, 50 à 8), et les
  sièges restent équitables à ±0,5 point.

## Règles conservées à l'identique

- Pioche aléatoire infinie, sans paquet ni défausse.
- **Une carte maudite à 0**, tirée 1 fois sur 52, qui ne vaut rien dans aucun rôle.
- Bouclier **permanent**, jamais usé, remplacé uniquement par « Changer un bouclier ».
- Dégâts `carte + batterie − bouclier`, file FIFO sur les cartes de vie, débordement,
  surplus perdu.
- Batterie de la cible perdue **uniquement** si une carte de vie est détruite.
- Charge possible sur **n'importe quel** joueur vivant, y compris un adversaire.
- Résurrection : 1 carte de vie + bouclier neuf, et **les deux** joueurs perdent leur
  super-pouvoir.
- Super-pouvoir unique par partie, inaccessible une fois la carte piochée.
- Cibler n'importe quel joueur vivant, soi-même compris.

## Corrections

| # | v1 | v2 |
|---|---|---|
| 1 | La super-attaque ne consommait pas la batterie de l'attaquant | Elle la consomme, comme l'attaque normale |
| 2 | Charger une cible déjà chargée bloquait le tour | La cible n'est pas proposée : `legalActions()` l'exclut |
| 3 | Deux rois de cœur en vie = joueur mort-né | Les cartes de vie sont retirées tant que leur total vaut 0 |
| 4 | `setValue(0)` produisait une carte sans nom ni visuel | La carte porte sa valeur et son rang d'origine : une carte de vie entamée se dessine fêlée |
| 5 | Aucune validation serveur : triche triviale | L'acteur vient de la session ; `legalActions()` arbitre tout |
| 6 | Pioche répétable à l'infini (re-tirage) | Piocher deux fois n'est pas une action légale |
| 7 | Identification par pseudo | Identifiant stable, reprise de siège, pouvoirs d'hôte |
| 8 | Un onglet fermé gelait la partie | Joueur marqué déconnecté, tour passé après 30 s |
| 9 | Boucle infinie si plus personne n'est vivant | Garde-fou dans la recherche du siège suivant |
| 10 | La partie continuait après la victoire | Phase `finished` : plus aucune action acceptée |
| 11 | La valeur d'une charge était visible de tous | La charge est posée **face cachée** : sa valeur ne quitte pas le serveur et ne se révèle qu'en étant dépensée |

### La charge, face cachée

Une charge se pose face cachée, et elle l'est **pour de bon** : le serveur ne transmet
que l'identifiant de la carte, jamais sa valeur — pas même à son porteur. Personne ne
peut donc la lire, ni à l'écran ni dans les outils de développement du navigateur.

Elle se révèle d'elle-même au moment où elle est dépensée : l'événement d'attaque
transporte alors la carte entière, puisque sa valeur entre dans le calcul des dégâts.
Le journal annonce donc « X pose une charge sur Y » sans chiffre, puis le montre à
l'attaque. Trois vérifications du test de fumée couvrent exactement cela.

## Mesures d'équilibrage

`pnpm sim --games 20000 --detail`, politique de jeu automatique :

- **0 % de parties non terminées** sur tous les effectifs de 2 à 8 joueurs : le bouclier
  permanent ne bloque pas le jeu.
- Durée : ~6 tours à 2 joueurs, ~16 à 4, ~34 à 8.
- **Les sièges sont équitables** : chaque position est à moins de 0,6 point de son taux de
  victoire théorique, à tous les effectifs.

Deux pièges rencontrés en route, consignés pour mémoire :

1. Le jeu avantageait réellement **celui qui commence en duel** (53,9 % de victoires). D'où
   le tirage au sort du siège de départ dans `startGame()` : le duel est depuis à 50,0 %.
2. Une première campagne de mesure annonçait un avantage du dernier siège à 3 joueurs et
   plus. C'était un **artefact du simulateur** : l'IA départageait les cibles à égalité par
   ordre de siège, donc les premiers sièges encaissaient plus souvent. Les égalités sont
   désormais tranchées au hasard et l'écart disparaît. Un biais mesuré sur une IA n'est une
   propriété du jeu qu'une fois la politique elle-même vérifiée.
