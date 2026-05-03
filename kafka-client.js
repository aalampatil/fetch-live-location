import './load-env.js';

import { Kafka } from 'kafkajs';

export const kafkaClient = new Kafka({
  clientId: 'ap',
  brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
});
