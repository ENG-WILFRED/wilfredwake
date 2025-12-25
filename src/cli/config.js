/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║                    CLI CONFIG MANAGEMENT                      ║
 * ║     Handles ~/.wilfredwake/config.json read/write             ║
 * ║     Stores user preferences, tokens, and settings              ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';

/**
 * Configuration manager for wilfredwake CLI
 * Handles persistent storage in user's home directory
 */
export class ConfigManager {
  constructor() {
    // ═══════════════════════════════════════════════════════════════
    // CONFIG PATHS
    // ═══════════════════════════════════════════════════════════════
    this.configDir = path.join(os.homedir(), '.wilfredwake');
    this.configFile = path.join(this.configDir, 'config.json');
    this.cacheDir = path.join(this.configDir, 'cache');

    // ═══════════════════════════════════════════════════════════════
    // DEFAULT CONFIGURATION
    // ═══════════════════════════════════════════════════════════════
    this.defaultConfig = {
      version: '1.0.0',
      orchestratorUrl: 'http://localhost:3000',
      token: null,
      environment: 'dev',
      userId: this._generateUserId(),
      preferences: {
        outputFormat: 'table',        // table or json
        verbose: false,               // Enable debug output
        autoWait: true,               // Wait for services to be ready
        timeout: 300,                 // Default timeout in seconds
        colorOutput: true,            // Enable colored output
        notifyOnComplete: false,      // Notify when wake completes
      },
      environments: {
        dev: {
          name: 'Development',
          orchestratorUrl: 'http://localhost:3000',
        },
        staging: {
          name: 'Staging',
          orchestratorUrl: 'http://staging-orchestrator:3000',
        },
        prod: {
          name: 'Production',
          orchestratorUrl: 'http://prod-orchestrator:3000',
        },
      },
      lastSyncTime: null,
      cacheExpiry: 3600000, // 1 hour in milliseconds
    };
  }

  /**
   * Generate a unique user ID for multi-developer support
   * @private
   * @returns {string} Unique user identifier
   */
  _generateUserId() {
    return `user_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Initialize configuration directory and files
   * @returns {Promise<void>}
   */
  async init() {
    try {
      // Create .wilfredwake directory if it doesn't exist
      await fs.mkdir(this.configDir, { recursive: true });

      // Create cache directory
      await fs.mkdir(this.cacheDir, { recursive: true });

      // Create config file with defaults if it doesn't exist
      const exists = await this._fileExists(this.configFile);
      if (!exists) {
        await this.saveConfig(this.defaultConfig);
      }
    } catch (error) {
      throw new Error(`Failed to initialize configuration: ${error.message}`);
    }
  }

  /**
   * Load configuration from disk
   * @returns {Promise<Object>} Configuration object
   */
  async loadConfig() {
    try {
      const exists = await this._fileExists(this.configFile);
      if (!exists) {
        await this.init();
        return this.defaultConfig;
      }

      const content = await fs.readFile(this.configFile, 'utf-8');
      const config = JSON.parse(content);

      // Merge with defaults for any missing properties
      return { ...this.defaultConfig, ...config };
    } catch (error) {
      throw new Error(`Failed to load configuration: ${error.message}`);
    }
  }

  /**
   * Save configuration to disk
   * @param {Object} config - Configuration object
   * @returns {Promise<void>}
   */
  async saveConfig(config) {
    try {
      await fs.mkdir(this.configDir, { recursive: true });
      const content = JSON.stringify(config, null, 2);
      await fs.writeFile(this.configFile, content, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to save configuration: ${error.message}`);
    }
  }

  /**
   * Update specific configuration value
   * @param {string} key - Configuration key (supports dot notation: "preferences.verbose")
   * @param {any} value - New value
   * @returns {Promise<Object>} Updated configuration
   */
  async updateConfig(key, value) {
    const config = await this.loadConfig();
    const keys = key.split('.');
    let current = config;

    // Navigate to the target object
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }

    // Set the value
    current[keys[keys.length - 1]] = value;

    await this.saveConfig(config);
    return config;
  }

  /**
   * Get specific configuration value
   * @param {string} key - Configuration key (supports dot notation)
   * @returns {Promise<any>} Configuration value
   */
  async getConfig(key) {
    const config = await this.loadConfig();
    const keys = key.split('.');
    let current = config;

    for (const k of keys) {
      current = current?.[k];
      if (current === undefined) return null;
    }

    return current;
  }

  /**
   * Cache data for quick retrieval
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   * @returns {Promise<void>}
   */
  async setCacheData(key, data) {
    try {
      const cacheFile = path.join(this.cacheDir, `${key}.json`);
      const cacheEntry = {
        timestamp: Date.now(),
        data,
      };
      await fs.writeFile(cacheFile, JSON.stringify(cacheEntry), 'utf-8');
    } catch (error) {
      // Silently fail on cache errors
      console.debug(`Cache write failed for ${key}: ${error.message}`);
    }
  }

  /**
   * Retrieve cached data if not expired
   * @param {string} key - Cache key
   * @returns {Promise<any|null>} Cached data or null if expired/not found
   */
  async getCacheData(key) {
    try {
      const cacheFile = path.join(this.cacheDir, `${key}.json`);
      const exists = await this._fileExists(cacheFile);

      if (!exists) return null;

      const content = await fs.readFile(cacheFile, 'utf-8');
      const cacheEntry = JSON.parse(content);

      const config = await this.loadConfig();
      const isExpired =
        Date.now() - cacheEntry.timestamp > config.cacheExpiry;

      if (isExpired) {
        await fs.unlink(cacheFile).catch(() => {});
        return null;
      }

      return cacheEntry.data;
    } catch (error) {
      return null;
    }
  }

  /**
   * Clear all cache
   * @returns {Promise<void>}
   */
  async clearCache() {
    try {
      const files = await fs.readdir(this.cacheDir);
      for (const file of files) {
        await fs.unlink(path.join(this.cacheDir, file));
      }
    } catch (error) {
      console.debug(`Cache clear failed: ${error.message}`);
    }
  }

  /**
   * Check if a file exists
   * @private
   * @param {string} filePath - Path to check
   * @returns {Promise<boolean>} True if file exists
   */
  async _fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Reset configuration to defaults
   * @returns {Promise<void>}
   */
  async reset() {
    await this.saveConfig(this.defaultConfig);
  }
}

export default ConfigManager;
