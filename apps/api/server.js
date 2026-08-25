const http = require('http');

const server = http.createServer((req, res)=> {
    console.log("Request received:", req.method, req.url);

    res.setHeader("Content-Type", "application/json");

    const response = {
        message: "Hello from your first backend!",
        method: req.method,
        url: req.url,
    }
    
    if (req.url === '/hello' ) {
        res.end(JSON.stringify({ message: "Hello Route" }))
    } else {
        res.end(JSON.stringify({ error: "Not Found" }))
    }

});

server.listen(3000, () => {
    console.log("Server running on http://localhost:3000")
})

