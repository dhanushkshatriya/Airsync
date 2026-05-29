// AirAI Core Assistant - Orchestrates edge heuristic NPU parsing offline & cloud predictive ML online
import { Storage, sysLog } from './storage.js';
import { PayAirEngine } from './payments.js';
import { MeshLinkEngine } from './messaging.js';

export class AirAiEngine {
  constructor(isOffline) {
    this.isOffline = isOffline;
  }

  setOnlineStatus(isOffline) {
    this.isOffline = isOffline;
    this.updateVisualState();
  }

  updateVisualState() {
    const activeEngineText = document.getElementById('aiActiveEngine');
    const nodeLocal = document.getElementById('nodeLocal');
    const nodeCloud = document.getElementById('nodeCloud');
    
    if (!activeEngineText || !nodeLocal || !nodeCloud) return;

    if (this.isOffline) {
      activeEngineText.textContent = 'Edge NPU Engine';
      activeEngineText.style.color = 'var(--color-ai)';
      nodeLocal.classList.add('active');
      nodeCloud.classList.remove('active');
    } else {
      activeEngineText.textContent = 'Cloud LLM Cluster';
      activeEngineText.style.color = 'var(--color-sync)';
      nodeLocal.classList.remove('active');
      nodeCloud.classList.add('active');
    }
  }

