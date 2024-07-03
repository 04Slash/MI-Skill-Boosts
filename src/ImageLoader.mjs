export class ImageLoader {
	static queue = [];
	static runners = [];

	static register(element, src) {
		this.setup();
		this.queue.push([element, src]);

		const available = this.runners.find(runner => !runner.isRunning);
		if (available)
			available.load();
	}
	static setup() {
		if (!this.runners.length) {
			for (let i = 0; i < 250; i++) {
				this.runners.push(new QueueRunner(() => this.queue.shift()));
			}
		}
	}
}

class QueueRunner {
	isRunning = false;

	constructor(nextFactory) {
		this.nextFactory = nextFactory;
	}
	async load() {
		this.isRunning = true;
		const next = this.nextFactory();

		if (next) {
			const [element, src] = next;
			try {
				element.decoding = 'async';
				element.src = src;
				await element.decode();
			} catch { }

			setTimeout(() => this.load());
		} else {
			this.isRunning = false;
		}
	}
}