import { io } from 'socket.io-client';

const baseURL =
  process.env.REACT_APP_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:5000';

const socket = io(baseURL, {
  transports: ['websocket', 'polling'],
  autoConnect: false,
});

export default socket;

