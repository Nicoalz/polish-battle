import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import { Game } from "./game";
import { TLastAction, TCard } from "./types/types";
import dotenv from "dotenv";
dotenv.config();
const PORT = process.env.PORT || 4000;
const app = express();
app.use(cors());

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", //"https://polishbattle.nicoalz.xyz",
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

  socket.on("draw-card", async (roomId: string, playerIndex: number) => {
    const lastAction: TLastAction = {
      text: `${games[roomId].players[playerIndex].name} draws a card`,
      cards: [],
    };
    io.to(roomId).emit("action", lastAction);
    games[roomId].drawCard(playerIndex);
    io.to(roomId).emit("game-state", games[roomId]);
  });

  socket.on(
    "attack",
    async (roomId: string, playerIndex: number, targetIndex: number) => {
      const player = games[roomId].players[playerIndex];
      const target = games[roomId].players[targetIndex];
      let dmg = 0;
      const targetChargedCard = target.chargedCard;
      const playerChargedCard = player.chargedCard;
      const cardDrawn = player.drawnCard;
      let actionTxt = `${player.name} attacks ${target.name} by ${cardDrawn?.value}`;
      if (cardDrawn) {
        dmg += cardDrawn.value;
      }
      if (playerChargedCard) {
        actionTxt += `+ ${playerChargedCard.value} 🔋`;
        dmg += playerChargedCard.value;
      }
      if (targetChargedCard && dmg > target.shield.value) {
        actionTxt += `.${games[roomId].players[targetIndex].name} loses his 🔋`;
      }

      const cards = [cardDrawn, playerChargedCard].filter((c) => c) as TCard[];
      const lastAction: TLastAction = {
        text: actionTxt,
        cards,
      };

      io.to(roomId).emit("action", lastAction);
      await sleep(1000);
      games[roomId].attack(playerIndex, targetIndex);
      io.to(roomId).emit("game-state", games[roomId]);
    }
  );

  socket.on(
    "change-shield",
    async (roomId: string, playerIndex: number, targetIndex: number) => {
      games[roomId].changeShield(playerIndex, targetIndex);
      let actionTxt = `${games[roomId].players[playerIndex].name} changes `;
      if (playerIndex === targetIndex) {
        actionTxt += `his shield with ${games[roomId].players[playerIndex].shield.value}`;
      } else {
        actionTxt += `${games[roomId].players[targetIndex].name}'s shield by ${games[roomId].players[targetIndex].shield.value}`;
      }
      const lastAction: TLastAction = {
        text: actionTxt,
        cards: [games[roomId].players[targetIndex].shield],
      };
      io.to(roomId).emit("action", lastAction);
      await sleep(1000);
      io.to(roomId).emit("game-state", games[roomId]);
    }
  );

  socket.on(
    "charge-attack",
    async (roomId: string, playerIndex: number, targetIndex: number) => {
      games[roomId].chargeCard(playerIndex, targetIndex);
      let actionTxt = `${games[roomId].players[playerIndex].name} charges `;
      if (playerIndex === targetIndex) {
        actionTxt += `his 🔋`;
      } else {
        actionTxt += `${games[roomId].players[targetIndex].name} 🔋`;
      }
      const lastAction: TLastAction = {
        text: actionTxt,
        cards: [],
      };
      io.to(roomId).emit("action", lastAction);
      await sleep(1000);
      io.to(roomId).emit("game-state", games[roomId]);
    }
  );

  socket.on(
    "resurrect",
    async (roomId: string, playerIndex: number, targetIndex: number) => {
      games[roomId].resurrect(playerIndex, targetIndex);
      const actionTxt = `${games[roomId].players[playerIndex].name} resurrects ${games[roomId].players[targetIndex].name}`;
      const lastAction: TLastAction = {
        text: actionTxt,
        cards: [],
      };
      io.to(roomId).emit("action", lastAction);
      await sleep(1000);
      io.to(roomId).emit("game-state", games[roomId]);
    }
  );

  socket.on(
    "super-attack",
    async (roomId: string, playerIndex: number, targetIndex: number) => {
      const superAttackCard = games[roomId].superAttack(
        playerIndex,
        targetIndex
      );
      let actionTxt = `${games[roomId].players[playerIndex].name} super attacks ${games[roomId].players[targetIndex].name} by ${superAttackCard.value}`;
      if (games[roomId].players[playerIndex].chargedCard) {
        actionTxt += `+ ${games[roomId].players[playerIndex].chargedCard?.value} 🔋`;
      }
      if (games[roomId].players[targetIndex].chargedCard) {
        actionTxt += `.${games[roomId].players[targetIndex].name} loses his 🔋`;
      }
      const chargedCard = games[roomId].players[playerIndex].chargedCard;
      const cards = [superAttackCard, chargedCard].filter((c) => c) as TCard[];
      const lastAction: TLastAction = {
        text: actionTxt,
        cards,
      };
      io.to(roomId).emit("action", lastAction);
      await sleep(1000);
      io.to(roomId).emit("game-state", games[roomId]);
    }
  );

  socket.on(
    "super-shield",
    async (roomId: string, playerIndex: number, targetIndex: number) => {
      const newShieldCard = games[roomId].superShield(playerIndex, targetIndex);
      let actionTxt = `${games[roomId].players[playerIndex].name} super shields`;
      if (playerIndex === targetIndex) {
        actionTxt += ` himself by ${newShieldCard.value}`;
      } else {
        actionTxt += ` ${games[roomId].players[targetIndex].name} by ${newShieldCard.value}`;
      }
      const lastAction: TLastAction = {
        text: actionTxt,
        cards: [newShieldCard],
      };
      io.to(roomId).emit("action", lastAction);
      await sleep(1000);
      io.to(roomId).emit("game-state", games[roomId]);
    }
  );

  socket.on("restart-game", (roomId: string) => {
    games[roomId].restartGame();
    io.to(roomId).emit("game-state", games[roomId]);
  });
});
