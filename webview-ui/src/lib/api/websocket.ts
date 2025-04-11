// WebSocket client for the gateway

// Event types
export type WebSocketEventType =
  | 'connection'
  | 'traces'
  | 'trace'
  | 'tracesCleared'
  | 'stats'
  | 'newTrace'
  | 'error'
  | 'pong'
  | string; // Allow any string for dynamic event types

// WebSocket message interface
export interface WebSocketMessage {
  type: WebSocketEventType;
  clientId?: string;
  data?: any;
  message?: string;
  timestamp?: number;
}

// WebSocket connection status
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

// WebSocket client class
export class WebSocketClient {
  private socket: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectInterval = 1000; // 1 second (reduced from 3 seconds)
  private maxReconnectAttempts = 5;
  private reconnectAttempts = 0;
  private url: string;
  private listeners: Map<WebSocketEventType, Set<(data: any) => void>> = new Map();
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();
  private connectionStatus: ConnectionStatus = 'disconnected';
  private pendingRequests: Map<string, { resolve: Function, reject: Function, timer: NodeJS.Timeout }> = new Map();
  private requestId = 0;

  constructor(url?: string) {
    if (url) {
      this.url = url;
    } else {
      // In VS Code webview, we need to use localhost explicitly
      if (typeof window.acquireVsCodeApi === 'function') {
        this.url = 'ws://localhost:3000/ws';
      } else {
        // In browser, we can use relative WebSocket URL
        this.url = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
      }
    }

    console.log(`WebSocket URL: ${this.url}`);

    // Connect immediately
    this.connect();

    // Set up automatic reconnection
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('focus', this.handleFocus.bind(this));
  }

  /**
   * Connect to the WebSocket server
   */
  public connect(): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.setStatus('connecting');

    try {
      this.socket = new WebSocket(this.url);

      this.socket.onopen = this.handleOpen.bind(this);
      this.socket.onmessage = this.handleMessage.bind(this);
      this.socket.onclose = this.handleClose.bind(this);
      this.socket.onerror = this.handleError.bind(this);
    } catch (error) {
      console.error('Failed to connect to WebSocket server:', error);
      this.setStatus('error');
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from the WebSocket server
   */
  public disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.setStatus('disconnected');
  }

