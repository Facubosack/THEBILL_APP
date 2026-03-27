// ============================================
// THE BILL — Main Application
// SPA Navigation | Firebase Auth | Dark Mode
// ============================================

// ---- Firebase Config ----
// TODO: Replace with your actual Firebase config
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// ---- Initialize Firebase ----
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ---- App State ----
const state = {
    currentScreen: 'screen-loading',
    previousScreen: null,
    user: null,
    darkMode: false,
    isFirstVisit: true,
    currentRoom: null,
    navigationHistory: []
};

// ---- Push Server URL ----
const PUSH_SERVER_URL = 'http://localhost:3001';

// ============================================
// SPA NAVIGATION
// ============================================

function showScreen(targetId, addToHistory = true) {
    const screens = document.querySelectorAll('.screen');
    screens.forEach(s => s.classList.remove('active'));

    const target = document.getElementById(targetId);
    if (target) {
        target.classList.add('active');

        if (addToHistory && state.currentScreen !== targetId) {
            state.navigationHistory.push(state.currentScreen);
        }
        state.previousScreen = state.currentScreen;
        state.currentScreen = targetId;
    }

    // Update bottom nav active state
    updateBottomNav(targetId);
}

function goBack() {
    if (state.navigationHistory.length > 0) {
        const prev = state.navigationHistory.pop();
        showScreen(prev, false);
    } else {
        showScreen('screen-home', false);
    }
}

function updateBottomNav(screenId) {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.classList.remove('active');
        if (item.dataset.screen === screenId) {
            item.classList.add('active');
        }
    });
}

// ============================================
// LOADING SCREEN
// ============================================

function initLoadingScreen() {
    // Show loading for 2 seconds, then check auth
    setTimeout(() => {
        checkAuthState();
    }, 2000);
}

// ============================================
// AUTH STATE (Mocked for UI Testing)
// ============================================

function checkAuthState() {
    // Mock check: see if we saved a fake session
    const isMockLoggedIn = localStorage.getItem('tb_mock_logged_in') === 'true';

    if (isMockLoggedIn) {
        state.user = {
            uid: 'test-user-123',
            displayName: 'Facundo',
            email: 'facundo@test.com',
            photoURL: '' // Empty so it shows the default styling
        };
        populateUserData(state.user);
        showScreen('screen-home');
    } else {
        state.user = null;
        state.isFirstVisit = !localStorage.getItem('tb_visited');
        showScreen('screen-login');
    }
}

// ---- Google Login (Mocked) ----
async function loginWithGoogle() {
    try {
        // Simulate network delay
        showToast('Iniciando sesión...');
        await new Promise(r => setTimeout(r, 800));

        // Create mock user
        const mockUser = {
            uid: 'test-user-123',
            displayName: 'Facundo',
            email: 'facundo@test.com',
            photoURL: ''
        };

        state.user = mockUser;
        localStorage.setItem('tb_visited', 'true');
        localStorage.setItem('tb_mock_logged_in', 'true');

        populateUserData(mockUser);
        showScreen('screen-home');
        showToast('¡Bienvenido/a, ' + getFirstName(mockUser.displayName) + '! 🎉');
    } catch (error) {
        console.error('Login error:', error);
        showToast('Error al iniciar sesión');
    }
}

// ---- Logout (Mocked) ----
async function logout() {
    try {
        localStorage.removeItem('tb_mock_logged_in');
        state.user = null;
        state.navigationHistory = [];
        showScreen('screen-login', false);
        showToast('Sesión cerrada');
    } catch (error) {
        console.error('Logout error:', error);
        showToast('Error al cerrar sesión');
    }
}

// ---- Populate User Data ----
function populateUserData(user) {
    if (!user) return;

    const firstName = getFirstName(user.displayName);

    // Home greeting
    const greeting = document.getElementById('greeting-text');
    if (greeting) {
        greeting.textContent = getGreeting() + ', ' + firstName + '!';
    }

    // Header avatar
    const avatar = document.getElementById('user-avatar');
    if (avatar && user.photoURL) {
        avatar.src = user.photoURL;
        avatar.alt = user.displayName || 'Avatar';
    }

    // Settings
    const settingsAvatar = document.getElementById('settings-avatar');
    if (settingsAvatar && user.photoURL) {
        settingsAvatar.src = user.photoURL;
    }

    const settingsName = document.getElementById('settings-user-name');
    if (settingsName) {
        settingsName.textContent = user.displayName || 'Usuario';
    }

    const settingsEmail = document.getElementById('settings-user-email');
    if (settingsEmail) {
        settingsEmail.textContent = user.email || '';
    }
}

