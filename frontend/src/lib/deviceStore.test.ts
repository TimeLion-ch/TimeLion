import { beforeEach, describe, expect, it } from 'vitest';
import { createDeviceStore, STORAGE_KEY, type DeviceStore } from './deviceStore';

const id = '0123456789abcdef0123456789abcdef';
const otherId = 'fedcba9876543210fedcba9876543210';
const responseId = '00000000000000000000000000000001';
const key = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8';
const otherKey = 'B'.repeat(42) + 'A';
const adminToken = 'A'.repeat(43);
const editToken = 'E'.repeat(43);

/** An in-memory stand-in for storage.ts. */
class MemoryStorage {
	readonly data = new Map<string, string>();
	get(name: string): string | null {
		return this.data.get(name) ?? null;
	}
	set(name: string, value: string): void {
		this.data.set(name, value);
	}
	remove(name: string): void {
		this.data.delete(name);
	}
}

let backend: MemoryStorage;
let now: number;
let store: DeviceStore;

beforeEach(() => {
	backend = new MemoryStorage();
	now = 1_800_000_000;
	store = createDeviceStore(backend, () => now);
});

/** Writes raw content, as if another version, an extension or a bit flip had put it there. */
function stored(content: unknown): void {
	backend.set(STORAGE_KEY, typeof content === 'string' ? content : JSON.stringify(content));
}

describe('saving', () => {
	it('starts empty', () => {
		expect(store.list()).toEqual([]);
		expect(store.get(id)).toBeNull();
	});

	it('saves a created poll with its admin token and title', () => {
		store.savePoll(id, key, { adminToken, title: 'Grillabend' });

		expect(store.get(id)).toEqual({ id, key, adminToken, responses: [], title: 'Grillabend', savedAt: now });
		expect(JSON.parse(backend.get(STORAGE_KEY) ?? '')).toEqual([store.get(id)]);
	});

	it('saves an answered poll with the response', () => {
		store.saveResponse(id, key, { id: responseId, editToken });

		expect(store.get(id)).toEqual({ id, key, responses: [{ id: responseId, editToken }], savedAt: now });
	});

	it('merges saves of the same poll', () => {
		store.savePoll(id, key, { adminToken, title: 'Grillabend' });
		now += 10;
		store.saveResponse(id, key, { id: responseId, editToken });
		now += 10;
		store.savePoll(id, key, { title: 'Grillabend (verschoben)' });

		expect(store.list()).toEqual([
			{
				id,
				key,
				adminToken,
				responses: [{ id: responseId, editToken }],
				title: 'Grillabend (verschoben)',
				savedAt: now,
			},
		]);
	});

	it('replaces a response saved again', () => {
		const newToken = 'N'.repeat(43);
		store.saveResponse(id, key, { id: responseId, editToken });
		store.saveResponse(id, key, { id: responseId, editToken: newToken });

		expect(store.get(id)?.responses).toEqual([{ id: responseId, editToken: newToken }]);
	});

	it('lists the most recently saved poll first', () => {
		store.savePoll(id, key);
		now += 10;
		store.savePoll(otherId, otherKey);
		expect(store.list().map((poll) => poll.id)).toEqual([otherId, id]);

		now += 10;
		store.savePoll(id, key);
		expect(store.list().map((poll) => poll.id)).toEqual([id, otherId]);
	});
});

describe('forgetting', () => {
	beforeEach(() => {
		store.savePoll(id, key, { adminToken });
		store.saveResponse(id, key, { id: responseId, editToken });
		store.savePoll(otherId, otherKey);
	});

	it('forgets one response and keeps the poll', () => {
		store.forgetResponse(id, responseId);

		expect(store.get(id)).toMatchObject({ adminToken, responses: [] });
	});

	it('ignores forgetting a response of an unknown poll', () => {
		store.forgetResponse('f'.repeat(32), responseId);

		expect(store.list()).toHaveLength(2);
	});

	it('forgets one poll', () => {
		store.forget(id);

		expect(store.get(id)).toBeNull();
		expect(store.get(otherId)).not.toBeNull();
	});

	it('forgets all polls and removes the storage entry', () => {
		store.forgetAll();

		expect(store.list()).toEqual([]);
		expect(backend.data.has(STORAGE_KEY)).toBe(false);
	});
});

describe('corrupted content', () => {
	const valid = { id, key, responses: [], savedAt: 5 };

	it.each([
		['not JSON', '{"id":'],
		['empty', ''],
		['null', 'null'],
		['an object', { [id]: valid }],
		['a string', '"polls"'],
		['a number', '42'],
	])('ignores content that is %s', (_, content) => {
		stored(content);

		expect(store.list()).toEqual([]);
	});

	it('ignores entries without a valid ID or key, and keeps the others', () => {
		stored([
			null,
			'x',
			[valid],
			{ ...valid, id: id.toUpperCase() },
			{ ...valid, id: 7 },
			{ ...valid, key: undefined },
			{ ...valid, key: key.slice(1) },
			{ ...valid, key: { toString: () => key } },
			valid,
		]);

		expect(store.list()).toEqual([valid]);
	});

	it('drops fields that do not fit', () => {
		stored([
			{
				id,
				key,
				adminToken: 'short',
				responses: [{ id: responseId, editToken }, { id: responseId }, { id: 'x', editToken }, 'x', null],
				title: 'x'.repeat(201),
				savedAt: -1,
				extra: 'x',
			},
			{ id: otherId, key, responses: 'x', title: 42, savedAt: 1.5 },
		]);

		expect(store.list()).toEqual([
			{ id, key, responses: [{ id: responseId, editToken }], savedAt: 0 },
			{ id: otherId, key, responses: [], savedAt: 0 },
		]);
	});

	it('keeps only the first entry of a duplicated poll', () => {
		stored([valid, { ...valid, key: otherKey }]);

		expect(store.list()).toEqual([valid]);
	});

	it('ignores __proto__ and inherited fields', () => {
		stored(`[{"__proto__":{"adminToken":"${adminToken}"},"id":"${id}","key":"${key}","savedAt":5}]`);

		const [poll] = store.list();

		expect(poll).toEqual({ id, key, responses: [], savedAt: 5 });
		expect(poll?.adminToken).toBeUndefined();
	});

	it('overwrites corrupted content with the valid entries on the next save', () => {
		stored([valid, { id: 'garbage' }]);

		store.savePoll(otherId, otherKey);

		expect(JSON.parse(backend.get(STORAGE_KEY) ?? '')).toEqual([
			{ id: otherId, key: otherKey, responses: [], savedAt: now },
			valid,
		]);
	});
});

describe('unavailable storage', () => {
	it('works without remembering anything', () => {
		const unavailable = { get: () => null, set: () => undefined, remove: () => undefined };
		const forgetful = createDeviceStore(unavailable, () => now);

		forgetful.savePoll(id, key, { adminToken });

		expect(forgetful.list()).toEqual([]);
		expect(() => forgetful.forgetAll()).not.toThrow();
	});
});
