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
  img: string;
  value: number;
  color: string;
  possibleColors: string[];
  possibleValues: { value: number; img: string }[];
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
