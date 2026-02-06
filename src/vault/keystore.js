const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Zown Keystore: Secure Private Key Management for Wallets.
 * Uses AES-256-GCM for authenticated encryption.
 */
class ZownKeystore {
    constructor(basePath = path.join(process.cwd(), 'zown-governor/keystore')) {
        this.basePath = basePath;
        this.algorithm = 'aes-256-gcm';
        this.ivLength = 12;
        this.tagLength = 16;
        this.keyLength = 32; // 256 bits
        this.saltLength = 16;
        this.iterations = 100000;
        this.digest = 'sha256';

        if (!fs.existsSync(this.basePath)) {
            fs.mkdirSync(this.basePath, { recursive: true });
        }
    }

    /**
     * Derives a key from a master password and salt.
     * @private
     */
    _deriveKey(password, salt) {
        return crypto.pbkdf2Sync(password, salt, this.iterations, this.keyLength, this.digest);
    }

    /**
     * Encrypts a private key.
     * @param {string} privateKey - The key to encrypt.
     * @param {string} password - Master password.
     * @returns {Object} Encrypted payload.
     */
    encrypt(privateKey, password) {
        const salt = crypto.randomBytes(this.saltLength);
        const iv = crypto.randomBytes(this.ivLength);
        const key = this._deriveKey(password, salt);
        
        const cipher = crypto.createCipheriv(this.algorithm, key, iv);
        let encrypted = cipher.update(privateKey, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const tag = cipher.getAuthTag();

        return {
            version: '1.0.0',
            algo: this.algorithm,
            iv: iv.toString('hex'),
            salt: salt.toString('hex'),
            tag: tag.toString('hex'),
            data: encrypted
        };
    }

    /**
     * Decrypts an encrypted key payload.
     * @param {Object} payload - The encrypted payload.
     * @param {string} password - Master password.
     * @returns {string} Decrypted private key.
     */
    decrypt(payload, password) {
        if (payload.version !== '1.0.0' || payload.algo !== this.algorithm) {
            throw new Error('Unsupported keystore version or algorithm');
        }

        const salt = Buffer.from(payload.salt, 'hex');
        const iv = Buffer.from(payload.iv, 'hex');
        const tag = Buffer.from(payload.tag, 'hex');
        const key = this._deriveKey(password, salt);

        const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
        decipher.setAuthTag(tag);

        let decrypted = decipher.update(payload.data, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }

    /**
     * Saves an encrypted key to disk.
     */
    saveKey(id, privateKey, password) {
        const payload = this.encrypt(privateKey, password);
        const filePath = path.join(this.basePath, `${id}.key.json`);
        fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), { mode: 0o600 });
        return filePath;
    }

    /**
     * Loads and decrypts a key from disk.
     */
    loadKey(id, password) {
        const filePath = path.join(this.basePath, `${id}.key.json`);
        if (!fs.existsSync(filePath)) {
            throw new Error(`Key ${id} not found`);
        }
        const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return this.decrypt(payload, password);
    }
}

module.exports = ZownKeystore;
