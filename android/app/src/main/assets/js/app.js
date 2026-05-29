// Main Coordinator - Handles UI inputs, routing event streams, and dashboard render loops
import { Storage, sysLog } from './storage.js';
import { PayAirEngine } from './payments.js';
import { MeshLinkEngine } from './messaging.js';
import { AirAiEngine } from './ai.js';
import { CloudSyncEngine } from './sync.js';

class AppCoordinator {
  constructor() {
    this.activePeer = 'Bob'; // Default chat recipient
    this.isOffline = true;   // Start offline for presentation impact
    
    // Instantiate engines
    this.ai = new AirAiEngine(this.isOffline);
    this.sync = new CloudSyncEngine(() => this.render());

    this.initElements();
    this.bindEvents();
    this.seedUi();
    this.render();
  }

  initElements() {
    // Top bar
    this.networkToggle = document.getElementById('networkToggle');
    this.statusLabel = document.getElementById('statusLabel');
    
    // Payments
    this.walletBalance = document.getElementById('walletBalance');
    this.allowanceText = document.getElementById('allowanceText');
    this.allowanceFill = document.getElementById('allowanceFill');
    this.payType = document.getElementById('payType');
    this.payRecipientLabel = document.getElementById('payRecipientLabel');
    this.payRecipient = document.getElementById('payRecipient');
    this.payAmount = document.getElementById('payAmount');
    this.btnGenerateVoucher = document.getElementById('btnGenerateVoucher');
    this.btnSimulateScan = document.getElementById('btnSimulateScan');
    this.ledgerList = document.getElementById('ledgerList');
    
    // QR Modal
    this.qrModal = document.getElementById('qrModal');
    this.qrContainer = document.getElementById('qrContainer');
    this.qrSignatureText = document.getElementById('qrSignatureText');
    this.btnCloseQr = document.getElementById('btnCloseQr');
    
    // Chat
    this.chatHistory = document.getElementById('chatHistory');
    this.chatInput = document.getElementById('chatInput');
    this.btnSendMessage = document.getElementById('btnSendMessage');
    this.smsPayloadText = document.getElementById('smsPayloadText');
    this.messageModeBadge = document.getElementById('messageModeBadge');
    
    // AI Panel
    this.aiChatHistory = document.getElementById('aiChatHistory');
    this.aiInput = document.getElementById('aiInput');
    this.btnSendAi = document.getElementById('btnSendAi');
    this.aiSuggestions = document.getElementById('aiSuggestions');
    
    // Sync Vaults
    this.localVaultContent = document.getElementById('localVaultContent');
    this.cloudVaultContent = document.getElementById('cloudVaultContent');
  }

