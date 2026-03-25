# AI Call Chain Diagnostics

This document describes the complete AI API call chain in NanoClaw and the diagnostic logging available for troubleshooting connection issues.

## Complete Call Chain

### 1. Host Side - Credential Proxy

**File:** `src/credential-proxy.ts`

The credential proxy runs on the host at port 3001 and intercepts all API requests from containers. It injects real credentials so containers never see secrets.

**Startup logging:**
```
logger.info({
  port, host, authMode,
  upstreamHost, upstreamProtocol,
  oauthTokenLength, apiKeyConfigured
}, 'Credential proxy started')
```

**Per-request logging (DEBUG level):**
- Request forwarding: method, path, auth mode, body size
- Credential injection: confirms when credentials are injected (never logs the credentials)
- Upstream response: HTTP status code

**Troubleshooting:**
- Check that proxy starts with correct `authMode` (api-key or oauth)
- Verify `upstreamHost` matches your `ANTHROPIC_BASE_URL` configuration
- Look for "Credential proxy injected credentials" to confirm injection is working
- Check for non-2xx status codes in upstream responses

### 2. Host Side - Container Runner

**File:** `src/container-runner.ts`

Spawns agent containers with isolated filesystems and environment variables.

**Startup logging:**
```
logger.info({
  containerName, authMode, proxyUrl,
  timezone, hostUid, mountCount, mounts
}, 'Container configuration')
```

**Error diagnostics:**
- Timeout: includes `timeoutMs`, `configTimeout`, `hadStreamingOutput`, proxy URL
- Exit errors: includes last 500 chars of stderr, proxy URL, auth mode

**Troubleshooting:**
- Verify `proxyUrl` points to `http://host.docker.internal:3001`
- Check `authMode` matches host configuration
- Look for mount configuration issues in container startup logs

### 3. Container Side - Agent Runner

**File:** `container/agent-runner/src/index.ts`

Runs inside the container, calls the Claude Agent SDK.

**Startup logging:**
```
[agent-runner] SDK Configuration:
[agent-runner]   ANTHROPIC_BASE_URL: http://host.docker.internal:3001
[agent-runner]   ANTHROPIC_API_KEY: set (X chars) or not set
[agent-runner]   CLAUDE_CODE_OAUTH_TOKEN: set (X chars) or not set
[agent-runner]   DEBUG mode: enabled/disabled
```

**Per-query logging (DEBUG level, requires DEBUG=1 or LOG_LEVEL=debug):**
- SDK environment details
- Message type details (JSON serialized)
- Assistant message UUIDs
- Full error stack traces

**Troubleshooting:**
- Verify `ANTHROPIC_BASE_URL` points to the credential proxy
- Check that the appropriate key/token is "set"
- Enable DEBUG mode for detailed SDK message flow

## Diagnostic Workflow

When AI calls are not working, follow this diagnostic workflow:

### Step 1: Test Direct API Connectivity

```bash
./test-api.sh
```

This script:
1. Validates environment variables are set
2. Tests connectivity to the base URL
3. Sends a test API request
4. Reports HTTP status code with troubleshooting tips

**Expected output:**
```
=== Test Complete: SUCCESS (HTTP 200) ===
```

**If failed:**
- Check `.env` file has correct `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, and `ANTHROPIC_MODEL`
- Verify network connectivity to the API endpoint
- Check firewall/proxy settings

### Step 2: Check Credential Proxy Logs

Start NanoClaw with debug logging:
```bash
LOG_LEVEL=debug npm run dev
```

Look for:
```
Credential proxy started { authMode: 'api-key', upstreamHost: '...' }
Credential proxy forwarding request { method: 'POST', path: '/v1/messages' }
Credential proxy injected credentials { authMode: 'api-key' }
Credential proxy received upstream response { statusCode: 200 }
```

**Common issues:**
- Proxy not starting: check port 3001 is available
- Wrong auth mode: verify `ANTHROPIC_API_KEY` is set in `.env` for API key mode
- Upstream connection errors: check `ANTHROPIC_BASE_URL` is reachable

### Step 3: Check Container Logs

With `LOG_LEVEL=debug`, look for:
```
Container configuration { authMode: 'api-key', proxyUrl: 'http://host.docker.internal:3001' }
Spawning container agent { group: '...' }
```

**Common issues:**
- Container won't start: check Docker is running
- Wrong proxy URL: verify container can resolve `host.docker.internal`
- Mount errors: check directory permissions

### Step 4: Check Agent Runner Logs

Look for container stderr output:
```
[agent-runner] SDK Configuration:
[agent-runner]   ANTHROPIC_BASE_URL: http://host.docker.internal:3001
[agent-runner]   ANTHROPIC_API_KEY: set (32 chars)
```

For detailed debugging, enable DEBUG mode:
```bash
# In container environment (requires rebuilding container)
DEBUG=1 docker run ...
```

**Common issues:**
- SDK can't connect to proxy: check `host.docker.internal` resolution
- Placeholder key being sent: proxy should inject real credentials
- SDK errors: check DEBUG logs for detailed stack traces

## Architecture Diagram

```
+------------------+     POST /v1/messages     +---------------------------+
|                  | ------------------------> |                           |
|  Container       |                           |  Credential Proxy         |
|  agent-runner    |  ANTHROPIC_BASE_URL=      |  (port 3001)              |
|                  |  http://host.docker.      |                           |
|  - SDK query()   |      internal:3001        |  - Intercepts requests    |
|  - placeholder   | <------------------------ |  - Injects real API key   |
|    credentials   |  Response (200/4xx/5xx)   |  - Forwards to upstream   |
|                  |                           |                           |
+------------------+                           +---------------------------+
                                                        |
                                                        | POST /v1/messages
                                                        | (with real API key)
                                                        v
                                         +---------------------------+
                                         |  Anthropic API /          |
                                         |  Compatible Endpoint      |
                                         |  (ANTHROPIC_BASE_URL)     |
                                         +---------------------------+
```

## Log Levels

| Level | What's logged | When to use |
|-------|---------------|-------------|
| `info` | Proxy startup, container spawn, container completion | Default operation |
| `debug` | Request forwarding, credential injection, response status, container config | Troubleshooting API calls |
| `error` | Upstream connection errors, container timeouts, container exit errors, SDK errors | Problems detected |
| `warn` | Output truncation, graceful stop failures | Non-critical issues |

## Security Notes

**Credentials are NEVER logged:**
- API keys are only shown as "set (X chars)"
- OAuth tokens are only shown as "set (X chars)"
- Actual credential values are never written to logs

**Safe to share debug logs:**
- All credential values are sanitized
- Only metadata (lengths, presence) is shown
- Request/response bodies are not logged at debug level
