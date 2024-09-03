const express = require('express');
const routes = require('./routes/index');

const app = express();

const port = process.env.PORT || 5000;

//middleware to parse json
app.use(express.json());

// load routes
app.use('/', routes);

// start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
})