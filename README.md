# retry-backoff-prototype
Meridian Pivot mini-prototype demonstrating retry logic and exponential backoff using Node.js and Express.
  # Retry & Exponential Backoff Prototype

## Meridian Pivot — Assignment 1

This project is an individual mini-prototype created for the Meridian Pivot simulation.

The purpose of this project is to independently learn and demonstrate **Retry with Exponential Backoff**, an unfamiliar technology/concept assigned during Days 1–2 of the sprint.

The prototype simulates an unreliable operation that can fail several times before eventually succeeding.

---

## Objective

The prototype demonstrates:

- Retry logic
- Maximum retry attempts
- Exponential backoff
- Increasing delays between retries
- Maximum delay limits
- Successful retry
- Retry exhaustion and final failure
- Error handling
- Retry attempt logging

---

## Technology Used

- Node.js
- Express
- JavaScript
- HTML
- CSS
- Vanilla JavaScript

No frontend framework is used.

---

## How Retry Works

Retry means attempting an operation again when it fails.

For example:

```text
Attempt 1 → Failed
Attempt 2 → Failed
Attempt 3 → Successful
