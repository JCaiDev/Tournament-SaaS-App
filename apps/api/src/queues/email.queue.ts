import { Queue } from 'bullmq';

export const emailQueue = new Queue('email-queue', {
    connection: {
        host: '127.0.0.1',
        port: 6379,
    },
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000,
        },
    },
});

export const addEmailJob = async (email: string, name: string) => {
    await emailQueue.add('welcome-email', {
        email,
        name,
        subject: 'Welcome to Neow!',
    });
    console.log(`Job queue added for ${email}`);
};
