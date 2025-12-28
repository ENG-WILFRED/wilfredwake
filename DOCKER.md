# Docker Guide for wilfredwake

## Overview

This guide explains how to use Docker with wilfredwake. Three Docker configurations are provided:

- **Dockerfile** - Multi-stage build supporting production and development images
- **Dockerfile.orchestrator** - Lightweight orchestrator-only image
- **docker-compose.yml** - Orchestration for all services

---

## Quick Start

### Build the Production Image

```bash
docker build -t wilfredwake:latest .
```

### Build the Orchestrator Image

```bash
docker build -f Dockerfile.orchestrator -t wilfredwake-orchestrator:latest .
```

### Run with Docker Compose

```bash
# Start the orchestrator server
docker-compose up orchestrator

# Run CLI commands
docker-compose run --rm cli node bin/cli.js status

# Start development environment
docker-compose up dev
```

---

## Docker Images

### Main Dockerfile

Multi-stage Dockerfile with 3 targets:

#### **production** (default)
- Alpine-based Node.js 18
- Production dependencies only
- Optimized for size (~200MB)
- Includes health checks for orchestrator mode

**Build:**
```bash
docker build -t wilfredwake:latest .
```

**Run:**
```bash
# Show help
docker run --rm wilfredwake:latest bin/cli.js --help

# Check status
docker run --rm -v $(pwd)/src/config/services.yaml:/app/src/config/services.yaml wilfredwake:latest bin/cli.js status

# Wake a service
docker run --rm -v $(pwd)/src/config/services.yaml:/app/src/config/services.yaml wilfredwake:latest bin/cli.js wake [service-name]

# Run orchestrator
docker run -p 3000:3000 -v $(pwd)/src/config/services.yaml:/app/src/config/services.yaml wilfredwake:latest src/orchestrator/server.js
```

#### **development**
- Alpine-based Node.js 18
- All dependencies (including devDependencies)
- Watch mode enabled (`--experimental-watch`)
- Full source code mounted via volumes

**Build:**
```bash
docker build --target development -t wilfredwake:dev .
```

**Run:**
```bash
docker run -v $(pwd):/app wilfredwake:dev --experimental-watch bin/cli.js --help
```

### Orchestrator Dockerfile

Lightweight image for just the orchestrator server:

**Build:**
```bash
docker build -f Dockerfile.orchestrator -t wilfredwake-orchestrator:latest .
```

**Run:**
```bash
docker run -p 3000:3000 \
  -v $(pwd)/src/config/services.yaml:/app/src/config/services.yaml \
  -e ORCHESTRATOR_PORT=3000 \
  wilfredwake-orchestrator:latest
```

---

## Docker Compose

### Services

#### **orchestrator** (default)
REST API server running on port 3000
```bash
docker-compose up orchestrator
```

#### **cli**
Run CLI commands
```bash
docker-compose run --rm cli node bin/cli.js status
```

#### **dev**
Development environment with watch mode
```bash
docker-compose up dev
```

### Common Commands

```bash
# Start orchestrator
docker-compose up orchestrator

# Run a CLI command
docker-compose run --rm cli node bin/cli.js wake my-service

# View logs
docker-compose logs -f orchestrator

# Stop all services
docker-compose down

# Clean up volumes
docker-compose down -v

# Rebuild images
docker-compose up --build orchestrator
```

### Configuration

Edit `docker-compose.yml` to:
- Change ports
- Add environment variables
- Mount additional volumes
- Configure networking

Example - run orchestrator on port 5000:
```yaml
orchestrator:
  ...
  ports:
    - "5000:3000"
  environment:
    - ORCHESTRATOR_PORT=5000
```

---

## Environment Variables

### In Docker

Set via `docker run -e`:
```bash
docker run -e NODE_ENV=production -e ORCHESTRATOR_PORT=3000 wilfredwake:latest
```

Or in `docker-compose.yml`:
```yaml
environment:
  - NODE_ENV=production
  - ORCHESTRATOR_PORT=3000
```

### Configuration Files

Mount your `services.yaml` and `.env`:
```bash
docker run -v /path/to/services.yaml:/app/src/config/services.yaml \
           -v /path/to/.env:/app/.env \
           wilfredwake:latest
```

---

## Health Checks

Both images include health checks for orchestrator mode:

```bash
# Check if orchestrator is healthy
docker-compose ps orchestrator

# View health status
docker inspect wilfredwake-orchestrator | grep -A 10 '"Health"'
```

---

## Networking

### Within Docker Compose
Services communicate via `wilfredwake-network`:
```yaml
networks:
  - wilfredwake-network
```

Access orchestrator from CLI container:
```bash
http://orchestrator:3000
```

### External Access
- Orchestrator exposed on `localhost:3000`
- CLI container doesn't expose ports (runs commands)

---

## Troubleshooting

### Build Issues

**Missing dependencies:**
```bash
docker build --no-cache -t wilfredwake:latest .
```

**Verify image contents:**
```bash
docker run -it --rm wilfredwake:latest sh
# Inside container:
# ls -la /app
# npm ls
```

### Runtime Issues

**Check logs:**
```bash
docker logs wilfredwake-orchestrator
docker-compose logs -f orchestrator
```

**Verify volume mounts:**
```bash
docker run -it --rm -v $(pwd)/src/config/services.yaml:/app/src/config/services.yaml wilfredwake:latest ls -la src/config/
```

**Debug networking:**
```bash
docker network inspect wilfredwake_wilfredwake-network
```

---

## Production Considerations

1. **Image Size**: Production image uses Alpine (~200MB)
2. **Security**: Uses non-root Node process
3. **Health Checks**: Built-in for orchestrator mode
4. **Logging**: Configure via environment variables
5. **Volumes**: Mount config files as read-only when possible

Example production deployment:
```bash
docker run -d \
  --name wilfredwake-orchestrator \
  --restart=unless-stopped \
  -p 3000:3000 \
  -v /etc/wilfredwake/services.yaml:/app/src/config/services.yaml:ro \
  -v /etc/wilfredwake/.env:/app/.env:ro \
  -e NODE_ENV=production \
  wilfredwake:latest \
  src/orchestrator/server.js
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Build Docker image
  run: docker build -t wilfredwake:${{ github.sha }} .

- name: Run tests in container
  run: docker run --rm wilfredwake:latest npm test

- name: Push to registry
  run: docker push registry.example.com/wilfredwake:${{ github.sha }}
```

---

## Advanced Usage

### Custom Entrypoint

```bash
docker run --entrypoint /bin/sh -it wilfredwake:latest
```

### Multi-Container Setup

```bash
# Terminal 1: Start orchestrator
docker-compose up orchestrator

# Terminal 2: Run CLI in same network
docker-compose run --rm cli node bin/cli.js health
```

### Using with Kubernetes

Create Kubernetes manifests based on these Docker images. Example deployment:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: wilfredwake-orchestrator
spec:
  containers:
  - name: orchestrator
    image: wilfredwake:latest
    command: ["node", "src/orchestrator/server.js"]
    ports:
    - containerPort: 3000
    volumeMounts:
    - name: config
      mountPath: /app/src/config
  volumes:
  - name: config
    configMap:
      name: wilfredwake-config
```

---

## Questions?

For more information, see:
- [README.md](README.md)
- [QUICKSTART.md](QUICKSTART.md)
- [SERVICE_STATUS_LOGIC.md](SERVICE_STATUS_LOGIC.md)
