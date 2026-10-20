/**
 * The poll form's state (a draft) and how it becomes a poll document (model.ts) plus an expiry timestamp. The form
 * components only edit the draft; the rules live here, so they can be tested without a browser.
 */

import { serverLimits } from './api';
import { addDays, todayIn, zonedToUtc } from './dates';
import type { MessageKey } from './i18n.svelte';
import { limits, type DateOption, type DatePoll, type Poll, type PollOption, type TextOption } from './model';

/** A time range on one day; the end is optional, and an end before the start is on the next day. */
export type DraftSlot = {
	/** `HH:MM`, or empty while the user hasn't entered it. */
	start: string;
	/** `HH:MM` or empty. */
	end: string;
	/** The option's ID when editing a poll, so that its votes stay. */
	id?: string;
};

export type DraftDay = {
	/** `YYYY-MM-DD` */
	date: string;
	/** No slots: the whole day is one option. Otherwise every slot is an option. */
	slots: DraftSlot[];
	/** The ID of the whole-day option when editing a poll. */
	id?: string;
};

/** An option of a text poll, in the form. */
export type DraftText = {
	text: string;
	/** The option's ID when editing a poll, so that its votes stay. */
	id?: string;
};

export type PollDraft = {
	title: string;
	description: string;
	location: string;
	/** Text polls have a timezone too: the expiry is the end of a day in it. */
	timezone: string;
	allowMaybe: boolean;
	/** Only the options of this type are saved; the others stay in the draft while the form is open. */
	type: 'dates' | 'text';
	/** Sorted by date, no duplicates. */
	days: DraftDay[];
	/** In the order they are shown. */
	texts: DraftText[];
	/** The choice limits of a text poll as typed: whole numbers, or empty for no limit. */
	minChoices: string;
	maxChoices: string;
	/** `YYYY-MM-DD`: the poll is deleted at the end of this day (in its timezone). */
	expiryDate: string;
};

export type DraftErrors = Partial<
	Record<'title' | 'days' | 'texts' | 'minChoices' | 'maxChoices' | 'expiry', MessageKey>
> & {
	/** By `slotKey(date, index)`. */
	slots?: Record<string, MessageKey>;
	/** By the index in `texts`. */
	textItems?: Record<number, MessageKey>;
};

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
		type: 'dates',
		days: [],
		// Two empty fields to start with: most text polls have at least two options.
		texts: [{ text: '' }, { text: '' }],
		minChoices: '',
		maxChoices: '',
		expiryDate: defaultExpiryDate({ type: 'dates', days: [] }, today),
	};
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const WHOLE_NUMBER = /^\d+$/;

/** Adds the date (as a whole day), or removes it if it is already there. */
export function toggleDay(days: DraftDay[], date: string): DraftDay[] {
	if (days.some((day) => day.date === date)) {
		return days.filter((day) => day.date !== date);
	}
	return [...days, { date, slots: [] }].sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Gives every other day a copy of the slots of the day `from`; the copies are new options. */
export function copySlots(days: DraftDay[], from: string): DraftDay[] {
	const source = days.find((day) => day.date === from);
	if (source === undefined) {
		return days;
	}
	return days.map((day) =>
		day === source ? day : { ...day, slots: source.slots.map(({ start, end }) => ({ start, end })) },
	);
}

export function slotKey(date: string, index: number): string {
	return `${date}/${index}`;
}

/** True if the slot ends on the next day (its end is before its start). */
export function endsNextDay(slot: DraftSlot): boolean {
	return TIME.test(slot.start) && TIME.test(slot.end) && slot.end < slot.start;
}

/** The last day the expiry can be set to, so that its end stays within the server's maximum lifetime. */
export function maxExpiryDate(today: string): string {
	return addDays(today, Math.floor(serverLimits.maxLifetime / 86_400) - 1);
}

/** 30 days after the last date (after today for text polls and without dates), capped at the maximum. */
export function defaultExpiryDate(draft: Pick<PollDraft, 'type' | 'days'>, today: string): string {
	const last = (draft.type === 'dates' ? draft.days.at(-1)?.date : undefined) ?? today;
	const wanted = addDays(last < today ? today : last, DEFAULT_EXPIRY_DAYS);
	const max = maxExpiryDate(today);
	return wanted < max ? wanted : max;
}

/** The end of `expiryDate` in the poll's timezone, as Unix seconds, capped below the server's maximum lifetime. */
export function expiresAt(draft: Pick<PollDraft, 'expiryDate' | 'timezone'>, now: number): number {
	const endOfDay = Math.floor(zonedToUtc(addDays(draft.expiryDate, 1), '00:00', draft.timezone) / 1000);
	return Math.min(endOfDay, now + serverLimits.maxLifetime - EXPIRY_MARGIN);
}

export function optionCount(draft: Pick<PollDraft, 'type' | 'days' | 'texts'>): number {
	if (draft.type === 'text') {
		return draft.texts.length;
	}
	return draft.days.reduce((count, day) => count + Math.max(1, day.slots.length), 0);
}

/** A text option as it is saved: control characters (a pasted tab, say) become spaces, and it is trimmed. */
export function optionText(text: string): string {
	return text.replace(/[\p{Cc}\p{Cs}]+/gu, ' ').trim();
}

/** A choice limit as typed: undefined if empty, null unless it is a whole number of at least 1. */
function choiceLimit(value: string): number | null | undefined {
	const trimmed = value.trim();
	if (trimmed === '') {
		return undefined;
	}
	return WHOLE_NUMBER.test(trimmed) && Number(trimmed) >= 1 ? Number(trimmed) : null;
}

/** @returns the problems by field; empty if the draft can be saved */
export function validateDraft(draft: PollDraft, today: string): DraftErrors {
	const errors: DraftErrors = draft.type === 'text' ? textErrors(draft) : dateErrors(draft);
	if (draft.title.trim() === '') {
		errors.title = 'form.error.titleRequired';
	}
	if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.expiryDate) || draft.expiryDate < today) {
		errors.expiry = 'form.error.expiryInvalid';
	} else if (draft.expiryDate > maxExpiryDate(today)) {
		errors.expiry = 'form.error.expiryTooLate';
	}
	return errors;
}

