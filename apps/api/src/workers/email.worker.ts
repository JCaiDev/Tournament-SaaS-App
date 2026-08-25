import { Worker, Job } from 'bullmq';
import { AppError } from '../errors/AppErrors';

const sendEmail = (job: Job) => {
    // In a real app, you'd use a service like Nodemailer or an API client
    console.log(`Sending welcome email to: ${job.data.email}`);
    console.log(`Subject: ${job.data.subject}`);
    console.log(`Name: ${job.data.name}`);
    // Simulate a successful email send
    return Promise.resolve();
};

export const worker = new Worker(
    'email-queue',
    async (job: Job) => {
        console.log(
            `Processing job ${job.id}, attempt ${job.attemptsMade + 1} of ${
                job.opts.attempts
            }`,
        );
        if (Math.random() < 0.5) {
            throw new Error('Simulated random server crash!');
        }
        console.log(`Processing job ${job.id} of type ${job.name}`);
        await sendEmail(job);
    },
    {
        connection: {
            host: '127.0.0.1',
            port: 6379,
        },
        limiter: {
            max: 10,
            duration: 1000,
        },
    },
);

worker.on('completed', (job: Job) => {
    console.log(`Job ${job.id} completed successfully`);
});

worker.on('failed', (job: Job | undefined, err: Error) => {
    if (job) {
        console.error(`Job ${job.id} failed with error: ${err.message}`);
    } else {
        console.error(`A job failed with error: ${err.message}`);
    }
});

console.log('Email worker started...');