  // Parses user commands in natural language and handles them dynamically
  processUserCommand(userInput) {
    sysLog(`AI Input Received: "${userInput}"`, 'ai');
    
    const query = userInput.toLowerCase().trim();
    let aiResponse = '';
    
    // OFFLINE EDGE PARSING
    if (this.isOffline) {
      sysLog('Active connection: None. Invoking Edge-NPU Heuristics parser...', 'warn');
      
      // Pattern 1: Offline Payments (supporting UPI, Phone Number, and Bank accounts)
      if (query.includes('pay') || query.includes('send') || query.includes('give') || query.includes('transfer')) {
        // Extract amount (look for numbers, possibly preceded by $)
        const amountMatch = query.match(/(?:rs|\$|amt)?\s*(\d+(?:\.\d{1,2})?)/i);
        const amount = amountMatch ? parseFloat(amountMatch[1]) : null;
        
        let recipientType = 'upi'; // Default to UPI ID
        let recipientVal = '';
        
        // Remove verbs and amount to isolate recipient details
        let details = query.replace(/pay|send|give|transfer|to|\$|rs/g, '').replace(/\b\d+(?:\.\d{1,2})?\b/g, '').trim();

        // 1. Detect UPI ID pattern
        if (details.includes('@') || details.includes('upi')) {
          recipientType = 'upi';
          // Clean up string to find the UPI handle
          const match = details.match(/[a-zA-Z0-9.\-_]+@[a-zA-Z]+/);
          recipientVal = match ? match[0] : (details.replace(/\s+/g, '') + '@upi');
        }
        // 2. Detect Phone Number pattern
        else if (details.match(/(?:\+?\d{1,3}[- ]?)?\d{10}/) || details.includes('phone') || details.includes('number') || details.includes('tel') || details.includes('mob')) {
          recipientType = 'phone';
          const match = details.match(/\+?\d[\d -]{8,15}/);
          recipientVal = match ? match[0].trim() : '+91 98765 43210'; // Fallback seed
        }
        // 3. Detect Bank Account pattern
        else if (details.includes('bank') || details.includes('acc') || details.includes('account') || details.includes('ifsc')) {
          recipientType = 'bank';
          recipientVal = 'Acc: 9876543210, IFSC: HDFC0001234'; // Default parsed format
        }
        // 4. Default simple names mapped to mock UPI VPAs
        else if (details.includes('bob')) {
          recipientType = 'upi';
          recipientVal = 'bob@upi';
        } else if (details.includes('charlie')) {
          recipientType = 'upi';
          recipientVal = 'charlie@upi';
        } else if (details.includes('alice')) {
          recipientType = 'upi';
          recipientVal = 'alice@upi';
        } else if (details.length > 0) {
          recipientType = 'upi';
          recipientVal = details.replace(/\s+/g, '') + '@upi';
        }

        if (amount && recipientVal) {
          sysLog(`Local NPU matches NLP Intent: [OFFLINE_PAYMENT] Method: ${recipientType.toUpperCase()} | Amt: $${amount} | Target: ${recipientVal}`, 'ai');
          
          // Auto-fill form details
          const payTypeSelect = document.getElementById('payType');
          const payRecipientLabel = document.getElementById('payRecipientLabel');
          const payRecipientInput = document.getElementById('payRecipient');
          const payAmountInput = document.getElementById('payAmount');

          payTypeSelect.value = recipientType;
          payAmountInput.value = amount;
          payRecipientInput.value = recipientVal;

          // Update label and placeholder dynamically just like human toggle
          if (recipientType === 'upi') {
            payRecipientLabel.textContent = 'Recipient UPI ID';
            payRecipientInput.placeholder = 'e.g. alice@upi';
          } else if (recipientType === 'phone') {
            payRecipientLabel.textContent = 'Recipient Phone Number';
            payRecipientInput.placeholder = 'e.g. +91 98765 43210';
          } else if (recipientType === 'bank') {
            payRecipientLabel.textContent = 'Bank Account Details';
            payRecipientInput.placeholder = 'e.g. Acc: 9876543210, IFSC: HDFC0001234';
          }

          // Trigger dynamic local signature voucher
          const formattedRecipient = `${recipientType.toUpperCase()}: ${recipientVal}`;
          const voucher = PayAirEngine.generateOfflineVoucher(formattedRecipient, amount);
          
          if (voucher) {
            // Update QR modal visually
            const qrContainer = document.getElementById('qrContainer');
            const qrSignatureText = document.getElementById('qrSignatureText');
            const qrModal = document.getElementById('qrModal');

            qrContainer.innerHTML = PayAirEngine.drawQrCodeSvg(voucher);
            qrSignatureText.value = voucher.sig;
            qrModal.classList.add('active');

            aiResponse = `Edge NPU parsed your intent perfectly! I signed an offline **${recipientType.toUpperCase()}** payment voucher of **$${amount.toFixed(2)}** for **${recipientVal}** and automatically generated the secure transaction QR code. Let the recipient scan it to collect!`;
          } else {
            aiResponse = `Signature failed: The secure enclave blocked the transaction because it exceeds your remaining Offline Spend Allowance ($${Storage.state.wallet.allowance.toFixed(2)}).`;
          }
        } else {
          aiResponse = `I recognized your payment request, but could not parse the amount or recipient details. Try saying:
          - *"Pay bob@upi 25"*
          - *"Send 30 to phone 9876543210"*
          - *"Transfer 50 to Bank Account"*`;
        }
      }
      // Pattern 2: Offline Messaging (e.g., "message Bob cell tower down", "tell Charlie see you soon")
      else if (query.includes('msg') || query.includes('message') || query.includes('tell') || query.includes('write')) {
        let recipient = 'Bob'; // Default
        if (query.includes('charlie')) recipient = 'Charlie';
        
        // Extract message content
        let messageText = userInput.replace(/pay|send|message|msg|tell|bob|charlie/gi, '').trim();
        if (messageText.startsWith('to ')) messageText = messageText.substring(3);
        
        if (messageText.length > 0) {
          sysLog(`Local NPU matches NLP Intent: [OFFLINE_MESSAGE] Target: ${recipient}`, 'ai');
          MeshLinkEngine.sendMessage(recipient, messageText, true);
          aiResponse = `Message packaged! I compressed your text into a compressed SMS payload and buffered it in your local Outbox for **${recipient}**. Your peer will receive it when in radio mesh range.`;
        } else {
          aiResponse = `I detected a message intent, but couldn't extract the message content. Try saying: *"Message Bob the cell tower is down"*`;
        }
      }
      // Pattern 3: Default Offline Help
      else {
        aiResponse = `Hello! I am running in **On-Device Offline Mode**. Since there is no internet, I am utilizing your phone's NPU to parse commands locally. 
        
        **Available Offline Skills:**
        1. **Payments:** Say *"Pay Bob 30"* (Deducts local allowance and signs QR)
        2. **Messaging:** Say *"Message Charlie all good"* (Compresses text to offline SMS payload)
        3. **Status:** Ask *"Check allowance"* or *"Diagnose connection"*`;
      }
    } 
    
    // ONLINE CLOUD LLM PARSING
    else {
      sysLog('Active connection: Online. Upgrading pipeline to Cloud GPU Clusters...', 'success');
      
      if (query.includes('insight') || query.includes('analytics') || query.includes('chart') || query.includes('spend')) {
        sysLog('Cloud Server successfully compiled your query with predictive financial models.', 'success');
        
        // Calculate ledger overview
        const totalOut = Storage.state.transactions
          .filter(t => t.amount < 0)
          .reduce((sum, t) => sum + Math.abs(t.amount), 0);
          
        aiResponse = `### 📊 AirSync Cloud Analytics Report:
        I analyzed your transaction ledger spanning both offline and online states.
        
        - **Total Spent:** $${totalOut.toFixed(2)}
        - **Wallet Balance:** $${Storage.state.wallet.balance.toFixed(2)}
        - **System Health:** 100% Synced (Zero anomalies)
        
        **Predictive Advice:** Based on your $${(totalOut/2).toFixed(2)} hourly spend density, your remaining $${Storage.state.wallet.balance.toFixed(2)} balance will sustain you for another **48 hours** of offline operations. I recommend topping up before your next remote expedition!`;
      }
      else {
        aiResponse = `Welcome to **AirSync Cloud LLM**. Since you are online, I am utilizing our remote multi-GPU cluster to give you full-featured analytics and predictive advice.
        
        Try asking me:
        - *"Provide spending insights"* (analyzes your sync logs to build a predictive financial health summary)
        - You can also type standard chats, and I will query the synced database.`;
      }
    }

    return aiResponse;
  }

  // Returns localized smart suggestion chips based on connectivity status
  getSuggestionChips() {
    if (this.isOffline) {
      return [
        'Pay bob@upi 25',
        'Send 30 to phone 9876543210',
        'Message Charlie all good'
      ];
    } else {
      return [
        'Provide spending insights',
        'Check database logs',
        'Cloud sync statistics'
      ];
    }
  }
}
