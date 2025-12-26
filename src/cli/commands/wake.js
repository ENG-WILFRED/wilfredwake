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
      // DISPLAY FINAL STATUS AND START MONITORING
      // ═══════════════════════════════════════════════════════════════
      if (shouldWait) {
        _displayFinalStatus(results);
        
        // Start 5-minute monitoring period
        await _monitorServicesForDuration(
          config.orchestratorUrl,
          config.token,
          env,
          wakeTarget,
          5 * 60 * 1000 // 5 minutes in milliseconds
        );
      }

      process.exit(0);
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

/**
 * Monitor services for a duration and display live status updates
 * @private
 * @param {string} orchestratorUrl - Orchestrator URL
 * @param {string} token - Authorization token
 * @param {string} env - Environment name
 * @param {string} wakeTarget - Wake target (all, <service>, or <group>)
 * @param {number} duration - Duration in milliseconds
 */
async function _monitorServicesForDuration(
  orchestratorUrl,
  token,
  env,
  wakeTarget,
  duration
) {
  const pollInterval = 10000; // Poll every 10 seconds
  const startTime = Date.now();
  const endTime = startTime + duration;
  let pollCount = 0;

  console.log(
    chalk.magentaBright.bold(
      `📡 Monitoring services for ${Math.round(duration / 1000)}s...\n`
    )
  );

  while (Date.now() < endTime) {
    pollCount++;
    const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
    
    try {
      // Fetch current status from orchestrator
      const response = await axios.get(
        `${orchestratorUrl}/api/status`,
        {
          params: {
            environment: env,
          },
          timeout: 5000,
          headers: {
            Authorization: token ? `Bearer ${token}` : undefined,
          },
        }
      );

      const services = response.data.services || [];

      // Clear screen and display updated status
      console.clear();
      console.log(chalk.cyanBright.bold('📡 Live Service Monitoring\n'));
      console.log(
        chalk.gray(`Elapsed: ${chalk.yellow(elapsedSeconds)}s / ${Math.round(duration / 1000)}s | Poll #${pollCount}\n`)
      );

      // Display table with current status
      _displayLiveMonitoringTable(services, env);

      // Display summary stats
      _displayLiveMonitoringSummary(services);
    } catch (error) {
      console.clear();
      console.log(chalk.cyanBright.bold('📡 Live Service Monitoring\n'));
      console.log(
        chalk.gray(`Elapsed: ${chalk.yellow(elapsedSeconds)}s / ${Math.round(duration / 1000)}s | Poll #${pollCount}\n`)
      );
      logger.warn(`Status check failed: ${error.message}`);
    }

    // Wait before next poll (unless we're at the end)
    if (Date.now() < endTime) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }

  // Final summary
  console.clear();
  console.log(chalk.cyanBright.bold('📡 Monitoring Complete\n'));
  console.log(chalk.yellow(`Total monitoring duration: ${Math.round(duration / 1000)}s\n`));

  try {
    // Fetch final status
    const response = await axios.get(
      `${orchestratorUrl}/api/status`,
      {
        params: {
          environment: env,
        },
        timeout: 5000,
        headers: {
          Authorization: token ? `Bearer ${token}` : undefined,
        },
      }
    );

    const services = response.data.services || [];
    _displayLiveMonitoringTable(services, env);
    _displayLiveMonitoringSummary(services);
  } catch (error) {
    logger.warn(`Could not fetch final status: ${error.message}`);
  }

  console.log('');
}

/**
 * Display live monitoring status table
 * @private
 * @param {Array} services - Services array
 * @param {string} environment - Environment name
 */
function _displayLiveMonitoringTable(services, environment) {
  if (services.length === 0) {
    logger.info('No services to display.');
    return;
  }

  console.log(chalk.cyanBright.bold(`Services (${environment.toUpperCase()})\n`));

  const headers = ['Service', 'Status', 'Last Woken', 'URL'];
  console.log(format.tableHeader(headers));

  services.forEach((service) => {
    const statusColor = colors.status[service.status] || colors.status.unknown;
    const lastWoken = service.lastWakeTime
      ? new Date(service.lastWakeTime).toLocaleString()
      : 'Never';
    const cells = [
      chalk.cyan(service.name.padEnd(20)),
      statusColor(service.status.toUpperCase().padEnd(20)),
      chalk.yellow(lastWoken.padEnd(20)),
      chalk.gray((service.url || '').substring(0, 20).padEnd(20)),
    ];
    console.log(format.tableRow(cells));
    console.log('');
  });

  console.log('');
}

/**
 * Display live monitoring summary stats
 * @private
 * @param {Array} services - Services array
 */
function _displayLiveMonitoringSummary(services) {
  if (services.length === 0) return;

  const stats = {
    total: services.length,
    live: services.filter(s => s.status === 'live').length,
    dead: services.filter(s => s.status === 'dead').length,
    waking: services.filter(s => s.status === 'waking').length,
    failed: services.filter(s => s.status === 'failed').length,
    unknown: services.filter(s => s.status === 'unknown').length,
  };

  console.log(chalk.magentaBright.bold('Summary'));
  console.log(
    `  ${colors.status.live('✓')} Live: ${colors.status.live(stats.live)} | ${colors.status.dead('⚫')} Dead: ${colors.status.dead(stats.dead)} | ${colors.status.waking('⟳')} Waking: ${colors.status.waking(stats.waking)} | ${colors.status.failed('✗')} Failed: ${colors.status.failed(stats.failed)} | ${colors.status.unknown('?')} Unknown: ${colors.status.unknown(stats.unknown)}`
  );
  console.log(`  Total: ${stats.total} services\n`);
}
