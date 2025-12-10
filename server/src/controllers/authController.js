const bcrypt = require('bcrypt');
const db = require('../config/database');
const { generateToken } = require('../middleware/auth');

/**
 * Login user
 */
function login(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Find user
    const user = db.prepare(`
      SELECT id, username, email, password_hash, full_name, role, is_active
      FROM users
      WHERE username = ? AND is_active = 1
    `).get(username);

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Verify password
    const passwordMatch = bcrypt.compareSync(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Generate JWT token
    const token = generateToken(user);

    // Log activity
    db.prepare(`
      INSERT INTO activity_log (user_id, action, entity_type, description)
      VALUES (?, ?, ?, ?)
    `).run(user.id, 'LOGIN', 'User', `User ${username} logged in`);

    // Return user info and token (without password_hash)
    const { password_hash, ...userWithoutPassword } = user;

    res.json({
      success: true,
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
}

/**
 * Logout user (client-side token removal)
 */
function logout(req, res) {
  try {
    // Log activity
    db.prepare(`
      INSERT INTO activity_log (user_id, action, entity_type, description)
      VALUES (?, ?, ?, ?)
    `).run(req.user.id, 'LOGOUT', 'User', `User ${req.user.username} logged out`);

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
}

/**
 * Get current user info
 */
function getCurrentUser(req, res) {
  try {
    const user = db.prepare(`
      SELECT id, username, email, full_name, role, is_active, created_at
      FROM users
      WHERE id = ?
    `).get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
}

/**
 * Change password
 */
function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    // Get user with password hash
    const user = db.prepare(`
      SELECT id, password_hash
      FROM users
      WHERE id = ?
    `).get(req.user.id);

    // Verify current password
    const passwordMatch = bcrypt.compareSync(currentPassword, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const newPasswordHash = bcrypt.hashSync(newPassword, 8);

    // Update password
    db.prepare(`
      UPDATE users
      SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newPasswordHash, req.user.id);

    // Log activity
    db.prepare(`
      INSERT INTO activity_log (user_id, action, entity_type, description)
      VALUES (?, ?, ?, ?)
    `).run(req.user.id, 'UPDATE', 'User', 'Password changed');

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
}

module.exports = {
  login,
  logout,
  getCurrentUser,
  changePassword
};
