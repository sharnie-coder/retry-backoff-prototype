/**
 * server.js
 *
 * A tiny Express server that:
 *   1. Serves the static front-end (public/).
 *   2. Exposes POST /api/retry, which runs the retry/backoff demo
 *      and STREAMS each attempt back to the browser as it happens,
 *      so the user can watch the retries happen "live" instead of
 *      waiting for one big response at the end.
 */

const express = require('express');
const path = require('path');
const { runRetryDemo } = require('./retryService');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/retry', async (req, res) => {
  let { failuresBeforeSuccess, maxAttempts, baseDelay, maxDelay } = req.body;

  // --- Basic input validation (edge cases) ---
  failuresBeforeSuccess = Number(failuresBeforeSuccess);
  maxAttempts = Number(maxAttempts);
  baseDelay = Number(baseDelay);
  maxDelay = Number(maxDelay);

  const isValid =
    Number.isFinite(failuresBeforeSuccess) && failuresBeforeSuccess >= 0 &&
    Number.isInteger(maxAttempts) && maxAttempts >= 1 &&
    Number.isFinite(baseDelay) && baseDelay >= 0 &&
    Number.isFinite(maxDelay) && maxDelay >= 0;

  if (!isValid) {
    return res.status(400).json({
      error:
        'Invalid input. failuresBeforeSuccess and delays must be numbers >= 0, ' +
        'and maxAttempts must be a whole number >= 1.'
    });
  }

  // maxDelay smaller than baseDelay is not technically "invalid", but it
  // means every delay will just be capped at maxDelay. That's fine - the
  // capping logic in calculateBackoffDelay() already handles it.

  // We stream the response as newline-delimited JSON (NDJSON): one JSON
  // object per line, sent as soon as it happens. The browser reads this
  // stream chunk by chunk to show attempts "live".
  res.writeHead(200, {
    'Content-Type': 'application/x-ndjson',
    'Transfer-Encoding': 'chunked'
  });

  const sendEvent = (event) => {
    res.write(JSON.stringify(event) + '\n');

    // Also log every attempt to the server console, as requested.
    if (event.type === 'attempt' && event.status === 'failed') {
      console.log(`Attempt ${event.attempt} failed.`);
    } else if (event.type === 'attempt' && event.status === 'success') {
      console.log(`Attempt ${event.attempt} succeeded.`);
    } else if (event.type === 'waiting') {
      console.log(`Retrying in ${event.delay}ms.`);
    } else if (event.type === 'maxAttemptsReached') {
      console.log('Maximum attempts reached. No more retries.');
    }
  };

  await runRetryDemo({
    failuresBeforeSuccess,
    maxAttempts,
    baseDelay,
    maxDelay,
    onEvent: sendEvent
  });

  res.end();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Retry/Backoff prototype running at http://localhost:${PORT}`);
});