// ---- Greeting based on time ----
function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 6) return '¡Buenas noches';
    if (hour < 12) return '¡Buen día';
    if (hour < 19) return '¡Buenas tardes';
    return '¡Buenas noches';
}

function getFirstName(fullName) {
    if (!fullName) return 'amigo/a';
    return fullName.split(' ')[0];
}

// ============================================
// DARK MODE
// ============================================

function initDarkMode() {
    // Check saved preference
    const savedTheme = localStorage.getItem('tb_theme');
    if (savedTheme === 'dark') {
        enableDarkMode(true);
    } else if (savedTheme === 'light') {
        enableDarkMode(false);
    } else {
        // Follow system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        enableDarkMode(prefersDark);
    }
}

function enableDarkMode(enable) {
    state.darkMode = enable;
    document.documentElement.setAttribute('data-theme', enable ? 'dark' : 'light');
    localStorage.setItem('tb_theme', enable ? 'dark' : 'light');

    // Update toggle
    const toggle = document.getElementById('toggle-dark-mode');
    if (toggle) {
        toggle.checked = enable;
    }

    // Update theme color meta
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
        meta.content = enable ? '#0D0D11' : '#F5A623';
    }
}

// ============================================
// ROOM MANAGEMENT (UI Only - Phase 1)
// ============================================

function createRoom() {
    const nameInput = document.getElementById('input-restaurant-name');
    const tableInput = document.getElementById('input-table-number');

    const name = nameInput?.value?.trim();
    if (!name) {
        showToast('Ingresá el nombre del restaurante');
        nameInput?.focus();
        return;
    }

    // Generate room code
    const code = generateRoomCode();
    const table = tableInput?.value?.trim() || '';

    // For now, just show the code and navigate
    showToast('¡Sala creada! Código: ' + code);

    // TODO: Save to Firestore in Phase 2
    // For demo: show room screen
    const roomName = document.getElementById('room-name');
    const roomCode = document.getElementById('room-code-display');
    if (roomName) roomName.textContent = name;
    if (roomCode) roomCode.textContent = 'Código: ' + code;

    // Clear form
    nameInput.value = '';
    if (tableInput) tableInput.value = '';

    // Load demo menu
    loadDemoMenu();
    showScreen('screen-room');
}

function joinRoom() {
    const codeInput = document.getElementById('input-room-code');
    const code = codeInput?.value?.trim()?.toUpperCase();

    if (!code || code.length < 4) {
        showToast('Ingresá un código válido');
        return;
    }

    // TODO: Validate with Firestore in Phase 2
    showToast('Conectando a sala ' + code + '...');

    const roomName = document.getElementById('room-name');
    const roomCode = document.getElementById('room-code-display');
    if (roomName) roomName.textContent = 'Sala';
    if (roomCode) roomCode.textContent = 'Código: ' + code;

    // Clear input
    if (codeInput) codeInput.value = '';

    loadDemoMenu();
    showScreen('screen-room');
}

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// ============================================
// DEMO MENU (Phase 1 placeholder)
// ============================================

const DEMO_MENU = {
    categories: ['🍔 Platos', '🥤 Bebidas', '🍰 Postres'],
    items: [
        { name: 'Hamburguesa Clásica', price: 4500, desc: 'Carne, lechuga, tomate, queso', category: 0 },
        { name: 'Pizza Napolitana', price: 5200, desc: 'Mozzarella, tomate, albahaca', category: 0 },
        { name: 'Ensalada César', price: 3800, desc: 'Lechuga, parmesano, croutons', category: 0 },
        { name: 'Milanesa Napolitana', price: 5500, desc: 'Con papas fritas', category: 0 },
        { name: 'Coca-Cola', price: 1200, desc: '500ml', category: 1 },
        { name: 'Agua Mineral', price: 800, desc: '500ml', category: 1 },
        { name: 'Cerveza Artesanal', price: 2500, desc: 'Pinta IPA', category: 1 },
        { name: 'Limonada', price: 1500, desc: 'Con menta y jengibre', category: 1 },
        { name: 'Tiramisú', price: 3200, desc: 'Clásico italiano', category: 2 },
        { name: 'Flan Casero', price: 2800, desc: 'Con dulce de leche', category: 2 },
        { name: 'Brownie', price: 3000, desc: 'Con helado de vainilla', category: 2 }
    ]
};

