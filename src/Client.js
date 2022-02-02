export default class SocketClient {
	#register = {};
	#messageHandler = {};

	constructor(socket, opts = {}) {
		const {
			remoteTimeout = 10000
		} = opts
		this.socket = socket
		this.remoteTimeout = remoteTimeout

		this.socket.on("server-response-client", ({ request, response, success }) => {
			if (this.#register[request.id]) {
				clearTimeout(this.#register[request.id].timeoutId)
				// log(Label.response, "Server ➜ me", response)
				if (success) this.#register[request.id].resolve(response)
				else this.#register[request.id].reject(new Error(`SERVER RESPONSE: ${response.message}`))
				delete this.#register[request.id]
			}
		})

		this.socket.on("server-request-client", async request => {
			const sendBack = (response, success = true) => {
				socket.emit("client-response-server", {
					request,
					response,
					success
				})
			}
			if (this.#messageHandler[request.message]) {
				try {
					sendBack(await this.#messageHandler[request.message](...request.args))
				}
				catch(err) {
					console.error(err)
					sendBack({message: err.message, stack: err.stack}, false)
				}
			}
		})
	}

	onPromise(message, handler) {
		this.#messageHandler[message] = handler
	}

	emitPromise(message, ...args) {
		return new Promise((resolve, reject) => {
			const request = {
				id: uniqid(),
				message,
				args
			}
			const timeoutId = setTimeout(() => {
				if (!this.#register[request.id]) return
				delete this.#register[request.id]
				reject(new Error("Remote server timeout!"))
			}, this.remoteTimeout)
			this.#register[request.id] = { resolve, reject, timeoutId }
			this.socket.emit("client-request-server", request)
			// log(Label.request, "Me ➜ server", request)
		})
	}
}

function uniqid() {
	return Math.random().toString(16).slice(2)
}