  bindEvents() {
    // 1. Connection toggle
    this.networkToggle.addEventListener('change', (e) => {
      this.isOffline = !e.target.checked;
      this.updateConnectionState();
    });

    // 2. Payments: Target Type Toggler
    this.payType.addEventListener('change', (e) => {
      const val = e.target.value;
      this.payRecipient.value = '';
      if (val === 'upi') {
        this.payRecipientLabel.textContent = 'Recipient UPI ID';
        this.payRecipient.placeholder = 'e.g. alice@upi';
      } else if (val === 'phone') {
        this.payRecipientLabel.textContent = 'Recipient Phone Number';
        this.payRecipient.placeholder = 'e.g. +91 98765 43210';
      } else if (val === 'bank') {
        this.payRecipientLabel.textContent = 'Bank Account Details';
        this.payRecipient.placeholder = 'e.g. Acc: 9876543210, IFSC: HDFC0001234';
      }
    });

    // Generate offline voucher
    this.btnGenerateVoucher.addEventListener('click', () => {
      const recipient = this.payRecipient.value.trim();
      const amountVal = parseFloat(this.payAmount.value);
      const payMethod = this.payType.value;

      if (!recipient || isNaN(amountVal) || amountVal <= 0) {
        alert('Please specify valid recipient details and amount.');
        return;
      }

      // Prepend protocol context to make ledger records highly intuitive
      const formattedRecipient = `${payMethod.toUpperCase()}: ${recipient}`;

      const voucher = PayAirEngine.generateOfflineVoucher(formattedRecipient, amountVal);
      if (voucher) {
        // Render QR
        this.qrContainer.innerHTML = PayAirEngine.drawQrCodeSvg(voucher);
        this.qrSignatureText.value = voucher.sig;
        this.qrModal.classList.add('active');
        this.render();
      }
    });

    // Close QR Modal
    this.btnCloseQr.addEventListener('click', () => {
      this.qrModal.classList.remove('active');
      this.payRecipient.value = '';
      this.payAmount.value = '';
    });

    // Receive Payment Simulation
    this.btnSimulateScan.addEventListener('click', () => {
      // Provide copy-pasteable sample voucher or let them auto-execute a preset using UPI
      const mockAliceVoucher = {
        v: 'PAYAIR_v1.0',
        from: 'alice@upi',
        to: 'user-node@upi',
        amt: 50.00,
        non: 472183,
        ts: Date.now(),
        sig: '74c2e6840a1b65e297df38c5b05ea91a'
      };

      const promptMsg = `AirSync Scanner Module Active!\n\nTo simulate scanning a physical QR, press OK to claim a mock $50.00 voucher signed offline by Alice (alice@upi), or paste your own custom JSON voucher payload below:`;
      const response = prompt(promptMsg, JSON.stringify(mockAliceVoucher));
      
      if (response) {
        const success = PayAirEngine.claimVoucher(response);
        if (success) {
          this.render();
        }
      }
    });

    // 3. Messaging: Tab select
    document.querySelectorAll('.contact-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        document.querySelectorAll('.contact-tab').forEach(t => t.classList.remove('active'));
        const targetTab = e.currentTarget;
        targetTab.classList.add('active');
        this.activePeer = targetTab.dataset.peer;
        
        // Update badge mode
        if (this.activePeer === 'Bob') {
          this.messageModeBadge.textContent = 'Bluetooth Mesh';
          this.chatInput.placeholder = 'Send via Bluetooth mesh routing...';
        } else {
          this.messageModeBadge.textContent = 'SMS Payload Relay';
          this.chatInput.placeholder = 'Send as compressed GSM payload...';
        }
        
        this.render();
      });
    });

    // Chat sending
    this.btnSendMessage.addEventListener('click', () => this.handleSendMessage());
    this.chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.handleSendMessage();
    });

    // 4. AI assistant queries
    this.btnSendAi.addEventListener('click', () => this.handleSendAi());
    this.aiInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.handleSendAi();
    });

    // Storage listeners for auto re-render
    Storage.subscribe(() => this.render());
  }

  updateConnectionState() {
    const body = document.body;
    if (this.isOffline) {
      body.className = 'offline-state';
      this.statusLabel.textContent = 'Offline';
      this.ai.setOnlineStatus(true);
      
      sysLog('Warning! Internet connection lost. Core network modules offline.', 'warn');
      sysLog('PayAir secure element buffer: active. MeshLink radio: scanning.', 'info');
    } else {
      body.className = 'online-state';
      this.statusLabel.textContent = 'Online';
      this.ai.setOnlineStatus(false);
      
      sysLog('Internet back! Synchronizing offline transaction packets...', 'success');
      this.sync.triggerSync();
    }
    this.render();
  }

  handleSendMessage() {
    const text = this.chatInput.value.trim();
    if (!text) return;
    
    MeshLinkEngine.sendMessage(this.activePeer, text, this.isOffline);
    this.chatInput.value = '';
    this.render();
  }

  handleSendAi() {
    const text = this.aiInput.value.trim();
    if (!text) return;

    this.appendAiBubble(text, 'user');
    this.aiInput.value = '';

    // Pulse animation
    const localNode = document.getElementById('nodeLocal');
    if (localNode) {
      localNode.style.transform = 'scale(1.25)';
      setTimeout(() => localNode.style.transform = 'scale(1)', 300);
    }

    setTimeout(() => {
      const response = this.ai.processUserCommand(text);
      this.appendAiBubble(response, 'assistant');
    }, 800);
  }

  appendAiBubble(text, sender) {
    const bubble = document.createElement('div');
    bubble.className = `ai-chat-bubble ${sender}`;
    // Support basic markdown bolding
    bubble.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    this.aiChatHistory.appendChild(bubble);
    this.aiChatHistory.scrollTop = this.aiChatHistory.scrollHeight;
  }

  handleSuggestionClick(text) {
    this.aiInput.value = text;
    this.handleSendAi();
  }

  seedUi() {
    // Initial greetings
    sysLog('AirSync Offline Operations Suite initialized.', 'info');
    sysLog('Secure Enclave (NPU Wallet v1.0) status: ACTIVE.', 'info');
    
    this.appendAiBubble('Hello! I am **AirAI**, your offline-first smart coordinator. I use your device\'s **Edge NPU** to parse transactions and compress messages when offline, and upgrade to **Cloud LLMs** when online. Try asking: *"Pay bob@upi 25"* or *"Message Charlie call you later"*!', 'assistant');
  }

  render() {
    const state = Storage.state;

    // 1. Wallet allowance
    this.walletBalance.textContent = `$${state.wallet.balance.toFixed(2)}`;
    this.allowanceText.textContent = `$${state.wallet.allowance.toFixed(2)} left`;
    const fillPercent = (state.wallet.allowance / state.wallet.initialAllowance) * 100;
    this.allowanceFill.style.width = `${Math.max(0, fillPercent)}%`;

    // 2. Render Ledger
    this.ledgerList.innerHTML = '';
    state.transactions.forEach(tx => {
      const item = document.createElement('div');
      item.className = 'ledger-item';
      
      const isNegative = tx.amount < 0;
      const amtText = `${isNegative ? '-' : '+'}$${Math.abs(tx.amount).toFixed(2)}`;
      const amtClass = isNegative ? 'ledger-amount minus' : 'ledger-amount plus';
      const badgeClass = tx.status === 'pending' ? 'ledger-status status-pending' : 'ledger-status status-synced';
      
      item.innerHTML = `
        <div class="ledger-item-left">
          <span class="ledger-recipient">${tx.recipient}</span>
          <div class="ledger-meta">
            <span>${tx.time}</span>
            <span class="${badgeClass}">${tx.status}</span>
          </div>
        </div>
        <span class="${amtClass}">${amtText}</span>
      `;
      this.ledgerList.appendChild(item);
    });

    // 3. Render Chats
    this.chatHistory.innerHTML = '';
    const messages = state.chats[this.activePeer] || [];
    messages.forEach(msg => {
      const bubble = document.createElement('div');
      bubble.className = `chat-bubble ${msg.sender === 'me' ? 'sent' : 'received'}`;
      
      const statusIcon = msg.status === 'pending' 
        ? `<svg viewBox="0 0 24 24" width="10" height="10" fill="var(--color-offline)"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>`
        : `<svg viewBox="0 0 24 24" width="10" height="10" fill="var(--color-online)"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
      
      bubble.innerHTML = `
        <div>${msg.text}</div>
        <div class="bubble-meta">
          <span>${msg.time}</span>
          ${msg.sender === 'me' ? statusIcon : ''}
        </div>
      `;
      this.chatHistory.appendChild(bubble);
    });
    this.chatHistory.scrollTop = this.chatHistory.scrollHeight;

    // Compactor preview
    if (messages.length > 0 && messages[messages.length - 1].sender === 'me') {
      const lastSent = messages.filter(m => m.sender === 'me').pop();
      if (lastSent && lastSent.status === 'pending') {
        this.smsPayloadText.textContent = MeshLinkEngine.compactPayload(this.activePeer, lastSent.text);
      } else {
        this.smsPayloadText.textContent = 'N/A (Synced)';
      }
    } else {
      this.smsPayloadText.textContent = 'N/A';
    }

    // 4. Suggestion chips
    this.aiSuggestions.innerHTML = '';
    this.ai.getSuggestionChips().forEach(text => {
      const chip = document.createElement('div');
      chip.className = 'suggestion-chip';
      chip.textContent = text;
      chip.addEventListener('click', () => this.handleSuggestionClick(text));
      this.aiSuggestions.appendChild(chip);
    });

    // 5. Sync vaults split screen
    const comparison = this.sync.getVaultComparison();
    
    this.localVaultContent.innerHTML = '';
    comparison.local.forEach(item => {
      const row = document.createElement('div');
      row.className = 'vault-record';
      row.innerHTML = `
        <span class="vault-record-key">${item.key}</span>
        <span class="vault-record-val" style="color:var(--color-offline);">${item.val}</span>
      `;
      this.localVaultContent.appendChild(row);
    });

    this.cloudVaultContent.innerHTML = '';
    comparison.cloud.forEach(item => {
      const row = document.createElement('div');
      row.className = 'vault-record';
      row.innerHTML = `
        <span class="vault-record-key">${item.key}</span>
        <span class="vault-record-val" style="color:var(--color-online);">${item.val}</span>
      `;
      this.cloudVaultContent.appendChild(row);
    });
  }
}

// Instantiate on load
window.addEventListener('DOMContentLoaded', () => {
  window.AirSyncApp = new AppCoordinator();
});
