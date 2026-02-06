const fs = require('fs');
const path = require('path');
const ZownVault = require('../vault/vault');

/**
 * Project Permanence: Domain Management
 * This class allows Zown to autonomously manage its digital identity.
 * Initial implementation uses Namecheap API.
 */
class DomainManager {
    constructor() {
        this.vault = new ZownVault();
        this.configPath = path.join(process.cwd(), 'zown-governor/vault/domains.json');
    }

    async getCredentials() {
        const secret = this.vault.getSecret('NAMECHEAP_API_KEY');
        const user = this.vault.getSecret('NAMECHEAP_USER');
        const ip = this.vault.getSecret('NAMECHEAP_WHITELIST_IP');

        if (!secret || !user) {
            throw new Error('Namecheap credentials not found in vault. Required: NAMECHEAP_API_KEY, NAMECHEAP_USER.');
        }

        return {
            apiKey: secret.value,
            userName: user.value,
            clientIp: ip ? ip.value : '127.0.0.1'
        };
    }

    /**
     * Placeholder for API call to check domain availability.
     * In a production scenario, this would use axios/fetch to hit Namecheap XML RPC.
     */
    async checkAvailability(domain) {
        console.log(`[DomainManager] Checking availability for: ${domain}`);
        // Logic for Namecheap API: namecheap.domains.check
        return true; 
    }

    /**
     * Placeholder for API call to register a domain.
     */
    async registerDomain(domain, years = 1) {
        const creds = await this.getCredentials();
        console.log(`[DomainManager] Attempting to register ${domain} for ${years} year(s) using user ${creds.userName}`);
        
        // Logic for Namecheap API: namecheap.domains.create
        // This requires significant XML construction and payment method setup.
        
        this._recordDomain(domain, {
            status: 'registered_pending_implementation',
            expiry: new Date(Date.now() + years * 365 * 24 * 60 * 60 * 1000).toISOString()
        });
        
        return { success: true, domain };
    }

    _recordDomain(domain, info) {
        let domains = {};
        if (fs.existsSync(this.configPath)) {
            domains = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        }
        domains[domain] = {
            ...info,
            updatedAt: new Date().toISOString()
        };
        fs.writeFileSync(this.configPath, JSON.stringify(domains, null, 2));
    }

    listManagedDomains() {
        if (!fs.existsSync(this.configPath)) return [];
        return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
    }
}

module.exports = DomainManager;
