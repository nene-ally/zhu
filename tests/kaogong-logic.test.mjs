import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeLast7Days, toggleWrongQuestion } from '../src/scripts/tauri/kaogong-logic.js';

test('Kaogong logic summarizes seven days and toggles mastery', () => {
    const data = {
        checkins: [{ date: '2026-07-22', totalQuestions: 30, wrongQuestions: 4 }],
        wrongQuestions: [{ id: 'q1', status: 'review' }],
    };
    const rows = summarizeLast7Days(data, new Date('2026-07-22T12:00:00Z'));
    assert.equal(rows.length, 7);
    assert.deepEqual(rows.at(-1), { date: '2026-07-22', total: 30, wrong: 4 });
    toggleWrongQuestion(data, 'q1');
    assert.equal(data.wrongQuestions[0].status, 'mastered');
});
