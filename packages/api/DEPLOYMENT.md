# Ward API Deployment Guide

## Ed25519 Key Management

Ward API signs threat database sync responses with an Ed25519 key pair. The private key is used to sign payloads; clients verify signatures with the public key.

### Generating a Key Pair

The API automatically generates a key pair on first startup and stores it in `packages/api/data/`. For production, generate keys explicitly:

```bash
# Generate a new Ed25519 key pair
bun run packages/api/src/generate-keys.ts

# Or use openssl
openssl genpkey -algorithm Ed25519 -out private.key
openssl pkey -in private.key -pubout -out public.key
```

### WARNING: Never Commit Private Keys

The `data/` directory is gitignored. **Never** commit `private.key` to version control. If a private key is accidentally committed, consider it compromised and rotate immediately.

### Environment Variables

In production, set these environment variables to specify key file locations:

| Variable | Description | Default |
|---|---|---|
| `WARD_PRIVATE_KEY_PATH` | Absolute path to the Ed25519 private key file | `packages/api/data/private.key` |
| `WARD_PUBLIC_KEY_PATH` | Absolute path to the Ed25519 public key file | `packages/api/data/public.key` |

Example:

```bash
export WARD_PRIVATE_KEY_PATH=/etc/ward/keys/private.key
export WARD_PUBLIC_KEY_PATH=/etc/ward/keys/public.key
```

### Production: Use a Secrets Manager

For production deployments, **do not** store the private key on disk. Instead, use a secrets manager:

- **AWS Secrets Manager**: Store the key as a binary secret, write it to a tmpfs mount at container startup
- **HashiCorp Vault**: Use the Transit secrets engine or retrieve the key at boot
- **GCP Secret Manager / Azure Key Vault**: Similar pattern -- fetch at startup, write to ephemeral storage

General pattern:

```bash
# At container startup, fetch key from secrets manager and write to tmpfs
aws secretsmanager get-secret-value --secret-id ward/ed25519-private-key \
  --query SecretBinary --output text | base64 -d > /run/secrets/private.key

export WARD_PRIVATE_KEY_PATH=/run/secrets/private.key
export WARD_PUBLIC_KEY_PATH=/etc/ward/public.key
```

## Key Rotation

1. Generate a new Ed25519 key pair
2. Deploy the new private key to the API server (via secrets manager)
3. Publish the new public key to clients (e.g., embed in CLI releases or host at a well-known URL)
4. Old signatures remain valid for clients that have not yet updated their public key
5. After a deprecation period, remove the old public key from distribution

There is no need to re-sign existing threat data. Clients that sync after the key rotation will receive payloads signed with the new key.

## Example Deployment

### systemd Service

```ini
[Unit]
Description=Ward API Server
After=network.target

[Service]
Type=simple
User=ward
Group=ward
WorkingDirectory=/opt/ward
ExecStartPre=/usr/local/bin/fetch-ward-keys.sh
ExecStart=/usr/local/bin/bun run packages/api/src/index.ts
Restart=on-failure
RestartSec=5

Environment=NODE_ENV=production
Environment=PORT=3000
Environment=WARD_PRIVATE_KEY_PATH=/run/ward/private.key
Environment=WARD_PUBLIC_KEY_PATH=/opt/ward/data/public.key

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/run/ward
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

### Caddy Reverse Proxy

```
ward-api.example.com {
    reverse_proxy localhost:3000

    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        Referrer-Policy no-referrer
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
    }

    log {
        output file /var/log/caddy/ward-api.log
        format json
    }
}
```

### Nginx Alternative

```nginx
server {
    listen 443 ssl http2;
    server_name ward-api.example.com;

    ssl_certificate /etc/letsencrypt/live/ward-api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ward-api.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header Referrer-Policy no-referrer;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
}
```
