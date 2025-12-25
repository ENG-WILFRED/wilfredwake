/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║                SERVICE REGISTRY MANAGER                       ║
 * ║     Loads and validates service configuration                 ║
 * ║     Manages service definitions and dependencies              ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';

/**
 * Service Registry - Single source of truth for service definitions
 * Loads services from YAML/JSON configuration files
 * Validates service definitions and dependency chains
 */
export class ServiceRegistry {
  constructor() {
    this.services = new Map();
    this.registry = null;
    this.lastLoadTime = null;
  }

  /**
   * Load service registry from file
   * Supports both YAML and JSON formats
   *
   * @param {string} filePath - Path to registry file
   * @returns {Promise<void>}
   */
  async load(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');

      let registry;
      if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
        registry = yaml.load(content);
      } else if (filePath.endsWith('.json')) {
        registry = JSON.parse(content);
      } else {
        throw new Error('Unsupported file format. Use .yaml, .yml, or .json');
      }

      this._validateRegistry(registry);
      this.registry = registry;
      this._indexServices(registry);
      this.lastLoadTime = Date.now();
    } catch (error) {
      throw new Error(
        `Failed to load service registry from ${filePath}: ${error.message}`
      );
    }
  }

  /**
   * Load registry from string content
   * @param {string} content - YAML or JSON content
   * @param {string} format - Format type ('yaml' or 'json')
   */
  async loadFromString(content, format = 'yaml') {
    try {
      let registry;
      if (format === 'yaml') {
        registry = yaml.load(content);
      } else if (format === 'json') {
        registry = JSON.parse(content);
      } else {
        throw new Error('Unsupported format. Use "yaml" or "json"');
      }

      this._validateRegistry(registry);
      this.registry = registry;
      this._indexServices(registry);
      this.lastLoadTime = Date.now();
    } catch (error) {
      throw new Error(`Failed to load registry: ${error.message}`);
    }
  }

  /**
   * Get all services for a specific environment
   * @param {string} environment - Environment name (dev, staging, prod)
   * @returns {Array<Object>} Array of services
   */
  getServices(environment = 'dev') {
    const env = this.registry?.services?.[environment] || {};
    // Return service objects augmented with their name for downstream code
    return Object.entries(env).map(([name, svc]) => ({ name, ...svc }));
  }

  /**
   * Get a specific service by name
   * @param {string} serviceName - Service name
   * @param {string} environment - Environment name
   * @returns {Object|null} Service definition
   */
  getService(serviceName, environment = 'dev') {
    const svc = this.registry?.services?.[environment]?.[serviceName] || null;
    if (!svc) return null;
    return { name: serviceName, ...svc };
  }

  /**
   * Get service dependencies
   * @param {string} serviceName - Service name
   * @param {string} environment - Environment name
   * @returns {Array<string>} Array of dependent service names
   */
  getDependencies(serviceName, environment = 'dev') {
    const service = this.getService(serviceName, environment);
    return service?.dependsOn || [];
  }

  /**
   * Resolve service wake order respecting dependencies
   * Performs topological sort to determine wake sequence
   *
   * @param {string|Array<string>} target - Service name or array of names
   * @param {string} environment - Environment name
   * @returns {Array<Object>} Services in wake order
   */
  resolveWakeOrder(target, environment = 'dev') {
    const services = this.getServices(environment);
    let targetServices = [];

    // ═══════════════════════════════════════════════════════════════
    // RESOLVE TARGET SERVICES
    // ═══════════════════════════════════════════════════════════════
    if (target === 'all') {
      // Wake all services (services is already an array of named objects)
      targetServices = services;
    } else if (Array.isArray(target)) {
      // Wake specified services
      targetServices = target
        .map(name => this.getService(name, environment))
        .filter(Boolean);
    } else {
      // Wake single service and its dependencies
      const service = this.getService(target, environment);
      if (service) {
        targetServices = [service];
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // TOPOLOGICAL SORT - Respect dependency order
    // ═══════════════════════════════════════════════════════════════
    const visited = new Set();
    const tempVisited = new Set();
    const result = [];

    const visit = (serviceName) => {
      if (visited.has(serviceName)) return;
      if (tempVisited.has(serviceName)) {
        throw new Error(`Circular dependency detected involving ${serviceName}`);
      }

      tempVisited.add(serviceName);
      const service = this.getService(serviceName, environment);

      if (service) {
        // Visit dependencies first
        for (const dep of service.dependsOn || []) {
          visit(dep);
        }
      }

      tempVisited.delete(serviceName);
      visited.add(serviceName);
      result.push(serviceName);
    };

    // Visit each target service
    for (const service of targetServices) {
      visit(service.name);
    }

    // Convert to service objects
    return result
      .map(name => this.getService(name, environment))
      .filter(Boolean);
  }

  /**
   * Validate registry structure
   * @private
   * @param {Object} registry - Registry object to validate
   */
  _validateRegistry(registry) {
    if (!registry) {
      throw new Error('Registry is empty or invalid');
    }

    if (!registry.services) {
      throw new Error('Registry must contain "services" key');
    }

    // Validate each environment
    for (const [env, services] of Object.entries(registry.services)) {
      if (typeof services !== 'object' || Array.isArray(services)) {
        throw new Error(
          `Services in environment "${env}" must be an object`
        );
      }

      // Validate each service
      for (const [name, service] of Object.entries(services)) {
        this._validateService(name, service, env);
      }
    }
  }

  /**
   * Validate individual service definition
   * @private
   * @param {string} name - Service name
   * @param {Object} service - Service definition
   * @param {string} environment - Environment name
   */
  _validateService(name, service, environment) {
    if (!service.url) {
      throw new Error(
        `Service "${name}" in environment "${environment}" must have a URL`
      );
    }

    if (!service.health) {
      throw new Error(
        `Service "${name}" must define a health check endpoint`
      );
    }

    // 'wake' endpoint is optional; newer logic uses health-only checks
    // Keep backwards compatibility if present, but do not require it.

    if (service.dependsOn && !Array.isArray(service.dependsOn)) {
      throw new Error(
        `Service "${name}" dependsOn must be an array`
      );
    }
  }

  /**
   * Index services by name for quick lookup
   * @private
   * @param {Object} registry - Registry object
   */
  _indexServices(registry) {
    this.services.clear();

    for (const environment of Object.keys(registry.services || {})) {
      const envServices = registry.services[environment];
      for (const [name, service] of Object.entries(envServices)) {
        const key = `${environment}:${name}`;
        this.services.set(key, service);
      }
    }
  }

  /**
   * Get registry statistics
   * @returns {Object} Statistics about loaded registry
   */
  getStats() {
    const stats = {
      totalServices: 0,
      environments: [],
      lastLoadTime: this.lastLoadTime,
    };

    if (this.registry?.services) {
      for (const [env, services] of Object.entries(this.registry.services)) {
        stats.environments.push({
          name: env,
          serviceCount: Object.keys(services).length,
        });
        stats.totalServices += Object.keys(services).length;
      }
    }

    return stats;
  }
}

export default ServiceRegistry;
