# wilfredwake 🌅

**CLI Tool for Multi-Developer Development Environment Wake & Status Management**

---

## 📖 Table of Contents

- [Purpose](#purpose)
- [Quick Start](#quick-start)
- [Features](#features)
- [Installation](#installation)
- [Configuration](#configuration)
- [Commands](#commands)
- [Architecture](#architecture)
- [Service Registry](#service-registry)
- [Multi-Developer Support](#multi-developer-support)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)
- [Future Enhancements](#future-enhancements)

---

## Purpose

**wilfredwake** is a CLI tool for managing sleeping development services in distributed systems. It enables developers to:

✅ **Wake services on demand** - Start services when needed  
✅ **Check readiness** - Validate services are healthy before use  
✅ **Respect dependencies** - Wake services in correct order  
✅ **Multi-developer support** - Shared orchestrator ensures consistent state  
✅ **Avoid workflow blocks** - Cold-start and Render-like sleeping environments no longer interrupt development  

---

## Quick Start

### 1. Initialize Configuration

```bash
# Run setup wizard
wilfredwake init

# Provide orchestrator URL (default: https://wilfredwake.onrender.com)
# Select environment (dev, staging, prod)
# Optionally provide API token
```

### 2. Check Service Status

```bash
# Check all services
wilfredwake status

# Check specific service
wilfredwake status auth

# Output as JSON
wilfredwake status --format json
```

### 3. Wake Services

```bash
# Wake all services
wilfredwake wake all

# Wake specific service
wilfredwake wake auth

# Wake service group
wilfredwake wake payments

# Don't wait for readiness
wilfredwake wake all --no-wait

# Custom timeout (in seconds)
wilfredwake wake all --timeout 600
```

### 4. Check Health

```bash
# Health check all services
wilfredwake health

# Check specific service
wilfredwake health auth

# No waking, just diagnostics
```

---

## Features

### 🎯 Core Features

- **Dependency-Aware Waking** - Services wake in correct dependency order
- **Health Monitoring** - Continuous polling until services are ready
- **Multi-Environment** - Manage dev, staging, and prod separately
- **Configuration-Driven** - No code changes to add new services
- **Human-Readable Output** - Color-coded status with visual hierarchy
- **Error Handling** - Clear error messages with guidance
- **Timeout Management** - Configurable timeouts with exponential backoff

### 🎨 Output Features

- **Color-Coded Status** - Different colors for different service states
- **Table Format** - Clear, organized service status display
- **JSON Export** - Machine-readable output for automation
- **Progress Indicators** - Animated spinners during operations
- **Duration Tracking** - See how long operations take

### 🔒 Multi-Developer Features

- **Per-User Tokens** - Identify developers in orchestrator logs
- **Shared State** - Orchestrator is single source of truth
- **Concurrent Operations** - Multiple developers can wake services
- **Safe Waking** - No interference between developers

---

## Installation

### NPM (Global)

```bash
# Install globally
npm install -g wilfredwake

# Verify installation
wilfredwake --version
```

### NPM (Local Development)

```bash
# Clone repository
git clone https://github.com/wilfred/wilfredwake.git
cd wilfredwake

# Install dependencies
npm install

# Link for local testing
npm link

# Run CLI
wilfredwake --help
```

### From Source

```bash
# Using git clone
git clone https://github.com/wilfred/wilfredwake.git
cd wilfredwake

# Install dependencies
npm install

# Start CLI (development)
npm start

# Start orchestrator (development)
npm run orchestrator

# Watch mode for development
npm run dev
npm run orchestrator:dev
```

---

## Configuration

### First-Time Setup

```bash
wilfredwake init
```

This creates `~/.wilfredwake/config.json` with:

```json
{
  "orchestratorUrl": "https://wilfredwake.onrender.com",
  "token": "your-api-token",
  "environment": "dev",
  "preferences": {
    "outputFormat": "table",
    "verbose": false,
    "autoWait": true,
    "timeout": 300,
    "colorOutput": true,
    "notifyOnComplete": false
  }
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `orchestratorUrl` | string | `https://wilfredwake.onrender.com` | Orchestrator backend URL |
| `token` | string | `null` | API token for authentication |
| `environment` | string | `dev` | Default environment (dev, staging, prod) |
| `preferences.outputFormat` | string | `table` | Output format (table or json) |
| `preferences.verbose` | boolean | `false` | Enable debug output |
| `preferences.autoWait` | boolean | `true` | Wait for services to be ready |
| `preferences.timeout` | number | `300` | Default timeout in seconds |
| `preferences.colorOutput` | boolean | `true` | Enable colored output |

### Environment Variables

```bash
# Orchestrator settings
export PORT=3000
export REGISTRY_FILE=/path/to/services.yaml
export NODE_ENV=production
export REQUIRE_AUTH=true
```

---

## Commands

### `wilfredwake init`

Initialize wilfredwake configuration.

**Options:**
- `-o, --orchestrator <url>` - Orchestrator URL (default: https://wilfredwake.onrender.com)
- `-t, --token <token>` - Developer API token

**Example:**
```bash
wilfredwake init --orchestrator http://my-orchestrator:3000 --token abc123
```

---

### `wilfredwake status [service]`

Check status of services.

**Options:**
- `-e, --env <environment>` - Environment (dev, staging, prod) [default: dev]
- `-f, --format <format>` - Output format: table or json [default: table]

**Examples:**
```bash
# All services
wilfredwake status

# Specific service
wilfredwake status auth

# Different environment
wilfredwake status -e staging

# JSON format
wilfredwake status --format json

# Combine options
wilfredwake status payment-producer -e staging --format json
```

**Output:**
```
📊 Services (DEV)

SERVICE              STATUS     URL                      UPTIME
auth                 READY      https://auth-dev...      2h 30m
payment-producer     SLEEPING   https://pay-prod...      N/A
payment-consumer     READY      https://pay-cons...      1h 15m

Summary
✓ Ready: 2 | ⚫ Sleeping: 1 | ⟳ Waking: 0 | ✗ Failed: 0
Total: 3 services
```

---

### `wilfredwake wake <target>`

Wake services on demand.

**Target Options:**
- `all` - Wake all services
- `<service-name>` - Wake specific service
- `<group-name>` - Wake service group

**Options:**
- `-e, --env <environment>` - Environment (dev, staging, prod) [default: dev]
- `--no-wait` - Don't wait for services to be ready
- `--timeout <seconds>` - Timeout for readiness [default: 300]

**Examples:**
```bash
# Wake all services
wilfredwake wake all

# Wake specific service (with dependencies)
wilfredwake wake payment-consumer

# Wake service group
wilfredwake wake payments

# Different environment
wilfredwake wake all -e staging

# Custom timeout
wilfredwake wake all --timeout 600

# Don't wait for readiness
wilfredwake wake all --no-wait
```

**Output:**
```
🌅 Wake Operation Results

Timeline:
│ ✓ auth (1.2s)
│ ✓ payment-producer (3.4s)
└ ✓ payment-consumer (2.1s)

✓ Wake Complete

✓ Ready: 3
⏱ Total Time: 6.7s
✓ All services are ready!
```

---

### `wilfredwake health [service]`

Check health status (no waking).

**Options:**
- `-e, --env <environment>` - Environment (dev, staging, prod) [default: dev]

**Examples:**
```bash
# Check all
wilfredwake health

# Check specific
wilfredwake health auth

# Different environment
wilfredwake health -e prod
```

**Output:**
```
💓 Health Status (DEV)

💚 auth (ready)
   URL: https://auth-dev.onrender.com
   Response time: 42ms
   Last checked: 10:30:15 AM
   Status code: 200

😴 payment-producer (sleeping)
   URL: https://pay-prod-dev.onrender.com
   Error: Service Unavailable (503)

Summary
  Total services: 2
  ✓ Healthy: 1
  ✗ Unhealthy: 1
```

---

## Architecture

### System Design

```
┌──────────────────┐
│   Developer CLI  │  ← You run: wilfredwake wake all
│   (this tool)    │
└────────┬─────────┘
         │ HTTP REST API
         ↓
┌──────────────────────────────┐
│   Orchestrator (always-on)   │  ← Backend service
│   • Registry Manager         │
│   • Wake Orchestrator        │
│   • State Tracking           │
└────────┬──────────────────────┘
         │ Wake requests
         ↓
┌──────────────────┐
│ Microservices    │  ← /health and /wake endpoints
│ • auth           │
│ • payment-prod   │
│ • payment-cons   │
│ • api-gateway    │
└──────────────────┘
```

### Components

#### 1. CLI (`src/cli/`)

Local interface developers interact with.

- **commands/** - Command implementations (init, status, wake, health)
- **config.js** - Configuration management
- **utils.js** - CLI utilities and helpers

#### 2. Orchestrator (`src/orchestrator/`)

Always-on backend service.

- **server.js** - Express.js API server
- **registry.js** - Service registry loader and validator
- **orchestrator.js** - Wake logic and dependency ordering

#### 3. Shared (`src/shared/`)

Common utilities and modules.

- **colors.js** - Color schemes and formatting
- **logger.js** - Logging and utilities
- **errors.js** - Error definitions

#### 4. Configuration (`src/config/`)

Service definitions and registry.

- **services.yaml** - Service registry (single source of truth)

---

## Service Registry

### Format

The service registry is a YAML file defining all services, environments, and dependencies.

**Location:** `src/config/services.yaml`

### Structure

```yaml
services:
  dev:                          # Environment name
    auth:                       # Service name
      url: https://...          # Base URL
      health: /health           # Health check endpoint
      wake: /wake               # Wake endpoint
      dependsOn: []             # Dependencies (empty = no deps)
      description: "..."        # Service description

    payment-consumer:
      url: https://...
      health: /health
      wake: /wake
      dependsOn: [auth]         # Depends on auth service
      description: "..."

groups:                         # Service groups (optional)
  payments:
    services: [payment-producer, payment-consumer]
```

### Adding a New Service

1. **Edit `src/config/services.yaml`**

```yaml
services:
  dev:
    my-new-service:
      url: https://my-service-dev.onrender.com
      health: /health
      wake: /wake
      dependsOn: [auth]         # List dependencies
```

2. **Reload registry**

```bash
# Orchestrator reloads automatically (watch mode)
# Or manually:
curl -X POST https://wilfredwake.onrender.com/api/reload
```

3. **Use immediately**

```bash
wilfredwake wake my-new-service
```

### Service Endpoints

Every service must implement:

**Health Check Endpoint** (GET)
```http
GET /health
Response: HTTP 200 OK
{
  "status": "ok",
  "uptime": 3600
}
```

**Wake Endpoint** (POST)
```http
POST /wake
Response: HTTP 200 OK or 204 No Content
```

### Dependencies

Dependencies determine wake order using topological sort.

**Example:**
```yaml
auth:
  dependsOn: []              # Wakes first

payment-producer:
  dependsOn: [auth]         # Wakes after auth

payment-consumer:
  dependsOn:                # Wakes after both
    - payment-producer
    - database
```

**Wake order when `wilfredwake wake all`:**
1. ✓ auth (no dependencies)
2. ✓ database (no dependencies)
3. ✓ payment-producer (after auth)
4. ✓ payment-consumer (after payment-producer and database)

---

## Multi-Developer Support

### How It Works

1. **Each developer runs CLI locally** - Installs and configures wilfredwake
2. **One shared orchestrator** - Backend service is always-on
3. **Per-developer tokens** - Identifies developer in logs
4. **Centralized state** - Orchestrator is single source of truth

### Benefits

- ✅ No local hardcoding of services
- ✅ Consistent state across all developers
- ✅ One source of truth for service definitions
- ✅ Safe concurrent operations
- ✅ Easy to update services (just update registry)

### Setup

**Developer A:**
```bash
wilfredwake init --orchestrator http://orchestrator.company.com:3000
# Creates ~/.wilfredwake/config.json with unique user ID
```

**Developer B:**
```bash
wilfredwake init --orchestrator http://orchestrator.company.com:3000
# Different config file, same orchestrator
```

Both developers now use the same service definitions and state.

---

## Examples

### Example 1: Wake All Services

```bash
$ wilfredwake wake all -e dev

🌅 Wake Operation Results

Timeline:
│ ✓ auth (1.2s)
│ ✓ database (0.8s)
│ ✓ payment-producer (2.1s)
└ ✓ payment-consumer (1.9s)

✓ Wake Complete

✓ Ready: 4
⏱ Total Time: 6.0s
✓ All services are ready!
```

### Example 2: Wake Single Service with Dependencies

```bash
$ wilfredwake wake payment-consumer

🌅 Wake Operation Results

Timeline:
│ ✓ auth (1.2s)
│ ✓ payment-producer (2.1s)
└ ✓ payment-consumer (1.9s)

✓ Wake Complete

✓ Ready: 3
⏱ Total Time: 5.2s
✓ All services are ready!
```

### Example 3: Check Status in Different Environments

```bash
# Development
$ wilfredwake status -e dev

# Staging
$ wilfredwake status -e staging

# Production
$ wilfredwake status -e prod
```

### Example 4: JSON Output for Automation

```bash
$ wilfredwake status --format json

[
  {
    "name": "auth",
    "status": "ready",
    "url": "https://auth-dev.onrender.com",
    "uptime": "2h 30m"
  },
  ...
]
```

### Example 5: Health Check Without Waking

```bash
$ wilfredwake health

💓 Health Status (DEV)

💚 auth (ready)
😴 payment-producer (sleeping)
💚 api-gateway (ready)

Summary
  Total services: 3
  ✓ Healthy: 2
  ✗ Unhealthy: 1
```

### Example 6: Custom Timeout

```bash
# 10 minute timeout
$ wilfredwake wake all --timeout 600

# Don't wait (fire and forget)
$ wilfredwake wake all --no-wait
```

---

## Troubleshooting

### "Could not connect to orchestrator"

**Problem:** CLI can't reach the orchestrator backend.

**Solution:**
1. Check orchestrator is running: `curl https://wilfredwake.onrender.com/health`
2. Verify orchestrator URL in config: `cat ~/.wilfredwake/config.json`
3. Check firewall/networking: Can you reach the URL?

```bash
# Reinitialize with correct URL
wilfredwake init --orchestrator http://correct-orchestrator:3000
```

### Service times out during wake

**Problem:** Service takes too long to wake.

**Solution:** Increase timeout

```bash
# Default is 300 seconds (5 minutes)
wilfredwake wake all --timeout 900  # 15 minutes
```

### Circular dependency detected

**Problem:** Services have circular dependencies.

**Solution:** Fix in `services.yaml`

```yaml
# ❌ BAD - Circular dependency
auth:
  dependsOn: [payment-producer]

payment-producer:
  dependsOn: [auth]

# ✅ GOOD - Linear dependency
auth:
  dependsOn: []

payment-producer:
  dependsOn: [auth]
```

### Some services fail to wake

**Problem:** One or more services don't respond.

**Solution:**
1. Check service URLs in registry
2. Verify services have `/health` and `/wake` endpoints
3. Check service logs
4. Try individual service wake

```bash
# Try single service
wilfredwake wake auth

# Check health
wilfredwake health auth

# Check orchestrator logs
```

### Service shows as "sleeping" but should be ready

**Problem:** Service is responding with 503.

**Solution:** Service may actually be asleep. Wake it:

```bash
wilfredwake wake <service-name>
```

---

## Future Enhancements

### Phase 1 (Current)
✅ Basic CLI commands
✅ Service registry
✅ Orchestrator backend
✅ Dependency ordering

### Phase 2
🔄 CLI auto-completion
🔄 Hot reload of service registry
🔄 Web UI for visualization
🔄 Scoped groups and tagging

### Phase 3
🔲 Slack/email notifications
🔲 Service metrics and performance tracking
🔲 Health monitoring and alerting
🔲 Multi-user authentication

### Phase 4
🔲 Kubernetes integration
🔲 Service lifecycle management (pause, stop, restart)
🔲 GraphQL API for advanced queries
🔲 gRPC support for services

---

## Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

---

## License

MIT License - See LICENSE file for details

---

## Support

For issues, questions, or suggestions:

- 📝 [Open an issue](https://github.com/wilfred/wilfredwake/issues)
- 💬 [Discussions](https://github.com/wilfred/wilfredwake/discussions)
- 📧 Email: wilfred@wilfredwake.dev

---

## References & Inspiration

- Render sleeping service behavior
- Kubernetes orchestration concepts
- Terraform infrastructure as code
- Internal DevOps tooling best practices
- Multi-environment configuration strategies

---

**Made with ❤️ by Wilfred Wake**

*Keep your development environment awake and ready!* 🌅
# wilfredwake
