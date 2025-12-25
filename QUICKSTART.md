# 🌅 wilfredwake Quick Start Guide

This guide will get you up and running with wilfredwake in 5 minutes.

---

## Prerequisites

- **Node.js** 18.0.0 or higher
- **npm** or **yarn**
- **Orchestrator running** (see [Starting the Orchestrator](#starting-the-orchestrator))

---

## 1. Install wilfredwake

### Option A: Global Installation (Recommended)

```bash
npm install -g wilfredwake
```

Verify installation:
```bash
wilfredwake --version
wilfredwake --help
```

### Option B: Local Development

```bash
# Clone repository
git clone https://github.com/wilfred/wilfredwake.git
cd wilfredwake

# Install dependencies
npm install

# Link for local use
npm link

# Test
wilfredwake --version
```

---

## 2. Start the Orchestrator

The orchestrator is the always-on backend that manages services.

### Option A: Start Locally

```bash
# Terminal 1 - Start orchestrator
cd /home/wilfred/wilfredwake
npm run orchestrator

# Expected output:
# ╔════════════════════════════════╗
# ║    WILFREDWAKE ORCHESTRATOR    ║
# ╚════════════════════════════════╝
# Loading service registry from: ./src/config/services.yaml
# ✓ Registry loaded: 6 services
# ✓ Orchestrator running on port 3000
```

### Option B: Production Deployment

Deploy the orchestrator to a server (AWS, Heroku, Railway, etc.):

```bash
# Build
npm install
npm run build

# Run
npm run orchestrator
```

---

## 3. Initialize CLI Configuration

In a new terminal, configure your CLI:

```bash
wilfredwake init
```

Follow the prompts:
- **Orchestrator URL**: `http://localhost:3000` (or your server)
- **Environment**: `dev` (default)
- **API Token**: Optional

---

## 4. Check Service Status

```bash
# Check all services
wilfredwake status

# Expected output:
# 📊 Services (DEV)
#
# SERVICE              STATUS     URL                      UPTIME
# auth                 READY      https://auth-dev...      2h 30m
# database             READY      https://database-dev...  1h 15m
# payment-producer     SLEEPING   https://pay-prod...      N/A
# payment-consumer     READY      https://pay-cons...      3h 00m
# api-gateway          READY      https://api-dev...       4h 30m
# notification         SLEEPING   https://notify-dev...    N/A
#
# Summary
# ✓ Ready: 4 | ⚫ Sleeping: 2 | ⟳ Waking: 0 | ✗ Failed: 0
# Total: 6 services
```

---

## 5. Wake Services

### Wake All Services

```bash
wilfredwake wake all
```

Expected flow:
1. Auth wakes (no dependencies)
2. Database wakes (no dependencies)
3. Payment-producer wakes (depends on auth)
4. Payment-consumer wakes (depends on payment-producer and database)
5. API gateway wakes (depends on auth and database)
6. Notification wakes (depends on auth)

---

## 6. Common Operations

### Wake a Specific Service

```bash
# With dependencies
wilfredwake wake payment-consumer
# Will wake: auth → payment-producer → payment-consumer
```

### Wake a Service Group

```bash
# Payments group
wilfredwake wake payments
# Will wake: payment-producer → payment-consumer
```

### Health Check (No Waking)

```bash
wilfredwake health

# View specific service
wilfredwake health auth
```

### Different Environment

```bash
# Switch to staging
wilfredwake wake all -e staging

# Switch to production
wilfredwake wake all -e prod
```

### JSON Output

```bash
wilfredwake status --format json
```

### Custom Timeout

```bash
# 10 minute timeout
wilfredwake wake all --timeout 600

# Don't wait (fire and forget)
wilfredwake wake all --no-wait
```

---

## Configuration

Your configuration is stored in:
```bash
cat ~/.wilfredwake/config.json
```

To reconfigure:
```bash
wilfredwake init
```

---

## Service Registry

Edit service definitions in:
```bash
# Local
nano src/config/services.yaml

# After edit, reload:
curl -X POST http://localhost:3000/api/reload
```

To add a new service, edit `services.yaml`:

```yaml
services:
  dev:
    my-service:
      url: https://my-service-dev.onrender.com
      health: /health
      wake: /wake
      dependsOn: [auth]
```

Then reload and use immediately:

```bash
wilfredwake wake my-service
```

---

## Troubleshooting

### "Could not connect to orchestrator"

1. **Check orchestrator is running:**
   ```bash
   curl http://localhost:3000/health
   ```

2. **Check configuration:**
   ```bash
   cat ~/.wilfredwake/config.json
   ```

3. **Reinitialize:**
   ```bash
   wilfredwake init --orchestrator http://correct-url:3000
   ```

### Service times out

Increase timeout:
```bash
wilfredwake wake all --timeout 900  # 15 minutes
```

### Service shows as "sleeping" but not waking

Check service logs and ensure `/wake` endpoint is working:
```bash
curl -X POST https://service-url/wake
```

---

## Development

### Start in Watch Mode

```bash
# Terminal 1 - Orchestrator with watch
npm run orchestrator:dev

# Terminal 2 - CLI with watch (if developing commands)
npm run dev
```

### Run Tests

```bash
npm test
```

### Debug

Enable verbose logging:
```bash
# In ~/.wilfredwake/config.json
{
  "preferences": {
    "verbose": true
  }
}
```

---

## Next Steps

1. **Read the full README** for detailed documentation
2. **Customize the service registry** for your services
3. **Deploy the orchestrator** to your infrastructure
4. **Share with your team** - Everyone uses the same orchestrator
5. **Integrate with CI/CD** - Automate service waking

---

## Getting Help

- **Help command:**
  ```bash
  wilfredwake --help
  ```

- **Command-specific help:**
  ```bash
  wilfredwake wake --help
  wilfredwake status --help
  ```

- **Issues:**
  https://github.com/wilfred/wilfredwake/issues

---

## Common Workflows

### Developer Starts Day

```bash
# Wake all services
wilfredwake wake all

# Check status
wilfredwake status

# Start development
# ... your IDE, your code ...
```

### Testing Specific Service

```bash
# Wake only that service and dependencies
wilfredwake wake payment-consumer

# Health check
wilfredwake health payment-consumer

# Test
# ... run tests ...
```

### After Pull Request

```bash
# Pull latest changes (including service registry)
git pull

# Reload service registry
curl -X POST http://localhost:3000/api/reload

# Wake any new services
wilfredwake wake all
```

---

## Best Practices

✅ **Do:**
- Run orchestrator in a shared, always-on location
- Keep service registry updated with current services
- Use appropriate timeouts for your services
- Check health before reporting issues

❌ **Don't:**
- Run orchestrator on your laptop
- Hardcode service URLs in the CLI
- Ignore circular dependency errors
- Mix different service registries

---

**Ready to wake some services? Run:**

```bash
wilfredwake wake all
```

Happy developing! 🌅
