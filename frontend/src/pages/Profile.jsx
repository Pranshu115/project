import React, { useState, useEffect } from 'react';
import { User, Building, MapPin, Phone, Mail, FileText, Plus, Edit, Save, X } from 'lucide-react';
import './Profile.css';

const Profile = ({ user }) => {
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setProfile(data.profile);
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profile)
      });
      setEditing(false);
    } catch (error) {
      console.error('Failed to save profile:', error);
    }
  };

  if (loading) {
    return (
      <div className="profile-loading">
        <div className="spinner" />
        <p>Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <div className="profile-header">
        <div className="profile-title">
          <User size={24} />
          <h1>Company Profile</h1>
        </div>
        <div className="profile-actions">
          {editing ? (
            <>
              <button className="btn-secondary" onClick={() => setEditing(false)}>
                <X size={18} />
                Cancel
              </button>
              <button className="btn-primary" onClick={handleSave}>
                <Save size={18} />
                Save Changes
              </button>
            </>
          ) : (
            <button className="btn-primary" onClick={() => setEditing(true)}>
              <Edit size={18} />
              Edit Profile
            </button>
          )}
        </div>
      </div>

      {user?.userType === 'service_provider' ? (
        <ServiceProviderProfile 
          profile={profile} 
          setProfile={setProfile} 
          editing={editing} 
        />
      ) : (
        <SupplierProfile 
          profile={profile} 
          setProfile={setProfile} 
          editing={editing} 
        />
      )}
    </div>
  );
};

