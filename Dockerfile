# Use official Node.js LTS image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Create uploads directory
RUN mkdir -p uploads/images uploads/videos uploads/files

# Expose the port the app runs on
EXPOSE 4400

# Environment variable for production
ENV NODE_ENV=production

# Command to run the application
CMD ["npm", "start"]