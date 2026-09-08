import express from 'express';
import http from 'http';
import {Server as SocketIOServer} from 'socket.io';

const app = express();
const port = process.env.PORT ?? 3000;

app.use(express.json());

// Endpoint de sante : utilise par le HEALTHCHECK Docker et par la CI.
app.get('/health', (_req, res) => {
  res.status(200).json({status: 'ok'});
});

const server = http.createServer(app);

// Socket.io est deja branche ici : la story "messagerie instantanee"
// n'aura qu'a ajouter ses evenements dans io.on('connection', ...).
const io = new SocketIOServer(server, {
  cors: {origin: '*'},
});

io.on('connection', socket => {
  console.log(`Client connecte: ${socket.id}`);
});

server.listen(port, () => {
  console.log(`Serveur demarre sur le port ${port}`);
});
