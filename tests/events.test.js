/*
	EVENT SEQUENCE TESTS
	Covers the evaluation chain from parsed patterns to the
	sequence of note events the Scheduler emits: note ranges
	(ascending/descending/single/sharp), cross-octave and
	negative transposition, boundary clamping, empty
	intervals, and rests.
*/
const assert = require('assert');
const { parseLine } = require('../parser');
const { buildEventSequence } = require('../helpers/patternClock');
const { rhythmMap } = require('../helpers/parseArguments');
const { transposeNote, noteToMidi, midiToNote } = require('../helpers/noteUtils');

const cases = [];
function test(name, fn) { cases.push([name, fn]); }

// The length of an 8n tick at the default tempo (120bpm),
// taken from the same map the scheduler uses.
const EIGHTH = rhythmMap['8n'];

// Helper: parse a play line and build its event sequence
// over a fixed window starting at t=0.
function eventsOf(line, duration) {
	const ast = parseLine(line);
	return buildEventSequence(ast.patterns, 0, duration);
}

function pitches(events) { return events.map(e => e.note); }
function starts(events) { return events.map(e => e.start); }

// Floating-point-safe comparison for time lists.
function assertTimesClose(actual, expected) {
	assert.strictEqual(actual.length, expected.length,
		`expected ${expected.length} times, got ${actual.length}`);
	actual.forEach((t, i) => {
		assert.ok(Math.abs(t - expected[i]) < 1e-9,
			`time ${i}: expected ${expected[i]}, got ${t}`);
	});
}

// --- a plain ascending range produces a cycling pitch list ---
test('(notes [E3..G3]) cycles through the range at 8n intervals', () => {
	const events = eventsOf('> @synth (rhythm [8n]) (notes [E3..G3])', EIGHTH * 3.5);
	assert.deepStrictEqual(pitches(events), ['E3', 'F3', 'F#3', 'G3']);
	assertTimesClose(starts(events), [0, EIGHTH, 2 * EIGHTH, 3 * EIGHTH]);
	assertTimesClose(events.map(e => e.stop), [EIGHTH, 2 * EIGHTH, 3 * EIGHTH, 4 * EIGHTH]);
});

// --- descending range ---
test('(notes [C4..A3]) descends and cycles', () => {
	const events = eventsOf('> @synth (rhythm [8n]) (notes [C4..A3])', EIGHTH * 3.5);
	assert.deepStrictEqual(pitches(events), ['C4', 'B3', 'A#3', 'A3']);
});

// --- single-note range ---
test('(notes [E3..E3]) repeats the single note', () => {
	const events = eventsOf('> @synth (rhythm [8n]) (notes [E3..E3])', EIGHTH * 3.5);
	assert.deepStrictEqual(pitches(events), ['E3', 'E3', 'E3', 'E3']);
});

// --- sharp spelling survives into the event stream ---
test('(notes [F#3..A#3]) emits sharp-spelled pitches', () => {
	const events = eventsOf('> @synth (rhythm [8n]) (notes [F#3..A#3])', EIGHTH * 4.5);
	assert.deepStrictEqual(pitches(events), ['F#3', 'G3', 'G#3', 'A3', 'A#3']);
});

// --- cross-octave negative transpose ---
test('(transpose -12 [E3..C4]) shifts the whole range down an octave', () => {
	const events = eventsOf('> @synth (rhythm [8n]) (notes (transpose -12 [E3..C4]))', EIGHTH * 1.5);
	assert.deepStrictEqual(pitches(events), ['E2', 'F2']);
});

// --- negative transpose across the bottom boundary clamps ---
test('(transpose -60 [E3..C4]) clamps to C-1 instead of breaking', () => {
	const events = eventsOf('> @synth (rhythm [8n]) (notes (transpose -60 [E3..C4]))', EIGHTH * 1.5);
	// E3 (52) - 60 = -8 -> clamped to 0 -> C-1
	assert.deepStrictEqual(pitches(events), ['C-1', 'C-1']);
});

// --- positive transpose across the top boundary clamps ---
test('(transpose 120 [E3..C4]) clamps to G9', () => {
	const events = eventsOf('> @synth (rhythm [8n]) (notes (transpose 120 [E3..C4]))', EIGHTH * 1.5);
	assert.deepStrictEqual(pitches(events), ['G9', 'G9']);
});

// --- transpose keeps sharp spelling in both directions ---
test('transpose spelling is sharp and symmetric', () => {
	assert.strictEqual(transposeNote('C4', 1), 'C#4');
	assert.strictEqual(transposeNote('C4', -1), 'B3');
	assert.strictEqual(transposeNote('F#3', -1), 'F3');
	assert.strictEqual(transposeNote('E3', -14), 'D2');
	assert.strictEqual(transposeNote('C4', -60), 'C-1');
	assert.strictEqual(transposeNote('C4', 100), 'G9');
});

// --- note/midi conversion is a stable round trip ---
test('noteToMidi/midiToNote cover the full MIDI range', () => {
	assert.strictEqual(noteToMidi('C-1'), 0);
	assert.strictEqual(noteToMidi('C4'), 60);
	assert.strictEqual(noteToMidi('A4'), 69);
	assert.strictEqual(noteToMidi('G9'), 127);
	for (let m = 0; m <= 127; m++) {
		assert.strictEqual(noteToMidi(midiToNote(m)), m, `round trip failed for midi ${m}`);
	}
	// enharmonic spellings map to the same midi note
	assert.strictEqual(noteToMidi('F#3'), noteToMidi('Gb3'));
	assert.strictEqual(noteToMidi('B#3'), noteToMidi('C4'));
});

// --- empty interval: no events, but the clock advances ---
test('(notes [3..3]) emits no note events over the window', () => {
	const events = eventsOf('> @synth (rhythm [8n]) (notes [3..3])', EIGHTH * 4);
	assert.deepStrictEqual(events, []);
});

// --- rests still work alongside ranges ---
test('rests produce gaps in the event times', () => {
	const events = eventsOf('> @synth (rhythm [8n r8n]) (notes [E3..F3])', EIGHTH * 3.5);
	// two events (E3, F3) separated by a rest
	assert.deepStrictEqual(pitches(events), ['E3', 'F3']);
	assertTimesClose(starts(events), [0, 2 * EIGHTH]);
});

// --- numbers as notes (drums) are untouched ---
test('numeric notes pass through unchanged', () => {
	const events = eventsOf('> @percussion (rhythm [8n]) (notes [0 1 2])', EIGHTH * 2.5);
	assert.deepStrictEqual(pitches(events), [0, 1, 2]);
});

// --- determinism: the same line always yields the same events ---
test('event sequences are deterministic across runs', () => {
	const line = '> @synth (rhythm [8n 16n]) (notes (transpose -2 [F#3..A#3]))';
	assert.deepStrictEqual(eventsOf(line, 2.0), eventsOf(line, 2.0));
});

module.exports = { cases };
