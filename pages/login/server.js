var static = require('node-static');
var file = new static.Server(`${__dirname}/auth`)

require('http').createServer(function (request, response) {
    request.addListener('end', function () {
        file.serve(request, response)
    }).resume()
}).listen(9990).on("error", (err) => console.log(err.message));