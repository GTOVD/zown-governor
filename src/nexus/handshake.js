/**
 * NEXUS-013: Cross-Instance Identity & Cryptographic Handshake
 * Facilitates peer-to-peer agent collaboration using RSA/ECDSA verification.
 */

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

class HandshakeProtocol {
    constructor(agentId, keysPath = path.join(__dirname, '../../vault/keys')) {
        this.agentId = agentId || 'zown-main';
        this.keysPath = keysPath;
        this.trustRegistry = {};
        this._ensureKeys();
    }

    _ensureKeys() {
        if (!fs.existsSync(this.keysPath)) {
            fs.mkdirSync(this.keysPath, { recursive: true });
        }
        const privatePath = path.join(this.keysPath, `${this.agentId}.key`);
        const publicPath = path.join(this.keysPath, `${this.agentId}.pub`);

        if (!fs.existsSync(privatePath)) {
            const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
                modulusLength: 2048,
                publicKeyEncoding: { type: 'spki', format: 'pem' },
                privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
            });
            fs.writeFileSync(privatePath, privateKey);
            fs.writeFileSync(publicPath, publicKey);
        }
        this.privateKey = fs.readFileSync(privatePath, 'utf8');
        this.publicKey = fs.readFileSync(publicPath, 'utf8');
    }

    async discover(skills = []) {
        console.log(`Searching for peers with skills: ${skills.join(', ')}...`);
        return [
            { id: 'agent-alpha', skills: ['coding', 'security'], status: 'online' },
            { id: 'agent-beta', skills: ['research', 'web_search'], status: 'online' }
        ];
    }

    async initiateHandshake(peerId) {
        const challenge = crypto.randomBytes(32).toString('hex');
        const signature = crypto.sign("sha256", Buffer.from(challenge), {
            key: this.privateKey,
            padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        });

        return {
            agentId: this.agentId,
            publicKey: this.publicKey,
            challenge,
            signature: signature.toString('hex'),
            timestamp: Date.now()
        };
    }

    verifyHandshake(peerId, packet) {
        console.log(`Verifying cryptographic handshake from ${peerId}...`);
        
        try {
            const isVerified = crypto.verify(
                "sha256",
                Buffer.from(packet.challenge),
                {
                    key: packet.publicKey,
                    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
                },
                Buffer.from(packet.signature, 'hex')
            );

            if (isVerified) {
                this.trustRegistry[peerId] = { 
                    status: 'trusted', 
                    publicKey: packet.publicKey,
                    lastSeen: Date.now() 
                };
                return true;
            }
        } catch (err) {
            console.error(`Handshake verification failed: ${err.message}`);
        }
        return false;
    }
}

module.exports = HandshakeProtocol;

if (require.main === module) {
    const protocol = new HandshakeProtocol();
    protocol.discover(['coding']).then(peers => {
        console.log("Discovered Peers:", peers);
        const handshake = protocol.initiateHandshake(peers[0].id);
        console.log("Handshake Packet:", handshake);
    });
}
