/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║              INIT COMMAND - First-Time Setup                  ║
 * ║     Guides user through configuration initialization           ║
 * ║     Sets orchestrator URL and API token                       ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

import readline from 'readline';
import chalk from 'chalk';
import ConfigManager from '../config.js';
import { Logger, utils } from '../../shared/logger.js';
import { format } from '../../shared/colors.js';

const logger = new Logger();

/**
 * Initialize wilfredwake configuration
 * Prompts user for orchestrator URL and API token
 * Creates ~/.wilfredwake/config.json
 *
 * @param {Object} options - Command options
 * @param {string} options.orchestrator - Orchestrator URL
 * @param {string} options.token - API token
 */
export async function initCommand(options) {
  try {
    // ═══════════════════════════════════════════════════════════════
    // INITIALIZATION HEADER
    // ═══════════════════════════════════════════════════════════════
    console.log('\n' + chalk.cyanBright.bold('╔════════════════════════════════════╗'));
    console.log(chalk.cyanBright.bold('║  WILFREDWAKE INITIALIZATION WIZARD  ║'));
    console.log(chalk.cyanBright.bold('╚════════════════════════════════════╝\n'));

    logger.info('Welcome to wilfredwake! Let\'s set up your environment.');

    const configManager = new ConfigManager();
    await configManager.init();

    // ═══════════════════════════════════════════════════════════════
    // GATHER CONFIGURATION DETAILS
    // ═══════════════════════════════════════════════════════════════

    const answers = await _promptForConfig(options);

    logger.section('Validating Configuration');

    // ═══════════════════════════════════════════════════════════════
    // VALIDATE ORCHESTRATOR URL
    // ═══════════════════════════════════════════════════════════════
    process.stdout.write(
      chalk.dim(`Validating orchestrator at ${answers.orchestrator}... `)
    );

    const isReachable = await utils.isUrlReachable(
      `${answers.orchestrator}/health`,
      5000
    );

    if (isReachable) {
      logger.success('Orchestrator is reachable!');
    } else {
      logger.warn(
        `Could not reach orchestrator. Make sure it's running at ${answers.orchestrator}`
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // SAVE CONFIGURATION
    // ═══════════════════════════════════════════════════════════════
    logger.section('Saving Configuration');

    const config = await configManager.loadConfig();
    config.orchestratorUrl = answers.orchestrator;
    if (answers.token) {
      config.token = answers.token;
    }
    config.environment = answers.environment;

    await configManager.saveConfig(config);

    logger.success(`Configuration saved to ${configManager.configFile}`);

    // ═══════════════════════════════════════════════════════════════
    // COMPLETION MESSAGE
    // ═══════════════════════════════════════════════════════════════
    console.log('\n' + chalk.greenBright.bold('✓ Setup Complete!\n'));

    console.log(chalk.cyan('Configuration Summary:'));
    console.log(chalk.dim(`  • Orchestrator: ${answers.orchestrator}`));
    console.log(chalk.dim(`  • Environment: ${answers.environment}`));
    if (answers.token) {
      console.log(chalk.dim(`  • Token: ${answers.token.substring(0, 10)}...`));
    }
    console.log('');

    console.log(chalk.cyan('Next steps:'));
    console.log(chalk.yellow('  $ wilfredwake status                # Check service status'));
    console.log(chalk.yellow('  $ wilfredwake wake all              # Wake all services'));
    console.log(chalk.yellow('  $ wilfredwake --help                # View all commands\n'));

    process.exit(0);
  } catch (error) {
    logger.error(`Initialization failed: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Prompt user for configuration values
 * @private
 * @param {Object} options - Pre-provided options
 * @returns {Promise<Object>} User answers
 */
async function _promptForConfig(options) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (query) =>
    new Promise((resolve) => {
      rl.question(chalk.blueBright(`? ${query}`), resolve);
    });

  try {
    // ═══════════════════════════════════════════════════════════════
    // ORCHESTRATOR URL
    // ═══════════════════════════════════════════════════════════════
    let orchestrator = options.orchestrator;

    if (!orchestrator) {
      console.log(
        chalk.dim(
          '\nFirst, we need the URL of your orchestrator service.'
        )
      );
      console.log(
        chalk.dim(
          'This is the always-on backend that manages your services.'
        )
      );
      console.log('');

      orchestrator = await question(
        `Orchestrator URL ${chalk.gray('(default: https://wilfredwake.onrender.com)')} `
      );
      orchestrator = orchestrator || 'https://wilfredwake.onrender.com';
    }

    // Validate URL format
    if (!utils.isValidUrl(orchestrator)) {
      throw new Error(`Invalid URL format: ${orchestrator}`);
    }

    // ═══════════════════════════════════════════════════════════════
    // ENVIRONMENT SELECTION
    // ═══════════════════════════════════════════════════════════════
    console.log('');
    const envOptions = ['dev', 'staging', 'prod'];
    let environment = 'dev';

    console.log(chalk.dim('Select your working environment:'));
    envOptions.forEach((env, idx) => {
      console.log(chalk.gray(`  ${idx + 1}. ${env}`));
    });

    const envChoice = await question('Environment (1-3, default: 1) ');
    const envIdx = parseInt(envChoice || '1') - 1;

    if (envIdx >= 0 && envIdx < envOptions.length) {
      environment = envOptions[envIdx];
    }

    // ═══════════════════════════════════════════════════════════════
    // API TOKEN (Optional)
    // ═══════════════════════════════════════════════════════════════
    console.log('');
    const token = options.token ||
      (await question(
        `API Token ${chalk.gray('(optional, press Enter to skip)')} `
      ));

    return {
      orchestrator: orchestrator.trim(),
      token: token ? token.trim() : null,
      environment,
    };
  } finally {
    rl.close();
  }
}
