const micro = require('micro');
const microApi = require('micro-api');

const api = microApi([
  {
    method: 'get',
    path: '/reports',
    handler: handlers.reports,
  },
  {
    method: 'get',
    path: '/foos/:fooId',
    handler: handlers.showFoo,
  },
])

function reports (req, res) {

}

module.exports = api;
