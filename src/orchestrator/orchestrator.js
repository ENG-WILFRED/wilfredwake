/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║              SERVICE ORCHESTRATOR ENGINE                      ║
 * ║     Simplified wake logic using /health endpoint              ║
 * ║     Tracks last wake time and service readiness               ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

import axios from 'axios';

/**
 * Service state enumeration
 */
export const ServiceState = {
  DEAD: 'dead',             // Service is not responding (initial state)
  WAKING: 'waking',         // Health check response slow (> 5s threshold)
  LIVE: 'live',             // Health check responds with 200 OK quickly
  FAILED: 'failed',         // Health check failed/error
  UNKNOWN: 'unknown',       // State cannot be determined
};

/**
 * Orchestrator class - Manages service wake operations
 * Uses simplified /health endpoint logic with timestamp tracking
 */
export class Orchestrator {
  constructor(registry) {
    this.registry = registry;
    this.serviceStates = new Map();        // Track service states
    this.lastWakeTime = new Map();         // Track when each service was last woken
    this.requestTimestamps = new Map();    // Track request/response times
    this.HEALTH_CHECK_TIMEOUT = 5000;      // 5 second threshold before marking as "waking"
  }

  /**
   * Wake services with dependency ordering
   * NEW LOGIC: Assume all services are dead initially
   * Just call /health and track timestamps
   *
   * @param {string|Array<string>} target - Wake target (all, <service>, <group>)
   * @param {string} environment - Environment name
   * @param {Object} options - Wake options
   * @param {boolean} options.wait - Wait for services to respond
   * @param {number} options.timeout - Overall timeout in seconds
   * @returns {Promise<Object>} Wake operation results
   */
  async wake(target, environment = 'dev', options = {}) {
    const { wait = true, timeout = 300 } = options;

    // ═══════════════════════════════════════════════════════════════
    // RESOLVE WAKE ORDER
    // ═══════════════════════════════════════════════════════════════
    let services;
    try {
      services = this.registry.resolveWakeOrder(target, environment);
    } catch (error) {
      return {
        success: false,
        error: error.message,
        services: [],
      };
    }

    if (services.length === 0) {
      return {
        success: true,
        error: null,
        services: [],
        totalDuration: 0,
      };
    }

    // ═══════════════════════════════════════════════════════════════
    // ASSUME ALL SERVICES ARE DEAD INITIALLY
    // NEW: Instead of /wake endpoint, just check /health repeatedly
    // ═══════════════════════════════════════════════════════════════
    const results = [];
    const startTime = Date.now();

    for (const service of services) {
      const serviceStartTime = Date.now();

      try {
        // NEW: Mark service as being woken and initiate health check sequence
        this._logTimestamp(service.name, 'Wake initiated');

        // NEW: Set state to DEAD initially (always assume dead)
        this._setServiceState(service.name, ServiceState.DEAD);
        this._recordLastWakeTime(service.name);

        // Check health status (handles timeout internally)
        const status = await this._checkHealthWithTimeout(
          service,
          timeout
        );

        const duration = Date.now() - serviceStartTime;

        results.push({
          name: service.name,
          status,
          url: service.url,
          duration,
          error: null,
          lastWakeTime: this.lastWakeTime.get(service.name),
        });

        this._setServiceState(service.name, status);
      } catch (error) {
        const duration = Date.now() - serviceStartTime;

        results.push({
          name: service.name,
          status: ServiceState.FAILED,
          url: service.url,
          duration,
          error: error.message,
          lastWakeTime: this.lastWakeTime.get(service.name),
        });

        this._setServiceState(service.name, ServiceState.FAILED);
      }
    }

    const totalDuration = Date.now() - startTime;
    const allLive = results.every(r => r.status === ServiceState.LIVE);

    return {
      success: allLive,
      error: null,
      services: results,
      totalDuration,
    };
  }