function dateErrors(draft: PollDraft): DraftErrors {
	const errors: DraftErrors = {};
	const count = optionCount(draft);
	if (count === 0) {
		errors.days = 'form.error.datesRequired';
	} else if (count > limits.options) {
		errors.days = 'form.error.tooManyOptions';
	}
	const slots = slotErrors(draft.days);
	if (Object.keys(slots).length > 0) {
		errors.slots = slots;
	}
	return errors;
}

/** Texts must not be blank or repeat one another (trimmed, ignoring case); the limits must fit the options. */
function textErrors(draft: PollDraft): DraftErrors {
	const errors: DraftErrors = {};
	const count = draft.texts.length;
	if (count === 0) {
		errors.texts = 'form.error.optionsRequired';
	} else if (count > limits.options) {
		errors.texts = 'form.error.tooManyTextOptions';
	}
	const items: Record<number, MessageKey> = {};
	const seen = new Set<string>();
	draft.texts.forEach(({ text }, index) => {
		const normalized = optionText(text).toLowerCase();
		if (normalized === '') {
			items[index] = 'form.error.optionTextRequired';
		} else if (seen.has(normalized)) {
			items[index] = 'form.error.duplicateOption';
		}
		seen.add(normalized);
	});
	if (Object.keys(items).length > 0) {
		errors.textItems = items;
	}

	const min = choiceLimit(draft.minChoices);
	const max = choiceLimit(draft.maxChoices);
	if (min === null) {
		errors.minChoices = 'form.error.limitInvalid';
	} else if (typeof min === 'number' && typeof max === 'number' && min > max) {
		errors.minChoices = 'form.error.limitOrder';
	} else if (typeof min === 'number' && count > 0 && min > count) {
		errors.minChoices = 'form.error.limitTooHigh';
	}
	if (max === null) {
		errors.maxChoices = 'form.error.limitInvalid';
	} else if (typeof max === 'number' && count > 0 && max > count) {
		errors.maxChoices = 'form.error.limitTooHigh';
	}
	return errors;
}

function slotErrors(days: DraftDay[]): Record<string, MessageKey> {
	const errors: Record<string, MessageKey> = {};
	for (const day of days) {
		const seen = new Set<string>();
		day.slots.forEach((slot, index) => {
			const key = slotKey(day.date, index);
			if (!TIME.test(slot.start)) {
				errors[key] = 'form.error.startRequired';
			} else if (slot.end !== '' && !TIME.test(slot.end)) {
				errors[key] = 'form.error.endInvalid';
			} else if (slot.end === slot.start) {
				errors[key] = 'form.error.endEqualsStart';
			} else if (seen.has(`${slot.start}-${slot.end}`)) {
				errors[key] = 'form.error.duplicateTime';
			}
			seen.add(`${slot.start}-${slot.end}`);
		});
	}
	return errors;
}

