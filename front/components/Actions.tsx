import { useState } from "react";
import { TGame, TPlayer } from "../types/types";
import { Socket } from "socket.io-client";
export default function Actions({
  game,
  socket,
  myIndex,
  alivePlayers,
  playerToPlay,
}: {
  game: TGame;
  socket: Socket;
  myIndex: number;
  alivePlayers: TPlayer[];
  playerToPlay: TPlayer;
}) {
  const [actionChosen, setActionChosen] = useState<string>("");
  const [targetIndex, setTargetIndex] = useState<number>(-1);

  function confirmAction() {
    if (actionChosen === "attack") {
      attackPlayer();
    }
    if (actionChosen === "change-shield") {
      changeShield();
    }
    if (actionChosen === "charge-attack") {
      const targetPlayer = alivePlayers.find(
        (player) => player.index === targetIndex
      );
      if (targetPlayer?.chargedCard) return;
      chargeAttack();
    }
    setActionChosen("");
    setTargetIndex(-1);
  }

  function attackPlayer() {
    if (targetIndex === -1) return;
    socket.emit("attack", game.id, myIndex, targetIndex);
  }

  function changeShield() {
    if (targetIndex === -1) return;
    socket.emit("change-shield", game.id, myIndex, targetIndex);
  }

  function chargeAttack() {
    if (targetIndex === -1) return;
    socket.emit("charge-attack", game.id, myIndex, targetIndex);
  }

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div className="flex flex-col items-center justify-center w-full">
        <h3 className="font-medium pb-2">
          {!actionChosen && "You have drawn a card, what do you want to do?"}
          {actionChosen && `Who do you want to ${actionChosen}?`}
        </h3>
        {!actionChosen && (
          <div className="flex flex-row justify-center items-center">
            <button
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded m-2"
              onClick={() => setActionChosen("attack")}
            >
              Attack
            </button>
            <button
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded m-2"
              onClick={() => setActionChosen("change-shield")}
            >
              Change Shield
            </button>
            {!playerToPlay.chargedCard && (
              <button
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded m-2"
                onClick={() => setActionChosen("charge-attack")}
              >
                Charge Attack
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
            ⬅️ Change action
          </button>
          <div className="flex flex-wrap">
            {alivePlayers.map((player) => (
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
            ⬅️ Change target
          </button>
          <p>
            You have chosen to {actionChosen} on:
            {alivePlayers[targetIndex].name}
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
