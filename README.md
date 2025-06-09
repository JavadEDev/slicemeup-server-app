# SliceMeUp - Modern Pizza Ordering System

SliceMeUp is a modern, full-stack pizza ordering application that provides a seamless experience for customers to browse, order, and track their pizza deliveries. Built with performance and user experience in mind, this application leverages modern web technologies to deliver a fast and reliable service.

## ✨ Features

- 🍕 Browse a variety of pizzas with detailed descriptions and ingredients
- 📱 Responsive design for optimal viewing on all devices
- 🛒 Real-time cart management with quantity tracking
- 📦 Order tracking and history with detailed order information
- 💳 Secure order processing with transaction support
- 📊 Admin dashboard for order management
- 📞 Contact form for customer support
- 🎯 Pizza of the Day feature
- 📱 Mobile-friendly interface
- 🔄 Real-time order status updates

## 🛠️ Tech Stack

### Backend
- Node.js with Fastify framework
- Turso Database (SQLite-compatible)
- RESTful API architecture
- CORS enabled for secure cross-origin requests
- Environment-based configuration
- Pino logger for enhanced logging
- Static file serving for pizza images

### Frontend
- Modern JavaScript/TypeScript
- Responsive UI design
- Real-time cart updates
- Image optimization for pizza displays
- WebP image format for better performance

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- Turso Database account

### Environment Setup
Create a `.env` file in the root directory with the following variables:
```env
TURSO_DATABASE_URL=your_database_url
TURSO_AUTH_TOKEN=your_auth_token
```

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/slicemeup.git
cd slicemeup
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## API Endpoints

### Pizza Management
- `GET /api/pizzas` - Get all available pizzas with sizes and prices
- `GET /api/pizza-of-the-day` - Get today's featured pizza with special pricing

### Order Management
- `GET /api/orders` - Get all orders
- `GET /api/order/:id` - Get specific order details including items and total
- `POST /api/order` - Create a new order with cart items
- `GET /api/past-orders` - Get paginated order history (20 items per page)
- `GET /api/past-order/:order_id` - Get detailed information about a specific past order

### Customer Support
- `POST /api/contact` - Submit contact form with name, email, and message

## 🔒 Security Features

- CORS protection with specific allowed origins
- Environment variable management
- Secure database connections
- Input validation
- Error handling and logging
- Transaction management for order processing
- Rate limiting (implemented in production)

## 📦 Deployment

The application is configured for deployment on Vercel with the following endpoints:

- Frontend: `https://pizza-front-sooty.vercel.app`
- Backend: `https://pizza-server-iota.vercel.app`

### Allowed Origins
- `https://pizza-front-sooty.vercel.app`
- `https://pizza-server-iota.vercel.app/`
- `http://localhost:5173` (for development)

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Run end-to-end tests
npm run test:e2e
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Code Style
- Follow the existing code style
- Use meaningful variable names
- Add comments for complex logic
- Include error handling
- Write tests for new features

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Authors

- Your Name - Initial work

## 🙏 Acknowledgments

- Thanks to all contributors who have helped shape this project
- Special thanks to the open-source community for the amazing tools and libraries
- Turso for providing the database infrastructure
- Vercel for hosting services

## 📞 Support

For support, please:
1. Open an issue in the GitHub repository
2. Use the contact form in the application
3. Check the [documentation](docs/) for common issues

## 🔄 Changelog

### Version 1.0.0
- Initial release
- Basic pizza ordering functionality
- Order tracking system
- Contact form implementation
- Pizza of the Day feature

---

Made with ❤️ by Javad Esmati
