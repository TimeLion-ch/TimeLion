/**
 * The poll form's state (a draft) and how it becomes a poll document (model.ts) plus an expiry timestamp. The form
 * components only edit the draft; the rules live here, so they can be tested without a browser.
 */

import { serverLimits } from './api';
import { addDays, zonedToUtc } from './dates';
import type { MessageKey } from './i18n.svelte';
import { limits, type Poll, type PollOption } from './model';

export type DraftDay = {
	/** `YYYY-MM-DD` */
	date: string;
};

export type PollDraft = {
	title: string;
	description: string;
	location: string;
	timezone: string;
	allowMaybe: boolean;
	/** Sorted by date, no duplicates. */
	days: DraftDay[];
	/** `YYYY-MM-DD`: the poll is deleted at the end of this day (in its timezone). */
	expiryDate: string;
};

export type DraftErrors = Partial<Record<'title' | 'days' | 'expiry', MessageKey>>;

/** How long a poll is kept after its last date, unless the creator chooses otherwise. */
export const DEFAULT_EXPIRY_DAYS = 30;

/** Seconds kept free below the server's maximum lifetime, for clock differences and the request's way there. */
const EXPIRY_MARGIN = 600;

export function emptyDraft(timezone: string, today: string): PollDraft {
	return {
		title: '',
		description: '',
		location: '',
		timezone,
		allowMaybe: true,
		days: [],
		expiryDate: defaultExpiryDate([], today),
	};
}

/** Adds the date, or removes it if it is already there. */
export function toggleDay(days: DraftDay[], date: string): DraftDay[] {
	if (days.some((day) => day.date === date)) {
		return days.filter((day) => day.date !== date);
	}
	return [...days, { date }].sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** The last day the expiry can be set to, so that its end stays within the server's maximum lifetime. */
export function maxExpiryDate(today: string): string {
	return addDays(today, Math.floor(serverLimits.maxLifetime / 86_400) - 1);
}

/** 30 days after the last date (or today without dates), capped at the maximum. */
export function defaultExpiryDate(days: DraftDay[], today: string): string {
	const last = days.at(-1)?.date ?? today;
	const wanted = addDays(last < today ? today : last, DEFAULT_EXPIRY_DAYS);
	const max = maxExpiryDate(today);
	return wanted < max ? wanted : max;
}

/** The end of `expiryDate` in the poll's timezone, as Unix seconds, capped below the server's maximum lifetime. */
export function expiresAt(draft: Pick<PollDraft, 'expiryDate' | 'timezone'>, now: number): number {
	const endOfDay = Math.floor(zonedToUtc(addDays(draft.expiryDate, 1), '00:00', draft.timezone) / 1000);
	return Math.min(endOfDay, now + serverLimits.maxLifetime - EXPIRY_MARGIN);
}

export function optionCount(draft: Pick<PollDraft, 'days'>): number {
	return draft.days.length;
}

/** @returns the problems by field; empty if the draft can be saved */
export function validateDraft(draft: PollDraft, today: string): DraftErrors {
	const errors: DraftErrors = {};
	if (draft.title.trim() === '') {
		errors.title = 'form.error.titleRequired';
	}
	const count = optionCount(draft);
	if (count === 0) {
		errors.days = 'form.error.datesRequired';
	} else if (count > limits.options) {
		errors.days = 'form.error.tooManyOptions';
	}
	if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.expiryDate) || draft.expiryDate < today) {
		errors.expiry = 'form.error.expiryInvalid';
	} else if (draft.expiryDate > maxExpiryDate(today)) {
		errors.expiry = 'form.error.expiryTooLate';
	}
	return errors;
}

/** The poll document. Texts are trimmed; empty optional texts are left out. */
export function buildPoll(draft: PollDraft, randomId: () => string = newOptionId): Poll {
	const ids = new Set<string>();
	const uniqueId = () => {
		let id = randomId();
		while (ids.has(id)) {
			id = randomId();
		}
		ids.add(id);
		return id;
	};
	const options: PollOption[] = draft.days.map((day) => ({ id: uniqueId(), start: day.date }));

	const poll: Poll = {
		v: 1,
		title: draft.title.trim(),
		timezone: draft.timezone,
		options,
		allowMaybe: draft.allowMaybe,
	};
	const description = draft.description.trim();
	if (description !== '') {
		poll.description = description;
	}
	const location = draft.location.trim();
	if (location !== '') {
		poll.location = location;
	}
	return poll;
}

/** 8 random lowercase hex characters, the form of option IDs. */
export function newOptionId(): string {
	return Array.from(crypto.getRandomValues(new Uint8Array(4)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
