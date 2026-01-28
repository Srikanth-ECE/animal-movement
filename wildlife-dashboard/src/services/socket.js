import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.listeners = new Map();
  }

  connect() {
    if (this.socket) return;
    
    console.log('🔌 Connecting to WebSocket...');
    
    this.socket = io('http://localhost:5000', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10
    });

    // Connection events
    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected');
      this.connected = true;
      this.socket.emit('join_dashboard');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason);
      this.connected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
    });

    this.socket.on('new_alert', (alert) => {
      console.log('📨 New alert via WebSocket:', alert.detection?.species);
      this.emitToListeners('new_alert', alert);
    });

    this.socket.on('update_alert', (alert) => {
      console.log('📝 Alert updated via WebSocket:', alert.id);
      this.emitToListeners('update_alert', alert);
    });

    this.socket.on('initial_alerts', (data) => {
      console.log('📋 Initial alerts received:', data.alerts?.length);
      this.emitToListeners('initial_alerts', data.alerts);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.listeners.clear();
    }
  }

  // Add event listener
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    
    // Also listen via socket.io
    if (this.socket) {
      this.socket.on(event, callback);
    }
    
    return () => this.off(event, callback);
  }

  // Remove event listener
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  // Emit to all listeners
  emitToListeners(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  // Request initial data
  requestInitialAlerts() {
    if (this.socket && this.connected) {
      this.socket.emit('request_initial_alerts');
    }
  }

  // Get connection status
  isConnected() {
    return this.connected;
  }
}

// Create single instance
const socketService = new SocketService();
export default socketService;