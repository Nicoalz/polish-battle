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
    this.turnIndex = this.getNextAlivePlayerIndex(this.turnIndex);
    this.nextTurnIndex = this.getNextAlivePlayerIndex(this.turnIndex);
  }

  private getNextAlivePlayerIndex(currentIndex: number): number {
    let nextIndex = (currentIndex + 1) % this.players.length;
    while (!this.players[nextIndex].isAlive()) {
      nextIndex = (nextIndex + 1) % this.players.length;
    }
    return nextIndex;
  }

  public showActualCard(player: Player): number {
    return player.drawnCard ? player.drawnCard.value : 0;
  }

  public startGame() {
    this.alivePlayers = this.players;
    this.isStarted = true;
  }

  public restartGame() {
    const players = this.players;
    this.players = [];
    this.alivePlayers = [];
    this.deadPlayers = [];
    this.turnIndex = 0;
    this.nextTurnIndex = 1;
    this.isStarted = false;
    this.winner = undefined;
    players.forEach((player) => {
      this.addPlayer(player.name);
    });
    this.startGame();
  }

  private applyDamageToLife(dmg: number, target: Player) {
    while (dmg > 0 && target.life.length > 0) {
      target.resetChargedCard();
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

    player.resetChargedCard();
    player.resetDrawnCard();
    this.updatePlayersStatus();
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
    if (target.isAlive()) return;
    target.shield = new Card();
    target.life.push(new Card());
    player.hasSuperPower = false;
    target.hasSuperPower = false;
    this.updatePlayersStatus();
    this.changeTurnToNextPlayer();
  }

  public superAttack(playerIndex: number, targetIndex: number): Card {
    const player = this.players[playerIndex];
    const target = this.players[targetIndex];
    const nullCard = new Card();
    nullCard.setValue(0);
    if (!player.hasSuperPower) return nullCard;
    if (player.drawnCard) return nullCard;
    const superPwrCard = new Card();
    if (superPwrCard.value < 8) {
      superPwrCard.setValue(8);
    }
    const chargedDmg = player.chargedCard?.value || 0;
    let dmg = superPwrCard.value + chargedDmg - target.shield.value;
    dmg = this.applyDamageToLife(dmg, target);
    target.resetChargedCard();
    player.hasSuperPower = false;
    this.updatePlayersStatus();
    this.changeTurnToNextPlayer();
    return superPwrCard;
  }

  public superShield(playerIndex: number, targetIndex: number): Card {
    const player = this.players[playerIndex];
    const target = this.players[targetIndex];
    const nullCard = new Card();
    nullCard.setValue(0);
    if (!player.hasSuperPower) return nullCard;
    if (player.drawnCard) return nullCard;
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
    return target.shield;
  }

  public updatePlayersStatus() {
    const alivePlayers = this.players.filter((p) => p.isAlive());
    const deadPlayers = this.players.filter((p) => !p.isAlive());
    this.alivePlayers = alivePlayers;
    this.deadPlayers = deadPlayers;
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
  public name: string;
  public value: number;
  public color: string;
  public possibleColors: string[] = ["hearts", "spades", "diamonds", "clubs"];
  public possibleValues: { value: number; name: string }[] = [
    { value: 1, name: "ace" },
    { value: 2, name: "2" },
    { value: 3, name: "3" },
    { value: 4, name: "4" },
    { value: 5, name: "5" },
    { value: 6, name: "6" },
    { value: 7, name: "7" },
    { value: 8, name: "8" },
    { value: 9, name: "9" },
    { value: 10, name: "10" },
    { value: 11, name: "jack" },
    { value: 12, name: "queen" },
    { value: 13, name: "king" },
  ];

  constructor() {
    this.color =
      this.possibleColors[
        Math.floor(Math.random() * this.possibleColors.length)
      ];
    const randomIndex = Math.floor(Math.random() * this.possibleValues.length);
    this.name = this.possibleValues[randomIndex].name;
    if (
      (this.name === "king" && this.color === "hearts") ||
      (this.name === "king" && this.color === "hearts")
    ) {
      this.value = 0;
    } else {
      this.value = this.possibleValues[randomIndex].value;
    }
  }

  setValue(value: number) {
    this.value = value;
    this.name =
      this.possibleValues.find((val) => val.value === value)?.name || "";
  }
}
