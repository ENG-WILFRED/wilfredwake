/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║                                                               ║
 * ║   WILFREDWAKE - CLI TOOL FOR SERVICE ORCHESTRATION           ║
 * ║                                                               ║
 * ║   Multi-Developer Development Environment Management          ║
 * ║   Wake & Status Management for Distributed Systems            ║
 * ║                                                               ║
 * ║   Project: wilfredwake                                       ║
 * ║   Version: 1.0.0                                             ║
 * ║   License: MIT                                               ║
 * ║                                                               ║
 * ╚═══════════════════════════════════════════════════════════════╝
 *
 * PURPOSE
 * ═══════════════════════════════════════════════════════════════
 * wilfredwake is a CLI tool to manage sleeping development services
 * in distributed systems, ensuring developers can wake services on
 * demand while respecting dependency order and checking readiness.
 *
 * CORE FEATURES
 * ═══════════════════════════════════════════════════════════════
 * • Service status checking and health monitoring
 * • On-demand service waking with dependency awareness
 * • Multi-developer support with centralized orchestrator
 * • Configuration-driven service registry (YAML/JSON)
 * • Human-readable colored output
 * • Timeout and error handling
 * • Multi-environment support (dev, staging, prod)
 *
 * ARCHITECTURE
 * ═══════════════════════════════════════════════════════════════
 * Developer CLI → Orchestrator (always-on) → Services
 *
 * CLI: Local interface developers use (this package)
 * Orchestrator: Backend service managing state and wake operations
 * Services: Individual microservices with /health and /wake endpoints
 *
 * SYSTEM COMPONENTS
 * ═══════════════════════════════════════════════════════════════
 * src/
 *   ├── cli/                    # CLI interface
 *   │   ├── commands/           # CLI command implementations
 *   │   │   ├── init.js         # Configuration setup
 *   │   │   ├── status.js       # Service status checking
 *   │   │   ├── wake.js         # Service wake operations
 *   │   │   └── health.js       # Health checks
 *   │   ├── config.js           # Configuration management
 *   │   └── utils.js            # CLI utilities
 *   ├── orchestrator/           # Backend orchestrator
 *   │   ├── server.js           # Express.js API server
 *   │   ├── registry.js         # Service registry loader
 *   │   ├── orchestrator.js     # Wake orchestration logic
 *   │   └── handlers/           # API request handlers
 *   ├── shared/                 # Shared modules
 *   │   ├── colors.js           # Color schemes and formatting
 *   │   ├── logger.js           # Logging utilities
 *   │   └── errors.js           # Error definitions
 *   └── config/                 # Configuration files
 *       └── services.yaml       # Service registry
 *   ├── bin/                    # Executable entry point
 *   │   └── cli.js              # CLI executable
 *   ├── package.json            # NPM package definition
 *   └── index.js                # Main entry point
 *
 * USAGE EXAMPLES
 * ═══════════════════════════════════════════════════════════════
 *
 * # Initialize configuration (first-time setup)
 * $ wilfredwake init
 *
 * # Check status of all services
 * $ wilfredwake status
 *
 * # Check specific service status
 * $ wilfredwake status auth
 *
 * # Wake all services
 * $ wilfredwake wake all
 *
 * # Wake specific service
 * $ wilfredwake wake auth
 *
 * # Wake service group
 * $ wilfredwake wake payments
 *
 * # Health check (no waking)
 * $ wilfredwake health
 *
 * # Environment-specific operations
 * $ wilfredwake wake all --env staging
 *
 * # JSON output format
 * $ wilfredwake status --format json
 *
 * CONFIGURATION
 * ═══════════════════════════════════════════════════════════════
 * Configuration is stored in ~/.wilfredwake/config.json
 *
 * Default values:
 * {
 *   "orchestratorUrl": "http://localhost:3000",
 *   "token": null,
 *   "environment": "dev",
 *   "preferences": {
 *     "outputFormat": "table",
 *     "verbose": false,
 *     "autoWait": true,
 *     "timeout": 300
 *   }
 * }
 *
 * SERVICE REGISTRY
 * ═══════════════════════════════════════════════════════════════
 * Service registry (services.yaml) defines:
 * • Service name, URL, and health/wake endpoints
 * • Service dependencies (for dependency-aware waking)
 * • Environment configurations (dev, staging, prod)
 * • Service grouping for bulk operations
 *
 * Example service definition:
 * services:
 *   dev:
 *     auth:
 *       url: https://auth-dev.onrender.com
 *       health: /health
 *       wake: /wake
 *       dependsOn: []
 *
 *     payment-consumer:
 *       url: https://payment-consumer-dev.onrender.com
 *       health: /health
 *       wake: /wake
 *       dependsOn: [auth]
 *
 * ORCHESTRATOR API
 * ═══════════════════════════════════════════════════════════════
 * The orchestrator backend provides REST APIs:
 *
 * GET  /health                 - Orchestrator health check
 * GET  /api/status             - Get service status
 * GET  /api/health             - Perform health checks
 * POST /api/wake               - Wake services
 * GET  /api/registry           - View service registry
 * POST /api/reload             - Reload service registry
 *
 * MULTI-DEVELOPER SUPPORT
 * ═══════════════════════════════════════════════════════════════
 * • CLI uses per-user token to identify developer
 * • Orchestrator is shared/always-on (single source of truth)
 * • Multiple developers can wake services concurrently
 * • State is centralized in orchestrator
 *
 * DEPENDENCY ORDERING
 * ═══════════════════════════════════════════════════════════════
 * Services are woken in dependency order using topological sort:
 *
 * Example dependency chain:
 * auth (no deps) → payment-producer (depends on auth)
 *              → payment-consumer (depends on payment-producer)
 *
 * When waking "all":
 * 1. auth wakes first
 * 2. Once auth is ready, payment-producer wakes
 * 3. Once payment-producer is ready, payment-consumer wakes
 *
 * HEALTH CHECKS
 * ═══════════════════════════════════════════════════════════════
 * • Health endpoint: GET {service-url}/health (configurable)
 * • Wake endpoint: POST {service-url}/wake (configurable)
 * • Status codes < 300: Service is ready
 * • Status code 503: Service is sleeping
 * • Status codes >= 400: Service has issues
 * • Timeout: Service not responding
 *
 * ERROR HANDLING
 * ═══════════════════════════════════════════════════════════════
 * • Timeouts: Services that don't respond within timeout
 * • Failed health checks: Services that fail health validation
 * • Circular dependencies: Detected and reported
 * • Connection errors: Clear error messages with guidance
 * • Partial success: Some services wake, others fail
 *
 * ENVIRONMENT VARIABLES
 * ═══════════════════════════════════════════════════════════════
 * PORT                 - Orchestrator port (default: 3000)
 * REGISTRY_FILE        - Path to service registry (default: src/config/services.yaml)
 * NODE_ENV             - Environment (development, production)
 * REQUIRE_AUTH         - Require authentication tokens
 *
 * FUTURE ENHANCEMENTS
 * ═══════════════════════════════════════════════════════════════
 * • CLI auto-completion support
 * • Hot reload of service registry
 * • Web UI for orchestration overview
 * • Scoped groups and service tagging
 * • API-based dynamic service registration
 * • Slack/email notifications for sleeping services
 * • Service metrics and performance tracking
 * • Automatic health monitoring and alerting
 * • Service lifecycle management (pause, stop, restart)
 * • Multi-user authentication and authorization
 *
 * LICENSE
 * ═══════════════════════════════════════════════════════════════
 * MIT License - See LICENSE file for details
 *
 * REFERENCES
 * ═══════════════════════════════════════════════════════════════
 * • Render sleeping service behavior
 * • Kubernetes orchestration concepts
 * • Terraform infrastructure as code patterns
 * • DevOps tooling best practices
 *
 */

// Entry point - exports CLI version and utilities for programmatic use
export { default as ConfigManager } from './src/cli/config.js';
export { Logger, utils } from './src/shared/logger.js';
export { colors, format } from './src/shared/colors.js';
export { ServiceRegistry } from './src/orchestrator/registry.js';
export { Orchestrator, ServiceState } from './src/orchestrator/orchestrator.js';
