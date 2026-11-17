import context from '../helpers/context';
import { PatternClock } from '../helpers/patternClock';

export default class Scheduler {
	constructor(patterns) {
		// The pure pattern logic (rhythm & note patterns,
		// rests, empty lists) lives in PatternClock so it
		// can be shared with the deterministic test suite.
		this.clock = new PatternClock(patterns);

		// Store a callback to the Sound here.
		this.tickCallback = null;
		// Stash a ref to the setInterval id
		this.interval = null;

		// CLOCK

		// currentTs will keep track of which
		// tick we've scheduled up to.
		this.currentTime = null;
		this.lookahead = .04;
		this.startTime = null;
	}

	tick(callback) {
		this.tickCallback = callback;
	}

	start(timestamp) {
		this.startTime = timestamp;
		this.currentTime = timestamp;

		this.interval = setInterval(() => {
			while (this.currentTime < context.currentTime + this.lookahead) {
				const { length, note } = this.clock.nextTick();
				// We're only ticking on beats that aren't rests
				// (a null note is a rest or an empty pattern).
				if (note !== null && note !== undefined) {
					// schedule stuff!
					this.tickCallback(
						// start time
						this.currentTime,
						// stop time
						this.currentTime + length,
						// note
						note
					);
				}
				// go to the next beat in the clock
				this.currentTime += length;
			}
		}, 40);
	}

	stop() {
		this.interval = clearInterval(this.interval);
	}
}