let selectedCategory = 0;
let orderItems = [];
let currentModalItem = null;
let currentQty = 1;

function loadDemoMenu() {
    renderCategories();
    renderMenuItems(0);
    updateOrderBadge();
}

function renderCategories() {
    const container = document.getElementById('menu-categories');
    if (!container) return;

    container.innerHTML = DEMO_MENU.categories.map((cat, i) =>
        `<button class="category-tab ${i === selectedCategory ? 'active' : ''}" data-category="${i}">${cat}</button>`
    ).join('');

    container.querySelectorAll('.category-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            selectedCategory = parseInt(tab.dataset.category);
            renderCategories();
            renderMenuItems(selectedCategory);
        });
    });
}

function renderMenuItems(categoryIndex) {
    const container = document.getElementById('menu-items');
    if (!container) return;

    const items = DEMO_MENU.items.filter(item => item.category === categoryIndex);

    container.innerHTML = items.map((item, i) =>
        `<div class="menu-card" data-item-index="${DEMO_MENU.items.indexOf(item)}">
            <div class="menu-card-info">
                <h4 class="menu-card-name">${item.name}</h4>
                <p class="menu-card-desc">${item.desc}</p>
                <span class="menu-card-price">$${item.price.toLocaleString('es-AR')}</span>
            </div>
            <button class="menu-card-add" aria-label="Agregar ${item.name}">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
            </button>
        </div>`
    ).join('');

    container.querySelectorAll('.menu-card-add').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const card = btn.closest('.menu-card');
            const itemIndex = parseInt(card.dataset.itemIndex);
            openAddItemModal(DEMO_MENU.items[itemIndex]);
        });
    });
}

// ============================================
// ORDER MANAGEMENT
// ============================================

function openAddItemModal(item) {
    currentModalItem = item;
    currentQty = 1;

    const modal = document.getElementById('modal-add-item');
    const name = document.getElementById('modal-item-name');
    const price = document.getElementById('modal-item-price');
    const desc = document.getElementById('modal-item-desc');
    const qtyDisplay = document.getElementById('qty-value');
    const total = document.getElementById('modal-total');

    if (name) name.textContent = item.name;
    if (price) price.textContent = '$' + item.price.toLocaleString('es-AR');
    if (desc) desc.textContent = item.desc;
    if (qtyDisplay) qtyDisplay.textContent = '1';
    if (total) total.textContent = '$' + item.price.toLocaleString('es-AR');

    // Reset payer options
    document.querySelectorAll('.payer-option').forEach(opt => opt.classList.remove('active'));
    const defaultPayer = document.querySelector('.payer-option[data-payer="me"]');
    if (defaultPayer) defaultPayer.classList.add('active');

    const splitSection = document.getElementById('split-section');
    if (splitSection) splitSection.style.display = 'none';

    if (modal) modal.classList.add('active');
}

function closeAddItemModal() {
    const modal = document.getElementById('modal-add-item');
    if (modal) modal.classList.remove('active');
    currentModalItem = null;
}

function updateQty(delta) {
    currentQty = Math.max(1, Math.min(20, currentQty + delta));
    const qtyDisplay = document.getElementById('qty-value');
    const total = document.getElementById('modal-total');

    if (qtyDisplay) qtyDisplay.textContent = currentQty;
    if (total && currentModalItem) {
        total.textContent = '$' + (currentModalItem.price * currentQty).toLocaleString('es-AR');
    }
}

function addToOrder() {
    if (!currentModalItem) return;

    const existingIndex = orderItems.findIndex(item => item.name === currentModalItem.name);
    if (existingIndex >= 0) {
        orderItems[existingIndex].qty += currentQty;
    } else {
        orderItems.push({
            name: currentModalItem.name,
            price: currentModalItem.price,
            qty: currentQty,
            desc: currentModalItem.desc
        });
    }

    updateOrderBadge();
    closeAddItemModal();
    showToast(currentQty + 'x ' + currentModalItem.name + ' agregado');
}

function updateOrderBadge() {
    const badge = document.getElementById('order-count');
    const totalItems = orderItems.reduce((sum, item) => sum + item.qty, 0);
    if (badge) {
        badge.textContent = totalItems;
        badge.style.display = totalItems > 0 ? 'flex' : 'none';
    }
}

