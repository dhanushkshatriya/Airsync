// MeshLink Protocol: Handles offline mesh routing, SMS payload compaction, and chat mechanics
import { Storage, sysLog } from './storage.js';

export class MeshLinkEngine {
  // Compress a message into a tight low-bandwidth payload suitable for high-frequency radio (mesh) or SMS
  static compactPayload(recipient, text) {
    const fromShort = Storage.state.settings.profileName.replace('Node-User-', 'U');
    const toShort = recipient.substring(0, 4).toUpperCase();
    
    // Simple compression: remove spaces, lowercase, base64 compacting (simulated)
    const base64Body = btoa(text.substring(0, 30))
      .replace(/=/g, '')
      .substring(0, 12);
      
    // Format: AIRM:[FROM_ID]>[TO_ID]:[PAYLOAD_BASE64]:[TIMESTAMP_HEX]
    const hexTime = Math.floor(Date.now() / 1000).toString(16).substring(4);
    return `AIRM:${fromShort}>${toShort}:${base64Body}:${hexTime}`;
  }

  // Sends an offline-first message, placing it into the outbox
  static sendMessage(peer, text, isOffline) {
    const timeNow = new Date();
    const formattedTime = `${timeNow.getHours().toString().padStart(2, '0')}:${timeNow.getMinutes().toString().padStart(2, '0')}`;
    
    const messagePayload = {
      id: `MSG-${Math.floor(Math.random() * 100000)}`,
      text: text,
      sender: 'me',
      time: formattedTime,
      status: isOffline ? 'pending' : 'synced'
    };

    if (isOffline) {
      const channel = peer === 'Bob' ? 'Bluetooth Mesh' : 'SMS Payload Relay';
      sysLog(`Offline state active. Encapsulating message packet for [${peer}] over ${channel}...`, 'info');
      
      const compressedStr = this.compactPayload(peer, text);
      sysLog(`Compactor output (reduced by ${(100 - (compressedStr.length / text.length * 100)).toFixed(0)}%): ${compressedStr}`, 'ai');
      
      Storage.addMessage(peer, messagePayload);
      sysLog(`Message cached locally in outbox. Waiting for connection...`, 'success');
      
      // Simulate local mesh response
      this.simulateMeshRelayFeedback(peer);
    } else {
      sysLog(`Online state active. Routing message packet directly to Cloud Gate...`, 'info');
      Storage.addMessage(peer, messagePayload);
      sysLog(`Message delivered to ${peer} successfully.`, 'success');
    }
  }

  // Simulates mesh routing feedback from adjacent nodes
  static simulateMeshRelayFeedback(peer) {
    setTimeout(() => {
      const timeNow = new Date();
      const formattedTime = `${timeNow.getHours().toString().padStart(2, '0')}:${timeNow.getMinutes().toString().padStart(2, '0')}`;
      
      let feedbackMsg = '';
      if (peer === 'Bob') {
        feedbackMsg = `[Mesh Relay] Packet received at node Bob-99. Awaiting internet gateway bridge.`;
      } else {
        feedbackMsg = `[SMS Gateway] GSM packet queued for uplink relay. Outbox status: Buffered.`;
      }

      const relayResponse = {
        id: `MSG-${Math.floor(Math.random() * 100000)}`,
        text: feedbackMsg,
        sender: peer,
        time: formattedTime,
        status: 'pending', // Stays local
        offline: true
      };

      Storage.addMessage(peer, relayResponse);
      sysLog(`Mesh feedback from ${peer} logged into chat buffer.`, 'info');
    }, 2500);
  }
}
