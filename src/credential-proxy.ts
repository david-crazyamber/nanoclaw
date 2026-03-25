/**
 * Credential proxy for container isolation.
 * Containers connect here instead of directly to the Anthropic API.
 * The proxy injects real credentials so containers never see them.
 *
 * Two auth modes:
 *   API key:  Proxy injects x-api-key on every request.
 *   OAuth:    Container CLI exchanges its placeholder token for a temp
 *             API key via /api/oauth/claude_cli/create_api_key.
 *             Proxy injects real OAuth token on that exchange request;
 *             subsequent requests carry the temp key which is valid as-is.
 */
import { createServer, Server } from 'http';
import { request as httpsRequest } from 'https';
import { request as httpRequest, RequestOptions } from 'http';

import { readEnvFile } from './env.js';
import { logger } from './logger.js';

export type AuthMode = 'api-key' | 'oauth';

export interface ProxyConfig {
  authMode: AuthMode;
}

export function startCredentialProxy(
  port: number,
  host = '127.0.0.1',
): Promise<Server> {
  const secrets = readEnvFile([
    'ANTHROPIC_API_KEY',
    'CLAUDE_CODE_OAUTH_TOKEN',
    'ANTHROPIC_AUTH_TOKEN',
    'ANTHROPIC_BASE_URL',
  ]);

  // Helper function to truncate sensitive values for logging
  const truncateSecret = (secret: string | undefined): string => {
    if (!secret) return 'not set';
    if (secret.length <= 8) return `${secret.length} chars`;
    return `${secret.slice(0, 4)}...${secret.slice(-4)} (${secret.length} chars)`;
  };

  const authMode: AuthMode = secrets.ANTHROPIC_API_KEY ? 'api-key' : 'oauth';
  const oauthToken =
    secrets.CLAUDE_CODE_OAUTH_TOKEN || secrets.ANTHROPIC_AUTH_TOKEN;

  // Log which credential will be used for injection
  if (authMode === 'api-key') {
    logger.info(
      {
        authMode,
        credentialSource: 'ANTHROPIC_API_KEY',
        apiKeyTruncated: truncateSecret(secrets.ANTHROPIC_API_KEY),
      },
      'Proxy auth mode detected',
    );
  } else {
    logger.info(
      {
        authMode,
        credentialSource: secrets.CLAUDE_CODE_OAUTH_TOKEN
          ? 'CLAUDE_CODE_OAUTH_TOKEN'
          : 'ANTHROPIC_AUTH_TOKEN',
        oauthTokenTruncated: truncateSecret(oauthToken),
      },
      'Proxy auth mode detected',
    );
  }

  const upstreamUrl = new URL(
    secrets.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
  );
  const isHttps = upstreamUrl.protocol === 'https:';
  const makeRequest = isHttps ? httpsRequest : httpRequest;

  // Log proxy configuration at startup with detailed credential info
  logger.info(
    {
      port,
      host,
      authMode,
      upstreamUrl: upstreamUrl.toString(),
      upstreamHost: upstreamUrl.host,
      upstreamProtocol: upstreamUrl.protocol,
      apiKeyStatus: secrets.ANTHROPIC_API_KEY
        ? truncateSecret(secrets.ANTHROPIC_API_KEY)
        : 'not configured',
      oauthTokenStatus: oauthToken
        ? truncateSecret(oauthToken)
        : 'not configured',
      anthropicBaseUrl: secrets.ANTHROPIC_BASE_URL || 'default (https://api.anthropic.com)',
    },
    'Credential proxy started',
  );

  // Log credential injection configuration
  if (authMode === 'api-key') {
    logger.info(
      {
        apiKeyTruncated: secrets.ANTHROPIC_API_KEY
          ? truncateSecret(secrets.ANTHROPIC_API_KEY)
          : 'MISSING',
        headerName: 'x-api-key',
      },
      'Credential proxy configured for API key auth',
    );
  } else {
    logger.warn(
      {
        reason: 'ANTHROPIC_API_KEY not found in environment',
        fallingBackTo: 'OAuth token',
        oauthTokenTruncated: oauthToken ? truncateSecret(oauthToken) : 'MISSING',
      },
      'Credential proxy using OAuth mode (no API key configured)',
    );
  }

  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const body = Buffer.concat(chunks);
        const bodyPreview = body.length > 200
          ? body.slice(0, 200).toString() + '...'
          : body.toString();

        // Log ALL incoming request headers for debugging
        const incomingHeaders: Record<string, string> = {};
        for (const [key, value] of Object.entries(req.headers)) {
          if (key === 'x-api-key') {
            incomingHeaders[key] = value && typeof value === 'string' ? truncateSecret(value) : 'absent';
          } else if (key === 'authorization') {
            incomingHeaders[key] = value && typeof value === 'string' ? truncateSecret(value) : 'absent';
          } else {
            incomingHeaders[key] = String(value);
          }
        }

        // Log request details before forwarding
        logger.info(
          {
            method: req.method,
            path: req.url,
            authMode,
            hasBody: body.length > 0,
            bodySize: body.length,
            bodyPreview: body.length > 0 ? bodyPreview : undefined,
            incomingHeaders,
          },
          'Credential proxy received request',
        );

        const headers: Record<string, string | number | string[] | undefined> =
          {
            ...(req.headers as Record<string, string>),
            host: upstreamUrl.host,
            'content-length': body.length,
          };

        // Strip hop-by-hop headers that must not be forwarded by proxies
        delete headers['connection'];
        delete headers['keep-alive'];
        delete headers['transfer-encoding'];

        let credentialInjected = false;
        let credentialType: string | undefined;

        if (authMode === 'api-key') {
          // API key mode: inject x-api-key on every request
          const originalHeader = headers['x-api-key'];
          delete headers['x-api-key'];
          headers['x-api-key'] = secrets.ANTHROPIC_API_KEY;
          credentialInjected = true;
          credentialType = 'api-key';

          logger.info(
            {

              method: req.method,
              baseUrl: secrets.ANTHROPIC_BASE_URL,
              path: req.url,
              fullpath: secrets.ANTHROPIC_BASE_URL + req.url,
              credentialType: 'x-api-key',
              apiKeyTruncated: truncateSecret(secrets.ANTHROPIC_API_KEY),
              originalHeader: originalHeader ? 'present' : 'absent',
              injectionStatus: 'success',
            },
            'Credential proxy injected API key',
          );
        } else {
          // OAuth mode: replace placeholder Bearer token with the real one
          // only when the container actually sends an Authorization header
          // (exchange request + auth probes). Post-exchange requests use
          // x-api-key only, so they pass through without token injection.
          if (headers['authorization']) {
            const originalAuth = headers['authorization'];
            delete headers['authorization'];
            if (oauthToken) {
              headers['authorization'] = `Bearer ${oauthToken}`;
              credentialInjected = true;
              credentialType = 'oauth';

              logger.info(
                {
                  method: req.method,
                  path: req.url,
                  credentialType: 'Authorization',
                  oauthTokenTruncated: truncateSecret(oauthToken),
                  originalAuth: originalAuth ? 'present' : 'absent',
                  injectionStatus: 'success',
                },
                'Credential proxy injected OAuth token',
              );
            } else {
              logger.warn(
                {
                  method: req.method,
                  path: req.url,
                  reason: 'OAuth token not configured',
                },
                'Credential proxy could not inject OAuth token',
              );
            }
          }
        }

        // Log final headers being sent to upstream (excluding full credentials)
        const headersForLogging: Record<string, string> = {};
        for (const [key, value] of Object.entries(headers)) {
          if (key === 'x-api-key') {
            headersForLogging[key] = secrets.ANTHROPIC_API_KEY
              ? truncateSecret(secrets.ANTHROPIC_API_KEY)
              : 'not set';
          } else if (key === 'authorization') {
            headersForLogging[key] = typeof value === 'string' && value.length > 8
              ? truncateSecret(value)
              : String(value);
          } else {
            headersForLogging[key] = String(value);
          }
        }

        logger.info(
          {
            method: req.method,
            path: req.url,
            upstreamUrlOrigin: upstreamUrl.origin,
            upstreamUrlPath: upstreamUrl.pathname,
            hostname: upstreamUrl.hostname,
            port: upstreamUrl.port || (isHttps ? 443 : 80),
            finalPath: upstreamUrl.origin + upstreamUrl.pathname + req.url,
            finalHeaders: headersForLogging,
          },
          'Credential proxy sending request to upstream',
        );

        const upstream = makeRequest(
          {
            hostname: upstreamUrl.hostname,
            port: upstreamUrl.port || (isHttps ? 443 : 80),
            path: upstreamUrl.pathname + req.url,
            method: req.method,
            headers,
          } as RequestOptions,
          (upRes) => {
            // Collect response body for logging
            const responseChunks: Buffer[] = [];
            upRes.on('data', (chunk) => responseChunks.push(chunk));
            upRes.on('end', () => {
              const responseBody = Buffer.concat(responseChunks);
              const responseBodyPreview = responseBody.length > 200
                ? responseBody.slice(0, 200).toString() + '...'
                : responseBody.toString();

              // Log upstream response status with full details
              logger.info(
                {
                  statusCode: upRes.statusCode,
                  method: req.method,
                  path: req.url,
                  upstreamPath: upstreamUrl.origin + req.url,
                  responseHeaders: JSON.stringify(upRes.headers),
                  responseBodySize: responseBody.length,
                  responseBodyPreview,
                },
                `Credential proxy received upstream response (HTTP ${upRes.statusCode})`,
              );

              res.writeHead(upRes.statusCode!, upRes.headers);
              res.end(responseBody);
            });
          },
        );

        upstream.on('error', (err) => {
          logger.error(
            {
              err,
              url: req.url,
              method: req.method,
              upstreamHost: upstreamUrl.host,
              upstreamPath: upstreamUrl.origin + req.url,
            },
            'Credential proxy upstream error',
          );
          if (!res.headersSent) {
            res.writeHead(502);
            res.end('Bad Gateway');
          }
        });

        upstream.write(body);
        upstream.end();
      });
    });

    server.listen(port, host, () => {
      logger.info(
        {
          port,
          host,
          pid: process.pid,
          baseUrl: `http://${host}:${port}`,
        },
        'Credential proxy server listening',
      );
      resolve(server);
    });

    server.on('error', (err) => {
      logger.error(
        { port, host, err },
        'Credential proxy server error',
      );
      reject(err);
    });
  });
}

/** Detect which auth mode the host is configured for. */
export function detectAuthMode(): AuthMode {
  const secrets = readEnvFile(['ANTHROPIC_API_KEY']);
  return secrets.ANTHROPIC_API_KEY ? 'api-key' : 'oauth';
}
