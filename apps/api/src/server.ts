import 'dotenv/config';
import './config/env';
import './workers/email.worker';
import { app } from './app';

let port = Number(process.env.PORT) || 3001;

console.log(`Starting app in ${process.env.NODE_ENV} mode`);

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