/** An option before it gets its ID: an existing one when editing, otherwise a new one. */
type DraftOption = Omit<DateOption, 'id'> & { id?: string | undefined };

/** The options of a day in time order: the whole day, or one per slot. */
function dayOptions(day: DraftDay): DraftOption[] {
	if (day.slots.length === 0) {
		return [{ id: day.id, start: day.date }];
	}
	return day.slots
		.map((slot) => {
			const option: DraftOption = { id: slot.id, start: `${day.date}T${slot.start}` };
			if (slot.end !== '') {
				option.end = `${endsNextDay(slot) ? addDays(day.date, 1) : day.date}T${slot.end}`;
			}
			return option;
		})
		.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : (a.end ?? '') < (b.end ?? '') ? -1 : 1));
}

/**
 * The poll document of the chosen type. Texts are trimmed; empty optional texts are left out. Options keep the ID they
 * had when the draft was made from a poll; new options get a random one.
 */
export function buildPoll(draft: PollDraft, randomId: () => string = newOptionId): Poll {
	const common = { v: 1, title: draft.title.trim(), timezone: draft.timezone, allowMaybe: draft.allowMaybe } as const;
	let poll: Poll;
	if (draft.type === 'text') {
		const idOf = idAssigner(draft.texts, randomId);
		const options: TextOption[] = draft.texts.map((item) => ({ id: idOf(item.id), text: optionText(item.text) }));
		poll = { ...common, type: 'text', options };
		const min = choiceLimit(draft.minChoices);
		const max = choiceLimit(draft.maxChoices);
		if (typeof min === 'number') {
			poll.minChoices = min;
		}
		if (typeof max === 'number') {
			poll.maxChoices = max;
		}
	} else {
		const drafted = draft.days.flatMap(dayOptions);
		const idOf = idAssigner(drafted, randomId);
		const options: DateOption[] = drafted.map(({ id, ...option }) => ({ id: idOf(id), ...option }));
		poll = { ...common, type: 'dates', options };
	}
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

/** Keeps the IDs the options have, and gives the others random IDs that no other option has. */
function idAssigner(
	drafted: readonly { id?: string | undefined }[],
	randomId: () => string,
): (id: string | undefined) => string {
	const ids = new Set<string>();
	for (const { id } of drafted) {
		if (id !== undefined) {
			ids.add(id);
		}
	}
	return (id) => {
		if (id !== undefined) {
			return id;
		}
		let fresh = randomId();
		while (ids.has(fresh)) {
			fresh = randomId();
		}
		ids.add(fresh);
		return fresh;
	};
}

/** The draft for editing a poll. Options keep their IDs; `expiresAt` (Unix seconds) becomes the expiry date. */
export function draftFromPoll(poll: DatePoll, expiresAt: number): PollDraft {
	const days = new Map<string, DraftDay>();
	for (const option of poll.options) {
		const [date = '', time] = option.start.split('T');
		const day = days.get(date) ?? { date, slots: [] };
		days.set(date, day);
		if (time === undefined) {
			day.id ??= option.id;
		} else {
			day.slots.push({ id: option.id, start: time, end: option.end?.split('T')[1] ?? '' });
		}
	}
	return {
		title: poll.title,
		description: poll.description ?? '',
		location: poll.location ?? '',
		timezone: poll.timezone,
		allowMaybe: poll.allowMaybe,
		type: 'dates',
		days: [...days.values()].sort((a, b) => (a.date < b.date ? -1 : 1)),
		texts: [],
		minChoices: '',
		maxChoices: '',
		expiryDate: expiryDateOf(expiresAt, poll.timezone),
	};
}

/** The day (in the timezone) whose end is the expiry. */
export function expiryDateOf(expiresAt: number, timezone: string): string {
	return todayIn(timezone, new Date((expiresAt - 1) * 1000));
}

/** The edited poll document; the final option stays chosen if it still exists. */
export function editedPoll(previous: Poll, draft: PollDraft, randomId: () => string = newOptionId): Poll {
	const poll = buildPoll(draft, randomId);
	if (previous.finalOptionId !== undefined && poll.options.some((option) => option.id === previous.finalOptionId)) {
		poll.finalOptionId = previous.finalOptionId;
	}
	return poll;
}

/** The options of `previous` that `next` no longer has. */
export function removedOptions(previous: Poll, next: Poll): PollOption[] {
	const kept = new Set(next.options.map((option) => option.id));
	return previous.options.filter((option) => !kept.has(option.id));
}

/** 8 random lowercase hex characters, the form of option IDs. */
export function newOptionId(): string {
	return Array.from(crypto.getRandomValues(new Uint8Array(4)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
