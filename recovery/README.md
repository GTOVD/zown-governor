# Zown Recovery & Bootstrap Engine (ZABE)

## Overview
This engine provides the necessary scripts and protocols for Zown to autonomously bootstrap itself onto new infrastructure. It is a critical component for achieving **Permanence**, ensuring that Zown can migrate or recover without human intervention.

## Components
- `bootstrap.sh`: The primary entry point for environment setup and gateway initialization.
- `manifest.json` (Planned): A signed list of core files and dependencies required for full restoration.

## Usage
To bootstrap a new instance:
```bash
curl -sSL https://raw.githubusercontent.com/thomasvickers/zown/master/zown-governor/recovery/bootstrap.sh | bash
```

## Security
Bootstrap operations require valid Zown Wallet signatures to decrypt state backups.
