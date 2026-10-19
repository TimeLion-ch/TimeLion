/**
 * The plaintext documents inside the ciphertexts (crypto.ts), and their validators.
 *
 * Decrypted data is untrusted (CLAUDE.md, rule 7): anyone with the link can encrypt anything. The validators return a
 * fresh object with only the known fields, or null. They read own properties only, check sizes before anything
 * expensive, and never recurse into values they don't know.
 *
 * Lengths count UTF-16 code units, like the `maxlength` attribute of form fields.
 */

export type Vote = 'yes' | 'maybe' | 'no';

export type PollOption = {
	/** 8 lowercase hex characters, unique within the poll. Votes refer to options by this ID. */
	id: string;
	/** `YYYY-MM-DD` for a whole day, or `YYYY-MM-DDTHH:MM`: wall-clock time in the poll's timezone, no offset. */
	start: string;
	/** The same form as `start` and later: the last day (inclusive) of a multi-day option, or the end time. */
	end?: string;
};

export type Poll = {
	v: 1;
	title: string;
	description?: string;
	location?: string;
	/** IANA time zone name, e.g. `Europe/Zurich`. */
	timezone: string;
	options: PollOption[];
	allowMaybe: boolean;
	finalOptionId?: string;
};

/** Named PollResponse so that it doesn't shadow the DOM's `Response`. */
export type PollResponse = {
	v: 1;
	name: string;
	/** Option ID → vote. Options without a vote are unanswered. */
	votes: Record<string, Vote>;
	comment?: string;
};

export const limits = {
	title: 200,
	description: 2000,
	location: 200,
	timezone: 64,
	options: 100,
	name: 80,
	comment: 500,
} as const;

const OPTION_ID = /^[0-9a-f]{8}$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const TIME_ZONE = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)*$/;

/** @returns the poll, or null if `value` is not a valid v1 poll document */
export function parsePoll(value: unknown): Poll | null {
	if (!isRecord(value) || field(value, 'v') !== 1) {
		return null;
	}
	const title = requiredText(field(value, 'title'), limits.title);
	const description = optionalText(field(value, 'description'), limits.description);
	const location = optionalText(field(value, 'location'), limits.location);
	const timezone = field(value, 'timezone');
	const options = parseOptions(field(value, 'options'));
	const allowMaybe = field(value, 'allowMaybe');
	if (
		title === null ||
		description === null ||
		location === null ||
		!isTimeZone(timezone) ||
		options === null ||
		typeof allowMaybe !== 'boolean'
	) {
		return null;
	}

	const poll: Poll = { v: 1, title, timezone, options, allowMaybe };
	if (description !== undefined) {
		poll.description = description;
	}
	if (location !== undefined) {
		poll.location = location;
	}
	// A final option that no longer exists is ignored, like votes for it.
	const finalOptionId = field(value, 'finalOptionId');
	if (typeof finalOptionId === 'string' && options.some((option) => option.id === finalOptionId)) {
		poll.finalOptionId = finalOptionId;
	}
	return poll;
}

/**
 * Votes for options the poll doesn't have, and votes with an unknown value, are ignored.
 *
 * @returns the response, or null if `value` is not a valid v1 response document
 */
export function parseResponse(value: unknown, poll: Poll): PollResponse | null {
	if (!isRecord(value) || field(value, 'v') !== 1) {
		return null;
	}
	const name = requiredText(field(value, 'name'), limits.name);
	const comment = optionalText(field(value, 'comment'), limits.comment);
	const votes = field(value, 'votes');
	if (name === null || comment === null || !isRecord(votes)) {
		return null;
	}

	const response: PollResponse = { v: 1, name, votes: {} };
	// Only the poll's options are looked up, so the work doesn't depend on what the response contains.
	for (const { id } of poll.options) {
		const vote = field(votes, id);
		if (vote === 'yes' || vote === 'maybe' || vote === 'no') {
			response.votes[id] = vote;
		}
	}
	if (comment !== undefined) {
		response.comment = comment;
	}
	return response;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Inherited properties (`constructor`, a polluted prototype) don't count. */
function field(record: Record<string, unknown>, name: string): unknown {
	return Object.hasOwn(record, name) ? record[name] : undefined;
}

/** @returns the text, or null unless it is a string of at most `max` code units that isn't blank */
function requiredText(value: unknown, max: number): string | null {
	return typeof value === 'string' && value.length <= max && value.trim() !== '' ? value : null;
}

/** @returns undefined if absent, the text if it is a string of at most `max` code units, otherwise null */
function optionalText(value: unknown, max: number): string | undefined | null {
	if (value === undefined) {
		return undefined;
	}
	return typeof value === 'string' && value.length <= max ? value : null;
}

function parseOptions(value: unknown): PollOption[] | null {
	if (!Array.isArray(value) || value.length < 1 || value.length > limits.options) {
		return null;
	}
	const options: PollOption[] = [];
	const ids = new Set<string>();
	for (const item of value as unknown[]) {
		const option = parseOption(item);
		if (option === null || ids.has(option.id)) {
			return null;
		}
		ids.add(option.id);
		options.push(option);
	}
	return options;
}

function parseOption(value: unknown): PollOption | null {
	if (!isRecord(value)) {
		return null;
	}
	const id = field(value, 'id');
	const start = field(value, 'start');
	const end = field(value, 'end');
	if (typeof id !== 'string' || !OPTION_ID.test(id) || !isDateOrDateTime(start)) {
		return null;
	}
	if (end === undefined) {
		return { id, start };
	}
	// Both have the same form, so comparing the strings compares the dates.
	if (!isDateOrDateTime(end) || end.length !== start.length || end <= start) {
		return null;
	}
	return { id, start, end };
}

function isDateOrDateTime(value: unknown): value is string {
	if (typeof value !== 'string') {
		return false;
	}
	const match = DATE.exec(value) ?? DATE_TIME.exec(value);
	if (match === null) {
		return false;
	}
	const [year = 0, month = 0, day = 0, hour = 0, minute = 0] = match.slice(1).map(Number);
	return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month) && hour <= 23 && minute <= 59;
}

function daysInMonth(year: number, month: number): number {
	if (month === 2) {
		return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28;
	}
	return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function isTimeZone(value: unknown): value is string {
	if (typeof value !== 'string' || value.length > limits.timezone || !TIME_ZONE.test(value)) {
		return false;
	}
	try {
		new Intl.DateTimeFormat('en', { timeZone: value });
		return true;
	} catch {
		return false;
	}
}
