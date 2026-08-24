"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
let port = 3001;
app_1.app.listen(port, () => {
    console.log(`server running on port ${port}`);
});