const ServiceProviderProfile = ({ profile, setProfile, editing }) => {
  const addProject = () => {
    const newProject = {
      id: Date.now(),
      name: '',
      address: '',
      googleLocation: '',
      siteInCharge: '',
      contactDetails: { phone: '', email: '' }
    };
    setProfile({
      ...profile,
      projects: [...(profile?.projects || []), newProject]
    });
  };

  const updateProject = (projectId, field, value) => {
    setProfile({
      ...profile,
      projects: profile.projects.map(project =>
        project.id === projectId ? { ...project, [field]: value } : project
      )
    });
  };

  const removeProject = (projectId) => {
    setProfile({
      ...profile,
      projects: profile.projects.filter(project => project.id !== projectId)
    });
  };

  return (
    <div className="profile-content">
      {/* Basic Information */}
      <div className="profile-section">
        <h2>
          <Building size={20} />
          Company Information
        </h2>
        <div className="form-grid">
          <div className="form-group">
            <label>Company Name</label>
            <input
              type="text"
              value={profile?.companyName || ''}
              onChange={(e) => setProfile({...profile, companyName: e.target.value})}
              disabled={!editing}
            />
          </div>
          <div className="form-group">
            <label>GSTIN</label>
            <input
              type="text"
              value={profile?.gstin || ''}
              onChange={(e) => setProfile({...profile, gstin: e.target.value})}
              disabled={!editing}
              placeholder="22AAAAA0000A1Z5"
            />
          </div>
          <div className="form-group">
            <label>Contact Person</label>
            <input
              type="text"
              value={profile?.contactPerson || ''}
              onChange={(e) => setProfile({...profile, contactPerson: e.target.value})}
              disabled={!editing}
            />
          </div>
          <div className="form-group">
            <label>Phone Number</label>
            <input
              type="tel"
              value={profile?.phone || ''}
              onChange={(e) => setProfile({...profile, phone: e.target.value})}
              disabled={!editing}
            />
          </div>
          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              value={profile?.email || ''}
              onChange={(e) => setProfile({...profile, email: e.target.value})}
              disabled={!editing}
            />
          </div>
        </div>
      </div>

      {/* Project Addresses */}
      <div className="profile-section">
        <div className="section-header">
          <h2>
            <MapPin size={20} />
            Project Addresses
          </h2>
          {editing && (
            <button className="btn-add" onClick={addProject}>
              <Plus size={16} />
              Add Project
            </button>
          )}
        </div>

        <div className="projects-list">
          {(profile?.projects || []).map((project) => (
            <div key={project.id} className="project-card">
              <div className="project-header">
                <input
                  type="text"
                  value={project.name}
                  onChange={(e) => updateProject(project.id, 'name', e.target.value)}
                  disabled={!editing}
                  placeholder="Project Name"
                  className="project-name-input"
                />
                {editing && (
                  <button 
                    className="btn-remove"
                    onClick={() => removeProject(project.id)}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              
              <div className="form-grid">
                <div className="form-group span-2">
                  <label>Address</label>
                  <textarea
                    value={project.address}
                    onChange={(e) => updateProject(project.id, 'address', e.target.value)}
                    disabled={!editing}
                    rows="2"
                  />
                </div>
                <div className="form-group span-2">
                  <label>Google Location</label>
                  <input
                    type="text"
                    value={project.googleLocation}
                    onChange={(e) => updateProject(project.id, 'googleLocation', e.target.value)}
                    disabled={!editing}
                    placeholder="Google Maps URL or coordinates"
                  />
                </div>
                <div className="form-group">
                  <label>Site In-Charge</label>
                  <input
                    type="text"
                    value={project.siteInCharge}
                    onChange={(e) => updateProject(project.id, 'siteInCharge', e.target.value)}
                    disabled={!editing}
                  />
                </div>
                <div className="form-group">
                  <label>Contact Phone</label>
                  <input
                    type="tel"
                    value={project.contactDetails?.phone || ''}
                    onChange={(e) => updateProject(project.id, 'contactDetails', {
                      ...project.contactDetails,
                      phone: e.target.value
                    })}
                    disabled={!editing}
                  />
                </div>
                <div className="form-group span-2">
                  <label>Contact Email</label>
                  <input
                    type="email"
                    value={project.contactDetails?.email || ''}
                    onChange={(e) => updateProject(project.id, 'contactDetails', {
                      ...project.contactDetails,
                      email: e.target.value
                    })}
                    disabled={!editing}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const SupplierProfile = ({ profile, setProfile, editing }) => {
  const addBranch = () => {
    const newBranch = {
      id: Date.now(),
      name: '',
      address: '',
      gstin: '',
      email: '',
      phone: '',
      inCharge: ''
    };
    setProfile({
      ...profile,
      branches: [...(profile?.branches || []), newBranch]
    });
  };

  const updateBranch = (branchId, field, value) => {
    setProfile({
      ...profile,
      branches: profile.branches.map(branch =>
        branch.id === branchId ? { ...branch, [field]: value } : branch
      )
    });
  };

  const removeBranch = (branchId) => {
    setProfile({
      ...profile,
      branches: profile.branches.filter(branch => branch.id !== branchId)
    });
  };

  return (
    <div className="profile-content">
      {/* Basic Information */}
      <div className="profile-section">
        <h2>
          <Building size={20} />
          Company Information
        </h2>
        <div className="form-grid">
          <div className="form-group">
            <label>Company Name</label>
            <input
              type="text"
              value={profile?.companyName || ''}
              onChange={(e) => setProfile({...profile, companyName: e.target.value})}
              disabled={!editing}
            />
          </div>
          <div className="form-group">
            <label>Main GSTIN</label>
            <input
              type="text"
              value={profile?.mainGstin || ''}
              onChange={(e) => setProfile({...profile, mainGstin: e.target.value})}
              disabled={!editing}
              placeholder="22AAAAA0000A1Z5"
            />
          </div>
          <div className="form-group">
            <label>Contact Person</label>
            <input
              type="text"
              value={profile?.contactPerson || ''}
              onChange={(e) => setProfile({...profile, contactPerson: e.target.value})}
              disabled={!editing}
            />
          </div>
          <div className="form-group">
            <label>Phone Number</label>
            <input
              type="tel"
              value={profile?.phone || ''}
              onChange={(e) => setProfile({...profile, phone: e.target.value})}
              disabled={!editing}
            />
          </div>
          <div className="form-group span-2">
            <label>Email Address</label>
            <input
              type="email"
              value={profile?.email || ''}
              onChange={(e) => setProfile({...profile, email: e.target.value})}
              disabled={!editing}
            />
          </div>
        </div>
      </div>

      {/* Branch Locations */}
      <div className="profile-section">
        <div className="section-header">
          <h2>
            <MapPin size={20} />
            Branch Locations
          </h2>
          {editing && (
            <button className="btn-add" onClick={addBranch}>
              <Plus size={16} />
              Add Branch
            </button>
          )}
        </div>

        <div className="branches-list">
          {(profile?.branches || []).map((branch) => (
            <div key={branch.id} className="branch-card">
              <div className="branch-header">
                <input
                  type="text"
                  value={branch.name}
                  onChange={(e) => updateBranch(branch.id, 'name', e.target.value)}
                  disabled={!editing}
                  placeholder="Branch Name"
                  className="branch-name-input"
                />
                {editing && (
                  <button 
                    className="btn-remove"
                    onClick={() => removeBranch(branch.id)}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              
              <div className="form-grid">
                <div className="form-group span-2">
                  <label>Address</label>
                  <textarea
                    value={branch.address}
                    onChange={(e) => updateBranch(branch.id, 'address', e.target.value)}
                    disabled={!editing}
                    rows="2"
                  />
                </div>
                <div className="form-group">
                  <label>Branch GSTIN</label>
                  <input
                    type="text"
                    value={branch.gstin}
                    onChange={(e) => updateBranch(branch.id, 'gstin', e.target.value)}
                    disabled={!editing}
                    placeholder="22AAAAA0000A1Z5"
                  />
                </div>
                <div className="form-group">
                  <label>Branch In-Charge</label>
                  <input
                    type="text"
                    value={branch.inCharge}
                    onChange={(e) => updateBranch(branch.id, 'inCharge', e.target.value)}
                    disabled={!editing}
                  />
                </div>
                <div className="form-group">
                  <label>Phone Number</label>
                  <input
                    type="tel"
                    value={branch.phone}
                    onChange={(e) => updateBranch(branch.id, 'phone', e.target.value)}
                    disabled={!editing}
                  />
                </div>
                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    value={branch.email}
                    onChange={(e) => updateBranch(branch.id, 'email', e.target.value)}
                    disabled={!editing}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Profile;