const rpio = require('rpio')
const express = require('express')
const app = express()
const server = require('http').Server(app)
const io = require('socket.io')(server)
const crypto = require('./encryption')
const { logger } = require('./logger.js')
require('dotenv').config()
const remoteServer = require('socket.io-client')(
	'https://' + process.env.SERVER_URL + '/?token=' + process.env.AUTH_TOKEN,
)

// GPIO SETUP
rpio.open(10, rpio.OUTPUT, rpio.LOW)
rpio.open(8, rpio.OUTPUT, rpio.LOW)
rpio.open(36, rpio.INPUT, rpio.PULL_UP)
rpio.open(38, rpio.INPUT, rpio.PULL_UP)
rpio.poll(36, haltAll, rpio.POLL_HIGH)
rpio.poll(38, mainSwitch)

// EXPRESS
server.listen(process.env.LOCAL_PORT)
app.use(express.static(__dirname + '/public'))

// VALUES AND CONSTANTS
const pins = {
	mainLight: 10,
	tableLight: 8,
}
let values = {
	mainLight: false,
	tableLight: false,
}
let convert = {
	true: rpio.HIGH,
	false: rpio.LOW,
}
let lastTime = 0

//	BUTTON FUNCTIONS
function haltAll() {
	rpio.msleep(20)
	if (Date.now() - lastTime > 200) {
		lastTime = Date.now()
		try {
			Object.keys(values).forEach(key => {
				if (values[key] === true) {
					values[key] = false
					rpio.write(pins[key], rpio.LOW)
				}
			})
			io.sockets.emit('send-data', values)
			remoteServer.emit('send-data', crypto.encrypt(JSON.stringify(values)))
		} catch (e) {
			logger.warn(e)
		}
	}
}
function mainSwitch() {
	rpio.msleep(20)
	if (Date.now() - lastTime > 200) {
		lastTime = Date.now()
		try {
			values['mainLight'] = !values['mainLight']
			rpio.write(pins['mainLight'], convert[values['mainLight']])
			io.sockets.emit('send-data', values)
			remoteServer.emit('send-data', crypto.encrypt(JSON.stringify(values)))
		} catch (e) {
			logger.warn(e)
		}
	}
}

// REMOTE SOCKET.IO
remoteServer.on('toggle', function(data) {
	if (Date.now() - lastTime > 200) {
		lastTime = Date.now()
		try {
			data = JSON.parse(crypto.decrypt(data))
			values[data.type] = data.value
			io.sockets.emit('send-data', values)
			rpio.write(pins[data.type], convert[data.value])
		} catch (e) {
			logger.warn(e)
		}
	}
})
remoteServer.on('request-data', function() {
	try {
		remoteServer.emit('send-data', crypto.encrypt(JSON.stringify(values)))
	} catch (e) {
		logger.warn(e)
	}
})

// LOCAL SOCKET.IO
io.on('connection', function(socket) {
	socket.emit('send-data', values)

	socket.on('toggle', function(data) {
		if (Date.now() - lastTime > 200) {
			lastTime = Date.now()
			try {
				values[data.type] = data.value
				socket.broadcast.emit('send-data', values)
				remoteServer.emit('send-data', crypto.encrypt(JSON.stringify(values)))
				rpio.write(pins[data.type], convert[data.value])
			} catch (e) {
				logger.warn(e)
			}
		}
	})
})
