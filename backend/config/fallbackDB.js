import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Fallback MongoDB connection with environment variable only
 * SECURITY: No hardcoded credentials - only uses MONGODB_URI from .env
 */
const connectWithFallback = async () => {
  const mongoUri = process.env.MONGODB_URI;
  
  if (!mongoUri) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  // Try primary connection string
  try {
    console.log('🔄 Attempting MongoDB connection...');
    
    const options = {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 5,
      ssl: true,
      tls: true,
      tlsAllowInvalidCertificates: false,
    };
    
    const conn = await mongoose.connect(mongoUri, options);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`Database: ${conn.connection.name}`);
    return conn;
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    throw new Error(`Failed to connect to MongoDB: ${error.message}`);
  }
};

export default connectWithFallback;