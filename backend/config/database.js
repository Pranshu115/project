import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
  try {
    console.log('🔄 Attempting to connect to MongoDB...');
    const mongoUri = process.env.MONGODB_URI;
    console.log('📍 URI:', mongoUri ? 'Configured' : 'Missing');
    
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is not set');
    }
    
    // Log database name from URI for debugging
    const dbNameMatch = mongoUri.match(/\/([^?]+)/);
    const dbName = dbNameMatch ? dbNameMatch[1] : 'unknown';
    console.log(`📊 Database name from URI: ${dbName}`);
    
    // Connection options with proper SSL/TLS configuration
    const options = {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      ssl: true,
      tls: true,
      tlsAllowInvalidCertificates: false,
    };

    const conn = await mongoose.connect(mongoUri, options);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    console.log(`📊 Ready State: ${conn.connection.readyState} (0=disconnected, 1=connected, 2=connecting, 3=disconnecting)`);
    
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