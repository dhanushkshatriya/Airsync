// PayAir Protocol: Handles Offline Transaction Token Signing & Verification
import { Storage, sysLog } from './storage.js';

// Simulated cryptographic keys for secure element emulation
const SECURE_ENCLAVE_KEYS = {
  publicKey: '04c7cf9952a12a76f2b2b1a8d05ea91a76c8c4a169b1580218...',
  privateKey: 'enclave_prv_781_x509_secp256k1'
};

export class PayAirEngine {
  // Generates a cryptographically signed payment voucher to be shared offline via QR Code
  static generateOfflineVoucher(recipient, amount) {
    sysLog(`Initiating secure enclave token signature for $${amount.toFixed(2)} to ${recipient}...`, 'info');
    
    // 1. Enforce local secure element limits (Offline Spend Allowance)
    try {
      Storage.deductOfflineWallet(amount);
    } catch (err) {
      sysLog(`Secure Enclave block: ${err.message}`, 'warn');
      alert(`Payment Blocked: ${err.message}`);
      return null;
    }

    // 2. Compile voucher payload
    const nonce = Math.floor(Math.random() * 1000000);
    const timestamp = Date.now();
    const payload = {
      v: 'PAYAIR_v1.0',
      from: Storage.state.settings.profileName,
      to: recipient,
      amt: amount,
      non: nonce,
      ts: timestamp
    };

    // 3. Cryptographically sign the payload using local private key (Simulated HMAC/SHA256 ECDSA)
    const signSource = `${payload.from}:${payload.to}:${payload.amt}:${payload.non}:${payload.ts}`;
    const mockSignature = this.hashString(signSource + SECURE_ENCLAVE_KEYS.privateKey).substring(0, 32);

    const voucher = {
      ...payload,
      sig: mockSignature,
      pk: SECURE_ENCLAVE_KEYS.publicKey.substring(0, 24) + '...'
    };

    sysLog(`Voucher signed by local NPU Secure Enclave! Signature: ${mockSignature}`, 'success');

    // 4. Save to local transaction queue
    const localTx = {
      id: `TX-${nonce.toString().substring(0, 4)}`,
      recipient: recipient,
      amount: -amount,
      time: 'Just now',
      status: 'pending',
      offline: true,
      payload: voucher
    };
    Storage.addTransaction(localTx);

    return voucher;
  }

  // Parses and verifies an incoming signed voucher from another node
  static claimVoucher(voucherString) {
    try {
      sysLog('Scanning incoming transaction voucher payload...', 'info');
      const voucher = JSON.parse(voucherString);

      if (voucher.v !== 'PAYAIR_v1.0') {
        throw new Error('Invalid protocol header version.');
      }

      sysLog(`Voucher header validated. From: ${voucher.from} | Amount: $${voucher.amt}`, 'info');
      sysLog('Verifying cryptographic signature against sender public key...', 'info');

      // Re-sign locally to verify authenticity
      const signSource = `${voucher.from}:${voucher.to}:${voucher.amt}:${voucher.non}:${voucher.ts}`;
      const regeneratedSig = this.hashString(signSource + SECURE_ENCLAVE_KEYS.privateKey).substring(0, 32);

      // In real-world, we would check against sender's public key; here we simulate validation success
      sysLog(`Signature match! Validated payload: [sig: ${voucher.sig}]`, 'success');
      sysLog(`Crediting wallet locally... balance increased by $${voucher.amt}`, 'success');

      // Add credit transaction to ledger
      const localCreditTx = {
        id: `TX-${voucher.non.toString().substring(0, 4)}`,
        recipient: `From: ${voucher.from}`,
        amount: voucher.amt,
        time: 'Just now',
        status: 'pending',
        offline: true,
        payload: voucher
      };
      
      Storage.state.wallet.balance += voucher.amt;
      Storage.addTransaction(localCreditTx);
      return true;

    } catch (err) {
      sysLog(`Voucher validation failed: ${err.message}`, 'warn');
      alert(`Invalid Voucher: ${err.message}`);
      return false;
    }
  }

  // Lightweight string hashing helper (simulating cryptographic SHA-256)
  static hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16).padStart(8, '0') + Math.abs(hash * 33).toString(16);
  }

  // Generates a highly stylized decorative SVG representing our secure QR code
  static drawQrCodeSvg(voucherData) {
    const rawString = JSON.stringify(voucherData);
    const size = 180;
    const blocksCount = 18;
    const blockSize = size / blocksCount;
    
    let svgMarkup = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="background:#fff;">`;
    
    // Seeded random matrix drawer
    let hashInt = parseInt(this.hashString(rawString).substring(0, 8), 16);
    
    // Render standard QR corner marker targets (Position Detection Patterns)
    const drawMarker = (x, y) => {
      svgMarkup += `<rect x="${x}" y="${y}" width="${blockSize*7}" height="${blockSize*7}" fill="#0b0f19" />`;
      svgMarkup += `<rect x="${x+blockSize}" y="${y+blockSize}" width="${blockSize*5}" height="${blockSize*5}" fill="#ffffff" />`;
      svgMarkup += `<rect x="${x+blockSize*2}" y="${y+blockSize*2}" width="${blockSize*3}" height="${blockSize*3}" fill="#6366f1" />`; // Glowing indigo center
    };
    
    drawMarker(0, 0); // Top Left
    drawMarker(size - blockSize*7, 0); // Top Right
    drawMarker(0, size - blockSize*7); // Bottom Left

    // Draw custom decorative logo in the center (Aegis Shield)
    const centerStart = blockSize * 7;
    const centerWidth = blockSize * 4;
    
    // Fill the rest with pseudo-random code blocks based on payload hash
    for (let row = 0; row < blocksCount; row++) {
      for (let col = 0; col < blocksCount; col++) {
        // Skip position patterns
        if (row < 7 && col < 7) continue;
        if (row < 7 && col >= blocksCount - 7) continue;
        if (row >= blocksCount - 7 && col < 7) continue;
        // Skip center logo
        if (row >= 7 && row < 11 && col >= 7 && col < 11) continue;

        // Generate deterministic dot grid
        hashInt = (hashInt * 16807) % 2147483647;
        const drawDot = hashInt % 2 === 0;
        
        if (drawDot) {
          const x = col * blockSize;
          const y = row * blockSize;
          // Apply elegant cyber coloring gradient
          const fill = row + col > blocksCount ? '#06b6d4' : '#0b0f19';
          svgMarkup += `<rect x="${x}" y="${y}" width="${blockSize}" height="${blockSize}" fill="${fill}" rx="1"/>`;
        }
      }
    }
    
    // Draw the shield center
    svgMarkup += `<rect x="${centerStart}" y="${centerStart}" width="${centerWidth}" height="${centerWidth}" fill="#0b0f19" rx="4" />`;
    // Tiny lightning bolt inside logo
    svgMarkup += `<path d="M${centerStart + blockSize*2} ${centerStart + blockSize/2} l-${blockSize*1.2} ${blockSize*1.8} h${blockSize*1.2} l-${blockSize*0.4} ${blockSize*1.2} l${blockSize*1.5} -2.1h-${blockSize*1.2}z" fill="#10b981" />`;

    svgMarkup += `</svg>`;
    return svgMarkup;
  }
}
