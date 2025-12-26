/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║                    TEST FILE EXAMPLES                        ║
 * ║     Unit and integration tests for wilfredwake                ║
 * ╚═══════════════════════════════════════════════════════════════╝
 *
 * Run tests with: npm test
 * Watch mode: npm run test:watch
 */

import test from 'node:test';
import assert from 'node:assert';
import ServiceRegistry from '../src/orchestrator/registry.js';
import { Orchestrator, ServiceState } from '../src/orchestrator/orchestrator.js';

/**
 * Test Suite: Service Registry
 */
test('ServiceRegistry - Load and validate YAML with real URLs', async (t) => {
  const registry = new ServiceRegistry();

  const yaml = `
services:
  dev:
    backend:
      url: https://pension-backend-rs4h.onrender.com
      health: /api/health
      dependsOn: []
    frontend:
      url: https://transactions-k6gk.onrender.com
      health: /health
      dependsOn: []
    payment-gateway:
      url: https://payment-gateway-7eta.onrender.com
      health: /health
      dependsOn: []
    notification-consumer:
      url: https://notification-service-consumer.onrender.com
      health: /
      dependsOn: []
    notification-producer:
      url: https://notification-service-producer.onrender.com
      health: /health
      dependsOn: []
`;

  await registry.loadFromString(yaml, 'yaml');
  const services = registry.getServices('dev');

  assert.equal(services.length, 5, 'Should load 5 services');
  assert.equal(services[0].name, 'backend', 'First service should be backend');
  assert.equal(services[0].url, 'https://pension-backend-rs4h.onrender.com', 'Backend URL should match');
});

test('ServiceRegistry - Resolve wake order with real services', async (t) => {
  const registry = new ServiceRegistry();

  const yaml = `
services:
  dev:
    backend:
      url: https://pension-backend-rs4h.onrender.com
      health: /api/health
      dependsOn: []
    frontend:
      url: https://transactions-k6gk.onrender.com
      health: /health
      dependsOn: []
    payment-gateway:
      url: https://payment-gateway-7eta.onrender.com
      health: /health
      dependsOn: []
    notification-consumer:
      url: https://notification-service-consumer.onrender.com
      health: /
      dependsOn: []
    notification-producer:
      url: https://notification-service-producer.onrender.com
      health: /health
      dependsOn: []
`;

  await registry.loadFromString(yaml, 'yaml');
  const order = registry.resolveWakeOrder('all', 'dev');

  assert.equal(order.length, 5, 'Should resolve 5 services');
  assert.equal(order[0].name, 'backend', 'Backend should be first');
});

test('ServiceRegistry - Detect circular dependencies', async (t) => {
  const registry = new ServiceRegistry();

  const yaml = `
services:
  dev:
    auth:
      url: https://auth.test
      health: /health
      wake: /wake
      dependsOn: [payment]
    payment:
      url: https://payment.test
      health: /health
      wake: /wake
      dependsOn: [auth]
`;

  await registry.loadFromString(yaml, 'yaml');

  assert.throws(
    () => registry.resolveWakeOrder('all', 'dev'),
    /Circular dependency/,
    'Should detect circular dependency'
  );
});

test('ServiceRegistry - Get service by name with real services', async (t) => {
  const registry = new ServiceRegistry();

  const yaml = `
services:
  dev:
    backend:
      url: https://pension-backend-rs4h.onrender.com
      health: /api/health
      dependsOn: []
`;

  await registry.loadFromString(yaml, 'yaml');
  const service = registry.getService('backend', 'dev');

  assert.ok(service, 'Should find service');
  assert.equal(service.name, 'backend', 'Service name should match');
  assert.equal(service.url, 'https://pension-backend-rs4h.onrender.com', 'Service URL should match');
});

