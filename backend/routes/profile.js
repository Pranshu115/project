import express from 'express';
import mongoose from 'mongoose';
import { authenticateToken } from './auth.js';
import User from '../models/User.js';

const router = express.Router();

// Get user profile
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ 
        status: 'error',
        message: 'User not found' 
      });
    }

    // Return profile structure based on user type
    const profile = createProfileResponse(user);
    res.json({ 
      status: 'success',
      profile 
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Internal server error' 
    });
  }
});

// Update user profile
router.put('/', authenticateToken, async (req, res) => {
  try {
    const profileData = req.body;
    
    // Prepare update data based on user type
    const updateData = {
      company: profileData.companyName,
      phone: profileData.phone,
      'address.street': profileData.address?.street,
      'address.city': profileData.address?.city,
      'address.state': profileData.address?.state,
      'address.zipCode': profileData.address?.zipCode,
      'profile.website': profileData.website,
      'profile.description': profileData.description
    };

    // Add user type specific fields
    if (profileData.userType === 'service_provider') {
      updateData['profile.gstin'] = profileData.gstin;
      updateData['profile.panNumber'] = profileData.panNumber;
      // Normalize projects - ensure they have proper IDs
      const projects = (profileData.projects || []).map(project => ({
        ...project,
        id: project.id || new mongoose.Types.ObjectId()
      }));
      updateData['profile.projects'] = projects;
    } else if (profileData.userType === 'supplier') {
      updateData['profile.businessType'] = profileData.businessType;
      updateData['profile.categories'] = profileData.categories || [];
      // Normalize branches - ensure they have proper IDs
      const branches = (profileData.branches || []).map(branch => ({
        ...branch,
        id: branch.id || new mongoose.Types.ObjectId()
      }));
      updateData['profile.branches'] = branches;
    }

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    const updatedUser = await User.findByIdAndUpdate(
      req.userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ 
        status: 'error',
        message: 'User not found' 
      });
    }

    const profile = createProfileResponse(updatedUser);
    res.json({ 
      status: 'success',
      message: 'Profile updated successfully',
      profile 
    });
  } catch (error) {
    console.error('Update profile error:', error);
    
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
      message: 'Internal server error' 
    });
  }
});

// Helper function to create profile response structure
function createProfileResponse(user) {
  const baseProfile = {
    userId: user._id,
    companyName: user.company || '',
    contactPerson: user.name,
    phone: user.phone || '',
    email: user.email,
    address: user.address || {},
    website: user.profile?.website || '',
    description: user.profile?.description || '',
    userType: user.userType,
    createdAt: user.createdAt
  };

  if (user.userType === 'service_provider') {
    return {
      ...baseProfile,
      gstin: user.profile?.gstin || '',
      panNumber: user.profile?.panNumber || '',
      projects: user.profile?.projects || []
    };
  } else if (user.userType === 'supplier') {
    return {
      ...baseProfile,
      businessType: user.profile?.businessType || '',
      categories: user.profile?.categories || [],
      branches: user.profile?.branches || []
    };
  }

  return baseProfile;
}

export { router as profileRouter };