import http from 'http';
import { app } from './src/app';
import { Server } from 'socket.io';

const server = http.createServer(app);

export const io = new Server(server, {
    cors: { origin: '*', credentials: true }
});

const PORT = process.env.PORT || 1337;

server.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});