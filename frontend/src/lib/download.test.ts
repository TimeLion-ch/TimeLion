import { describe, expect, it } from 'vitest';
import { fileName } from './download';

describe('fileName', () => {
	it('makes a safe file name', () => {
		expect(fileName('Grillabend: Team/Bern 2026', 'ics')).toBe('Grillabend-TeamBern-2026.ics');
		expect(fileName('Zoë’s Fest', 'csv')).toBe('Zoës-Fest.csv');
		expect(fileName('../../', 'xlsx')).toBe('timelion.xlsx');
	});
});
