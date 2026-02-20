import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
  try {
    console.log('🔄 Attempting to connect to MongoDB...');
    console.log('📍 URI:', process.env.MONGODB_URI ? 'Configured' : 'Missing');
    
    // Connection options with proper SSL/TLS configuration
    const options = {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      ssl: true,
      tls: true,
      tlsAllowInvalidCertificates: false,
    };

    const conn = await mongoose.connect(process.env.MONGODB_URI, options);

    console.log(` MongoDB Connected: ${conn.connection.host}`);
    console.log(`Database: ${conn.connection.name}`);
    
    mongoose.connection.on('error', (err) => {
      console.error(' MongoDB connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('🔌 MongoDB disconnected');
    });

    return conn;

  } catch (error) {
    console.error(' Error connecting to MongoDB:', error.message);
    throw error;
  }
};

export default connectDB;