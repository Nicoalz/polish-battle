export type TPlayer = {
  index: number;
  name: string;
  life: TCard[];
  drawnCard?: TCard;
  isChef: boolean;
  shield: TCard;
  chargedCard?: TCard;
  hasSuperPower: boolean;
};

export type TCard = {
  name: string;
  value: number;
  color: string;
  possibleColors: string[];
  possibleValues: { value: number; name: string }[];
};

export type TGame = {
  id: string;
  players: TPlayer[];
  alivePlayers: TPlayer[];
  deadPlayers: TPlayer[];
  turnIndex: number;
  nextTurnIndex: number;
  isStarted: boolean;
  winner?: TPlayer;
};

export type TLastAction = {
  cards: TCard[];
  text: string;
};
