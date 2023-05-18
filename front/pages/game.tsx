import { useEffect } from "react";
import { socket } from "../socket/socket";
import { useState } from "react";
import { TGame } from "../types/types";
import Gameboard from "@/components/Gameboard";
const Game = () => {
  const [roomId, setRoomId] = useState("");
  const [username, setUsername] = useState("");
  const [isJoined, setIsJoined] = useState(false);
  const [isChef, setIsChef] = useState(false);
  const [chefName, setChefName] = useState("");
  const [game, setGame] = useState({} as TGame);
  const [myIndex, setMyIndex] = useState(-1);

  useEffect(() => {
    socket.connect();
    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    const url = window.location.href;
    const id = url.split("?")[1];
    setRoomId(id);
  }, []);

  useEffect(() => {
    const myIndex = game.players?.findIndex(
      (player) => player.name === username
    );
    setMyIndex(myIndex);
    const chefPlayer = game.players?.find((player) => player.isChef);
    setChefName(chefPlayer?.name || "");
    if (chefPlayer && chefPlayer.index === myIndex) {
      setIsChef(true);
    }
  }, [game, username]);

  function ready() {
    if (!roomId || !username) {
      return;
    }
    socket.emit("join-room", roomId, username);
    setIsJoined(true);
  }

  function startGame() {
    if (!roomId || !username || !isChef || game.players.length < 2) {
      return;
    }
    socket.emit("start-game", roomId);
  }

  socket.on("game-state", (game: TGame) => {
    setGame(game);
  });

  return (
    <div className="container m-auto flex flex-col items-center justify-center my-8">
      <h1>Room ID: {roomId}</h1>
      {!isJoined && (
        <div className="flex justify-center m-8 items-center w-full">
          <div className="flex flex-col m-8 items-center justify-center">
            <input
              id="username"
              type="text"
              placeholder="Username..."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="border border-gray-400 p-2 rounded my-2 w-full text-black"
            />
            <button
              className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded w-full"
              onClick={ready}
            >
              Ready
            </button>
          </div>
        </div>
      )}
      {isJoined && game && (
        <div>
          <div className="flex items-center justify-center">
            <h1>Players:</h1>
            <ul className="flex flex-wrap">
              {game.players?.map((player) => (
                <li key={player.index} className="m-2">
                  {player.name} {player.isChef && <span>👑</span>}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex items-center justify-center">
            {!game.isStarted &&
              (isChef ? (
                <div>
                  <button
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                    onClick={startGame}
                  >
                    Start Game
                  </button>
                </div>
              ) : (
                <div>
                  <h1>Waiting for {chefName} to start the game</h1>
                </div>
              ))}
          </div>
          {game.isStarted && (
            <div>
              <Gameboard
                game={game}
                username={username}
                socket={socket}
                myIndex={myIndex}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Game;
