import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import { Game } from "./game";
const PORT = 4000;
const app = express();
app.use(cors());

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

const games: { [key: string]: Game } = {};

io.on("connection", (socket) => {
  console.log("a user connected", socket.id);

  socket.on("join-room", (roomId: string, name: string) => {
    socket.join(roomId);
    const room = io.sockets.adapter.rooms.get(roomId);
    if (!room) return;
    if (room.size === 1) {
      games[roomId] = new Game(roomId);
    }
    if (games[roomId].isStarted) return;
    games[roomId].addPlayer(name);
    io.to(roomId).emit("game-state", games[roomId]);
  });

  socket.on("start-game", (roomId: string) => {
    games[roomId].startGame();
    io.to(roomId).emit("game-state", games[roomId]);
  });

  socket.on("draw-card", (roomId: string, playerIndex: number) => {
    console.log("draw-card", roomId, playerIndex);
    const actionTxt = `${games[roomId].players[playerIndex].name} draws a card`;
    io.to(roomId).emit("action", actionTxt);
    sleep(3000);
    games[roomId].drawCard(playerIndex);
    io.to(roomId).emit("game-state", games[roomId]);
  });

  socket.on(
    "attack",
    (roomId: string, playerIndex: number, targetIndex: number) => {
      let actionTxt = `${games[roomId].players[playerIndex].name} attacks ${games[roomId].players[targetIndex].name} with ${games[roomId].players[playerIndex].drawnCard?.value}`;
      if (games[roomId].players[playerIndex].chargedCard) {
        actionTxt += `+ ${games[roomId].players[playerIndex].chargedCard?.value} charged card`;
      }
      if (games[roomId].players[targetIndex].chargedCard) {
        actionTxt += ` attacked player loses his charged card attack`;
      }
      io.to(roomId).emit("action", actionTxt);
      sleep(3000);
      games[roomId].attack(playerIndex, targetIndex);
      io.to(roomId).emit("game-state", games[roomId]);
    }
  );

  socket.on(
    "change-shield",
    (roomId: string, playerIndex: number, targetIndex: number) => {
      games[roomId].changeShield(playerIndex, targetIndex);
      const actionTxt = `${games[roomId].players[playerIndex].name} changes shield of ${games[roomId].players[targetIndex].name} with ${games[roomId].players[playerIndex].shield.value}`;
      io.to(roomId).emit("action", actionTxt);
      sleep(3000);
      io.to(roomId).emit("game-state", games[roomId]);
    }
  );

  socket.on(
    "charge-attack",
    (roomId: string, playerIndex: number, targetIndex: number) => {
      games[roomId].chargeCard(playerIndex, targetIndex);
      const actionTxt = `${games[roomId].players[playerIndex].name} charges attack of ${games[roomId].players[targetIndex].name} with`;
      io.to(roomId).emit("action", actionTxt);
      sleep(3000);
      io.to(roomId).emit("game-state", games[roomId]);
    }
  );

  socket.on(
    "resurrect",
    (roomId: string, playerIndex: number, targetIndex: number) => {
      games[roomId].resurrect(playerIndex, targetIndex);
      const actionTxt = `${games[roomId].players[playerIndex].name} resurrects ${games[roomId].players[targetIndex].name}`;
      io.to(roomId).emit("action", actionTxt);
      sleep(3000);
      io.to(roomId).emit("game-state", games[roomId]);
    }
  );

  socket.on(
    "super-attack",
    (roomId: string, playerIndex: number, targetIndex: number) => {
      const superDmg = games[roomId].superAttack(playerIndex, targetIndex);
      const actionTxt = `${
        games[roomId].players[playerIndex].name
      } super attacks ${
        games[roomId].players[targetIndex].name
      } with ${superDmg} ${
        games[roomId].players[playerIndex].chargedCard &&
        `+ ${games[roomId].players[playerIndex].chargedCard?.value} charged card`
      }`;
      io.to(roomId).emit("action", actionTxt);
      sleep(3000);
      io.to(roomId).emit("game-state", games[roomId]);
    }
  );

  socket.on(
    "super-shield",
    (roomId: string, playerIndex: number, targetIndex: number) => {
      const newShieldValue = games[roomId].superShield(
        playerIndex,
        targetIndex
      );
      const actionTxt = `${games[roomId].players[playerIndex].name} super shields ${games[roomId].players[targetIndex].name} with ${newShieldValue}`;
      io.to(roomId).emit("action", actionTxt);
      sleep(3000);
      io.to(roomId).emit("game-state", games[roomId]);
    }
  );
});
