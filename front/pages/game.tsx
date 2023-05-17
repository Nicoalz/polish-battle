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

  function joinRoom() {
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
    <div>
      <h1>Room ID: {roomId}</h1>
      {!isJoined && (
        <div className="flex flex-col">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            onClick={joinRoom}
          >
            Join
          </button>
        </div>
      )}
      {isJoined && game && (
        <div>
          <div>
            <h1>Players</h1>
            <ul>
              {game.players?.map((player) => (
                <li key={player.index}>
                  {player.name} {player.isChef && <span>👑</span>}
                </li>
              ))}
            </ul>
          </div>
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
