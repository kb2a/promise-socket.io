export class Packet {
	id = uniqid();
	constructor(message, args) {
		this.message = message
		this.args = args
	}
}

function uniqid() {
	return Math.random()
		.toString(16)
		.slice(2)
}
