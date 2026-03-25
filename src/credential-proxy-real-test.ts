#!/usr/bin/env tsx
/**
 * Real API connectivity test for credential-proxy.
 *
 * This script:
 * 1. Starts the credential-proxy server
 * 2. Sends a "你好" message through the proxy
 * 3. Verifies the API returns a 200 response
 *
 * Usage: npx tsx src/credential-proxy-real-test.ts
 */

import http from 'http';
import { startCredentialProxy } from './credential-proxy.js';
import { readEnvFile } from './env.js';

// Load real environment variables from .env
const secrets = readEnvFile([
  'ANTHROPIC_API_KEY',
  'CLAUDE_CODE_OAUTH_TOKEN',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_MODEL',
]);

console.log('=== Credential Proxy Real API Test ===\n');
console.log('Configuration:');
console.log(
  `  Base URL: ${secrets.ANTHROPIC_BASE_URL || 'default (https://api.anthropic.com)'}`,
);
console.log(
  `  Model: ${secrets.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20251101'}`,
);
console.log(
  `  API Key: ${secrets.ANTHROPIC_API_KEY ? 'configured' : 'not set'}`,
);
console.log(
  `  OAuth Token: ${secrets.ANTHROPIC_AUTH_TOKEN ? 'configured' : 'not set'}`,
);
console.log('');

// Validate required configuration
if (!secrets.ANTHROPIC_API_KEY && !secrets.ANTHROPIC_AUTH_TOKEN) {
  console.error('ERROR: No credentials configured');
  console.error('  Set ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN in .env');
  process.exit(1);
}

if (!secrets.ANTHROPIC_BASE_URL) {
  console.error('ERROR: ANTHROPIC_BASE_URL not configured');
  process.exit(1);
}

// Start the proxy server
const PROXY_PORT = 3001;

console.log(`Starting credential proxy on port ${PROXY_PORT}...`);

startCredentialProxy(PROXY_PORT)
  .then((server) => {
    console.log(`Proxy started successfully\n`);

    // Send test request
    const requestBody = JSON.stringify({
      model: secrets.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20251101',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Say hello in one word' }],
    });

    console.log('Sending test request...');
    console.log(`  Endpoint: http://127.0.0.1:${PROXY_PORT}/v1/messages`);
    console.log(`  Payload: ${requestBody}`);
    console.log('');

    return new Promise<void>((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: PROXY_PORT,
          path: '/v1/messages',
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'anthropic-version': '2023-06-01',
            'x-api-key': secrets.ANTHROPIC_API_KEY,
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => {
            const body = Buffer.concat(chunks).toString();
            console.log(`Response (HTTP ${res.statusCode}):`);

            if (res.statusCode === 200) {
              try {
                const data = JSON.parse(body);
                console.log(JSON.stringify(data, null, 2));
                console.log('\n=== TEST PASSED ===');
                server.close();
                resolve();
              } catch (e) {
                console.log(body);
                console.log('\n=== TEST PASSED (non-JSON response) ===');
                server.close();
                resolve();
              }
            } else {
              console.log(body);
              console.error(`\n=== TEST FAILED: HTTP ${res.statusCode} ===`);
              server.close();
              reject(new Error(`HTTP ${res.statusCode}: ${body}`));
            }
          });
        },
      );

      req.on('error', (err) => {
        console.error('Request error:', err.message);
        server.close();
        reject(err);
      });

      req.write(requestBody);
      req.end();
    });
  })
  .catch((err) => {
    console.error('Test failed:', err.message);
    process.exit(1);
  });
