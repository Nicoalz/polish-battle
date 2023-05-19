import { TGame, TPlayer, TLastAction } from "../types/types";
import { useEffect, useState } from "react";
import { Socket } from "socket.io-client";
import Image from "next/image";
import Actions from "./Actions";
import SuperPowers from "./SuperPowers";
export default function Gameboard({
  game,
  username,
  socket,
  myIndex,
}: {
  game: TGame;
  username: string;
  socket: Socket;
  myIndex: number;
}) {
  const [playerToPlay, setPlayerToPlay] = useState<TPlayer>();
  const [isMyTurn, setIsMyTurn] = useState<boolean>(false);
  const [lastAction, setLastAction] = useState<TLastAction | null>(null);

  useEffect(() => {
    if (!game.players) return;
    updateIsMyTurn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  function updateIsMyTurn() {
    const playerToPlay = game.players.find(
      (player) => player.index === game.turnIndex
    );
    setPlayerToPlay(playerToPlay);
    if (playerToPlay?.name === username) {
      setIsMyTurn(true);
    } else {
      setIsMyTurn(false);
    }
  }

  function drawCard() {
    if (!game.players) {
      return;
    }
    socket.emit("draw-card", game.id, myIndex);
  }

  socket.on("action", (action: TLastAction) => {
    setLastAction(action);
  });

  function restartGame() {
    socket.emit("restart-game", game.id);
  }

  return (
    <div className="flex flex-col justify-center items-center container mx-auto relative w-full">
      <h1 className="font-bold text-3xl py-2">Gameboard</h1>
      <button
        onClick={restartGame}
        className="text-xs left-0 top-0 m-2 bg-orange-500 hover:bg-orange-700 text-white font-normal py-2 px-4 rounded absolute"
      >
        🔁 Restart
      </button>
      <div className="flex flex-col  w-full">
        <div className="flex flex-col relative">
          {game.winner && (
            <div className="absolute flex justify-center items-center w-full h-full bg-black/80 z-10">
              <div>
                <h1 className="bg-[#202124] font-bold text-3xl rounded py-2 px-4 flex justify-center items-center">{game.winner.name} has won the game!</h1>
              </div>
            </div>
          )}
          <div className="flex flex-col justify-center items-center  py-2">
            <p>
              {playerToPlay?.name} is playing
              <span className="text-xs ml-2">
                (Next: {game.players[game.nextTurnIndex].name})
              </span>
            </p>
            <div>
              <p className="text-xl font-medium h-8">{lastAction?.text}</p>
              <div className="flex flex-wrap justify-center items-centerw w-full">
                {lastAction?.cards.map((card, index) => (
                  <Image
                    className="mx-1"
                    key={index}
                    src={`/cards_img/${card.name}_of_${card.color}.png`}
                    alt={card.name}
                    width={60}
                    height={60}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-col justify-center items-center  py-2">
            <h2 className="text-xl font-medium">Players</h2>
            <ul className="flex flex-wrap justify-center items-center">
              {game.alivePlayers?.map((player) => (
                <li
                  key={player.index}
                  className={`p-4 bg-white/5 shadow-xl flex flex-col justify-between items-center rounded-xl m-2 relative
                   ${
                     player.life.length > 0 &&
                     player.life
                       .map((life) => life.value)
                       .reduce((a, b) => a + b) === 0
                       ? "line-through"
                       : ""
                   } `}
                >
                  {player.chargedCard && (
                    <p className="absolute left-2 top-2 text-2xl">🔋</p>
                  )}
                  {player.hasSuperPower && (
                    <p className="absolute right-2 top-2 text-2xl">💥</p>
                  )}
                  <p className="font-bold text-xl">{player.name}</p>
                  <Image
                    src={`/cards_img/${player.shield.name}_of_${player.shield.color}.png`}
                    alt={player.drawnCard?.name || "card"}
                    className="my-4"
                    width={100}
                    height={100}
                  />
                  <div className="flex flex-wrap">
                    {player.life.map((life, index) => (
                      <Image
                        key={index}
                        src={`/cards_img/${life.name}_of_${life.color}.png`}
                        alt={life.name}
                        width={100}
                        height={100}
                      />
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
          {isMyTurn && (
            <div className="flex flex-col items-center justify-center py-2 0">
              <p className="font-medium text-xl">It s your turn to play!</p>
              <div className="flex flex-col items-center justify-center  w-full py-2">
                <h2 className="py-2">Actions:</h2>
                <div className="flex flex-wrap justify-center items-center">
                  {!playerToPlay?.drawnCard && (
                    <button
                      className="m-2 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                      onClick={drawCard}
                    >
                      Draw a card
                    </button>
                  )}
                </div>
              </div>
              {playerToPlay?.drawnCard && (
                <Actions
                  game={game}
                  socket={socket}
                  myIndex={myIndex}
                  playerToPlay={playerToPlay}
                  setIsMyTurn={setIsMyTurn}
                />
              )}
              {!playerToPlay?.drawnCard && playerToPlay?.hasSuperPower && (
                <SuperPowers game={game} socket={socket} myIndex={myIndex} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
