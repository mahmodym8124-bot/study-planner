const express = require('express');
const cors = require('cors');
const helmet = require('helmet'); // Assuming you are using Helmet for other security headers

const app = express();

// Configure CORS to allow requests from your GitHub Pages origin
const corsOptions = {
  origin: 'https://mahmodym8124-bot.github.io', // Specify the exact origin that needs access
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE', // Allow common HTTP methods
  credentials: true, // Important: Allow cookies/authorization headers to be sent cross-origin
  optionsSuccessStatus: 204 // For preflight requests, respond with 204 No Content
};

app.use(cors(corsOptions));
app.use(helmet()); // Apply Helmet for other security headers

// Your API routes
app.get('/auth/google', (req, res) => {
  // Handle your Google authentication logic here
  res.json({ message: 'Google auth endpoint reached!' });
});

// ... other routes

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});