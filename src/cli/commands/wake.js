/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║           WAKE COMMAND - Wake Services On Demand              ║
 * ║     Initiates service wake with dependency ordering           ║
 * ║     Polls health checks until ready or timeout                ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

import axios from 'axios';
import ConfigManager from '../config.js';
import { Logger, utils } from '../../shared/logger.js';
import { colors, format } from '../../shared/colors.js';
import chalk from 'chalk';

const logger = new Logger();

/**
 * Wake services on demand
 * Defaults to waking all services if none specified
 * Can also wake specific service or service group
 * Respects dependency order and waits for readiness
 *
 * @param {string} target - Wake target (defaults to 'all', or <service>, or <group>)
 * @param {Object} options - Command options
 * @param {string} options.env - Environment (dev, staging, prod)
 * @param {boolean} options.wait - Wait for services to be ready
 * @param {string} options.timeout - Timeout in seconds
 */
export async function wakeCommand(target, options) {
  try {
    // ═══════════════════════════════════════════════════════════════
    // LOAD CONFIGURATION
    // ═══════════════════════════════════════════════════════════════
    const configManager = new ConfigManager();
    const config = await configManager.loadConfig();

    const env = options.env || config.environment;
    const shouldWait = options.wait !== false;
    const timeout = parseInt(options.timeout || config.preferences.timeout);
    // DEFAULT: Wake all services if none specified
    const wakeTarget = target || 'all';

    logger.section('Service Wake Request');

    logger.info(
      `Waking ${chalk.cyan(wakeTarget)} in ${chalk.yellow(env)} environment...`
    );

    // ═══════════════════════════════════════════════════════════════
    // SEND WAKE REQUEST TO ORCHESTRATOR
    // ═══════════════════════════════════════════════════════════════
    let stopSpinner;
    try {
      stopSpinner = logger.spinner(
        `Sending wake request for ${chalk.cyan(wakeTarget)}...`
      );

      const response = await axios.post(
        `${config.orchestratorUrl}/api/wake`,
        {
          target: wakeTarget,
          environment: env,
          wait: shouldWait,
          timeout,
        },
        {
          timeout: (timeout + 10) * 1000,
          headers: {
            Authorization: config.token ? `Bearer ${config.token}` : undefined,
          },
        }
      );

      stopSpinner();
      console.log(''); // New line after spinner

      // ═══════════════════════════════════════════════════════════════
      // PROCESS WAKE RESPONSE
      // ═══════════════════════════════════════════════════════════════
      const results = response.data;

      _displayWakeResults(results);

      // ═══════════════════════════════════════════════════════════════
      // DISPLAY FINAL STATUS
      // ═══════════════════════════════════════════════════════════════
      if (shouldWait) {
        _displayFinalStatus(results);
      }

      process.exit(results.success ? 0 : 1);
    } catch (error) {
      stopSpinner?.();
      throw error;
    }
  } catch (error) {
    if (error.response?.status === 404) {
      logger.error(`Service not found: ${error.response.data.message}`);
    } else if (error.code === 'ECONNREFUSED') {
      logger.error('Could not connect to orchestrator. Is it running?');
      console.log(chalk.dim('Run: wilfredwake init'));
    } else {
      logger.error(`Wake request failed: ${error.message}`);
    }

    process.exit(1);
  }
}

/**
 * Display wake operation results
 * @private
 * @param {Object} results - Wake results from orchestrator
 */
function _displayWakeResults(results) {
  console.log(chalk.cyanBright.bold('\n🌅 Wake Operation Results\n'));

  if (!results.services || results.services.length === 0) {
    logger.info('No services to wake.');
    return;
  }

  // ═══════════════════════════════════════════════════════════════
  // SERVICE WAKE TIMELINE
  // ═══════════════════════════════════════════════════════════════
  console.log(chalk.cyan('Timeline:'));

  results.services.forEach((service, index) => {
    const duration = service.duration
      ? ` (${utils.formatDuration(service.duration)})`
      : '';

    let statusIndicator;
    if (service.status === 'live') {
      statusIndicator = chalk.greenBright('✓');
    } else if (service.status === 'failed') {
      statusIndicator = chalk.redBright('✗');
    } else {
      statusIndicator = chalk.yellowBright('⟳');
    }

    const arrow = index < results.services.length - 1 ? '│' : '└';
    console.log(
      `  ${chalk.dim(arrow)} ${statusIndicator} ${chalk.cyan(
        service.name
      )}${chalk.yellow(duration)}`
    );

    if (service.error) {
      console.log(`    ${chalk.redBright(`Error: ${service.error}`)}`);
    }
  });

  console.log('');
}

/**
 * Display final status summary
 * @private
 * @param {Object} results - Wake results from orchestrator
 */
function _displayFinalStatus(results) {
  const succeeded = results.services.filter(s => s.status === 'live').length;
  const failed = results.services.filter(s => s.status === 'failed').length;
  const totalTime = utils.formatDuration(results.totalDuration || 0);

  console.log(chalk.magentaBright.bold('✓ Wake Complete\n'));

  console.log(`  ${colors.status.live('✓')} Live: ${colors.status.live(succeeded)}`);
  if (failed > 0) {
    console.log(`  ${colors.status.failed('✗')} Failed: ${colors.status.failed(failed)}`);
  }
  console.log(`  ${chalk.yellow('⏱')} Total Time: ${chalk.yellow(totalTime)}\n`);

  if (results.success) {
    logger.success('All services are live!');
  } else {
    logger.warn('Some services failed to wake. Check errors above.');
  }

  console.log('');
}
