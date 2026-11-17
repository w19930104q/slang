import { parseArgument, rhythmMap } from './parseArguments';

/*
	PATTERN CLOCK
	The pure heart of the Scheduler: given the parsed
	pattern functions of a play line (rhythm, notes),
	a PatternClock produces one tick at a time. It has no
	audio or timer dependencies, which makes the event
	sequence of a scene fully deterministic and testable
	(see tests/events.test.js and tests/scene.test.js).
*/

export class PatternClock {
	constructor(patterns) {
		// Start with defaults for
		// each of the patterns.

		// a list of rhythm lengths
		this.rhythmPattern = parseArgument('8n');
		// a List of notes
		this.notePattern = parseArgument(69);

		// Loop through whatever we got and overwrite
		// the default patterns. All three of these
		// functions only accept one argument, which
		// is why we're pulling arguments[0] out.
		patterns.forEach((pattern) => {
			switch (pattern.function) {
				case 'rhythm':
					// We have to special-case rhythm argument parsing
					// for now because the xoxoxo-style pattern is not
					// recognized by the parser as a List.
					this.rhythmPattern = parseArgument(pattern.arguments[0])
					break;
				case 'notes':
					this.notePattern = parseArgument(pattern.arguments[0]);
					break;
				default:
					break;
			}
		});
	}

	// Advance one tick. Returns the tick length in seconds
	// and the note for this tick (or null for rests and
	// for empty note patterns).
	nextTick() {
		// The tick length could be a number or a string that starts
		// with 'r', indicating a rest.
		let nextTickLength = this.rhythmPattern.next();
		// Let's start by assuming it's not a rest.
		let rest = false;
		// if it's a string and it starts with R, it is a rest.
		if (typeof nextTickLength === 'string' && nextTickLength.charAt(0).toLowerCase() === 'r') {
			rest = true;
			// Convert it into the appropriate rhythm.
			nextTickLength = rhythmMap[nextTickLength.substr(1)];
		}

		let note = null;
		if (!rest) {
			// A null note (empty note pattern) produces no
			// event, just like a rest.
			note = this.notePattern.next();
		}

		return { length: nextTickLength, note };
	}
}

/*
	buildEventSequence(patterns, startTime, endTime)
	Walk a PatternClock over a fixed window and return the
	list of note events { start, stop, note }. This is the
	exact logic the Scheduler runs against the audio clock;
	here it is pure, so a fixed scene always produces the
	same output times and pitch lists.
*/
export function buildEventSequence(patterns, startTime, endTime) {
	const clock = new PatternClock(patterns);
	const events = [];

	let currentTime = startTime;
	while (currentTime < endTime) {
		const { length, note } = clock.nextTick();
		if (note !== null && note !== undefined) {
			events.push({
				start: currentTime,
				stop: currentTime + length,
				note,
			});
		}
		currentTime += length;
	}

	return events;
}
