import { kafkaClient } from './kafka-client.js';
import type { LocationUpdate } from './types.js';

async function init(): Promise<void> {
  const kafkaConsumer = kafkaClient.consumer({
    groupId: `database-processor`,
  });
  await kafkaConsumer.connect();

  await kafkaConsumer.subscribe({
    topics: ['location-updates'],
    fromBeginning: true,
  });

  await kafkaConsumer.run({
    eachMessage: async ({ message, heartbeat }) => {
      if (!message.value) return;
      const data: LocationUpdate = JSON.parse(message.value.toString());
      console.log(`INSERT INTO DB LOCATION`, data);
      await heartbeat();
    },
  });
}

init();
