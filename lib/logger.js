var winston = require('winston')

module.exports = new (winston.Logger)(
  {
    transports: [
      new (winston.transports.Console)({
        level: 'debug'
      }),
      new (winston.transports.File)({
        filename: __dirname +'/../log/output.log',
        level: 'info'
      })
    ]
  }
);
