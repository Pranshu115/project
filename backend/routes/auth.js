import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';

const router = express.Router();

// JWT utility functions
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  
  // Remove password from output
  user.password = undefined;
  
  res.status(statusCode).json({
    status: 'success',
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      userType: user.userType,
      company: user.company,
      phone: user.phone,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt
    }
  });
};

// Middleware to protect routes
export const authenticateToken = async (req, res, next) => {
  try {
    // 1) Getting token and check if it's there
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'You are not logged in! Please log in to get access.'
      });
    }

    // 2) Verification token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3) Check if user still exists
    const currentUser = await User.findById(decoded.id).select('+password');
    if (!currentUser) {
      return res.status(401).json({
        status: 'error',
        message: 'The user belonging to this token does no longer exist.'
      });
    }

    // 4) Check if user changed password after the token was issued
    if (currentUser.changedPasswordAfter && currentUser.changedPasswordAfter(decoded.iat)) {
      return res.status(401).json({
        status: 'error',
        message: 'User recently changed password! Please log in again.'
      });
    }

    // 5) Update last login
    currentUser.lastLogin = new Date();
    await currentUser.save({ validateBeforeSave: false });

    // Grant access to protected route
    req.user = currentUser;
    req.userId = currentUser._id;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid token. Please log in again!'
      });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'error',
        message: 'Your token has expired! Please log in again.'
      });
    }
    
    return res.status(500).json({
      status: 'error',
      message: 'Something went wrong during authentication'
    });
  }
};

// Middleware to check if user is service provider
export const isServiceProvider = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    
    if (user && user.userType === 'service_provider') {
      next();
    } else {
      res.status(403).json({ 
        status: 'error',
        message: 'Access denied. This feature is only available for service providers.' 
      });
    }
  } catch (error) {
    res.status(500).json({ 
      status: 'error',
      message: 'Error checking user permissions' 
    });
  }
};

// Register new user (signup)
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, userType, company, phone } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'User with this email already exists'
      });
    }

    // Create new user
    const newUser = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      userType: userType || '',
      company,
      phone
    });

    // Send token
    createSendToken(newUser, 201, res);
  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({
        status: 'error',
        message: 'Validation Error',
        errors
      });
    }
    
    res.status(500).json({
      status: 'error',
      message: 'Error creating user account'
    });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1) Check if email and password exist
    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide email and password'
      });
    }

    // Check for admin email from environment variables
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@tatvadirect.com';
    const initialAdminPassword = process.env.ADMIN_PASSWORD;
    
    // Debug logging (remove in production if needed)
    console.log('Login attempt for email:', email.toLowerCase());
    console.log('Admin email from env:', adminEmail.toLowerCase());
    console.log('Admin password set:', !!initialAdminPassword);
    
    // If this is the admin email, handle admin login
    if (email.toLowerCase() === adminEmail.toLowerCase()) {
      let adminUser = await User.findOne({ email: adminEmail.toLowerCase() }).select('+password');
      
      console.log('Admin user found:', !!adminUser);
      
      // If admin user doesn't exist and we have initial password from env, create it
      if (!adminUser && initialAdminPassword) {
        console.log('Creating new admin user...');
        try {
          adminUser = await User.create({
            name: process.env.ADMIN_NAME || 'Admin User',
            email: adminEmail.toLowerCase(),
            password: initialAdminPassword, // Will be hashed by User model pre-save hook
            userType: 'admin',
            company: process.env.ADMIN_COMPANY || 'Tatva Direct',
            emailVerified: true,
            isActive: true
          });
          console.log('Admin user created successfully');
        } catch (createError) {
          console.error('Error creating admin user:', createError);
          return res.status(500).json({
            status: 'error',
            message: 'Error creating admin account. Please check server logs.'
          });
        }
      }
      
      // If admin user exists, verify password normally (against hashed password in DB)
      if (adminUser) {
        // Ensure user type is admin
        if (adminUser.userType !== 'admin') {
          adminUser.userType = 'admin';
          await adminUser.save();
        }
        
        // Verify password (works with hashed password in DB)
        const isPasswordCorrect = await adminUser.correctPassword(password, adminUser.password);
        console.log('Password verification result:', isPasswordCorrect);
        
        // If password doesn't match and we have initial password from env, 
        // allow reset if the provided password matches the env password
        if (!isPasswordCorrect && initialAdminPassword && password === initialAdminPassword) {
          console.log('Password matches env, updating admin password...');
          // Update password to ensure it's properly hashed
          adminUser.password = initialAdminPassword;
          await adminUser.save();
          // Reload user to get the hashed password
          adminUser = await User.findById(adminUser._id).select('+password');
          console.log('Admin password updated successfully');
        } else if (!isPasswordCorrect) {
          // Wrong password
          console.log('Incorrect password provided');
          return res.status(401).json({
            status: 'error',
            message: 'Incorrect email or password. Please check your credentials.'
          });
        }
        
        // Final password verification
        const finalPasswordCheck = await adminUser.correctPassword(password, adminUser.password);
        if (!finalPasswordCheck) {
          console.log('Final password check failed');
          return res.status(401).json({
            status: 'error',
            message: 'Incorrect email or password. Please check your credentials.'
          });
        }
        
        // Check if user is active
        if (!adminUser.isActive) {
          return res.status(401).json({
            status: 'error',
            message: 'Your account has been deactivated. Please contact support.'
          });
        }
        
        console.log('Admin login successful');
        return createSendToken(adminUser, 200, res);
      } else {
        // Admin email but no admin user and no initial password set
        console.log('Admin user not found and no password in env');
        return res.status(401).json({
          status: 'error',
          message: 'Admin account not configured. Please set ADMIN_PASSWORD in environment variables.'
        });
      }
    }

    // 2) Check if user exists and password is correct
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user || !(await user.correctPassword(password, user.password))) {
      return res.status(401).json({
        status: 'error',
        message: 'Incorrect email or password'
      });
    }

    // 3) Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        status: 'error',
        message: 'Your account has been deactivated. Please contact support.'
      });
    }

    // 4) If everything ok, send token to client
    createSendToken(user, 200, res);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error during login'
    });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    
    res.status(200).json({
      status: 'success',
      user
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching user data'
    });
  }
});

// Get current user (alternative endpoint)
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    
    res.status(200).json({
      status: 'success',
      user
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching user data'
    });
  }
});

// Update password
router.patch('/update-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // 1) Get user from collection
    const user = await User.findById(req.userId).select('+password');

    // 2) Check if current password is correct
    if (!(await user.correctPassword(currentPassword, user.password))) {
      return res.status(401).json({
        status: 'error',
        message: 'Your current password is incorrect'
      });
    }

    // 3) If so, update password
    user.password = newPassword;
    user.passwordChangedAt = new Date();
    await user.save();

    // 4) Log user in, send JWT
    createSendToken(user, 200, res);
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error updating password'
    });
  }
});

// Logout (client-side token removal)
router.post('/logout', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Logged out successfully'
  });
});

export { router as authRouter };