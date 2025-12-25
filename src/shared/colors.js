/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║                      COLORS & THEMES MODULE                   ║
 * ║     Provides consistent color scheme for CLI output           ║
 * ║     Uses chalk for terminal color support                    ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

import chalk from 'chalk';

/**
 * Color scheme definitions
 * Each color is assigned a semantic meaning for consistent UX
 */
export const colors = {
  // ═══════════════════════════════════════════════════════════════
  // STATUS INDICATORS - Service states with visual distinction
  // ═══════════════════════════════════════════════════════════════
  status: {
    // New architecture states
    live: chalk.greenBright,            // ✓ Service is responsive and healthy
    dead: chalk.gray,                   // ⚫ Service is not responding/dormant
    waking: chalk.yellowBright,         // ⟳ Service is responding slowly
    failed: chalk.redBright,            // ✗ Service failed to respond
    unknown: chalk.magentaBright,       // ? Unknown state
    
    // Legacy states (for backwards compatibility)
    ready: chalk.greenBright,           // ✓ Service is running and healthy
    sleeping: chalk.gray,               // ⚫ Service is in sleep/cold state
    pending: chalk.blueBright,          // ⏳ Service is pending action
    error: chalk.red,                   // ⚠️ Error occurred
  },

  // ═══════════════════════════════════════════════════════════════
  // ACTION MESSAGES - Operation feedback
  // ═══════════════════════════════════════════════════════════════
  action: {
    success: chalk.greenBright,         // Operation completed successfully
    warning: chalk.yellowBright,        // Warning/caution message
    info: chalk.cyanBright,             // Informational message
    debug: chalk.gray,                  // Debug/verbose output
    prompt: chalk.blueBright,           // User input prompt
  },

  // ═══════════════════════════════════════════════════════════════
  // EMPHASIS - UI elements and emphasis
  // ═══════════════════════════════════════════════════════════════
  emphasis: {
    primary: chalk.cyan,                // Primary/main heading
    secondary: chalk.magenta,           // Secondary heading
    accent: chalk.yellow,               // Accent elements
    muted: chalk.gray,                  // Muted/secondary text
    highlight: chalk.inverse,           // Highlighted text
  },

  // ═══════════════════════════════════════════════════════════════
  // SPECIAL MARKERS - Icons and visual elements
  // ═══════════════════════════════════════════════════════════════
  markers: {
    success: chalk.greenBright('✓'),
    error: chalk.redBright('✗'),
    warning: chalk.yellowBright('⚠'),
    info: chalk.cyanBright('ℹ'),
    arrow: chalk.dim('→'),
    bullet: chalk.dim('•'),
    spinner: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  },
};

/**
 * Formatting utilities for structured output
 */
export const format = {
  /**
   * Format a service status line with color coding
   * @param {string} serviceName - Name of the service
   * @param {string} status - Current status (ready, sleeping, waking, etc)
   * @param {string} message - Optional message to display
   * @returns {string} Formatted status line
   */
  serviceStatus(serviceName, status, message = '') {
    const statusColor = colors.status[status] || colors.status.unknown;
    const statusText = statusColor(status.toUpperCase().padEnd(10));
    const msgText = message ? ` ${colors.emphasis.muted(`(${message})`)}` : '';
    return `  ${statusText} ${chalk.cyan(serviceName)}${msgText}`;
  },

  /**
   * Format a table header row
   * @param {string[]} columns - Column names
   * @returns {string} Formatted header
   */
  tableHeader(columns) {
    return chalk.inverse(
      ' ' + columns.map(col => col.padEnd(20)).join(' ') + ' '
    );
  },

  /**
   * Format a table row
   * @param {string[]} cells - Cell values
   * @returns {string} Formatted row
   */
  tableRow(cells) {
    return '  ' + cells.map(cell => cell.padEnd(20)).join(' ');
  },

  /**
   * Format a section header
   * @param {string} title - Section title
   * @returns {string} Formatted header
   */
  section(title) {
    return chalk.cyanBright.bold(`\n▶ ${title}\n`);
  },

  /**
   * Format a success message
   * @param {string} message - Message text
   * @returns {string} Formatted message
   */
  success(message) {
    return `${colors.markers.success} ${chalk.greenBright(message)}`;
  },

  /**
   * Format an error message
   * @param {string} message - Message text
   * @returns {string} Formatted message
   */
  error(message) {
    return `${colors.markers.error} ${chalk.redBright(message)}`;
  },

  /**
   * Format an info message
   * @param {string} message - Message text
   * @returns {string} Formatted message
   */
  info(message) {
    return `${colors.markers.info} ${chalk.cyanBright(message)}`;
  },

  /**
   * Format a warning message
   * @param {string} message - Message text
   * @returns {string} Formatted message
   */
  warning(message) {
    return `${colors.markers.warning} ${chalk.yellowBright(message)}`;
  },
};

export default { colors, format };
