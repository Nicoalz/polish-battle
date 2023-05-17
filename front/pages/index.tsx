import { useState } from "react";
export default function Home() {
  const [roomId, setRoomId] = useState("");

  function joinRoom() {
    if (!roomId) {
      return;
    }
    window.location.href = `/game?${roomId}`;
  }

  return (
    <div>
      <h1 className="text-4xl font-bold">Hello World</h1>
      <div className="flex flex-col">
        <label htmlFor="roomId">Room ID</label>
        <input
          id="roomId"
          type="text"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
        />
        <button
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          onClick={joinRoom}
        >
          Join
        </button>
      </div>
    </div>
  );
}
