// ============================================
// THE BILL — Push Notification Server
// Express + web-push + node-cron
// ============================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const webpush = require('web-push');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const SUBS_FILE = path.join(__dirname, 'subscriptions.json');

// ---- Middleware ----
app.use(cors());
app.use(express.json());

// ---- VAPID Configuration ----
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@thebill.app';

if (!VAPID_PUBLIC || !VAPID_PRIVATE || VAPID_PUBLIC === 'YOUR_VAPID_PUBLIC_KEY_HERE') {
    console.warn('⚠️  VAPID keys not configured. Run: npx web-push generate-vapid-keys');
    console.warn('   Then update your .env file with the generated keys.');
} else {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    console.log('✅ VAPID keys configured');
}

// ---- Subscriptions Store ----
function loadSubscriptions() {
    try {
        if (fs.existsSync(SUBS_FILE)) {
            return JSON.parse(fs.readFileSync(SUBS_FILE, 'utf-8'));
        }
    } catch (e) {
        console.error('Error loading subscriptions:', e);
    }
    return [];
}

function saveSubscriptions(subs) {
    fs.writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2));
}

let subscriptions = loadSubscriptions();

// ============================================
// API ENDPOINTS
// ============================================

// ---- Get VAPID public key ----
app.get('/vapid-public-key', (req, res) => {
    res.json({ key: VAPID_PUBLIC || '' });
});

// ---- Subscribe ----
app.post('/subscribe', (req, res) => {
    const { subscription, userId } = req.body;

    if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ error: 'Invalid subscription' });
    }

    // Check if already subscribed
    const exists = subscriptions.find(s => s.subscription.endpoint === subscription.endpoint);
    if (!exists) {
        subscriptions.push({
            subscription,
            userId: userId || 'anonymous',
            createdAt: new Date().toISOString(),
            remindersEnabled: true
        });
        saveSubscriptions(subscriptions);
        console.log(`📩 New subscription from ${userId || 'anonymous'}`);
    }

    res.json({ success: true, message: 'Subscribed' });
});

// ---- Unsubscribe ----
app.post('/unsubscribe', (req, res) => {
    const { endpoint } = req.body;

    if (!endpoint) {
        return res.status(400).json({ error: 'Missing endpoint' });
    }

    subscriptions = subscriptions.filter(s => s.subscription.endpoint !== endpoint);
    saveSubscriptions(subscriptions);
    console.log('🗑️  Unsubscribed endpoint');

    res.json({ success: true, message: 'Unsubscribed' });
});

// ---- Toggle Reminders ----
app.post('/toggle-reminder', (req, res) => {
    const { endpoint, enabled } = req.body;

    const sub = subscriptions.find(s => s.subscription.endpoint === endpoint);
    if (sub) {
        sub.remindersEnabled = enabled;
        saveSubscriptions(subscriptions);
    }

    res.json({ success: true });
});

// ---- Update Reminders for user ----
app.post('/update-reminders', (req, res) => {
    const { userId, enabled } = req.body;

    subscriptions.forEach(sub => {
        if (sub.userId === userId) {
            sub.remindersEnabled = enabled;
        }
    });
    saveSubscriptions(subscriptions);

    res.json({ success: true });
});

// ---- Send Test Notification ----
app.post('/send-test', async (req, res) => {
    const { endpoint } = req.body;

    const sub = subscriptions.find(s => s.subscription.endpoint === endpoint);
    if (!sub) {
        return res.status(404).json({ error: 'Subscription not found' });
    }

    const payload = JSON.stringify({
        title: '🧾 The Bill',
        body: '¡Esta es una notificación de prueba!',
        icon: '/icon-192.png',
        data: { url: '/' }
    });

    try {
        await webpush.sendNotification(sub.subscription, payload);
        res.json({ success: true, message: 'Test notification sent' });
    } catch (error) {
        console.error('Push error:', error);
        if (error.statusCode === 410) {
            // Subscription expired
            subscriptions = subscriptions.filter(s => s.subscription.endpoint !== endpoint);
            saveSubscriptions(subscriptions);
        }
        res.status(500).json({ error: 'Failed to send notification' });
    }
});

// ---- Send to all (admin) ----
app.post('/send-all', async (req, res) => {
    const { title, body } = req.body;

    const payload = JSON.stringify({
        title: title || '🧾 The Bill',
        body: body || 'Tenés novedades',
        icon: '/icon-192.png',
        data: { url: '/' }
    });

    let sent = 0;
    let failed = 0;
    const expired = [];

    for (const sub of subscriptions) {
        try {
            await webpush.sendNotification(sub.subscription, payload);
            sent++;
        } catch (error) {
            failed++;
            if (error.statusCode === 410) {
                expired.push(sub.subscription.endpoint);
            }
        }
    }

    // Clean expired
    if (expired.length > 0) {
        subscriptions = subscriptions.filter(s => !expired.includes(s.subscription.endpoint));
        saveSubscriptions(subscriptions);
    }

    res.json({ success: true, sent, failed, cleaned: expired.length });
});

// ============================================
// SCHEDULED REMINDERS (Example: daily at 20:00)
// ============================================

cron.schedule('0 20 * * *', async () => {
    console.log('⏰ Running scheduled reminder...');

    const payload = JSON.stringify({
        title: '🧾 The Bill',
        body: '¿Saliste a comer? ¡Usá The Bill para dividir la cuenta!',
        icon: '/icon-192.png',
        data: { url: '/' }
    });

    const expired = [];

    for (const sub of subscriptions) {
        if (!sub.remindersEnabled) continue;

        try {
            await webpush.sendNotification(sub.subscription, payload);
        } catch (error) {
            if (error.statusCode === 410) {
                expired.push(sub.subscription.endpoint);
            }
        }
    }

    if (expired.length > 0) {
        subscriptions = subscriptions.filter(s => !expired.includes(s.subscription.endpoint));
        saveSubscriptions(subscriptions);
        console.log(`🗑️  Cleaned ${expired.length} expired subscriptions`);
    }
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        subscriptions: subscriptions.length,
        vapidConfigured: !!VAPID_PUBLIC && VAPID_PUBLIC !== 'YOUR_VAPID_PUBLIC_KEY_HERE'
    });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
    console.log(`\n🧾 The Bill Push Server running on http://localhost:${PORT}`);
    console.log(`   Subscriptions: ${subscriptions.length}`);
    console.log(`   Health: http://localhost:${PORT}/health\n`);
});
