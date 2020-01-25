'use strict'

const { createLogger, format, transports } = require('winston')

const logger = createLogger({
	level: 'info',
	format: format.combine(
		format.timestamp({
			format: 'YYYY-MM-DD HH:mm:ss',
		}),
		format.errors({ stack: true }),
		format.splat(),
		format.json(),
	),
	defaultMeta: { service: 'the-room-public' },
	transports: [new transports.File({ filename: 'app.log' })],
})

module.exports = { logger }
