#!/usr/bin/env node

/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║                                                               ║
 * ║   WILFREDWAKE - CLI TOOL FOR SERVICE ORCHESTRATION           ║
 * ║   Multi-Developer Development Environment Management          ║
 * ║                                                               ║
 * ║   Entry Point: Main CLI executable with command routing      ║
 * ║   Uses Commander.js for robust command-line interface        ║
 * ║                                                               ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import { initCommand } from '../src/cli/commands/init.js';
import { statusCommand } from '../src/cli/commands/status.js';
import { wakeCommand } from '../src/cli/commands/wake.js';
import { healthCommand } from '../src/cli/commands/health.js';

// ═══════════════════════════════════════════════════════════════
// MAIN CLI SETUP
// ═══════════════════════════════════════════════════════════════

const program = new Command();

program
  .name('wilfredwake')
  .description(
    chalk.cyan('🌅 CLI Tool for Multi-Developer Development Environment Wake & Status Management')
  )
  .version(
    (() => {
      try {
        const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url)));
        return pkg.version || '0.0.0';
      } catch (e) {
        return '0.0.0';
      }
    })()
  )
  .usage(chalk.yellow('[command] [options]'));

// ═══════════════════════════════════════════════════════════════
// COMMAND REGISTRATION
// ═══════════════════════════════════════════════════════════════

/**
 * INIT COMMAND
 * Initializes wilfredwake configuration on first-time setup
 * Sets up ~/.wilfredwake directory and config.json
 */
program
  .command('init')
  .description(
    chalk.magenta('Initialize wilfredwake configuration (first-time setup)')
  )
  .option('-o, --orchestrator <url>', 'Orchestrator URL', 'https://wilfredwake.onrender.com')
  .option('-t, --token <token>', 'Developer API token')
  .action(initCommand);

/**
 * STATUS COMMAND
 * Displays current status of all services
 * Connects to orchestrator for real-time state
 */
program
  .command('status [service]')
  .description(chalk.green('Check status of all services or a specific service'))
  .option('-e, --env <environment>', 'Environment (dev, staging, prod)')
  .option('-f, --format <format>', 'Output format (table, json)', 'table')
  .action(statusCommand);

/**
 * WAKE COMMAND
 * Wakes services on demand with dependency ordering
 * Defaults to all services if no target specified
 * Supports waking individual services, groups, or all services
 */
program
  .command('wake [target]')
  .description(chalk.blue('Wake services on demand (all, <service>, or <group>)'))
  .option('-e, --env <environment>', 'Environment (dev, staging, prod)')
  .option('--no-wait', 'Don\'t wait for services to be ready')
  .option('--timeout <seconds>', 'Timeout for service readiness', '300')
  .action(wakeCommand);

/**
 * HEALTH COMMAND
 * Performs health check on services without waking
 * Useful for monitoring and diagnostics
 */
program
  .command('health [service]')
  .description(chalk.cyan('Check health status of services'))
  .option('-e, --env <environment>', 'Environment (dev, staging, prod)')
  .action(healthCommand);

// ═══════════════════════════════════════════════════════════════
// HELP & ERROR HANDLING
// ═══════════════════════════════════════════════════════════════

// Default help message with visual enhancements
program.on('--help', () => {
  console.log('');
  console.log(chalk.dim('Examples:'));
  console.log(chalk.yellow('  $ wilfredwake init                  # Setup configuration'));
  console.log(chalk.yellow('  $ wilfredwake status                # Check all services'));
  console.log(chalk.yellow('  $ wilfredwake wake all              # Wake all services'));
  console.log(chalk.yellow('  $ wilfredwake wake auth             # Wake single service'));
  console.log(chalk.yellow('  $ wilfredwake health                # Check health'));
  console.log('');
  console.log(
    chalk.dim(
      'For more information, visit: https://github.com/wilfred/wilfredwake'
    )
  );
  console.log('');
});

// Error handling for unknown commands
program.on('command:*', () => {
  console.error(
    chalk.red(
      '\n❌ Invalid command. Use --help for available commands.\n'
    )
  );
  process.exit(1);
});

// ═══════════════════════════════════════════════════════════════
// CLI EXECUTION
// ═══════════════════════════════════════════════════════════════

// Parse command-line arguments and execute
program.parse(process.argv);

// Show help if no command provided
if (process.argv.length < 3) {
  program.outputHelp();
}
