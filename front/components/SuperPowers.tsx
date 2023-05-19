import { useState } from "react";
import { TGame, TPlayer } from "../types/types";
import { Socket } from "socket.io-client";
export default function SuperPowers({
  game,
  socket,
  myIndex,
}: {
  game: TGame;
  socket: Socket;
  myIndex: number;
}) {
  const [actionChosen, setActionChosen] = useState<string>("");
  const [targetIndex, setTargetIndex] = useState<number>(-1);

  function confirmAction() {
    if (actionChosen === "super-attack") {
      superAttack();
    }
    if (actionChosen === "super-shield") {
      superShield();
    }
    if (actionChosen === "resurrect") {
      const targetPlayer = game.alivePlayers.find(
        (player) => player.index === targetIndex
      );
      if (targetPlayer?.life.length && targetPlayer?.life.length > 0) return;
      resurrect();
    }
    setActionChosen("");
    setTargetIndex(-1);
  }

  function superAttack() {
    if (targetIndex === -1) return;
    socket.emit("super-attack", game.id, myIndex, targetIndex);
  }

  function superShield() {
    if (targetIndex === -1) return;
    socket.emit("super-shield", game.id, myIndex, targetIndex);
  }

  function resurrect() {
    if (targetIndex === -1) return;
    socket.emit("resurrect", game.id, myIndex, targetIndex);
  }

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div className="flex flex-col items-center justify-center w-full">
        <h3 className="font-medium pb-2">
          {!actionChosen && "You super power is available!"}
          {actionChosen && `Who do you want to ${actionChosen}?`}
        </h3>
        {!actionChosen && (
          <div className="flex flex-row justify-center items-center">
            <button
              className="bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded m-2"
              onClick={() => setActionChosen("super-attack")}
            >
              Super Attack
            </button>
            <button
              className="bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded m-2"
              onClick={() => setActionChosen("super-shield")}
            >
              Super Shield
            </button>
            {game.deadPlayers.length > 0 && (
              <button
                className="bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded m-2"
                onClick={() => setActionChosen("resurrect")}
              >
                Resurrect
              </button>
            )}
          </div>
        )}
      </div>
      {actionChosen && targetIndex === -1 && (
        <div className="relative w-full flex flex-col items-center justify-center">
          <button
            onClick={() => setActionChosen("")}
            className="absolute left-0 bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
          >
            ⬅️
          </button>
          <div className="flex flex-wrap">
            {(actionChosen === "super-attack" ||
              actionChosen === "super-shield") &&
              game.alivePlayers.map((player) => (
                <div key={player.index}>
                  <button
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded m-2"
                    onClick={() => {
                      setTargetIndex(player.index);
                    }}
                  >
                    {player.name}
                  </button>
                </div>
              ))}
            {actionChosen === "resurrect" &&
              game.deadPlayers.map((player) => (
                <div key={player.index}>
                  <button
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded m-2"
                    onClick={() => {
                      setTargetIndex(player.index);
                    }}
                  >
                    {player.name}
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}
      {actionChosen && targetIndex !== -1 && (
        <div className="relative w-full flex flex-col items-center justify-center">
          <button
            onClick={() => setTargetIndex(-1)}
            className="absolute left-0 bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
          >
            ⬅️
          </button>
          <p>
            You have chosen to {actionChosen} on:
            {game.players[targetIndex].name}
          </p>
          <button
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
            onClick={() => {
              confirmAction();
            }}
          >
            Confirm
          </button>
        </div>
      )}
    </div>
  );
}
