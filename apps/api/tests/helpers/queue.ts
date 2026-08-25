import { emailQueue } from '../../src/queues/email.queue';
import { worker } from '../../src/workers/email.worker';

export async function closeQueues() {
    await emailQueue.close();
    await worker.close();
}
