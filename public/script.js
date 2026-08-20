/**
 * script.js
 *
 * Handles the form submission, calls POST /api/retry, and reads the
 * response as a STREAM so each attempt appears in the log the moment
 * the server sends it - this is what makes the retry process feel "live"
 * instead of all the results just appearing at once at the end.
 */

const form = document.getElementById('retry-form');
const runButton = document.getElementById('run-button');
const errorBox = document.getElementById('error-box');
const logSection = document.getElementById('log-section');
const logEl = document.getElementById('log');
const resultBox = document.getElementById('result-box');
const resultText = document.getElementById('result-text');
const attemptsText = document.getElementById('attempts-text');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Reset the UI for a fresh run.
  errorBox.classList.add('hidden');
  errorBox.textContent = '';
  logEl.innerHTML = '';
  resultBox.classList.add('hidden');
  logSection.classList.remove('hidden');
  runButton.disabled = true;
  runButton.textContent = 'Running...';

  const payload = {
    failuresBeforeSuccess: Number(document.getElementById('failuresBeforeSuccess').value),
    maxAttempts: Number(document.getElementById('maxAttempts').value),
    baseDelay: Number(document.getElementById('baseDelay').value),
    maxDelay: Number(document.getElementById('maxDelay').value)
  };

  try {
    const response = await fetch('/api/retry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || 'Request failed.');
    }

    // Read the streamed response body chunk by chunk.
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // The server sends one JSON object per line (NDJSON).
      // Split on newlines, keeping any incomplete trailing line in the buffer.
      const lines = buffer.split('\n');
      buffer = lines.pop(); // last item may be incomplete, keep it for next chunk

      for (const line of lines) {
        if (line.trim() === '') continue;
        const event = JSON.parse(line);
        handleEvent(event);
      }
    }
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.remove('hidden');
  } finally {
    runButton.disabled = false;
    runButton.textContent = 'Run Retry Test';
  }
});

/**
 * Renders a single event from the server into the live log.
 */
function handleEvent(event) {
  if (event.type === 'attempt') {
    const header = document.createElement('div');
    header.className = 'attempt-header';
    header.textContent = `Attempt ${event.attempt}`;
    logEl.appendChild(header);

    const line = document.createElement('div');
    if (event.status === 'success') {
      line.className = 'success';
      line.textContent = '✅ Operation succeeded';
    } else {
      line.className = 'fail';
      line.textContent = `❌ Operation failed (${event.error})`;
    }
    logEl.appendChild(line);
  }

  if (event.type === 'waiting') {
    const line = document.createElement('div');
    line.className = 'waiting';
    line.textContent = `Waiting ${event.delay}ms...`;
    logEl.appendChild(line);
  }

  if (event.type === 'maxAttemptsReached') {
    const line = document.createElement('div');
    line.className = 'info';
    line.textContent = 'Maximum attempts reached. Do not retry again.';
    logEl.appendChild(line);
  }

  if (event.type === 'done') {
    resultBox.classList.remove('hidden');
    resultBox.classList.toggle('failure', !event.success);
    resultText.textContent = event.success ? 'SUCCESS' : 'FAILED';
    attemptsText.textContent = `Total attempts: ${event.attempts}`;
  }

  // Keep the log scrolled to the latest entry.
  logEl.scrollTop = logEl.scrollHeight;
}
