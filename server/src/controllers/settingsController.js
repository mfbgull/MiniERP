const db = require('../config/database');

// Get all settings
function getSettings(req, res) {
  try {
    const settings = db.prepare('SELECT * FROM settings').all();

    // Convert to key-value object
    const settingsObj = settings.reduce((acc, setting) => {
      acc[setting.key] = {
        value: setting.value,
        description: setting.description,
        updated_at: setting.updated_at
      };
      return acc;
    }, {});

    res.json(settingsObj);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
}

// Get a specific setting
function getSetting(req, res) {
  try {
    const { key } = req.params;
    const setting = db.prepare('SELECT * FROM settings WHERE key = ?').get(key);

    if (!setting) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    res.json(setting);
  } catch (error) {
    console.error('Get setting error:', error);
    res.status(500).json({ error: 'Failed to fetch setting' });
  }
}

// Update or create a setting
function updateSetting(req, res) {
  try {
    const { key } = req.params;
    const { value, description } = req.body;

    if (!value) {
      return res.status(400).json({ error: 'Value is required' });
    }

    // Check if setting exists
    const existing = db.prepare('SELECT * FROM settings WHERE key = ?').get(key);

    if (existing) {
      // Update existing setting
      db.prepare(`
        UPDATE settings
        SET value = ?, description = ?, updated_at = CURRENT_TIMESTAMP
        WHERE key = ?
      `).run(value, description || existing.description, key);
    } else {
      // Insert new setting
      db.prepare(`
        INSERT INTO settings (key, value, description)
        VALUES (?, ?, ?)
      `).run(key, value, description || null);
    }

    const updated = db.prepare('SELECT * FROM settings WHERE key = ?').get(key);
    res.json(updated);
  } catch (error) {
    console.error('Update setting error:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
}

// Update multiple settings at once
function updateSettings(req, res) {
  try {
    const settings = req.body; // { key: value, key2: value2, ... }

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Invalid settings data' });
    }

    const transaction = db.transaction(() => {
      Object.entries(settings).forEach(([key, data]) => {
        const value = typeof data === 'object' ? data.value : data;
        const description = typeof data === 'object' ? data.description : null;

        const existing = db.prepare('SELECT * FROM settings WHERE key = ?').get(key);

        if (existing) {
          db.prepare(`
            UPDATE settings
            SET value = ?, description = ?, updated_at = CURRENT_TIMESTAMP
            WHERE key = ?
          `).run(value, description || existing.description, key);
        } else {
          db.prepare(`
            INSERT INTO settings (key, value, description)
            VALUES (?, ?, ?)
          `).run(key, value, description);
        }
      });
    });

    transaction();

    const allSettings = db.prepare('SELECT * FROM settings').all();
    const settingsObj = allSettings.reduce((acc, setting) => {
      acc[setting.key] = {
        value: setting.value,
        description: setting.description,
        updated_at: setting.updated_at
      };
      return acc;
    }, {});

    res.json(settingsObj);
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
}

// Initialize default settings if they don't exist
function initializeDefaults() {
  const defaults = [
    { key: 'currency_symbol', value: '$', description: 'Currency symbol displayed throughout the application' },
    { key: 'currency_code', value: 'USD', description: 'Currency code (e.g., USD, EUR, PKR)' },
    { key: 'company_name', value: 'Mini ERP', description: 'Company name' },
    { key: 'date_format', value: 'MM/DD/YYYY', description: 'Date format preference' },
    { key: 'decimal_places', value: '2', description: 'Number of decimal places for currency' }
  ];

  defaults.forEach(({ key, value, description }) => {
    const existing = db.prepare('SELECT * FROM settings WHERE key = ?').get(key);
    if (!existing) {
      db.prepare(`
        INSERT INTO settings (key, value, description)
        VALUES (?, ?, ?)
      `).run(key, value, description);
    }
  });
}

module.exports = {
  getSettings,
  getSetting,
  updateSetting,
  updateSettings,
  initializeDefaults
};
