/**
 * retryService.js
 *
 * This file contains ALL of the retry + exponential backoff logic.
 * It is written by hand (no retry libraries) so every step is visible
 * and easy to explain during assessment.
 *
 * The three ideas demonstrated here are:
 *   1. RETRY        - if an operation fails, try it again instead of giving up.
 *   2. BACKOFF       - wait a bit before retrying, instead of retrying instantly.
 *   3. EXPONENTIAL   - make that wait grow bigger after each failure
 *                      (1s, 2s, 4s, 8s...), up to a maximum cap.
 */

/**
 * Calculates the delay before the NEXT attempt, using exponential backoff.
 *
 * Formula:
 *   delay = baseDelay * 2 ^ (attempt - 1)
 *
 * Example with baseDelay = 1000ms:
 *   attempt 1 failed -> wait 1000 * 2^0 = 1000ms
 *   attempt 2 failed -> wait 1000 * 2^1 = 2000ms
 *   attempt 3 failed -> wait 1000 * 2^2 = 4000ms
 *
 * The result is capped at `maxDelay` so the wait time never grows
 * without limit, no matter how many attempts have failed.
 *
 * @param {number} attempt   - the attempt number that just failed (1-based)
 * @param {number} baseDelay - starting delay in ms
 * @param {number} maxDelay  - the largest delay we are allowed to wait
 * @returns {number} delay in milliseconds, capped at maxDelay
 */
function calculateBackoffDelay(attempt, baseDelay, maxDelay) {
  const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
  return Math.min(exponentialDelay, maxDelay);
}

/**
 * A tiny helper that pauses execution for `ms` milliseconds.
 * This is what actually creates the "wait" between retries.
 */
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Builds a fake "unreliable" operation for demonstration purposes.
 *
 * It fails on its first `failuresBeforeSuccess` calls, then succeeds
 * on every call after that.
 *
 * Example: failuresBeforeSuccess = 2
 *   call 1 -> throws (failure)
 *   call 2 -> throws (failure)
 *   call 3 -> returns successfully
 *
 * Note: if failuresBeforeSuccess is larger than maxAttempts (e.g. 10
 * failures but only 4 attempts allowed), the operation simply keeps
 * failing for every attempt that gets used. It is runWithRetry's job
 * to stop once maxAttempts is reached - the operation itself doesn't
 * know or care how many attempts the caller has left.
 */
function createUnreliableOperation(failuresBeforeSuccess) {
  let callCount = 0;

  return function unreliableOperation() {
    callCount += 1;
    if (callCount <= failuresBeforeSuccess) {
      throw new Error(`Simulated failure #${callCount}`);
    }
    return { message: 'Operation succeeded', callCount };
  };
}

/**
 * Runs `operation` with retry + exponential backoff.
 *
 * How it works, step by step:
 *   - Try the operation.
 *   - If it succeeds, stop immediately and report success.
 *   - If it fails, record the failure.
 *       - If this was the LAST allowed attempt, stop and report failure.
 *       - Otherwise, calculate the backoff delay, wait, then try again.
 *
 * @param {Function} operation   - function to run; should throw on failure
 * @param {number} maxAttempts   - maximum number of attempts allowed
 * @param {number} baseDelay     - base delay in ms for backoff calculation
 * @param {number} maxDelay      - maximum delay in ms between attempts
 * @param {Function} onEvent     - optional callback fired with progress events,
 *                                 used to stream live updates to the browser
 * @returns {Promise<{success: boolean, attempts: number, result?: any, error?: string, log: Array}>}
 */
async function runWithRetry(operation, maxAttempts, baseDelay, maxDelay, onEvent = () => {}) {
  const log = [];
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Try the operation. If it doesn't throw, it succeeded.
      const result = operation();

      log.push({ attempt, status: 'success' });
      onEvent({ type: 'attempt', attempt, status: 'success' });
      onEvent({ type: 'done', success: true, attempts: attempt, result });

      return { success: true, attempts: attempt, result, log };
    } catch (err) {
      lastError = err.message;
      log.push({ attempt, status: 'failed', error: err.message });
      onEvent({ type: 'attempt', attempt, status: 'failed', error: err.message });

      const isLastAttempt = attempt === maxAttempts;
      if (isLastAttempt) {
        // No attempts left. Stop here - do NOT retry again.
        onEvent({ type: 'maxAttemptsReached' });
        break;
      }

      // Not the last attempt yet: calculate the backoff delay and wait.
      const delay = calculateBackoffDelay(attempt, baseDelay, maxDelay);
      onEvent({ type: 'waiting', delay, nextAttempt: attempt + 1 });
      await wait(delay);
    }
  }

  // If we reach this point, every attempt failed.
  onEvent({ type: 'done', success: false, attempts: maxAttempts, error: lastError });
  return { success: false, attempts: maxAttempts, error: lastError, log };
}

/**
 * Convenience wrapper used by the server: builds the unreliable
 * operation from the given config and runs it through runWithRetry.
 */
async function runRetryDemo({ failuresBeforeSuccess, maxAttempts, baseDelay, maxDelay, onEvent }) {
  const operation = createUnreliableOperation(failuresBeforeSuccess);
  return runWithRetry(operation, maxAttempts, baseDelay, maxDelay, onEvent);
}

module.exports = {
  calculateBackoffDelay,
  createUnreliableOperation,
  runWithRetry,
  runRetryDemo
};
