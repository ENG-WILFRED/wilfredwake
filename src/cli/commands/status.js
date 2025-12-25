/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║           STATUS COMMAND - Check Service Status              ║
 * ║     Queries orchestrator for real-time service states         ║
 * ║     Displays status in table or JSON format                   ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

import axios from 'axios';
import ConfigManager from '../config.js';
import { Logger, utils } from '../../shared/logger.js';
import { colors, format } from '../../shared/colors.js';
import chalk from 'chalk';

const logger = new Logger();

/**
 * Check status of services
 * Defaults to showing all services if none specified
 * Can also filter by specific service or service group
 *
 * @param {string} service - Optional service name to filter (defaults to 'all')
 * @param {Object} options - Command options
 * @param {string} options.env - Environment (dev, staging, prod)
 * @param {string} options.format - Output format (table, json)
 */
export async function statusCommand(service, options) {
  try {
    // ═══════════════════════════════════════════════════════════════
    // LOAD CONFIGURATION
    // ═══════════════════════════════════════════════════════════════
    const configManager = new ConfigManager();
    const config = await configManager.loadConfig();

    const env = options.env || config.environment;
    const outputFormat = options.format || config.preferences.outputFormat;
    // DEFAULT: Show all services if none specified
    const serviceFilter = service || 'all';

    logger.section('Service Status Check');

    // ═══════════════════════════════════════════════════════════════
    // FETCH STATUS FROM ORCHESTRATOR
    // ═══════════════════════════════════════════════════════════════
    let stopSpinner;
    try {
      stopSpinner = logger.spinner('Fetching service status...');

      const response = await axios.get(
        `${config.orchestratorUrl}/api/status`,
        {
          params: {
            environment: env,
            service: serviceFilter !== 'all' ? serviceFilter : undefined,
          },
          timeout: 10000,
        }
      );

      stopSpinner();
      console.log(''); // New line after spinner

      const services = response.data.services || [];

      // ═══════════════════════════════════════════════════════════════
      // DISPLAY RESULTS
      // ═══════════════════════════════════════════════════════════════

      if (outputFormat === 'json') {
        _displayJsonStatus(services);
      } else {
        _displayTableStatus(services, env);
      }

      // ═══════════════════════════════════════════════════════════════
      // SUMMARY STATISTICS
      // ═══════════════════════════════════════════════════════════════
      _displaySummary(services);

      process.exit(0);
    } catch (error) {
      stopSpinner?.();
      throw error;
    }
  } catch (error) {
    logger.error(`Failed to fetch status: ${error.message}`);

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
 * Display status in table format with colors
 * @private
 * @param {Array} services - Services array
 * @param {string} environment - Environment name
 */
function _displayTableStatus(services, environment) {
  if (services.length === 0) {
    logger.info('No services found in registry.');
    return;
  }

  console.log(chalk.cyanBright.bold(`\n📊 Services (${environment.toUpperCase()})\n`));

  // ═══════════════════════════════════════════════════════════════
  // TABLE HEADER
  // ═══════════════════════════════════════════════════════════════
  const headers = ['Service', 'Status', 'Last Woken', 'URL'];
  console.log(format.tableHeader(headers));

  // ═══════════════════════════════════════════════════════════════
  // TABLE ROWS
  // ═══════════════════════════════════════════════════════════════
  services.forEach((service) => {
    const statusColor = colors.status[service.status] || colors.status.unknown;
    const lastWoken = service.lastWakeTime
      ? new Date(service.lastWakeTime).toLocaleString()
      : 'Never';

    const cells = [
      chalk.cyan(service.name.padEnd(20)),
      statusColor(service.status.toUpperCase().padEnd(20)),
      chalk.yellow(lastWoken.padEnd(20)),
      chalk.gray(service.url.substring(0, 20).padEnd(20)),
    ];
    console.log(format.tableRow(cells));
  });

  console.log(''); // Spacing
}

/**
 * Display status in JSON format
 * @private
 * @param {Array} services - Services array
 */
function _displayJsonStatus(services) {
  console.log(JSON.stringify(services, null, 2));
}

/**
 * Display summary statistics
 * @private
 * @param {Array} services - Services array
 */
function _displaySummary(services) {
  if (services.length === 0) return;

  const stats = {
    total: services.length,
    ready: services.filter(s => s.status === 'ready').length,
    sleeping: services.filter(s => s.status === 'sleeping').length,
    waking: services.filter(s => s.status === 'waking').length,
    failed: services.filter(s => s.status === 'failed').length,
  };

  console.log(chalk.magentaBright.bold('Summary'));
  console.log(
    `  ${colors.status.ready('✓')} Ready: ${colors.status.ready(
      stats.ready
    )} | ${colors.status.sleeping('⚫')} Sleeping: ${colors.status.sleeping(
      stats.sleeping
    )} | ${colors.status.waking('⟳')} Waking: ${colors.status.waking(
      stats.waking
    )} | ${colors.status.failed('✗')} Failed: ${colors.status.failed(
      stats.failed
    )}`
  );
  console.log(`  Total: ${stats.total} services\n`);
}
