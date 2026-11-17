/*
	NOTE UTILITIES
	A single, deterministic source of truth for note math.
	These functions replace the tonal-range / tonal-distance /
	tonal Note calls that used to be spread across the parser,
	the transpose function and the Osc block. The old chain had
	unstable boundary behavior:

	- `Range.chromatic(['F#3','A#3'])` respelled sharps as flats
	  (Gb3, Ab3, Bb3), so sharp input did not survive a range.
	- `transpose` spelled ascending transpositions with flats and
	  descending ones with sharps, and produced notes like `E#3`
	  or `C-1` whose `Note.midi` is `null` -> NaN frequencies.
	- Descending ranges and single-note ranges depended on
	  library internals rather than documented semantics.

	The semantics defined here:

	- A note name is a letter A-G (either case), an optional
	  accidental (# or b) and an integer octave, possibly
	  negative, so the full MIDI range C-1..G9 is expressible.
	- All generated notes are spelled with sharps. Flat input
	  is accepted and normalized (Bb3 -> A#3).
	- Ranges are closed chromatic intervals: equal endpoints
	  produce a single note, and descending endpoints produce
	  a descending sequence. (Numeric ranges are half-open
	  and empty when their endpoints are equal; see the
	  range rules in slang-grammar.js.)
	- Transposition is by integer semitones and is clamped to
	  the MIDI range 0..127 (C-1..G9), so it is total: every
	  input produces a stable, valid note.
*/

const NOTE_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const LETTER_TO_SEMITONE = {
	C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

export const MIDI_MIN = 0;  // C-1
export const MIDI_MAX = 127; // G9

const NOTE_NAME_REGEX = /^([A-Ga-g])(#|b)?(-?\d+)$/;

export function isNoteName(value) {
	return typeof value === 'string' && NOTE_NAME_REGEX.test(value);
}

export function noteToMidi(note) {
	const match = typeof note === 'string' && note.match(NOTE_NAME_REGEX);
	if (!match) {
		throw new Error(
			`"${note}" is not a valid note name. ` +
			`Expected a letter A-G, an optional # or b, and an octave number (e.g. E3, F#3, Bb2).`
		);
	}

	const [, letter, accidental, octaveString] = match;

	let semitone = LETTER_TO_SEMITONE[letter.toUpperCase()];
	if (accidental === '#') semitone += 1;
	else if (accidental === 'b') semitone -= 1;

	const octave = parseInt(octaveString, 10);
	// MIDI note 0 is C-1, so octave -1 starts at 0, octave 4
	// (middle C octave) starts at 60, etc. Accidentals that
	// push past the octave boundary (B#3, Cb4) land on the
	// correct enharmonic MIDI note for free.
	return (octave + 1) * 12 + semitone;
}

export function clampMidi(midi) {
	return Math.min(MIDI_MAX, Math.max(MIDI_MIN, midi));
}

export function midiToNote(midi) {
	const m = Math.round(midi);
	// Javascript's % keeps the sign of the dividend, so
	// normalize to a positive semitone index for notes
	// below C-1 as well.
	const semitone = ((m % 12) + 12) % 12;
	const octave = Math.floor(m / 12) - 1;
	return NOTE_NAMES_SHARP[semitone] + octave;
}

/*
	noteRange(from, to)
	A closed chromatic interval between two note names.
	- ascending endpoints -> ascending list
	- descending endpoints -> descending list
	- equal endpoints -> a single note
	Every range contains at least one note; there is no
	empty note range. (The empty interval exists only for
	numeric ranges with equal endpoints, e.g. [3..3].)
*/
export function noteRange(from, to) {
	const start = noteToMidi(from);
	const end = noteToMidi(to);
	const step = start <= end ? 1 : -1;

	const notes = [];
	for (let midi = start; ; midi += step) {
		notes.push(midiToNote(midi));
		if (midi === end) break;
	}
	return notes;
}

/*
	transposeNote(note, semitones)
	Transpose a note name by an integer number of semitones.
	The result is clamped to the MIDI range so that extreme
	negative/positive transpositions land on a stable boundary
	note (C-1 / G9) instead of an unparseable name like C-2.
*/
export function transposeNote(note, semitones) {
	const midi = noteToMidi(note) + Math.round(semitones);
	return midiToNote(clampMidi(midi));
}