  /**
   * Get status of services
   * Returns current state of services (always assumes dead initially)
   *
   * @param {string} serviceName - Optional specific service
   * @param {string} environment - Environment name
   * @returns {Promise<Object>} Status information
   */
  async getStatus(serviceName, environment = 'dev') {
    const services = serviceName
      ? [this.registry.getService(serviceName, environment)].filter(Boolean)
      : this.registry.getServices(environment);

    const statusResults = [];

    for (const service of services) {
      const status = await this._checkHealthWithTimeout(service, 5); // Quick check
      
      statusResults.push({
        name: service.name,
        status,
        url: service.url,
        lastWakeTime: this.lastWakeTime.get(service.name) || null,
      });
    }

    return {
      services: statusResults,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Check health of services
   * Performs health check without waking
   *
   * @param {string} serviceName - Optional specific service
   * @param {string} environment - Environment name
   * @returns {Promise<Object>} Health information
   */
  async getHealth(serviceName, environment = 'dev') {
    const services = serviceName
      ? [this.registry.getService(serviceName, environment)].filter(Boolean)
      : this.registry.getServices(environment);

    const healthResults = [];

    for (const service of services) {
      const health = await this._performHealthCheck(service);
      healthResults.push({
        name: service.name,
        status: health.state,
        url: service.url,
        statusCode: health.statusCode,
        responseTime: health.responseTime,
        lastChecked: new Date().toISOString(),
        lastWakeTime: this.lastWakeTime.get(service.name) || null,
        error: health.error,
        dependencies: service.dependsOn || [],
      });
    }

    return {
      services: healthResults,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * REMOVED: _wakeService - No longer calls /wake endpoint
   * NEW: Health-based checking with timeout threshold
   */

  /**
   * Check health with timeout threshold
   * NEW: If response takes > 5 seconds, mark as WAKING
   *      If responds quickly with 200, mark as LIVE
   *
   * @private
   * @param {Object} service - Service definition
   * @param {number} timeoutSeconds - Overall timeout
   * @returns {Promise<string>} Service state
   */
  async _checkHealthWithTimeout(service, timeoutSeconds = 5) {
    const startTime = Date.now();
    const overallTimeoutMs = timeoutSeconds * 1000;

    try {
      const health = await this._performHealthCheck(service);
      const responseTime = Date.now() - startTime;

      // ═══════════════════════════════════════════════════════════════
      // NEW LOGIC: Simple threshold-based state determination
      // ═══════════════════════════════════════════════════════════════
      if (health.state === ServiceState.LIVE) {
        this._logTimestamp(
          service.name,
          `Health check OK in ${responseTime}ms`
        );
        return ServiceState.LIVE;
      }

      // If response is slow (> 5 seconds threshold), mark as waking
      if (responseTime > this.HEALTH_CHECK_TIMEOUT) {
        this._logTimestamp(
          service.name,
          `Health check slow (${responseTime}ms) - marking as waking`
        );
        return ServiceState.WAKING;
      }

      // If it's dead but response came back (non-200), still mark as waking
      if (health.statusCode === 503 || health.statusCode >= 500) {
        this._logTimestamp(service.name, `Health returned ${health.statusCode} - marking as waking`);
        return ServiceState.WAKING;
      }

      return health.state || ServiceState.UNKNOWN;
    } catch (error) {
      this._logTimestamp(service.name, `Health check error: ${error.message}`);
      return ServiceState.FAILED;
    }
  }

  /**
   * Perform health check on service
   * NEW: Simple /health endpoint call with timeout tracking
   *
   * @private
   * @param {Object} service - Service definition
   * @returns {Promise<Object>} Health check result
   */
  async _performHealthCheck(service) {
    const startTime = Date.now();

    try {
      const healthUrl = new URL(service.health, service.url).toString();

      this._logTimestamp(service.name, `Requesting ${service.health}`);

      const response = await axios.get(healthUrl, {
        timeout: 10000,
        validateStatus: () => true,
      });

      const responseTime = Date.now() - startTime;

      // ═══════════════════════════════════════════════════════════════
      // DETERMINE STATE FROM STATUS CODE
      // ═══════════════════════════════════════════════════════════════
      // Consider any HTTP response (2xx/3xx/4xx/5xx) as evidence the
      // service is responsive — treat as LIVE. Only mark FAILED for
      // server errors (5xx). This follows "mark as woken when any
      // response is received" behavior.
      let state = ServiceState.LIVE;
      if (response.status >= 500) {
        state = ServiceState.FAILED;
      }

      this._logTimestamp(
        service.name,
        `Responded ${response.status} in ${responseTime}ms`
      );

      return {
        state,
        statusCode: response.status,
        responseTime,
        error: null,
        uptime: response.data?.uptime || null,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      this._logTimestamp(
        service.name,
        `Health check failed: ${error.message}`
      );

      return {
        state: ServiceState.DEAD,  // Changed: assume dead on error
        statusCode: null,
        responseTime,
        error: error.message,
        uptime: null,
      };
    }
  }

  /**
   * Set service state
   * @private
   * @param {string} serviceName - Service name
   * @param {string} state - New state
   */
  _setServiceState(serviceName, state) {
    this.serviceStates.set(serviceName, state);
  }

  /**
   * Record the time a service was last woken
   * NEW: Track when each service wake was initiated
   *
   * @private
   * @param {string} serviceName - Service name
   */
  _recordLastWakeTime(serviceName) {
    const timestamp = new Date().toISOString();
    this.lastWakeTime.set(serviceName, timestamp);
  }

  /**
   * Log a timestamp for service event
   * NEW: Detailed logging of request/response times
   *
   * @private
   * @param {string} serviceName - Service name
   * @param {string} message - Event message
   */
  _logTimestamp(serviceName, message) {
    const timestamp = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const key = `${serviceName}:${Date.now()}`;
    this.requestTimestamps.set(key, {
      service: serviceName,
      timestamp,
      message,
    });

    console.log(`[${timestamp}] ${serviceName}: ${message}`);
  }

  /**
   * Wait for specified milliseconds
   * @private
   * @param {number} ms - Milliseconds to wait
   */
  async _wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear service states and wake times
   * @returns {void}
   */
  clearStates() {
    this.serviceStates.clear();
    this.lastWakeTime.clear();
    this.requestTimestamps.clear();
  }
}
