import {io, Socket} from 'socket.io-client';
import {env} from '../../app/config/env';

class ChatClient {
  socket: Socket;

  constructor(token: string, username?: string) {
    this.socket = io(env.VITE_PUBLIC_CHAT_URL, {
      auth: {token, username},
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      autoConnect: false,
    });
    this.setupListeners();
    this.socket.connect();
  }

  private setupListeners() {
    this.socket.on('connect', () => {
      if (__DEV__) console.log('Chat connected:', this.socket.id);
    });
    this.socket.on('disconnect', (reason: string) => {
      if (__DEV__) console.log('Chat disconnected:', reason);
    });
    this.socket.on('connect_error', (error: Error) => {
      if (__DEV__) console.log('Chat error:', error.message);
    });
    this.socket.on('reconnect', () => {
      this.getAllUsers();
      this.getRooms();
    });
  }

  sendDirectMessage(recipientId: string, message: string) {
    this.socket.emit('directMessage', {recipientId, message});
  }

  joinRoom(roomId: string) {
    this.socket.emit('joinRoom', {roomId});
  }

  sendRoomMessage(roomId: string, message: string) {
    this.socket.emit('roomMessage', {roomId, message});
  }

  sendGlobalMessage(message: string) {
    this.socket.emit('globalMessage', {message});
  }

  getOnlineUsers() {
    this.socket.emit('getOnlineUsers');
  }

  getAllUsers() {
    this.socket.emit('getAllUsers');
  }

  getRooms() {
    this.socket.emit('getRooms');
  }

  getDirectMessageHistory(otherUserId: string) {
    if (!this.socket.connected) {
      this.socket.connect();
      this.socket.once('connect', () => {
        this.socket.emit('getDirectMessageHistory', {otherUserId});
      });
    } else {
      this.socket.emit('getDirectMessageHistory', {otherUserId});
    }
  }

  getRoomHistory(roomId: string) {
    if (!this.socket.connected) {
      this.socket.connect();
      this.socket.once('connect', () => {
        this.socket.emit('getRoomHistory', {roomId});
      });
    } else {
      this.socket.emit('getRoomHistory', {roomId});
    }
  }

  disconnect() {
    this.socket.disconnect();
  }
}

export default ChatClient;
