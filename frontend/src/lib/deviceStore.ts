/**
 * The polls this browser created or answered ("my polls"), with their keys and tokens, stored in localStorage via
 * storage.ts. The list exists only in this browser.
 *
 * Stored content is read as untrusted, because it can be corrupted, edited or written by an older version: an entry
 * without a valid ID or key is ignored, and so is every other field that doesn't fit. Storage can also be unavailable;
 * then nothing is remembered beyond the page view, and nothing throws.
 */

import { ID_PATTERN, TOKEN_PATTERN } from './api';
import { KEY_PATTERN } from './crypto';
import { limits } from './model';
import { storage } from './storage';

export const STORAGE_KEY = 'timelion.polls.v1';

export type ResponseRef = { id: string; editToken: string };

export type DevicePoll = {
	id: string;
	key: string;
	adminToken?: string;
	/** This browser's responses. */
	responses: ResponseRef[];
	/** A copy of the title for the list of polls; the poll document is the source of truth. */
	title?: string;
	/** Unix seconds of the last save. */
	savedAt: number;
};

export type DeviceStore = ReturnType<typeof createDeviceStore>;

type Backend = Pick<typeof storage, 'get' | 'set' | 'remove'>;

/** Tests pass an in-memory backend and a clock. */
export function createDeviceStore(backend: Backend = storage, now = () => Math.floor(Date.now() / 1000)) {
	function read(): DevicePoll[] {
		let data: unknown;
		try {
			data = JSON.parse(backend.get(STORAGE_KEY) ?? '[]');
		} catch {
			return [];
		}
		if (!Array.isArray(data)) {
			return [];
		}
		const polls: DevicePoll[] = [];
		for (const item of data as unknown[]) {
			const poll = parseEntry(item);
			if (poll !== null && !polls.some((other) => other.id === poll.id)) {
				polls.push(poll);
			}
		}
		return polls;
	}

	function write(polls: DevicePoll[]): void {
		backend.set(STORAGE_KEY, JSON.stringify(polls));
	}

	/** Applies `change` to the poll's entry, created from `id` and `key` if there is none, and saves it on top. */
	function upsert(id: string, key: string, change: (poll: DevicePoll) => void): void {
		const polls = read();
		const poll = polls.find((candidate) => candidate.id === id) ?? { id, key, responses: [], savedAt: 0 };
		poll.key = key;
		change(poll);
		poll.savedAt = now();
		write([poll, ...polls.filter((other) => other.id !== id)]);
	}

	return {
		/** Most recently saved first. */
		list(): DevicePoll[] {
			return read().sort((a, b) => b.savedAt - a.savedAt);
		},

		get(id: string): DevicePoll | null {
			return read().find((poll) => poll.id === id) ?? null;
		},

		/** Adds the poll or updates its key, and its admin token and title if given. Its responses are kept. */
		savePoll(id: string, key: string, details: { adminToken?: string; title?: string } = {}): void {
			upsert(id, key, (poll) => {
				if (details.adminToken !== undefined) {
					poll.adminToken = details.adminToken;
				}
				if (details.title !== undefined) {
					poll.title = details.title;
				}
			});
		},

		saveResponse(pollId: string, key: string, response: ResponseRef): void {
			upsert(pollId, key, (poll) => {
				poll.responses = [...poll.responses.filter((other) => other.id !== response.id), response];
			});
		},

		/** After the response was deleted. The poll stays in the list. */
		forgetResponse(pollId: string, responseId: string): void {
			const polls = read();
			const poll = polls.find((candidate) => candidate.id === pollId);
			if (poll !== undefined) {
				poll.responses = poll.responses.filter((response) => response.id !== responseId);
				write(polls);
			}
		},

		/** Removes the poll from this browser only; it stays on the server until it expires or is deleted. */
		forget(id: string): void {
			write(read().filter((poll) => poll.id !== id));
		},

		forgetAll(): void {
			backend.remove(STORAGE_KEY);
		},
	};
}

export const deviceStore = createDeviceStore();

function parseEntry(value: unknown): DevicePoll | null {
	if (!isRecord(value)) {
		return null;
	}
	const id = field(value, 'id');
	const key = field(value, 'key');
	if (!matches(id, ID_PATTERN) || !matches(key, KEY_PATTERN)) {
		return null;
	}

	const savedAt = field(value, 'savedAt');
	const responses = field(value, 'responses');
	const poll: DevicePoll = {
		id,
		key,
		responses: Array.isArray(responses) ? (responses as unknown[]).flatMap(parseRef) : [],
		savedAt: typeof savedAt === 'number' && Number.isSafeInteger(savedAt) && savedAt >= 0 ? savedAt : 0,
	};
	const adminToken = field(value, 'adminToken');
	if (matches(adminToken, TOKEN_PATTERN)) {
		poll.adminToken = adminToken;
	}
	const title = field(value, 'title');
	if (typeof title === 'string' && title.length <= limits.title) {
		poll.title = title;
	}
	return poll;
}

/** For flatMap: a valid reference as a one-element list, otherwise an empty one. */
function parseRef(value: unknown): ResponseRef[] {
	if (!isRecord(value)) {
		return [];
	}
	const id = field(value, 'id');
	const editToken = field(value, 'editToken');
	return matches(id, ID_PATTERN) && matches(editToken, TOKEN_PATTERN) ? [{ id, editToken }] : [];
}

function matches(value: unknown, pattern: RegExp): value is string {
	return typeof value === 'string' && pattern.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Inherited properties don't count. */
function field(record: Record<string, unknown>, name: string): unknown {
	return Object.hasOwn(record, name) ? record[name] : undefined;
}
