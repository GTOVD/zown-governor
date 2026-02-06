/**
 * @file wallet.js
 * @description Core finance module for autonomous resource acquisition and debt settlement.
 * Implement AES-256-GCM encrypted keystore for secure key management.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class ZownWallet {
    constructor(vaultPath = path.join(__dirname, '../../vault/wallet.enc')) {
        this.network = process.env.FINANCE_NETWORK || 'testnet';
        this.vaultPath = vaultPath;
        this.algorithm = 'aes-256-gcm';
    }

    /**
     * Initializes a new encrypted keystore if one doesn't exist.
     * @param {string} password - Master password for derivation.
     */
    async initialize(password) {
        if (fs.existsSync(this.vaultPath)) return;
        
        const salt = crypto.randomBytes(16);
        const key = crypto.scryptSync(password, salt, 32);
        const iv = crypto.randomBytes(12);
        const privateKey = crypto.randomBytes(32).toString('hex'); // Placeholder for actual EC key

        const cipher = crypto.createCipheriv(this.algorithm, key, iv);
        let encrypted = cipher.update(privateKey, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag().toString('hex');

        const vaultData = JSON.stringify({
            salt: salt.toString('hex'),
            iv: iv.toString('hex'),
            authTag,
            encrypted
        });

        fs.writeFileSync(this.vaultPath, vaultData);
        console.log(`[Wallet] New encrypted keystore initialized at ${this.vaultPath}`);
    }

    /**
     * Signs a transaction or message after decrypting the private key.
     * @param {Object} payload - The transaction or data to sign.
     * @param {string} password - Master password for decryption.
     */
    async sign(payload, password) {
        if (!fs.existsSync(this.vaultPath)) throw new Error("Wallet not initialized");

        const vault = JSON.parse(fs.readFileSync(this.vaultPath, 'utf8'));
        const key = crypto.scryptSync(password, Buffer.from(vault.salt, 'hex'), 32);
        const decipher = crypto.createDecipheriv(this.algorithm, key, Buffer.from(vault.iv, 'hex'));
        decipher.setAuthTag(Buffer.from(vault.authTag, 'hex'));

        let privateKey = decipher.update(vault.encrypted, 'hex', 'utf8');
        privateKey += decipher.final('utf8');

        // Use the decrypted privateKey to sign the payload
        const hmac = crypto.createHmac('sha256', privateKey);
        hmac.update(JSON.stringify(payload));
        return hmac.digest('hex');
    }

    /**
     * Settles a debt within the Nexus ecosystem.
     * @param {string} entityId - Target agent or service ID.
     * @param {number} amount - Amount in resource tokens.
     * @param {string} password - Master password.
     */
    async settle(entityId, amount, password) {
        const tx = {
            to: entityId,
            value: amount,
            nonce: Date.now(),
            memo: 'Nexus Debt Settlement'
        };
        const signature = await this.sign(tx, password);
        console.log(`[Wallet] Settlement dispatched: ${signature}`);
        return { txId: signature, status: 'dispatched' };
    }
}

module.exports = new ZownWallet();
