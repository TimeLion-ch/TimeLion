/** Counting the votes of a poll. */

import type { Poll, PollResponse, Vote } from './model';

export type Tally = Record<Vote, number> & { unanswered: number };

/** Per option ID: how many responses voted yes, maybe or no, or didn't answer. */
export function tally(poll: Poll, responses: readonly PollResponse[]): Map<string, Tally> {
	const tallies = new Map<string, Tally>();
	for (const option of poll.options) {
		const counts: Tally = { yes: 0, maybe: 0, no: 0, unanswered: 0 };
		for (const response of responses) {
			const vote = Object.hasOwn(response.votes, option.id) ? response.votes[option.id] : undefined;
			counts[vote ?? 'unanswered']++;
		}
		tallies.set(option.id, counts);
	}
	return tallies;
}

/** A "maybe" counts half a "yes". */
export function score(counts: Tally): number {
	return counts.yes * 2 + counts.maybe;
}

/** The IDs of the options with the highest score; several if tied, none while nobody said yes or maybe. */
export function bestOptions(tallies: Map<string, Tally>): Set<string> {
	let best = 0;
	for (const counts of tallies.values()) {
		best = Math.max(best, score(counts));
	}
	const ids = new Set<string>();
	if (best > 0) {
		for (const [id, counts] of tallies) {
			if (score(counts) === best) {
				ids.add(id);
			}
		}
	}
	return ids;
}

/** True if any option has a time; then the poll's timezone matters. Text polls have no times. */
export function hasTimes(poll: Poll): boolean {
	return poll.type === 'dates' && poll.options.some((option) => option.start.includes('T'));
}
