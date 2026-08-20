# Retry / Exponential Backoff — Learning Prototype

A small standalone Node.js + Express prototype built to demonstrate an
understanding of **retry** and **exponential backoff**. It does not use
React, Tailwind, RabbitMQ, or a database — just plain HTML/CSS/JS on the
front end and Express on the back end, so the retry logic itself stays
front and center.

---

## 1. What is Retry?

**Retry** means: if an operation fails (e.g. a network request, an API
call, a database write), instead of giving up immediately, you try it
again. Many failures are *temporary* — a server was briefly overloaded,
a connection blipped — so trying again often succeeds.

## 2. What is Backoff?

**Backoff** means waiting a bit before you retry, instead of retrying
instantly. If you retry the instant something fails, you can end up
hammering a struggling server with requests, which can make the
problem worse.

## 3. What is Exponential Backoff?

**Exponential backoff** means the wait time *grows* after each failed
attempt — typically doubling each time — instead of staying fixed. This
gives a struggling system progressively more time to recover before the
next attempt arrives.

## 4. Why are retries useful?

- Networks and servers have transient hiccups (dropped packets, brief
  overload, momentary timeouts).
- Retrying automatically recovers from these blips without requiring a
  human to intervene or the whole request to fail outright.

## 5. Why can immediately retrying be harmful?

- If an operation fails because a server is overloaded, retrying
  instantly (and repeatedly) adds even more load to that already
  struggling server — this is sometimes called a "retry storm."
- It can turn a small, temporary problem into a full outage.
- Backoff (waiting, and waiting longer each time) gives the system room
  to recover instead of piling on.

## 6. How the exponential formula works

This prototype uses the formula:

```
delay = baseDelay × 2^(attempt - 1)
```

`attempt` is the number of the attempt that just **failed** (1-based).
The result is capped at `maxDelay`, so the wait time never grows past a
sensible limit.

Example with `baseDelay = 1000ms`:

| Attempt that failed | Formula          | Delay before next attempt |
|----------------------|-------------------|---------------------------|
| 1                     | 1000 × 2^0        | 1000ms                    |
| 2                     | 1000 × 2^1        | 2000ms                    |
| 3                     | 1000 × 2^2        | 4000ms                    |
| 4                     | 1000 × 2^3        | 8000ms                    |

If `maxDelay` is, say, `5000ms`, then the attempt-4 delay of 8000ms
would be capped down to 5000ms instead.

## 7. How this prototype works

- **`retryService.js`** contains all the retry logic, written by hand
  (no retry library):
  - `calculateBackoffDelay(attempt, baseDelay, maxDelay)` — implements
    the formula above, capped at `maxDelay`.
  - `createUnreliableOperation(failuresBeforeSuccess)` — builds a fake
    operation that fails a set number of times before succeeding, used
    to simulate an unreliable network call or API.
  - `runWithRetry(operation, maxAttempts, baseDelay, maxDelay, onEvent)`
    — the core loop: try the operation, and on failure either wait and
    retry (using the backoff delay) or stop if `maxAttempts` has been
    reached.
- **`server.js`** is a small Express server. It exposes
  `POST /api/retry`, which validates the input, runs the retry demo,
  and **streams** each attempt back to the browser as it happens
  (newline-delimited JSON), so the log updates live rather than
  appearing all at once at the end. It also logs each attempt to the
  server console.
- **`public/`** is the front end: a form to configure
  `failuresBeforeSuccess`, `maxAttempts`, `baseDelay`, and `maxDelay`,
  a "Run Retry Test" button, and a live log area that renders each
  attempt/wait/result as it streams in from the server.

## 8. Example: successful retry

Config: `failuresBeforeSuccess = 2`, `maxAttempts = 4`, `baseDelay = 1000ms`

```
Attempt 1
❌ Operation failed
Waiting 1000ms...

Attempt 2
❌ Operation failed
Waiting 2000ms...

Attempt 3
✅ Operation succeeded

Result: SUCCESS
Total attempts: 3
```

## 9. Example: failed retry (attempts exhausted)

Config: `failuresBeforeSuccess = 10`, `maxAttempts = 4`, `baseDelay = 1000ms`

```
Attempt 1
❌ Operation failed
Waiting 1000ms...

Attempt 2
❌ Operation failed
Waiting 2000ms...

Attempt 3
❌ Operation failed
Waiting 4000ms...

Attempt 4
❌ Operation failed
Maximum attempts reached. Do not retry again.

Result: FAILED
Total attempts: 4
```

Notice that no 5th attempt happens — once `maxAttempts` is reached, the
loop stops immediately, even though the operation was still configured
to fail more times.

## 10. Edge cases this prototype handles

- `failuresBeforeSuccess = 0` — the operation succeeds on attempt 1,
  no waiting occurs at all.
- `maxAttempts = 1` — only one attempt is made; if it fails, the
  result is an immediate FAILURE with no wait/retry.
- Operation that always fails (`failuresBeforeSuccess` very large) —
  retries stop exactly at `maxAttempts`, never beyond.
- `maxDelay` reached — `calculateBackoffDelay` caps the computed delay
  so it never exceeds `maxDelay`.
- Invalid/negative input — the server validates all four fields and
  responds with `400` and a clear error message instead of running.
- `failuresBeforeSuccess` greater than `maxAttempts` — handled
  naturally, since the loop is always bounded by `maxAttempts`
  regardless of how unreliable the operation is.

## 11. How to run the project

```bash
cd retry-backoff-prototype
npm install
npm start
```

Then open **http://localhost:3000** in your browser, fill in the four
fields, and click **Run Retry Test** to watch the retry/backoff process
happen live.

You can also call the API directly, e.g. with `curl`:

```bash
curl -N -X POST http://localhost:3000/api/retry \
  -H "Content-Type: application/json" \
  -d '{"failuresBeforeSuccess":2,"maxAttempts":4,"baseDelay":1000,"maxDelay":8000}'
```

(`-N` disables curl's output buffering so you can see the streamed
events arrive live, one per line.)
