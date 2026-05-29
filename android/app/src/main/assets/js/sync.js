// CloudVault Sync Engine: Manages automatic cloud backups, split vault views, & CRDT conflict resolution
import { Storage, sysLog } from './storage.js';

export class CloudSyncEngine {
  constructor(renderCallback) {
    this.renderCallback = renderCallback;
    this.isSyncing = false;
    this.initializeCloudVault();
  }

  // Initialize a mock cloud database representing our server-side storage
  initializeCloudVault() {
    const cachedCloud = localStorage.getItem('airsync_cloud_db');
    if (cachedCloud) {
      this.cloudState = JSON.parse(cachedCloud);
    } else {
      // Seed clean cloud database matching initial device configurations
      this.cloudState = {
        walletBalance: 500.00,
        transactionsCount: 0,
        messagesCount: 0,
        settings: {
          profileName: 'MyDevice',
          securityLevel: 'AES-256-GCM',
          firmwareVersion: 'v2.4.1'
        }
      };
      this.persistCloud();
    }
  }

  persistCloud() {
    localStorage.setItem('airsync_cloud_db', JSON.stringify(this.cloudState));
  }

  // Triggers the visual and logical sync process
  triggerSync() {
    if (this.isSyncing) return;
    this.isSyncing = true;
    
    const syncProgressBar = document.getElementById('syncProgressBar');
    const syncStatusLabel = document.getElementById('syncStatusLabel');
    const syncProgressContainer = document.getElementById('syncProgressContainer');
    
    if (!syncProgressBar || !syncStatusLabel || !syncProgressContainer) return;

    sysLog('Connection detected! Initiating automatic cloud synchronization...', 'success');
    syncProgressContainer.classList.add('sync-active');
    syncStatusLabel.textContent = 'Syncing...';

    // Animate progress circle (SVG Dash Offset starts at 157 and goes to 0)
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      const offset = 157 - (157 * (progress / 100));
      syncProgressBar.style.strokeDashoffset = offset;
      
      if (progress >= 100) {
        clearInterval(interval);
        this.completeSync(syncProgressContainer, syncStatusLabel, syncProgressBar);
      }
    }, 150);
  }

  completeSync(container, statusLabel, progressCircle) {
    // 1. Process sync queue and resolve database conflicts
    const queue = Storage.state.syncQueue;
    sysLog(`Uploading ${queue.length} buffered local updates to cloud ledger...`, 'info');

    let conflictOccurred = false;
    let conflictDetails = '';

    queue.forEach(item => {
      if (item.type === 'transaction') {
        // Find transaction and mark as synced
        const tx = Storage.state.transactions.find(t => t.id === item.payload.id);
        if (tx) tx.status = 'synced';
        this.cloudState.transactionsCount++;
        // Debit cloud balance
        this.cloudState.walletBalance += item.payload.amount; // transaction amounts are stored negative for debits
      } 
      else if (item.type === 'message') {
        // Find message and mark as synced
        const chatList = Storage.state.chats[item.peer];
        const msg = chatList ? chatList.find(m => m.id === item.payload.id) : null;
        if (msg) msg.status = 'synced';
        this.cloudState.messagesCount++;
      }
      else if (item.type === 'settings') {
        // Simulate a conflict resolution:
        // Assume cloud settings were edited by another device at the same time
        conflictOccurred = true;
        
        // CRDT LWW (Last-Write-Wins) Resolution
        const cloudTimestamp = item.timestamp - 10000; // Cloud write happened 10s earlier
        const localKey = Object.keys(item.payload)[0];
        const localVal = item.payload[localKey];
        
        sysLog(`CONFLICT DETECTED: Shared key "${localKey}" modified concurrently in Local & Cloud!`, 'warn');
        sysLog(`Local timestamp: ${item.timestamp} | Cloud timestamp: ${cloudTimestamp}`, 'info');
        
        // Local wins because timestamp is newer
        this.cloudState.settings[localKey] = localVal;
        conflictDetails = `Resolved profile conflict: "${localKey}" set to "${localVal}" (LWW CRDT winner).`;
        sysLog(`LWW Resolution applied: Local version wins. Synced to Cloud.`, 'success');
      }
    });

    // Sync wallet balance exactly
    this.cloudState.walletBalance = Storage.state.wallet.balance;
    this.persistCloud();

    // 2. Clear outbox queue
    Storage.clearSyncQueue();
    Storage.persist();

    // 3. UI resets
    container.classList.remove('sync-active');
    statusLabel.textContent = 'Synced';
    sysLog('Cloud ledger backup finished successfully! System states aligned.', 'success');

    // Update conflict status bar
    const conflictStatusText = document.getElementById('conflictStatusText');
    if (conflictStatusText) {
      if (conflictOccurred) {
        conflictStatusText.innerHTML = `<span style="color:var(--color-online);">★</span> ${conflictDetails}`;
      } else {
        conflictStatusText.textContent = 'No database conflicts detected. All local assets mirrored in Cloud.';
      }
    }

    this.isSyncing = false;
    
    // Clear circle stroke after animation delay
    setTimeout(() => {
      progressCircle.style.strokeDashoffset = 157;
      statusLabel.textContent = 'Idle';
    }, 1500);

    // Re-render dashboard
    if (this.renderCallback) this.renderCallback();
  }

  // Returns data to build the "Local Enclave" vs "Cloud Vault" split screen visuals
  getVaultComparison() {
    const local = [
      { key: 'Wallet Bal', val: `$${Storage.state.wallet.balance.toFixed(2)}` },
      { key: 'Local Tx Log', val: `${Storage.state.transactions.length} records` },
      { key: 'Profile Name', val: Storage.state.settings.profileName },
      { key: 'Pending Sync', val: `${Storage.state.syncQueue.length} queued` }
    ];

    const cloud = [
      { key: 'Wallet Bal', val: `$${this.cloudState.walletBalance.toFixed(2)}` },
      { key: 'Cloud Tx Log', val: `${this.cloudState.transactionsCount} records` },
      { key: 'Profile Name', val: this.cloudState.settings.profileName },
      { key: 'Sync Health', val: Storage.state.syncQueue.length === 0 ? 'Healthy' : 'Diverged' }
    ];

    return { local, cloud };
  }
}
