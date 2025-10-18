# Shothik Core API Service
#
A robust and scalable Node.js backend service that provides comprehensive API functionality for the Shothik platform. This service integrates multiple AI capabilities, authentication systems, and cloud services to deliver a powerful backend solution.
#
## 🚀 Features

- **AI Integration**
  - Google Vertex AI integration
  - Anthropic AI capabilities
  - Google Cloud Speech-to-Text
  - Generative AI functionalities

- **Authentication & Security**
  - Azure MSAL integration
  - Firebase Authentication
  - Express Rate Limiting
  - Secure cookie handling

- **File Processing**
  - Advanced file upload handling
  - FFmpeg integration for media processing
  - AWS S3 and Google Cloud Storage integration
  - Support for multiple file formats

- **Communication**
  - SendGrid email integration
  - Google Meet integration
  - WebSocket support for real-time communication
  - Message queuing with RabbitMQ and BullMQ

- **Database**
  - MongoDB integration
  - Robust data models
  - Efficient query handling

## 🛠️ Tech Stack

- **Runtime**: Node.js 18
- **Framework**: Express.js
- **Database**: MongoDB
- **Queue Systems**: RabbitMQ, BullMQ
- **Cloud Services**: 
  - Google Cloud Platform
  - AWS
  - Azure
- **AI Services**:
  - Google Vertex AI
  - Anthropic AI
  - Google Cloud Speech

## 🏁 Getting Started

### Prerequisites

- Node.js 18
- MongoDB
- FFmpeg
- Environment variables configured (see `.env.example`)

### Installation

1. Clone the repository
```bash
git clone [repository-url]
```

2. Install dependencies
```bash
npm install
```

3. Configure environment variables
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start the server
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## 🔧 Configuration

The service uses environment variables for configuration. Key configurations include:

- Database connection strings
- API keys for various services
- Authentication credentials
- Storage configuration
- Rate limiting settings

## 📚 API Documentation

API endpoints are organized in the following categories:

- Authentication routes
- User management
- AI processing endpoints
- File upload and processing
- Communication endpoints
- Payment integration (Stripe & Razor)

Detailed API documentation is available in the `/docs` directory.

## 🔐 Security

- Implements rate limiting
- CORS configuration
- Secure cookie handling
- Input validation
- Authentication middleware

## 🚦 Environment Variables

Required environment variables include:

- `PORT`: Server port (default: 8080)
- `PREFIX`: API prefix
- `MONGODB_URI`: MongoDB connection string
- Various API keys and secrets for integrated services

## 📦 Docker Support

The service includes Docker support for containerized deployment:

```bash
docker build -t shothik-core .
docker run -p 8080:8080 shothik-core
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the ISC License.

## 🔄 Version

Current Version: 1.0.1.3

--------------------------------------------------

## Chat session architecture

![Architecture Diagram](/assets/images/chat-system-architecture.png)

