import { Kafka } from 'kafkajs';

export const kafkaClient = new Kafka({
  clientId: 'ap',
  brokers: ['localhost:9092'],
});
