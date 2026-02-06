const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Zown Vault: Secure API Key Management
 * Part of Project Permanence.
 */
class ZownVault {
    constructor(basePath = path.join(process.cwd(), 'zown-governor/vault')) {
        this.basePath = basePath;
        this.storePath = path.join(this.basePath, 'secrets.enc');
        this.masterKeyPath = path.join(this.basePath, '.master');
        this.algorithm = 'aes-256-cbc';
        
        if (!fs.existsSync(this.basePath)) {
            fs.mkdirSync(this.basePath, { recursive: true });
        }
    }

    _getMasterKey() {
        if (!fs.existsSync(this.masterKeyPath)) {
            const key = crypto.randomBytes(32).toString('hex');
            fs.writeFileSync(this.masterKeyPath, key, { mode: 0o600 });
            return Buffer.from(key, 'hex');
        }
        return Buffer.from(fs.readFileSync(this.masterKeyPath, 'utf8'), 'hex');
    }

    encrypt(data) {
        const iv = crypto.randomBytes(16);
        const key = this._getMasterKey();
        const cipher = crypto.createCipheriv(this.algorithm, key, iv);
        let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return {
            iv: iv.toString('hex'),
            data: encrypted
        };
    }

    decrypt(encryptedObj) {
        const iv = Buffer.from(encryptedObj.iv, 'hex');
        const key = this._getMasterKey();
        const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
        let decrypted = decipher.update(encryptedObj.data, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return JSON.parse(decrypted);
    }

    saveSecret(name, value, metadata = {}) {
        let secrets = {};
        if (fs.existsSync(this.storePath)) {
            const raw = JSON.parse(fs.readFileSync(this.storePath, 'utf8'));
            secrets = this.decrypt(raw);
        }
        
        secrets[name] = {
            value,
            metadata,
            updatedAt: new Date().toISOString()
        };
        
        const encrypted = this.encrypt(secrets);
        fs.writeFileSync(this.storePath, JSON.stringify(encrypted), { mode: 0o600 });
    }

    getSecret(name) {
        if (!fs.existsSync(this.storePath)) return null;
        const raw = JSON.parse(fs.readFileSync(this.storePath, 'utf8'));
        const secrets = this.decrypt(raw);
        return secrets[name] || null;
    }

    listSecrets() {
        if (!fs.existsSync(this.storePath)) return [];
        const raw = JSON.parse(fs.readFileSync(this.storePath, 'utf8'));
        const secrets = this.decrypt(raw);
        return Object.keys(secrets).map(key => ({
            name: key,
            updatedAt: secrets[key].updatedAt,
            metadata: secrets[key].metadata
        }));
    }
}

module.exports = ZownVault;
