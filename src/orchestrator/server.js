/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║              ORCHESTRATOR API SERVER                          ║
 * ║     Express.js server providing REST API for service mgmt    ║
 * ║     Manages service waking, health checks, and state          ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { ServiceRegistry } from './registry.js';
import { Orchestrator } from './orchestrator.js';

// ═══════════════════════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════════════════════

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const REGISTRY_FILE = process.env.REGISTRY_FILE || path.join(__dirname, '../config/services.yaml');

// ═══════════════════════════════════════════════════════════════
// GLOBAL STATE
// ═══════════════════════════════════════════════════════════════

let registry = null;
let orchestrator = null;
let requestCounter = 0;

// ═══════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════════

// Body parser
app.use(express.json());

// Request logging with colors
app.use((req, res, next) => {
  const requestId = ++requestCounter;
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusColor =
      res.statusCode < 300
        ? chalk.greenBright
        : res.statusCode < 400
        ? chalk.yellowBright
        : chalk.redBright;

    console.log(
      chalk.dim(`[${new Date().toLocaleTimeString()}]`) +
      ` ${statusColor(res.statusCode)} ` +
      chalk.cyan(`${req.method} ${req.path}`) +
      chalk.gray(` (${duration}ms)`)
    );
  });

  next();
});

// ═══════════════════════════════════════════════════════════════
// MIDDLEWARE - AUTHENTICATION
// ═══════════════════════════════════════════════════════════════

/**
 * Token validation middleware
 * Checks Authorization header if tokens are required
 */
const validateToken = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  // For now, we accept all requests
  // In production, validate against registered tokens
  if (process.env.REQUIRE_AUTH && !token) {
    return res.status(401).json({
      success: false,
      error: 'Missing or invalid authentication token',
    });
  }

  req.userId = token || 'anonymous';
  next();
};

// ═══════════════════════════════════════════════════════════════
// API ROUTES
// ═══════════════════════════════════════════════════════════════

/**
 * GET /health
 * Health check endpoint for orchestrator itself
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    registry: registry ? registry.getStats() : null,
  });
});

/**
 * GET /api/status
 * Get current status of services
 * Query params:
 *   - environment: Environment name (dev, staging, prod)
 *   - service: Optional specific service name
 */