function showOrderSummary() {
    const container = document.getElementById('order-items-list');
    if (!container) return;

    if (orderItems.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🛒</div>
                <p class="empty-text">Tu pedido está vacío</p>
                <p class="empty-sub">Agregá items del menú</p>
            </div>`;
        document.getElementById('order-summary-card').style.display = 'none';
        document.getElementById('btn-confirm-order').style.display = 'none';
    } else {
        container.innerHTML = orderItems.map((item, i) =>
            `<div class="order-item-card">
                <div class="order-item-info">
                    <h4>${item.name}</h4>
                    <p class="order-item-qty">${item.qty}x $${item.price.toLocaleString('es-AR')}</p>
                </div>
                <div class="order-item-right">
                    <span class="order-item-total">$${(item.price * item.qty).toLocaleString('es-AR')}</span>
                    <button class="order-item-remove" data-index="${i}" aria-label="Eliminar">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
            </div>`
        ).join('');

        const subtotal = orderItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
        document.getElementById('order-subtotal').textContent = '$' + subtotal.toLocaleString('es-AR');
        document.getElementById('order-total').textContent = '$' + subtotal.toLocaleString('es-AR');
        document.getElementById('order-summary-card').style.display = 'block';
        document.getElementById('btn-confirm-order').style.display = 'flex';

        // Bind remove buttons
        container.querySelectorAll('.order-item-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.index);
                orderItems.splice(idx, 1);
                updateOrderBadge();
                showOrderSummary();
            });
        });
    }

    showScreen('screen-order');
}

// ============================================
// CONFIRM MODAL
// ============================================

let confirmCallback = null;

function showConfirm(text, callback) {
    const modal = document.getElementById('modal-confirm');
    const textEl = document.getElementById('modal-confirm-text');
    if (textEl) textEl.textContent = text;
    confirmCallback = callback;
    if (modal) modal.classList.add('active');
}

function closeConfirm() {
    const modal = document.getElementById('modal-confirm');
    if (modal) modal.classList.remove('active');
    confirmCallback = null;
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================

let toastTimer = null;

function showToast(message, duration = 3000) {
    const toast = document.getElementById('toast');
    const text = document.getElementById('toast-text');

    if (!toast || !text) return;

    clearTimeout(toastTimer);
    text.textContent = message;
    toast.classList.add('active');

    toastTimer = setTimeout(() => {
        toast.classList.remove('active');
    }, duration);
}

// ============================================
// PUSH NOTIFICATIONS
// ============================================

async function subscribeToPush() {
    try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            showToast('Tu navegador no soporta notificaciones push');
            return false;
        }

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            showToast('Permiso de notificaciones denegado');
            return false;
        }

        const reg = await navigator.serviceWorker.ready;

        // Get VAPID key from server
        let vapidKey;
        try {
            const res = await fetch(PUSH_SERVER_URL + '/vapid-public-key');
            const data = await res.json();
            vapidKey = data.key;
        } catch (e) {
            console.warn('Push server not available:', e);
            showToast('Servidor de push no disponible');
            return false;
        }

        const subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey)
        });

        // Send subscription to server
        await fetch(PUSH_SERVER_URL + '/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subscription,
                userId: state.user?.uid || 'anonymous'
            })
        });

        showToast('¡Notificaciones activadas! 🔔');
        return true;
    } catch (error) {
        console.error('Push subscription error:', error);
        showToast('Error al activar notificaciones');
        return false;
    }
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

// ============================================
// DATA RESET
// ============================================

function resetAllData() {
    showConfirm('¿Borrar todos tus datos? Esta acción no se puede deshacer.', async () => {
        try {
            localStorage.clear();
            orderItems = [];
            state.navigationHistory = [];

            // TODO: Delete Firestore data in Phase 2

            closeConfirm();
            showToast('Datos borrados correctamente');
            await logout();
        } catch (error) {
            console.error('Reset error:', error);
            showToast('Error al borrar datos');
        }
    });
}

// ============================================
// SERVICE WORKER REGISTRATION
// ============================================

async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const reg = await navigator.serviceWorker.register('/sw.js');
            console.log('[App] Service Worker registered:', reg.scope);
        } catch (error) {
            console.error('[App] SW registration failed:', error);
        }
    }
}

// ============================================
// SHARE ROOM
// ============================================

async function shareRoom() {
    const roomCode = document.getElementById('room-code-display')?.textContent?.replace('Código: ', '') || '';
    const roomName = document.getElementById('room-name')?.textContent || 'Sala';

    const shareData = {
        title: 'The Bill - ' + roomName,
        text: '¡Unite a mi sala en The Bill! Código: ' + roomCode,
        url: window.location.origin + '?join=' + roomCode
    };

    if (navigator.share) {
        try {
            await navigator.share(shareData);
        } catch (err) {
            if (err.name !== 'AbortError') {
                copyToClipboard(roomCode);
            }
        }
    } else {
        copyToClipboard(roomCode);
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Código copiado: ' + text);
    }).catch(() => {
        showToast('Código: ' + text);
    });
}

// ============================================
// EVENT LISTENERS
// ============================================

function initEventListeners() {
    // --- Login ---
    document.getElementById('btn-google-login')?.addEventListener('click', loginWithGoogle);

    // --- Header Actions ---
    document.getElementById('btn-settings')?.addEventListener('click', () => showScreen('screen-settings'));
    document.getElementById('btn-profile')?.addEventListener('click', () => showScreen('screen-settings'));

    // --- Home Actions ---
    document.getElementById('btn-create-room')?.addEventListener('click', () => showScreen('screen-create-room'));
    document.getElementById('btn-join-room')?.addEventListener('click', () => showScreen('screen-join-room'));

    // --- Back Buttons ---
    document.getElementById('btn-back-join')?.addEventListener('click', goBack);
    document.getElementById('btn-back-create')?.addEventListener('click', goBack);
    document.getElementById('btn-back-room')?.addEventListener('click', () => {
        orderItems = [];
        updateOrderBadge();
        showScreen('screen-home', false);
        state.navigationHistory = [];
    });
    document.getElementById('btn-back-order')?.addEventListener('click', goBack);
    document.getElementById('btn-back-settings')?.addEventListener('click', goBack);
    document.getElementById('btn-back-activity')?.addEventListener('click', goBack);

    // --- Submit Room ---
    document.getElementById('btn-submit-create')?.addEventListener('click', createRoom);
    document.getElementById('btn-submit-join')?.addEventListener('click', joinRoom);

    // --- Room Code Input ---
    const codeInput = document.getElementById('input-room-code');
    codeInput?.addEventListener('input', () => {
        const val = codeInput.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        codeInput.value = val;
        document.getElementById('btn-submit-join').disabled = val.length < 4;
    });

    // --- Room Actions ---
    document.getElementById('btn-share-room')?.addEventListener('click', shareRoom);
    document.getElementById('btn-my-order')?.addEventListener('click', showOrderSummary);

    // --- Add Item Modal ---
    document.getElementById('modal-close-add')?.addEventListener('click', closeAddItemModal);
    document.getElementById('qty-minus')?.addEventListener('click', () => updateQty(-1));
    document.getElementById('qty-plus')?.addEventListener('click', () => updateQty(1));
    document.getElementById('btn-add-to-order')?.addEventListener('click', addToOrder);

    // --- Payer Options ---
    document.querySelectorAll('.payer-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.payer-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');

            const splitSection = document.getElementById('split-section');
            if (splitSection) {
                splitSection.style.display = opt.dataset.payer === 'split' ? 'block' : 'none';
            }
        });
    });

    // --- Confirm Order ---
    document.getElementById('btn-confirm-order')?.addEventListener('click', () => {
        showToast('¡Pedido confirmado! 🎉');
        orderItems = [];
        updateOrderBadge();
        goBack();
    });

    // --- Confirm Modal ---
    document.getElementById('modal-confirm-cancel')?.addEventListener('click', closeConfirm);
    document.getElementById('modal-confirm-ok')?.addEventListener('click', () => {
        if (confirmCallback) confirmCallback();
    });

    // --- Settings ---
    document.getElementById('toggle-dark-mode')?.addEventListener('change', (e) => {
        enableDarkMode(e.target.checked);
    });

    document.getElementById('toggle-push')?.addEventListener('change', async (e) => {
        if (e.target.checked) {
            const success = await subscribeToPush();
            if (!success) e.target.checked = false;
        }
    });

    document.getElementById('btn-reset-data')?.addEventListener('click', resetAllData);
    document.getElementById('btn-logout')?.addEventListener('click', () => {
        showConfirm('¿Cerrar sesión?', logout);
    });

    // --- Bottom Nav ---
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const target = item.dataset.screen;
            if (target) showScreen(target);
        });
    });

    // --- Modal overlays: close on backdrop click ---
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('active');
            }
        });
    });

    // --- Handle back button (browser) ---
    window.addEventListener('popstate', (e) => {
        if (state.currentScreen !== 'screen-home' && state.currentScreen !== 'screen-login') {
            e.preventDefault();
            goBack();
        }
    });
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initDarkMode();
    initEventListeners();
    registerServiceWorker();
    initLoadingScreen();
});
