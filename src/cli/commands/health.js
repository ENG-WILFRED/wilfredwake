/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║          HEALTH COMMAND - Check Service Health                ║
 * ║     Performs health checks without waking services            ║
 * ║     Useful for monitoring and diagnostics                     ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

import axios from 'axios';
import ConfigManager from '../config.js';
import { Logger, utils } from '../../shared/logger.js';
import { colors, format } from '../../shared/colors.js';
import chalk from 'chalk';

const logger = new Logger();

/**
 * Check health status of services
 * Does NOT wake services, only checks their current health
 *
 * @param {string} service - Optional service name to check
 * @param {Object} options - Command options
 * @param {string} options.env - Environment (dev, staging, prod)
 */
export async function healthCommand(service, options) {
  try {
    // ═══════════════════════════════════════════════════════════════
    // LOAD CONFIGURATION
    // ═══════════════════════════════════════════════════════════════
    const configManager = new ConfigManager();
    const config = await configManager.loadConfig();

    const env = options.env || config.environment;

    logger.section('Service Health Check');

    // ═══════════════════════════════════════════════════════════════
    // FETCH HEALTH FROM ORCHESTRATOR
    // ═══════════════════════════════════════════════════════════════
    let stopSpinner;
    try {
      stopSpinner = logger.spinner('Checking service health...');

      const response = await axios.get(
        `${config.orchestratorUrl}/api/health`,
        {
          params: {
            environment: env,
            service: service || undefined,
          },
          timeout: 15000,
        }
      );

      stopSpinner();
      console.log(''); // New line after spinner

      const services = response.data.services || [];
      const timestamp = response.data.timestamp || new Date().toISOString();

      // ═══════════════════════════════════════════════════════════════
      // DISPLAY HEALTH RESULTS
      // ═══════════════════════════════════════════════════════════════
      _displayHealthStatus(services, env, timestamp);

      // ═══════════════════════════════════════════════════════════════
      // HEALTH SUMMARY
      // ═══════════════════════════════════════════════════════════════
      _displayHealthSummary(services);

      process.exit(0);
    } catch (error) {
      stopSpinner?.();
      throw error;
    }
  } catch (error) {
    logger.error(`Health check failed: ${error.message}`);

    if (error.code === 'ECONNREFUSED') {
      console.log(
        chalk.yellowBright(
          '\n⚠ Could not connect to orchestrator. Make sure it\'s running.'
        )
      );
      console.log(chalk.dim('Run: wilfredwake init'));
    }

    process.exit(1);
  }
}

/**
 * Display detailed health status
 * @private
 * @param {Array} services - Services health data
 * @param {string} environment - Environment name
 * @param {string} timestamp - Check timestamp
 */
function _displayHealthStatus(services, environment, timestamp) {
  if (services.length === 0) {
    logger.info('No services found in registry.');
    return;
  }

  console.log(chalk.cyanBright.bold(`\n💓 Health Status (${environment.toUpperCase()})\n`));
  console.log(chalk.gray(`Last checked: ${new Date(timestamp).toLocaleString()}\n`));

  // ═══════════════════════════════════════════════════════════════
  // DISPLAY EACH SERVICE'S HEALTH
  // ═══════════════════════════════════════════════════════════════
  services.forEach((service) => {
    const statusEmoji = _getHealthEmoji(service.status);
    const statusColor = colors.status[service.status] || colors.status.unknown;

    // Service header
    console.log(
      `${statusEmoji} ${statusColor.bold(service.name)} ${chalk.gray(
        `(${service.status})`
      )}`
    );

    // Service details
    if (service.url) {
      console.log(
        chalk.dim(`   URL: ${service.url}`)
      );
    }

    if (service.responseTime) {
      const timeColor =
        service.responseTime > 1000 ? chalk.yellow : chalk.green;
      console.log(
        chalk.dim(`   Response time: ${timeColor(
          `${service.responseTime}ms`
        )}`)
      );
    }

    if (service.lastWakeTime) {
      const lastWake = new Date(service.lastWakeTime).toLocaleString();
      console.log(chalk.dim(`   Last woken: ${lastWake}`));
    }

    if (service.lastChecked) {
      const lastCheck = new Date(service.lastChecked).toLocaleTimeString();
      console.log(chalk.dim(`   Last checked: ${lastCheck}`));
    }

    if (service.statusCode) {
      const codeColor =
        service.statusCode < 300 ? chalk.green :
        service.statusCode < 400 ? chalk.yellow :
        chalk.red;
      console.log(
        chalk.dim(`   Status code: ${codeColor(service.statusCode)}`)
      );
    }

    if (service.error) {
      console.log(chalk.redBright(`   Error: ${service.error}`));
    }

    if (service.dependencies && service.dependencies.length > 0) {
      console.log(
        chalk.dim(`   Dependencies: ${service.dependencies.join(', ')}`)
      );
    }

    console.log(''); // Spacing
  });
}

/**
 * Display health summary statistics
 * @private
 * @param {Array} services - Services health data
 */
function _displayHealthSummary(services) {
  if (services.length === 0) return;

  const stats = {
    total: services.length,
    live: services.filter(s => s.status === 'live').length,
    waking: services.filter(s => s.status === 'waking').length,
    dead: services.filter(s => s.status === 'dead').length,
    failed: services.filter(s => s.status === 'failed').length,
    unknown: services.filter(s => s.status === 'unknown').length,
  };

  console.log(chalk.magentaBright.bold('Summary'));
  console.log(`  Total services: ${stats.total}`);
  console.log(`  ${chalk.greenBright('✓')} Live: ${chalk.greenBright(
    stats.live
  )}`);
  if (stats.waking > 0) {
    console.log(`  ${chalk.yellowBright('⟳')} Waking: ${chalk.yellowBright(
      stats.waking
    )}`);
  }
  if (stats.dead > 0) {
    console.log(`  ${chalk.gray('⚫')} Dead: ${chalk.gray(
      stats.dead
    )}`);
  }
  if (stats.failed > 0) {
    console.log(`  ${chalk.redBright('✗')} Failed: ${chalk.redBright(
      stats.failed
    )}`);
  }
  if (stats.unknown > 0) {
    console.log(`  ${chalk.magentaBright('?')} Unknown: ${chalk.magentaBright(
      stats.unknown
    )}`);
  }
  console.log('');
}

/**
 * Get emoji for health status
 * @private
 * @param {string} status - Service status
 * @returns {string} Emoji character
 */
function _getHealthEmoji(status) {
  const emojis = {
    live: '💚',
    dead: '😴',
    waking: '🌅',
    failed: '❌',
    unknown: '❓',
    // Backward compatibility
    ready: '💚',
    sleeping: '😴',
    pending: '⏳',
  };

  return emojis[status] || '❓';
}
