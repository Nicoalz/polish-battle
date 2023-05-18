import { useState } from "react";
export default function Home() {
  const [roomId, setRoomId] = useState("");

  function joinRoom() {
    if (!roomId) {
      return;
    }
    window.location.href = `/game?${roomId}`;
  }

  function createRoom() {
    const rdmId = Math.random().toString(36).substring(7);
    setRoomId(rdmId);
    window.location.href = `/game?${rdmId}`;
  }

  return (
    <div className="container m-auto flex flex-col items-center justify-center my-8">
      <h1 className="text-4xl font-bold mb-8">Welcome to the Polish Battle</h1>
      <p className="mb-4">
        Join a room to play with your friends. If you dont have a room, create
        one.
      </p>
      <div className="flex justify-center m-8 items-center w-full">
        <div className="flex flex-col m-8 items-center justify-center">
          <button
            className="bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded w-full mb-4"
            onClick={createRoom}
          >
            Create room
          </button>
          <input
            id="roomId"
            type="text"
            placeholder="Room ID..."
            value={roomId}
            className="border border-gray-400 p-2 rounded my-2 w-full text-black"
            onChange={(e) => setRoomId(e.target.value)}
          />
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full"
            onClick={joinRoom}
          >
            Join room
          </button>
        </div>
      </div>
    </div>
  );
}