  /**
   * Send a message to the WebSocket server
   */
  public send(type: string, data?: any): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      this.socket.send(JSON.stringify({ type, ...data }));
      return true;
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
      return false;
    }
  }

  /**
   * Send a request and wait for a response
   */
  public request(type: string, data?: any, responseType?: string, timeout: number = 2000): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        this.connect();
        reject(new Error('WebSocket not connected'));
        return;
      }

      const id = this.getNextRequestId();
      const requestData = { ...data, requestId: id };

      // Set up timeout
      const timer = setTimeout(() => {
        const pendingRequest = this.pendingRequests.get(id);
        if (pendingRequest) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout for ${type}`));
        }
      }, timeout);

      // Store the pending request
      this.pendingRequests.set(id, { resolve, reject, timer });

      // Set up a one-time listener for the response
      const responseListener = (message: any) => {
        if (message.requestId === id) {
          this.off(responseType || type, responseListener);
          resolve(message);
        }
      };

      // Register the listener
      this.on(responseType || type, responseListener);

      // Send the request
      try {
        this.socket.send(JSON.stringify({ type, ...requestData }));
      } catch (error) {
        clearTimeout(timer);
        this.pendingRequests.delete(id);
        this.off(responseType || type, responseListener);
        reject(error);
      }
    });
  }

  /**
   * Get the next request ID
   */
  private getNextRequestId(): string {
    return `req_${++this.requestId}_${Date.now()}`;
  }

  /**
   * Add an event listener
   */
  public on(event: WebSocketEventType, callback: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event)?.add(callback);
  }

  /**
   * Remove an event listener
   */
  public off(event: WebSocketEventType, callback: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      return;
    }

    this.listeners.get(event)?.delete(callback);
  }

  /**
   * Add a status listener
   */
  public onStatusChange(callback: (status: ConnectionStatus) => void): void {
    this.statusListeners.add(callback);
    // Immediately call with current status
    callback(this.connectionStatus);
  }

  /**
   * Remove a status listener
   */
  public offStatusChange(callback: (status: ConnectionStatus) => void): void {
    this.statusListeners.delete(callback);
  }

  /**
   * Get the current connection status
   */
  public getStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Check if the WebSocket is connected
   */
  public isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  /**
   * Send a ping to the server
   */
  public ping(): void {
    this.send('ping');
  }

  /**
   * Request traces from the server
   */
  public getTraces(page = 1, limit = 50): void {
    this.send('getTraces', { page, limit });
  }

  /**
   * Request a specific trace from the server
   */
  public getTrace(id: string): void {
    this.send('getTrace', { id });
  }

  /**
   * Request to clear all traces
   */
  public clearTraces(): void {
    this.send('clearTraces');
  }

  /**
   * Request trace statistics from the server
   */
  public getStats(): void {
    this.send('getStats');
  }

  /**
   * Handle WebSocket open event
   */
  private handleOpen(): void {
    console.log('WebSocket connected');
    this.reconnectAttempts = 0;
    this.setStatus('connected');

    // Request initial data immediately after connection
    setTimeout(() => {
      this.getStats();
      this.getTraces();
    }, 100);
  }

  /**
   * Handle WebSocket message event
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data) as WebSocketMessage;

      // Check if this is a response to a pending request
      if ('requestId' in message && typeof message.requestId === 'string') {
        const pendingRequest = this.pendingRequests.get(message.requestId);
        if (pendingRequest) {
          clearTimeout(pendingRequest.timer);
          this.pendingRequests.delete(message.requestId);
          pendingRequest.resolve(message);
        }
      }

      // Notify all listeners for this event type
      if (this.listeners.has(message.type)) {
        this.listeners.get(message.type)?.forEach(callback => {
          try {
            callback(message);
          } catch (error) {
            console.error(`Error in WebSocket ${message.type} listener:`, error);
          }
        });
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(): void {
    console.log('WebSocket disconnected');
    this.socket = null;
    this.setStatus('disconnected');
    this.scheduleReconnect();

    // Reject all pending requests
    this.pendingRequests.forEach((request) => {
      clearTimeout(request.timer);
      request.reject(new Error('WebSocket disconnected'));
    });
    this.pendingRequests.clear();
  }

  /**
   * Handle WebSocket error event
   */
  private handleError(error: Event): void {
    console.error('WebSocket error:', error);
    this.setStatus('error');
    // The close event will be called after the error event
  }

  /**
   * Handle online event
   */
  private handleOnline(): void {
    console.log('Network connection restored, reconnecting WebSocket...');
    this.connect();
  }

  /**
   * Handle focus event
   */
  private handleFocus(): void {
    if (this.connectionStatus !== 'connected' && this.reconnectAttempts < this.maxReconnectAttempts) {
      console.log('Window focused, reconnecting WebSocket if needed...');
      this.connect();
    }
  }

  /**
   * Clean up event listeners
   */
  public cleanup(): void {
    window.removeEventListener('online', this.handleOnline.bind(this));
    window.removeEventListener('focus', this.handleFocus.bind(this));
    this.disconnect();
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;

      this.reconnectTimer = setTimeout(() => {
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        this.connect();
      }, this.reconnectInterval);
    } else {
      console.log('Max reconnect attempts reached, giving up');
    }
  }

  /**
   * Set the connection status and notify listeners
   */
  private setStatus(status: ConnectionStatus): void {
    this.connectionStatus = status;

    this.statusListeners.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.error('Error in WebSocket status listener:', error);
      }
    });
  }
}

// Create a singleton instance
export const wsClient = new WebSocketClient();

// Export a hook for React components
export function useWebSocket() {
  return wsClient;
}
