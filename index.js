const gpio = require('rpi-gpio')
const express = require('express')
const app = express()
const server = require('http').Server(app)
const io = require('socket.io')(server)

require('dotenv').config()
const remoteServer = require('socket.io-client')(
	'http://' + process.env.SERVER_IP + ':' + process.env.SERVER_PORT + '/',
)

gpio.setup(10, gpio.DIR_OUT)
gpio.setup(8, gpio.DIR_OUT)
gpio.setup(36, gpio.DIR_IN, gpio.EDGE_RISING)
gpio.setup(38, gpio.DIR_IN, gpio.EDGE_BOTH)

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
let lastTime = 0

remoteServer.on('toggle', function(data) {
	if (Date.now() - lastTime > 200) {
		lastTime = Date.now()
		values[data.type] = data.value
		io.sockets.emit('send-data', values)
		gpio.write(pins[data.type], data.value, function(err) {
			if (err) console.log(err)
		})
	}
})
remoteServer.on('request-data', function() {
	remoteServer.emit('send-data', values)
})

io.on('connection', function(socket) {
	socket.emit('send-data', values)

	socket.on('toggle', function(data) {
		if (Date.now() - lastTime > 200) {
			lastTime = Date.now()
			values[data.type] = data.value
			socket.broadcast.emit('send-data', values)
			remoteServer.emit('send-data', values)
			gpio.write(pins[data.type], data.value, function(err) {
				if (err) console.log(err)
			})
		}
	})
	gpio.on('change', function(channel, value) {
		if (Date.now() - lastTime > 200) {
			lastTime = Date.now()
			if (channel === 36) {
				Object.keys(values).forEach(key => {
					if (values[key] === true) {
						values[key] = false
						gpio.write(pins[key], false, function(err) {
							if (err) console.log(err)
						})
					}
				})
				socket.broadcast.emit('send-data', values)
				remoteServer.emit('send-data', values)
			}
			if (channel === 38) {
				values['mainLight'] = !values['mainLight']

				gpio.write(pins['mainLight'], values['mainLight'], function(err) {
					if (err) console.log(err)
				})
				socket.broadcast.emit('send-data', values)
				remoteServer.emit('send-data', values)
			}
		}
	})
})
