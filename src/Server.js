const reservedWords = ["client-request-server", "client-response-server"]

export default class SocketServer {
	#register = {};
	#onConnectionHandler = () => {};

	constructor(io, opts = {}) {
		const {remoteTimeout = 10000} = opts
		this.io = io
		this.remoteTimeout = remoteTimeout

		this.io.on("connection", async socket => {
			socket.messageHandler = {}

			socket.onPromise = (message, handler) => {
				if (reservedWords.includes(message))
					throw new Error(`${reservedWords.join(", ")} are reserved words`)
				socket.messageHandler[message] = handler
			}

			socket.emitPromise = (message, ...args) =>
				new Promise((resolve, reject) => {
					const request = {
						id: uniqid(),
						message,
						args
					}
					const timeoutId = setTimeout(() => {
						if (!this.#register[request.id]) return
						delete this.#register[request.id]
						reject(new Error("Remote client timeout!"))
					}, this.remoteTimeout)
					this.#register[request.id] = {resolve, reject, timeoutId}
					socket.emit("server-request-client", request)
					// log(Label.request, "Me ➜ client", request)
				})

			socket.on("client-request-server", async request => {
				// Logger.log(Label.request, "Client ➜ me", request)
				const sendBack = (response, success = true) => {
					// Logger.log(Label.response, "Me ➜ client", success ? response : response.stack)
					socket.emit("server-response-client", {
						request,
						response,
						success
					})
				}
				if (socket.messageHandler[request.message]) {
					try {
						sendBack(
							await socket.messageHandler[request.message](...request.args)
						)
					} catch (err) {
						console.error(err)
						sendBack({message: err.message, stack: err.stack}, false)
					}
					// Log.warn("client requested but not found event: ...")
				}
			})

			socket.on("client-response-server", ({request, response, success}) => {
				if (this.#register[request.id]) {
					clearTimeout(this.#register[request.id].timeoutId)
					// log(Label.response, "Client ➜ me", response)
					if (success) this.#register[request.id].resolve(response)
					else
						this.#register[request.id].reject(
							new Error(`CLIENT RESPONSE: ${response.message}`)
						)
					delete this.#register[request.id]
				}
			})

			await this.#onConnectionHandler(socket)
		})
	}

	onConnection(handler) {
		this.#onConnectionHandler = handler
	}
}

function uniqid() {
	return Math.random()
		.toString(16)
		.slice(2)
}
