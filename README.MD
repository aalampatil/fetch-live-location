📦 Kafka Learning Project

A simple Node.js backend demonstrating real-time communication and event streaming using Kafka, Express, and Socket.IO.

🚀 Tech Stack
Node.js (ES Modules)
Express – HTTP server
Socket.IO – Real-time communication
Kafka (KRaft mode) – Event streaming platform
pnpm – Package manager
Docker – Running Kafka locally
📁 Project Structure
.
├── index.js # Main server entry point
├── package.json
├── docker-compose.yml
└── README.md
⚙️ Prerequisites

Make sure you have installed:

Node.js (v18+ recommended)
pnpm
Docker & Docker Compose
🐳 Running Kafka (Docker)

Start Kafka using:

docker-compose up -d
Kafka Configuration
Broker: localhost:9092
Mode: KRaft (no Zookeeper)
Single node setup (for learning purposes)
📦 Install Dependencies
pnpm install
▶️ Running the Server
node index.js
🔌 Features
Basic Express server setup
Kafka producer/consumer using kafkajs
Real-time messaging with Socket.IO
Event-driven architecture learning setup
🧠 How It Works
Client connects via Socket.IO
Backend produces events to Kafka
Kafka processes and stores events
Consumer reads events
Server emits updates back to clients
🌍 Environment Variables (Recommended)

Create a .env file:

PORT=3000
KAFKA_BROKER=localhost:9092
⚠️ Notes
This setup is for local development only
Kafka is running in single-node mode
Not suitable for production without:
replication
proper networking
managed Kafka service
🚀 Deployment Tips

If deploying:

Backend → host on a platform (like Render)
Kafka → use managed service (e.g. Confluent Cloud, Redpanda, etc.)
Do not rely on Docker Compose in production platforms like Render
🛠️ Future Improvements
Add topic management
Add message schema validation
Implement retries & error handling
Add logging & monitoring
Scale Kafka cluster