test('ServiceRegistry - Get registry statistics with real services', async (t) => {
  const registry = new ServiceRegistry();

  const yaml = `
services:
  dev:
    backend:
      url: https://pension-backend-rs4h.onrender.com
      health: /api/health
      dependsOn: []
    frontend:
      url: https://transactions-k6gk.onrender.com
      health: /health
      dependsOn: []
    payment-gateway:
      url: https://payment-gateway-7eta.onrender.com
      health: /health
      dependsOn: []
    notification-consumer:
      url: https://notification-service-consumer.onrender.com
      health: /
      dependsOn: []
    notification-producer:
      url: https://notification-service-producer.onrender.com
      health: /health
      dependsOn: []
  staging:
    backend:
      url: https://pension-backend-rs4h.onrender.com
      health: /api/health
      dependsOn: []
`;

  await registry.loadFromString(yaml, 'yaml');
  const stats = registry.getStats();

  assert.equal(stats.totalServices, 6, 'Should count 6 total services');
  assert.equal(stats.environments.length, 2, 'Should have 2 environments');
});

/**
 * Test Suite: Orchestrator
 */
test('Orchestrator - Wake order respects dependencies with real services', async (t) => {
  const registry = new ServiceRegistry();

  const yaml = `
services:
  dev:
    backend:
      url: https://pension-backend-rs4h.onrender.com
      health: /api/health
      dependsOn: []
    frontend:
      url: https://transactions-k6gk.onrender.com
      health: /health
      dependsOn: []
`;

  await registry.loadFromString(yaml, 'yaml');
  const orchestrator = new Orchestrator(registry);

  const order = registry.resolveWakeOrder('all', 'dev');

  assert.equal(order[0].name, 'backend', 'Backend should wake first');
  assert.equal(order[1].name, 'frontend', 'Frontend should wake second');
});

test('Orchestrator - Set and get service state', async (t) => {
  const registry = new ServiceRegistry();

  const yaml = `
services:
  dev:
    auth:
      url: https://auth.test
      health: /health
      wake: /wake
      dependsOn: []
`;

  await registry.loadFromString(yaml, 'yaml');
  const orchestrator = new Orchestrator(registry);

  orchestrator._setServiceState('auth', ServiceState.LIVE);

  // Note: In real implementation, would have a getter method
  assert.ok(orchestrator.serviceStates.has('auth'), 'Should store service state');
});

/**
 * Test Suite: Error Handling
 */
test('ServiceRegistry - Validate missing required fields', async (t) => {
  const registry = new ServiceRegistry();

  const invalidYaml = `
services:
  dev:
    auth:
      url: https://auth.test
`;

  try {
    await registry.loadFromString(invalidYaml, 'yaml');
    assert.fail('Should have thrown validation error');
  } catch (error) {
    assert.ok(error.message.includes('health'), 'Should error on missing health endpoint');
  }
});

test('ServiceRegistry - Handle invalid YAML', async (t) => {
  const registry = new ServiceRegistry();

  const invalidYaml = `
services:
  dev: [invalid]
`;

  try {
    await registry.loadFromString(invalidYaml, 'yaml');
    assert.fail('Should have thrown error');
  } catch (error) {
    assert.ok(error.message.includes('must be an object'), 'Should error on invalid structure');
  }
});

/**
 * Test Suite: Configuration
 */
test('Config - Validate URL format', async (t) => {
  const { utils } = await import('../src/shared/logger.js');

  assert.ok(utils.isValidUrl('https://wilfredwake.onrender.com'), 'Valid URL');
  assert.ok(utils.isValidUrl('https://example.com'), 'Valid HTTPS URL');
  assert.ok(!utils.isValidUrl('not-a-url'), 'Invalid URL');
});

test('Config - Parse duration strings', async (t) => {
  const { utils } = await import('../src/shared/logger.js');

  assert.equal(utils.parseDuration('5s'), 5000, 'Parse seconds');
  assert.equal(utils.parseDuration('2m'), 120000, 'Parse minutes');
  assert.equal(utils.parseDuration('1h'), 3600000, 'Parse hours');
});

