import { TGame, TPlayer } from "../types/types";
import { useEffect, useState } from "react";
import { Socket } from "socket.io-client";
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
  const [alivePlayers, setAlivePlayers] = useState<TPlayer[]>([]);
  const [deadPlayers, setDeadPlayers] = useState<TPlayer[]>([]);
  const [actionText, setActionText] = useState<string>("");
  const [winner, setWinner] = useState<TPlayer | null>(null);

  useEffect(() => {
    if (!game.players) return;
    updateWinner();
    updatePlayersStatus();
    updateIsMyTurn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  function updatePlayersStatus() {
    const alivePlayers = game.alivePlayers;
    const deadPlayers = game.deadPlayers;
    setAlivePlayers(alivePlayers);
    setDeadPlayers(deadPlayers);
  }

  function updateWinner() {
    if (game.winner) {
      setWinner(game.winner);
    }
  }

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

  socket.on("action", (action: string) => {
    setActionText(action);
  });

  return (
    <div className=" flex flex-col justify-center items-center container mx-auto py-2">
      <h1 className="font-bold text-4xl py-2">Gameboard</h1>
      <div className="flex flex-col  w-full">
        <div className="flex flex-col relative">
          {winner && <div className="absolute w-full h-full bg-black/20"></div>}
          <div className="flex flex-col justify-center items-center  py-2">
            <p>
              {playerToPlay?.name} is playing
              <span className="text-xs ml-2">
                (Next: {game.players[game.nextTurnIndex].name})
              </span>
            </p>
            <p className="text-xl font-medium h-8">{actionText}</p>
          </div>
          <div className="flex flex-col justify-center items-center  py-2">
            <h2 className="text-xl font-medium">Players</h2>
            <ul className="flex flex-wrap justify-center items-center">
              {game.players?.map((player) => (
                <li
                  key={player.index}
                  className={`p-2 shadow-xl flex flex-col justify-between items-center rounded-xl m-2 w-32 h-32 ${
                    player.life.length > 0 &&
                    player.life
                      .map((life) => life.value)
                      .reduce((a, b) => a + b) === 0
                      ? "line-through"
                      : ""
                  } `}
                >
                  <p>{player.name}</p>
                  <p>
                    🛡️ {player.shield.img} {player.shield.color}{" "}
                    {player.shield.value === 0 && "0💀"}
                  </p>
                  {player.chargedCard && <p>🔋</p>}
                  {player.hasSuperPower && <p>💥</p>}
                  <div className="flex flex-wrap">
                    {player.life.map((life, index) => (
                      <p key={index}>
                        {" "}
                        {life.img} {life.color} {life.value === 0 && "0💀"}
                      </p>
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
                  alivePlayers={alivePlayers}
                  playerToPlay={playerToPlay}
                />
              )}
              {!playerToPlay?.drawnCard && playerToPlay?.hasSuperPower && (
                <SuperPowers
                  game={game}
                  socket={socket}
                  myIndex={myIndex}
                  alivePlayers={alivePlayers}
                  deadPlayers={deadPlayers}
                  playerToPlay={playerToPlay}
                />
              )}
            </div>
          )}
        </div>
        {winner && (
          <div>
            <h1>{winner.name} has won the game!</h1>
          </div>
        )}
      </div>
    </div>
  );
}