var path = require('path');

var mkdirp = require('mkdirp');
var winston = require('winston');

var PROD = process.env.NODE_ENV === 'production';

module.exports = function (filename) {
  var relativePath = path.relative(__dirname, filename);
  var name = relativePath.replace(/\W+/g, '_');
  var outputFilename = relativePath + '.log';
  var outputPath = path.resolve(__dirname, 'logs', outputFilename);
  var exceptionLogsOutputPath = path.resolve(__dirname, 'logs', 'exceptions.log');

  mkdirp(path.dirname(outputPath));

  winston.loggers.add(name, {
    console: {
      level: PROD ? 'warn' : 'info',
      colorize: true,
      label: relativePath
    },
    file: {
      level: 'debug',
      filename: outputPath
    }
  });

  winston.handleExceptions([
    new winston.transports.Console({
      handleExceptions: true,
      json: true
    }),
    new winston.transports.File({
      filename: exceptionLogsOutputPath
    })
  ]);

  return winston.loggers.get(name);
};