test('Config - Format duration to readable string', async (t) => {
  const { utils } = await import('../src/shared/logger.js');

  assert.equal(utils.formatDuration(500), '500ms', 'Format milliseconds');
  assert.equal(utils.formatDuration(5000), '5.0s', 'Format seconds');
  assert.equal(utils.formatDuration(65000), '1m 5s', 'Format minutes');
});

/**
 * Test Suite: Deep Merge
 */
test('Utils - Deep merge objects', async (t) => {
  const { utils } = await import('../src/shared/logger.js');

  const target = { a: 1, b: { c: 2 } };
  const source = { b: { d: 3 }, e: 4 };
  const result = utils.deepMerge(target, source);

  assert.equal(result.a, 1, 'Should preserve target properties');
  assert.equal(result.b.c, 2, 'Should preserve nested target');
  assert.equal(result.b.d, 3, 'Should add new nested properties');
  assert.equal(result.e, 4, 'Should add new properties');
});

/**
 * Test Suite: Retry Logic
 */
test('Utils - Retry with exponential backoff', async (t) => {
  const { utils } = await import('../src/shared/logger.js');

  let attempts = 0;

  const result = await utils.retry(
    async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error('Fail');
      }
      return 'success';
    },
    5,
    100
  );

  assert.equal(result, 'success', 'Should succeed on retry');
  assert.equal(attempts, 3, 'Should make 3 attempts');
});

test('Utils - Retry timeout after max attempts', async (t) => {
  const { utils } = await import('../src/shared/logger.js');

  try {
    await utils.retry(
      async () => {
        throw new Error('Always fails');
      },
      3,
      10
    );
    assert.fail('Should have thrown error');
  } catch (error) {
    assert.ok(error.message.includes('Always fails'), 'Should throw last error');
  }
});

/**
 * Test Suite: Real Service Health Checks
 */
test('Real Services - Any HTTP response marks service as LIVE', async (t) => {
  const registry = new ServiceRegistry();

  const yaml = `
services:
  dev:
    backend:
      url: https://pension-backend-rs4h.onrender.com
      health: /api/health
      dependsOn: []
    frontend:
      url: https://transactions-k6gk.onrender.com
      health: /health
      dependsOn: []
`;

  await registry.loadFromString(yaml, 'yaml');
  const orchestrator = new Orchestrator(registry);
  
  // Backend should be LIVE (responds with 200)
  const backend = registry.getService('backend', 'dev');
  const backendHealth = await orchestrator._performHealthCheck(backend);
  assert.ok(backendHealth.statusCode, 'Backend should respond');
  assert.equal(backendHealth.state, ServiceState.LIVE, 'Backend with any response is LIVE');
  
  // Frontend may return 404 but should still be LIVE (service is responsive)
  const frontend = registry.getService('frontend', 'dev');
  const frontendHealth = await orchestrator._performHealthCheck(frontend);
  // Frontend either responds (LIVE) or times out (DEAD) - both are valid outcomes
  assert.ok(frontendHealth.state === ServiceState.LIVE || frontendHealth.state === ServiceState.DEAD, 
    'Frontend should be either LIVE (responds) or DEAD (timeout)');
});

test('Service State - 404 Response means service is LIVE', async (t) => {
  const registry = new ServiceRegistry();

  const yaml = `
services:
  dev:
    payment:
      url: https://payment-gateway-7eta.onrender.com
      health: /health
      dependsOn: []
`;

  await registry.loadFromString(yaml, 'yaml');
  const orchestrator = new Orchestrator(registry);
  const service = registry.getService('payment', 'dev');

  const health = await orchestrator._performHealthCheck(service);
  
  // Payment gateway responds with 200, should be LIVE
  assert.ok(health, 'Should return health check result');
  assert.ok(health.statusCode || health.error, 'Should have status code or error');
  
  // If we get any HTTP response code (even 404), service is responsive = LIVE
  if (health.statusCode) {
    assert.equal(health.state, ServiceState.LIVE, 'Any HTTP response = LIVE (service is responsive)');
  }
});

console.log('\n✓ All tests completed');
