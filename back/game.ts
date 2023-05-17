export class Game {
  public id: string;
  public players: Player[] = [];
  public alivePlayers: Player[] = [];
  public deadPlayers: Player[] = [];
  public turnIndex: number;
  public nextTurnIndex: number;
  public isStarted: boolean;
  public winner?: Player;

  constructor(id: string) {
    this.id = id;
    this.players = [];
    this.turnIndex = 0;
    this.nextTurnIndex = 1;
    this.isStarted = false;
  }

  public addPlayer(name: string) {
    this.players.push(
      new Player(name, this.players.length === 0, this.players.length)
    );
  }

  public drawCard(actionnerIndex: number) {
    const player = this.players[actionnerIndex];
    player.drawnCard = new Card();
  }

  public changeTurnToNextPlayer() {
    this.turnIndex = (this.turnIndex + 1) % this.players.length;
    this.nextTurnIndex = (this.turnIndex + 1) % this.players.length;
  }

  public showActualCard(player: Player): number {
    return player.drawnCard ? player.drawnCard.value : 0;
  }

  public startGame() {
    this.alivePlayers = this.players;
    this.isStarted = true;
  }

  private applyDamageToLife(dmg: number, target: Player) {
    while (dmg > 0 && target.life.length > 0) {
      if (dmg >= target.life[0].value) {
        dmg -= target.life[0].value;
        target.life[0].setValue(0);
        target.life.shift();
      } else {
        target.life[0].setValue(target.life[0].value - dmg);
        dmg = 0;
      }
    }
    return dmg;
  }

  public attack(playerIndex: number, targetIndex: number) {
    const player = this.players[playerIndex];
    const target = this.players[targetIndex];
    if (!player.drawnCard) return;
    const chargedDmg = player.chargedCard?.value || 0;
    let dmg = player.drawnCard.value + chargedDmg - target.shield.value;

    dmg = this.applyDamageToLife(dmg, target);

    target.resetChargedCard();
    player.resetDrawnCard();
    this.updateWinner();
    this.changeTurnToNextPlayer();
  }

  public changeShield(playerIndex: number, targetIndex: number) {
    const player = this.players[playerIndex];
    if (!player.drawnCard) return;
    const target = this.players[targetIndex];
    target.shield = player.drawnCard;
    player.resetDrawnCard();
    this.changeTurnToNextPlayer();
  }

  public chargeCard(playerIndex: number, targetIndex: number) {
    const player = this.players[playerIndex];
    if (!player.drawnCard) return;
    const target = this.players[targetIndex];
    if (target.chargedCard) return;
    target.chargedCard = player.drawnCard;
    player.resetDrawnCard();
    this.changeTurnToNextPlayer();
  }

  public resurrect(playerIndex: number, targetIndex: number) {
    const player = this.players[playerIndex];
    const target = this.players[targetIndex];
    if (!player.hasSuperPower) return;
    if (player.drawnCard) return;
    if (target.life.length > 0) return;
    target.life.push(new Card());
    player.hasSuperPower = false;
    this.changeTurnToNextPlayer();
  }

  public superAttack(playerIndex: number, targetIndex: number): number {
    // its an attack with new Card, if new Card Value is < 8 then its deals 8 dmg
    const player = this.players[playerIndex];
    const target = this.players[targetIndex];
    if (!player.hasSuperPower) return 0;
    if (player.drawnCard) return 0;
    let superPwrDmg = 0;
    const newCard = new Card();
    if (newCard.value < 8) {
      superPwrDmg = 8;
    } else {
      superPwrDmg = newCard.value;
    }
    const chargedDmg = player.chargedCard?.value || 0;
    let dmg = superPwrDmg + chargedDmg - target.shield.value;
    dmg = this.applyDamageToLife(dmg, target);
    target.resetChargedCard();
    player.hasSuperPower = false;
    this.updateWinner();
    this.changeTurnToNextPlayer();
    return superPwrDmg;
  }

  public superShield(playerIndex: number, targetIndex: number): number {
    const player = this.players[playerIndex];
    const target = this.players[targetIndex];
    if (!player.hasSuperPower) return 0;
    if (player.drawnCard) return 0;
    let superPwrShield = 0;
    const newCard = new Card();
    if (newCard.value < 8) {
      superPwrShield = 8;
    } else {
      superPwrShield = newCard.value;
    }
    target.shield = new Card();
    target.shield.setValue(superPwrShield);
    player.hasSuperPower = false;
    this.changeTurnToNextPlayer();
    return superPwrShield;
  }

  public updateWinner() {
    const alivePlayers = this.players.filter((p) => p.isAlive());
    if (alivePlayers.length === 1) {
      this.winner = alivePlayers[0];
    }
  }
}

export class Player {
  public index: number;
  public name: string;
  public life: Card[] = [];
  public drawnCard?: Card;
  public isChef: boolean;
  public shield: Card;
  public chargedCard?: Card;
  public hasSuperPower: boolean;

  constructor(name: string, isChef: boolean, index: number) {
    this.name = name;
    this.life.push(new Card(), new Card());
    this.shield = new Card();
    this.isChef = isChef;
    this.index = index;
    this.hasSuperPower = true;
  }

  public isAlive() {
    return this.life.reduce((sum, card) => sum + card.value, 0) > 0;
  }

  public resetDrawnCard() {
    this.drawnCard = undefined;
  }

  public resetChargedCard() {
    this.chargedCard = undefined;
  }
}

export class Card {
  public img: string;
  public value: number;
  public color: string;
  public possibleColors: string[] = ["❤️", "♦️", "♠️", "♣️"];
  public possibleValues: { value: number; img: string }[] = [
    { value: 1, img: "1" },
    { value: 2, img: "2" },
    { value: 3, img: "3" },
    { value: 4, img: "4" },
    { value: 5, img: "5" },
    { value: 6, img: "6" },
    { value: 7, img: "7" },
    { value: 8, img: "8" },
    { value: 9, img: "9" },
    { value: 10, img: "10" },
    { value: 11, img: "💂‍♀️" },
    { value: 12, img: "👸" },
    { value: 13, img: "🤴" },
  ];

  constructor() {
    this.color =
      this.possibleColors[
        Math.floor(Math.random() * this.possibleColors.length)
      ];
    const randomIndex = Math.floor(Math.random() * this.possibleValues.length);
    this.img = this.possibleValues[randomIndex].img;
    if (
      (this.img === "🤴" && this.color === "❤️") ||
      (this.img === "🤴" && this.color === "♦️")
    ) {
      this.value = 0;
    } else {
      this.value = this.possibleValues[randomIndex].value;
    }
  }

  setValue(value: number) {
    this.value = value;
    this.img =
      this.possibleValues.find((val) => val.value === value)?.img || "";
  }
}
