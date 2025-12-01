const {default: PQueue} = require('p-queue');
const {default: pRetry} = require('p-retry');

/**
 * This queue ensures that we only process one request at a time to the Pollination API.
 * The 'interval' and 'intervalCap' settings ensure that there's a small delay between
 * each request, which is a common strategy to avoid hitting basic rate limits.
 */
const queue = new PQueue({
    concurrency: 1,      // Only one task at a time
    interval: 1000,      // 1000ms (1 second) interval
    intervalCap: 1       // Allow 1 request per interval
});

/**
 * This function wraps an async function (like an API call) with retry logic.
 * If the function fails, it will be retried multiple times with an increasing delay.
 * This is particularly useful for handling transient network errors or temporary
 * API rate limits (like the '429 Queue full' error).
 *
 * @param {Function} asyncFn The async function to execute.
 * @returns A function that, when called, will add the async function to the queue and execute it with retry logic.
 */
const withRetry = (asyncFn) => {
    return () => pRetry(asyncFn, {
        retries: 4, // Try the original request + 4 retries = 5 total attempts
        minTimeout: 2000, // Wait 2 seconds before the first retry
        factor: 2, // Double the delay for each subsequent retry (2s, 4s, 8s, 16s)
        onFailedAttempt: error => {
            console.warn(`[RateLimiter] Attempt ${error.attemptNumber} failed. There are ${error.retriesLeft} retries left. Reason: ${error.message}`);
        }
    });
};

/**
 * Adds a task to the queue. The task will be executed with retry logic.
 *
 * @param {Function} asyncFn The async function (e.g., an axios API call) to add to the queue.
 * @returns {Promise<any>} A promise that resolves with the return value of the async function.
 */
const addToQueue = (asyncFn) => {
    return queue.add(withRetry(asyncFn));
};

module.exports = { addToQueue };
