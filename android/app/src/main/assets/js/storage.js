// Storage Engine - Manages the simulated device enclave database (IndexedDB / LocalStorage)
// Provides pub-sub capabilities so modules can listen to data modifications

class LocalStorageEnclave {
  constructor() {
    this.listeners = [];
    this.initializeState();
  }

  initializeState() {
    // Automatic DB Migration: Detect and clear old fake seeds from browser cache
    let cachedState = localStorage.getItem('airsync_device_db');
    if (cachedState && cachedState.includes('TX-101')) {
      localStorage.removeItem('airsync_device_db');
      localStorage.removeItem('airsync_cloud_db');
      cachedState = null;
    }

    if (cachedState) {
      this.state = JSON.parse(cachedState);
    } else {
      this.state = {
        wallet: {
          balance: 500.00,
          allowance: 200.00,
          initialAllowance: 200.00
        },
        transactions: [],
        chats: {
          Bob: [],
          Charlie: []
        },
        settings: {
          profileName: 'MyDevice',
          securityLevel: 'AES-256-GCM',
          firmwareVersion: 'v2.4.1'
        },
        syncQueue: [] // Holds local-only offline updates: { type: 'transaction'|'message'|'settings', payload: ... }
      };
      this.persist();
    }
  }

  // Persists current in-memory state to browser localStorage (acting as our SQLite/IndexedDB file)
  persist() {
    localStorage.setItem('airsync_device_db', JSON.stringify(this.state));
    this.notify();
  }

  // Subscribe to state updates
  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  notify() {
    this.listeners.forEach(callback => callback(this.state));
  }

  // Wallet operations
  deductOfflineWallet(amount) {
    if (amount > this.state.wallet.allowance) {
      throw new Error(`Insufficient Offline Spending Allowance ($${this.state.wallet.allowance.toFixed(2)} left)`);
    }
    if (amount > this.state.wallet.balance) {
      throw new Error(`Insufficient total account balance ($${this.state.wallet.balance.toFixed(2)})`);
    }

    this.state.wallet.balance -= amount;
    this.state.wallet.allowance -= amount;
    this.persist();
    return this.state.wallet;
  }

  // Transaction logging
  addTransaction(tx) {
    this.state.transactions.unshift(tx);
    if (tx.status === 'pending') {
      this.state.syncQueue.push({
        id: `SQ-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        type: 'transaction',
        timestamp: Date.now(),
        payload: tx
      });
    }
    this.persist();
  }

  // Chat message logging
  addMessage(peer, message) {
    if (!this.state.chats[peer]) {
      this.state.chats[peer] = [];
    }
    this.state.chats[peer].push(message);

    if (message.status === 'pending') {
      this.state.syncQueue.push({
        id: `SQ-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        type: 'message',
        peer: peer,
        timestamp: Date.now(),
        payload: message
      });
    }
    this.persist();
  }

  // Settings update (conflict demonstration helper)
  updateSettings(key, value, forceQueue = false) {
    this.state.settings[key] = value;
    if (forceQueue) {
      this.state.syncQueue.push({
        id: `SQ-${Date.now()}`,
        type: 'settings',
        timestamp: Date.now(),
        payload: { [key]: value }
      });
    }
    this.persist();
  }

  // Clear sync queue after upload
  clearSyncQueue() {
    this.state.syncQueue = [];
    this.persist();
  }
}

export const Storage = new LocalStorageEnclave();

// Real-time Visual Developer Logs Controller
export function sysLog(message, type = 'info') {
  const logsContainer = document.getElementById('consoleLogs');
  if (!logsContainer) return;

  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${(now.getMilliseconds() / 10).toFixed(0).padStart(2, '0')}`;

  const entry = document.createElement('div');
  entry.className = 'log-entry';

  const timestamp = document.createElement('span');
  timestamp.className = 'log-timestamp';
  timestamp.textContent = `[${timeStr}]`;
  entry.appendChild(timestamp);

  const prefix = document.createElement('span');
  if (type === 'info') {
    prefix.className = 'log-info';
    prefix.textContent = '[SYS] ';
  } else if (type === 'warn') {
    prefix.className = 'log-warn';
    prefix.textContent = '[WARN] ';
  } else if (type === 'success') {
    prefix.className = 'log-success';
    prefix.textContent = '[SYNC] ';
  } else if (type === 'ai') {
    prefix.className = 'log-ai';
    prefix.textContent = '[AIRAI] ';
  }
  entry.appendChild(prefix);

  const textNode = document.createTextNode(message);
  entry.appendChild(textNode);

  logsContainer.appendChild(entry);
  logsContainer.scrollTop = logsContainer.scrollHeight;

  // Print to browser console too
  console.log(`%c[${timeStr}] ${prefix.textContent}${message}`, `color: ${type === 'success' ? '#10b981' : type === 'warn' ? '#f59e0b' : type === 'ai' ? '#06b6d4' : '#38bdf8'}`);
}
