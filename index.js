const gpio = require('rpi-gpio')
const rpio = require('rpio')
const express = require('express')
const app = express()
const server = require('http').Server(app)
const io = require('socket.io')(server)
const crypto = require('./encryption')

require('dotenv').config()
const remoteServer = require('socket.io-client')(
	'https://' + process.env.SERVER_URL + '/',
)

rpio.open(10, rpio.OUTPUT, rpio.LOW)
rpio.open(8, rpio.OUTPUT, rpio.LOW)
rpio.open(36, rpio.INPUT, rpio.PULL_UP)
rpio.open(38, rpio.INPUT, rpio.PULL_UP)
// gpio.setup(36, gpio.DIR_IN, gpio.EDGE_RISING)
// gpio.setup(38, gpio.DIR_IN, gpio.EDGE_BOTH)
rpio.poll(36, pollcb, rpio.POLL_HIGH)
rpio.poll(38, pollcb, rpio.POLL_BOTH)

server.listen(process.env.LOCAL_PORT)

app.use(express.static(__dirname + '/public'))

app.get('/', (req, res) => res.sendFile(__dirname + '/public/index.html'))

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

function pollcb(pin) {
	rpio.msleep(20)
	if (rpio.read(pin)) return

	if (Date.now() - lastTime > 200) {
		lastTime = Date.now()
		if (pin === 36) {
			Object.keys(values).forEach(key => {
				if (values[key] === true) {
					values[key] = false
					rpio.write(pins[key], rpio.LOW)
				}
			})
			// socket.broadcast.emit('send-data', values)
			remoteServer.emit('send-data', crypto.encrypt(JSON.stringify(values)))
		}
		if (pin === 38) {
			values['mainLight'] = !values['mainLight']
			rpio.write(pins['mainLight'], convert[values['mainLight']])
			// socket.broadcast.emit('send-data', values)
			remoteServer.emit('send-data', crypto.encrypt(JSON.stringify(values)))
		}
	}
}

// remoteServer.on('toggle', function(data) {
// 	data = JSON.parse(crypto.decrypt(data))
// 	if (Date.now() - lastTime > 200) {
// 		lastTime = Date.now()
// 		values[data.type] = data.value
// 		io.sockets.emit('send-data', values)
// 		gpio.write(pins[data.type], data.value, function(err) {
// 			if (err) console.log(err)
// 		})
// 	}
// })
// remoteServer.on('request-data', function() {
// 	remoteServer.emit('send-data', crypto.encrypt(JSON.stringify(values)))
// })

io.on('connection', function(socket) {
	socket.emit('send-data', values)

	socket.on('toggle', function(data) {
		if (Date.now() - lastTime > 200) {
			lastTime = Date.now()
			values[data.type] = data.value
			socket.broadcast.emit('send-data', values)
			remoteServer.emit('send-data', crypto.encrypt(JSON.stringify(values)))
			rpio.write(pins[data.type], convert[data.value])
		}
	})
	// gpio.on('change', function(channel, value) {
	// 	if (Date.now() - lastTime > 200) {
	// 		lastTime = Date.now()
	// 		if (channel === 36) {
	// 			Object.keys(values).forEach(key => {
	// 				if (values[key] === true) {
	// 					values[key] = false
	// 					gpio.write(pins[key], false, function(err) {
	// 						if (err) console.log(err)
	// 					})
	// 				}
	// 			})
	// 			socket.broadcast.emit('send-data', values)
	// 			remoteServer.emit('send-data', crypto.encrypt(JSON.stringify(values)))
	// 		}
	// 		if (channel === 38) {
	// 			values['mainLight'] = !values['mainLight']

	// 			gpio.write(pins['mainLight'], values['mainLight'], function(err) {
	// 				if (err) console.log(err)
	// 			})
	// 			socket.broadcast.emit('send-data', values)
	// 			remoteServer.emit('send-data', crypto.encrypt(JSON.stringify(values)))
	// 		}
	// 	}
	// })
})
