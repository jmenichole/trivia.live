/** How long players have to answer each question. */
export const QUESTION_DURATION_MS = 10_000;

/**
 * Extra time the server accepts after the question window closes, to absorb
 * network latency between the player's tap and the API receiving it.
 */
export const ANSWER_GRACE_MS = 750;

/** How long the correct answer is shown before the next question. */
export const REVEAL_DURATION_MS = 5_000;

/** How long the final results screen stays up before the show completes. */
export const RESULTS_DURATION_MS = 30_000;