app.get('/api/status', validateToken, async (req, res) => {
  try {
    const { environment = 'dev', service } = req.query;

    if (!orchestrator) {
      return res.status(503).json({
        success: false,
        error: 'Orchestrator not initialized',
      });
    }

    const status = await orchestrator.getStatus(service, environment);

    res.json({
      success: true,
      ...status,
    });
  } catch (error) {
    console.error(chalk.redBright(`Error in /api/status: ${error.message}`));
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/health
 * Get detailed health information for services
 * Query params:
 *   - environment: Environment name
 *   - service: Optional specific service name
 */
app.get('/api/health', validateToken, async (req, res) => {
  try {
    const { environment = 'dev', service } = req.query;

    if (!orchestrator) {
      return res.status(503).json({
        success: false,
        error: 'Orchestrator not initialized',
      });
    }

    const health = await orchestrator.getHealth(service, environment);

    res.json({
      success: true,
      ...health,
    });
  } catch (error) {
    console.error(chalk.redBright(`Error in /api/health: ${error.message}`));
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/wake
 * Wake services on demand
 * Body:
 *   - target: "all" | "<service-name>" | "<group-name>"
 *   - environment: Environment name
 *   - wait: Wait for services to be ready (boolean)
 *   - timeout: Timeout in seconds
 */
app.post('/api/wake', validateToken, async (req, res) => {
  try {
    const {
      target,
      environment = 'dev',
      wait = true,
      timeout = 300,
    } = req.body;

    if (!target) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: target',
      });
    }

    if (!orchestrator) {
      return res.status(503).json({
        success: false,
        error: 'Orchestrator not initialized',
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // PERFORM WAKE OPERATION
    // ═══════════════════════════════════════════════════════════════
    const result = await orchestrator.wake(target, environment, {
      wait,
      timeout: parseInt(timeout),
    });

    // ═══════════════════════════════════════════════════════════════
    // RETURN RESULT
    // ═══════════════════════════════════════════════════════════════
    const statusCode = result.success ? 200 : 207; // 207 Partial Success if some failed

    res.status(statusCode).json({
      success: result.success,
      error: result.error,
      target,
      environment,
      services: result.services,
      totalDuration: result.totalDuration,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(chalk.redBright(`Error in /api/wake: ${error.message}`));
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/registry
 * Get current service registry (read-only)
 * Query params:
 *   - environment: Optional environment filter
 */
app.get('/api/registry', validateToken, (req, res) => {
  try {
    const { environment } = req.query;

    if (!registry) {
      return res.status(503).json({
        success: false,
        error: 'Registry not loaded',
      });
    }

    const response = {
      success: true,
      stats: registry.getStats(),
      timestamp: new Date().toISOString(),
    };

    if (environment) {
      response.services = registry.getServices(environment);
    } else {
      response.services = registry.registry.services;
    }

    res.json(response);
  } catch (error) {
    console.error(chalk.redBright(`Error in /api/registry: ${error.message}`));
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/reload
 * Reload service registry
 * Requires authentication
 */
app.post('/api/reload', validateToken, async (req, res) => {
  try {
    console.log(chalk.yellowBright('Reloading service registry...'));

    registry = new ServiceRegistry();
    await registry.load(REGISTRY_FILE);

    orchestrator = new Orchestrator(registry);

    const stats = registry.getStats();
    console.log(chalk.greenBright(`Registry reloaded: ${stats.totalServices} services`));

    res.json({
      success: true,
      message: 'Registry reloaded successfully',
      stats,
    });
  } catch (error) {
    console.error(chalk.redBright(`Registry reload failed: ${error.message}`));
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// ERROR HANDLING
// ═══════════════════════════════════════════════════════════════

/**
 * 404 Handler
 */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint not found: ${req.method} ${req.path}`,
  });
});

/**
 * Global error handler
 */
app.use((err, req, res, next) => {
  console.error(chalk.redBright(`Server error: ${err.message}`));
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

// ═══════════════════════════════════════════════════════════════
// INITIALIZATION & SERVER START
// ═══════════════════════════════════════════════════════════════

/**
 * Initialize orchestrator and start server
 */
async function initialize() {
  try {
    // ═══════════════════════════════════════════════════════════════
    // LOAD REGISTRY
    // ═══════════════════════════════════════════════════════════════
    console.log(chalk.cyanBright.bold('╔════════════════════════════════════╗'));
    console.log(chalk.cyanBright.bold('║    WILFREDWAKE ORCHESTRATOR        ║'));
    console.log(chalk.cyanBright.bold('╚════════════════════════════════════╝\n'));

    console.log(chalk.yellowBright(`Loading service registry from: ${REGISTRY_FILE}`));

    registry = new ServiceRegistry();
    await registry.load(REGISTRY_FILE);

    const stats = registry.getStats();
    console.log(
      chalk.greenBright(
        `✓ Registry loaded: ${stats.totalServices} services\n`
      )
    );

    // ═══════════════════════════════════════════════════════════════
    // INITIALIZE ORCHESTRATOR
    // ═══════════════════════════════════════════════════════════════
    orchestrator = new Orchestrator(registry);

    // ═══════════════════════════════════════════════════════════════
    // START SERVER
    // ═══════════════════════════════════════════════════════════════
    app.listen(PORT, () => {
      console.log(chalk.greenBright.bold(`✓ Orchestrator running on port ${PORT}\n`));

      console.log(chalk.cyanBright('Available endpoints:'));
      console.log(chalk.yellow('  GET  /health                # Health check'));
      console.log(chalk.yellow('  GET  /api/status            # Service status'));
      console.log(chalk.yellow('  GET  /api/health            # Service health'));
      console.log(chalk.yellow('  POST /api/wake              # Wake services'));
      console.log(chalk.yellow('  GET  /api/registry          # View registry'));
      console.log(chalk.yellow('  POST /api/reload            # Reload registry\n'));

      console.log(chalk.dim(`Environment: ${process.env.NODE_ENV || 'development'}`));
      console.log(chalk.dim(`Registry file: ${REGISTRY_FILE}\n`));
    });
  } catch (error) {
    console.error(
      chalk.redBright(`Failed to initialize orchestrator: ${error.message}`)
    );
    process.exit(1);
  }
}

// Start the server
initialize();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log(chalk.yellowBright('\nReceived SIGTERM, shutting down gracefully...'));
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log(chalk.yellowBright('\nReceived SIGINT, shutting down gracefully...'));
  process.exit(0);
});

export default app;
