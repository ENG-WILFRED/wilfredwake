/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║                    LOGGER & UTILITIES MODULE                  ║
 * ║           Provides logging and utility functions               ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

import chalk from 'chalk';
import { colors, format } from './colors.js';

/**
 * Logger class for consistent output formatting
 * Provides methods for different log levels with color coding
 */
export class Logger {
  constructor(verbose = false) {
    this.verbose = verbose;
    this.spinnerState = 0;
  }

  /**
   * Log a success message
   * @param {string} message - Message to log
   */
  success(message) {
    console.log(format.success(message));
  }

  /**
   * Log an error message
   * @param {string} message - Message to log
   */
  error(message) {
    console.error(format.error(message));
  }

  /**
   * Log an info message
   * @param {string} message - Message to log
   */
  info(message) {
    console.log(format.info(message));
  }

  /**
   * Log a warning message
   * @param {string} message - Message to log
   */
  warn(message) {
    console.warn(format.warning(message));
  }

  /**
   * Log a debug message (only if verbose mode enabled)
   * @param {string} message - Message to log
   */
  debug(message) {
    if (this.verbose) {
      console.log(colors.emphasis.muted(`[DEBUG] ${message}`));
    }
  }

  /**
   * Log a section header
   * @param {string} title - Section title
   */
  section(title) {
    console.log(format.section(title));
  }

  /**
   * Start a spinner animation
   * @param {string} message - Message while spinning
   * @returns {Function} Function to stop spinner
   */
  spinner(message) {
    const frames = colors.markers.spinner;
    let index = 0;

    const interval = setInterval(() => {
      process.stdout.write(
        `\r${chalk.blueBright(frames[index])} ${message}`
      );
      index = (index + 1) % frames.length;
    }, 100);

    return () => {
      clearInterval(interval);
      process.stdout.write('\r'); // Clear line
    };
  }
}

/**
 * Utility functions for common operations
 */
export const utils = {
  /**
   * Wait for a specified number of milliseconds
   * @param {number} ms - Milliseconds to wait
   * @returns {Promise<void>}
   */
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Retry an async operation with exponential backoff
   * @param {Function} fn - Async function to retry
   * @param {number} maxAttempts - Maximum retry attempts
   * @param {number} baseDelay - Base delay in milliseconds
   * @returns {Promise<any>} Result from successful attempt
   */
  async retry(fn, maxAttempts = 5, baseDelay = 1000) {
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          await this.wait(delay);
        }
      }
    }

    throw lastError;
  },

  /**
   * Check if a URL is reachable
   * @param {string} url - URL to check
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<boolean>} True if reachable
   */
  async isUrlReachable(url, timeout = 5000) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      return false;
    }
  },

  /**
   * Format milliseconds to human-readable duration
   * @param {number} ms - Milliseconds
   * @returns {string} Formatted duration (e.g., "2.5s", "1m 30s")
   */
  formatDuration(ms) {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;

    const minutes = Math.floor(ms / 60000);
    const seconds = Math.round((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  },

  /**
   * Parse duration string to milliseconds
   * @param {string} duration - Duration string (e.g., "5m", "30s")
   * @returns {number} Milliseconds
   */
  parseDuration(duration) {
    const match = duration.match(/^(\d+)([smh])$/);
    if (!match) throw new Error(`Invalid duration format: ${duration}`);

    const [, amount, unit] = match;
    const multipliers = { s: 1000, m: 60000, h: 3600000 };
    return parseInt(amount, 10) * multipliers[unit];
  },

  /**
   * Deep merge objects
   * @param {Object} target - Target object
   * @param {Object} source - Source object to merge
   * @returns {Object} Merged object
   */
  deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (
          typeof source[key] === 'object' &&
          source[key] !== null &&
          !Array.isArray(source[key])
        ) {
          result[key] = this.deepMerge(result[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  },

  /**
   * Validate URL format
   * @param {string} url - URL to validate
   * @returns {boolean} True if valid URL
   */
  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },
};

export default { Logger, utils };
