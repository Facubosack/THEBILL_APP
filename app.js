// ============================================
// THE BILL — Main Application
// SPA Navigation | Firebase Auth | Dark Mode
// ============================================

// ---- Firebase Config ----
// TODO: Replace with your actual Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyAdui9_mb0pKBFdgeWSvgG9Bqq4Wf1jZcg",
    authDomain: "the-bill-app-8a613.firebaseapp.com",
    projectId: "the-bill-app-8a613",
    storageBucket: "the-bill-app-8a613.firebasestorage.app",
    messagingSenderId: "942829686361",
    appId: "1:942829686361:web:74a5e7d92595821580ab48"
};

// ---- Initialize Firebase ----
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ---- Secondary Firebase App for Waiter Creation ----
const secondaryApp = firebase.initializeApp(firebaseConfig, "WaiterCreatorApp");

// ---- App State ----
const state = {
    currentScreen: 'screen-loading',
    previousScreen: null,
    user: null,
    darkMode: false,
    isFirstVisit: true,
    currentRoom: null,
    navigationHistory: [],
    authMode: 'login' // 'login' or 'register'
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

    // Hide bottom nav if it's the role dashboards, room, or login
    const nav = document.getElementById('main-nav');
    if (nav) {
        if (['screen-home', 'screen-activity', 'screen-order'].includes(targetId)) {
            nav.style.display = 'flex';
        } else {
            nav.style.display = 'none';
        }
    }

    // Update bottom nav active state
    updateBottomNav(targetId);
}

function goHome() {
    if (state.user?.role === 'owner') {
        showScreen('screen-owner-dashboard', false);
    } else if (state.user?.role === 'waiter') {
        showScreen('screen-waiter-dashboard', false);
    } else {
        showScreen('screen-home', false);
    }
    state.navigationHistory = [];
}

function goBack() {
    if (state.navigationHistory.length > 0) {
        const prev = state.navigationHistory.pop();
        if (prev === 'screen-role-select' || prev === 'screen-login') {
            goHome();
        } else {
            showScreen(prev, false);
        }
    } else {
        goHome();
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
    // Show loading briefly, then wait for Firebase Auth
    setTimeout(() => {
        // Fallback if auth state doesn't fire (e.g. no internet)
        if (state.currentScreen === 'screen-loading') {
            checkAuthState(); 
        }
    }, 3000);
}

// ============================================
// AUTH STATE & REAL DATABASE LOGIC
// ============================================

auth.onAuthStateChanged(async (user) => {
    if (user) {
        try {
            const userRef = db.collection('users').doc(user.uid);
            const doc = await userRef.get();
            let userData;
            
            if (doc.exists) {
                userData = doc.data();
            } else {
                // --- NEW USER CREATION FLOW ---
                let role = 'client';
                let restaurantId = null;
                
                // 1. Check if owner hash or intent
                if (window.location.hash === '#owner' || localStorage.getItem('tb_intent') === 'owner') {
                    role = 'owner';
                } else {
                    // 2. Check if email is in any restaurant's waiters list
                    const restsRef = db.collection('restaurants');
                    // We need to query all restaurants that have this email in their 'waiters' array
                    // Ensure the email is lowercase for comparison
                    const emailToCheck = user.email ? user.email.toLowerCase() : '';
                    if (emailToCheck) {
                        const snapshot = await restsRef.where('waiters', 'array-contains', emailToCheck).get();
                        if (!snapshot.empty) {
                            role = 'waiter';
                            restaurantId = snapshot.docs[0].id; // Assign to the first matching restaurant
                        }
                    }
                }
                
                userData = {
                    uid: user.uid,
                    email: user.email || '',
                    displayName: user.displayName || (user.email ? user.email.split('@')[0] : 'Usuario'),
                    photoURL: user.photoURL || '',
                    role: role,
                    restaurantId: restaurantId,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                await userRef.set(userData);
            }
            
            state.user = userData;
            populateUserData();
            routeUserByRole(userData.role);
            
            showToast('¡Bienvenido/a' + (userData.displayName ? ', ' + getFirstName(userData.displayName) : '') + '! 🎉');
            
        } catch(e) {
            console.error("Error setting up user:", e);
            showToast("Error conectando a la base de datos");
            showScreen('screen-login', false);
        }
    } else {
        state.user = null;
        if (state.currentScreen !== 'screen-login') {
            showScreen('screen-login', false);
        }
    }
});

function checkAuthState() {
    // Just a fallback since onAuthStateChanged handles routing now
    if (!auth.currentUser) {
        showScreen('screen-login', false);
    }
}
function routeUserByRole(role) {
    if (role === 'owner') {
        loadOwnerData();
    } else if (role === 'waiter') {
        showScreen('screen-waiter-dashboard');
        loadWaiterData();
    } else {
        showScreen('screen-home');
        loadClientData();
    }
}

// ============================================
// LOGIN / LOGOUT
// ============================================

async function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        await auth.signInWithPopup(provider);
        // onAuthStateChanged will handle routing
    } catch (error) {
        console.error("Google login error:", error);
        showToast('Error al iniciar sesión: ' + error.message);
    }
}

function toggleAuthMode(e) {
    if (e) e.preventDefault();
    state.authMode = state.authMode === 'login' ? 'register' : 'login';
    
    const btnAuth = document.getElementById('btn-email-auth');
    const toggleText = document.getElementById('auth-toggle-text');
    const toggleBtn = document.getElementById('btn-toggle-auth');
    
    if (state.authMode === 'login') {
        btnAuth.textContent = 'Iniciar Sesión';
        toggleText.textContent = '¿No tenés cuenta?';
        toggleBtn.textContent = 'Crear una';
    } else {
        btnAuth.textContent = 'Crear Cuenta';
        toggleText.textContent = '¿Ya tenés cuenta?';
        toggleBtn.textContent = 'Iniciar Sesión';
    }
}

async function loginWithEmail() {
    const emailInput = document.getElementById('input-login-email');
    const passInput = document.getElementById('input-login-password');
    const email = emailInput?.value?.toLowerCase()?.trim();
    const password = passInput?.value;
    
    if (!email || !password) {
        showToast('Por favor, ingresá email y contraseña.');
        return;
    }
    
    if (password.length < 6) {
        showToast('La contraseña debe tener al menos 6 caracteres.');
        return;
    }

    showToast(state.authMode === 'login' ? 'Iniciando sesión...' : 'Creando cuenta...');
    
    try {
        if (state.authMode === 'login') {
            await auth.signInWithEmailAndPassword(email, password);
        } else {
            await auth.createUserWithEmailAndPassword(email, password);
        }
    } catch (error) {
        console.error("Auth error:", error);
        let msg = 'Error: ' + error.message;
        if (error.code === 'auth/email-already-in-use') msg = 'Este email ya está registrado.';
        if (error.code === 'auth/wrong-password') msg = 'Contraseña incorrecta.';
        if (error.code === 'auth/user-not-found') msg = 'Usuario no encontrado. ¿Querés crear una cuenta?';
        if (error.code === 'auth/weak-password') msg = 'La contraseña es muy débil.';
        showToast(msg);
    }
}

async function logout() {
    try {
        await auth.signOut();
        state.user = null;
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
// ROOM & REALTIME MANAGEMENT
// ============================================

let roomUnsubscribe = null;
let ordersUnsubscribe = null;

function createRoom() {
    // Deprecated for Phase 2: Waiters create rooms instead of clients
    showToast('Usá la cuenta de Mozo para crear mesas.');
}

async function joinRoom() {
    const codeInput = document.getElementById('input-room-code');
    const code = codeInput?.value?.trim()?.toUpperCase();

    if (!code || code.length !== 6) {
        showToast('Ingresá un código válido (6 caracteres)');
        return;
    }

    showToast('Buscando mesa ' + code + '...');

    try {
        const docRef = db.collection('rooms').doc(code);
        const doc = await docRef.get();
        if (doc.exists && doc.data().status === 'active') {
            const roomData = doc.data();
            
            // Add client to participants
            const participant = {
                uid: state.user.uid,
                displayName: state.user.displayName,
                photoURL: state.user.photoURL || ''
            };
            
            const exists = roomData.participants.find(p => p.uid === state.user.uid);
            if (!exists) {
                await docRef.update({
                    participants: firebase.firestore.FieldValue.arrayUnion(participant)
                });
                roomData.participants.push(participant);
            }
            
            state.currentRoom = roomData;
            
            const roomName = document.getElementById('room-name');
            const roomCode = document.getElementById('room-code-display');
            if (roomName) roomName.textContent = state.currentRoom.table;
            if (roomCode) roomCode.textContent = 'Código: ' + code;
            
            codeInput.value = '';
            
            // Load real menu from Restaurant
            await loadRestaurantMenu(state.currentRoom.restaurantId);
            
            // Save to recent rooms
            addRecentRoom(state.currentRoom);
            
            showScreen('screen-room');
            listenToRoom(code);
        } else {
            showToast('Mesa no encontrada o está cerrada');
            codeInput.focus();
        }
    } catch(e) {
        console.error(e);
        showToast('Error al buscar mesa');
    }
}

function listenToRoom(code) {
    if (roomUnsubscribe) roomUnsubscribe();
    if (ordersUnsubscribe) ordersUnsubscribe();
    
    // Listen for participants
    roomUnsubscribe = db.collection('rooms').doc(code).onSnapshot(doc => {
        if (doc.exists) {
            state.currentRoom = doc.data();
            renderParticipantsUI();
        } else {
            showToast('La mesa ha sido cerrada por el mozo');
            goHome(); // return safely
        }
    });

    // Listen for orders
    ordersUnsubscribe = db.collection('rooms').doc(code).collection('orders').onSnapshot(snapshot => {
        const orders = [];
        snapshot.forEach(d => orders.push({ id: d.id, ...d.data() }));
        state.currentOrders = orders;
        renderRealtimeOrders();
        updateOrderBadge(); // Client's FAB
    });
}

function renderParticipantsUI() {
    const list = document.getElementById('participants-list');
    if (!list || !state.currentRoom) return;
    
    list.innerHTML = state.currentRoom.participants.map(p => `
        <div class="participant-avatar" title="${p.displayName}">
            ${p.photoURL ? `<img src="${p.photoURL}" alt="${p.displayName}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : getInitials(p.displayName)}
        </div>
    `).join('');
}

function getInitials(name) {
    if (!name) return '?';
    return name.substring(0, 2).toUpperCase();
}

function renderRealtimeOrders() {} // implementation placeholder

// ============================================
// OWNER DASHBOARD EXPANSION
// ============================================

async function loadOwnerData() {
    try {
        const snapshot = await db.collection('restaurants')
            .where('ownerId', '==', state.user.uid)
            .get();

        const restaurants = [];
        snapshot.forEach(doc => {
            restaurants.push({ id: doc.id, ...doc.data() });
        });

        state.ownerRestaurants = restaurants;

        if (restaurants.length === 0) {
            showScreen('screen-owner-dashboard');
        } else {
            showOwnerRestaurants();
        }
    } catch (e) {
        console.error("Error loading owner data:", e);
        showToast("Error al cargar tus locales");
    }
}

function showOwnerRestaurants() {
    const grid = document.getElementById('owner-bars-grid');
    if (!grid) return;

    if (state.ownerRestaurants.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; padding:40px; color:var(--text-sec);">No tenés locales creados.</p>';
    } else {
        grid.innerHTML = state.ownerRestaurants.map(bar => `
            <div class="bar-card" onclick="enterOwnerBarDetail('${bar.id}')">
                <div class="bar-card-icon">🏪</div>
                <div class="bar-card-name">${bar.name}</div>
                <div style="font-size:10px; color:var(--text-sec);">${bar.waiters?.length || 0} Mozos</div>
            </div>
        `).join('');
    }

    showScreen('screen-owner-restaurants');
}

let barTablesUnsubscribe = null;

async function enterOwnerBarDetail(barId) {
    const bar = state.ownerRestaurants.find(b => b.id === barId);
    if (!bar) return;

    state.selectedBar = bar;
    document.getElementById('bar-detail-title').textContent = bar.name;

    renderOwnerWaiters();
    renderOwnerMenu();
    
    // Build backward-compatible map of UID -> Email for old tables
    try {
        const usersSnap = await db.collection('users')
            .where('restaurantId', '==', barId)
            .where('role', '==', 'waiter')
            .get();
        state.uidToEmailMap = {};
        usersSnap.forEach(doc => {
            state.uidToEmailMap[doc.data().uid] = doc.data().email;
        });
    } catch(e) { console.error(e); }

    // Start listening to active tables for this bar
    if (barTablesUnsubscribe) barTablesUnsubscribe();
    barTablesUnsubscribe = db.collection('rooms')
        .where('restaurantId', '==', barId)
        .where('status', '==', 'active')
        .onSnapshot(snapshot => {
            const counts = {};
            snapshot.forEach(doc => {
                const data = doc.data();
                const mappedEmail = state.uidToEmailMap ? state.uidToEmailMap[data.waiterId] : null;
                const key = data.waiterEmail || mappedEmail || data.waiterId;
                counts[key] = (counts[key] || 0) + 1;
            });
            state.activeTablesCounts = counts;
            renderOwnerWaiters(); // Refresh list with counts
        });

    showScreen('screen-owner-restaurant-detail');
}

function renderOwnerWaiters() {
    const list = document.getElementById('owner-waiters-list');
    if (!list || !state.selectedBar) return;

    const waiters = state.selectedBar.waiters || [];
    if (waiters.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:var(--text-sec); font-size:12px;">No hay mozos asignados</p>';
    } else {
        list.innerHTML = waiters.map(email => {
            const tableCount = state.activeTablesCounts ? (state.activeTablesCounts[email] || 0) : 0;
            return `
                <div class="owner-item-row">
                    <div class="owner-item-info">
                        <h4>${email}</h4>
                        <p>${tableCount > 0 ? `<span class="waiter-status-badge">${tableCount} mesas activas</span>` : 'Sin mesas activas'}</p>
                    </div>
                    <button class="btn-delete-small" onclick="removeWaiterFromBar('${email}')" title="Eliminar">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
            `;
        }).join('');
    }
}

function renderOwnerMenu() {
    const list = document.getElementById('owner-menu-list');
    if (!list || !state.selectedBar) return;

    const menu = state.selectedBar.menu || [];
    if (menu.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:var(--text-sec); font-size:12px;">El menú está vacío</p>';
    } else {
        list.innerHTML = menu.map((item, index) => `
            <div class="owner-item-row">
                <div class="owner-item-info">
                    <h4>${item.name}</h4>
                    <p>$${item.price.toLocaleString('es-AR')} - ${item.category}</p>
                </div>
                <button class="btn-delete-small" onclick="removeMenuItemFromBar(${index})" title="Eliminar">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
        `).join('');
    }
}

async function addWaiterToBar() {
    const input = document.getElementById('input-new-waiter-email');
    const passInput = document.getElementById('input-new-waiter-password');
    const email = input?.value?.toLowerCase().trim();
    const password = passInput?.value;
    
    if (!email || !state.selectedBar) return;
    if (!password || password.length < 6) return showToast('Contraseña corta (mínimo 6)');

    try {
        const btn = document.getElementById('btn-add-waiter-detail');
        const originalText = btn.textContent;
        btn.textContent = 'Creando...';
        btn.disabled = true;

        showToast('Creando cuenta del mozo...');
        const userCreds = await secondaryApp.auth().createUserWithEmailAndPassword(email, password);
        const newUid = userCreds.user.uid;
        await secondaryApp.auth().signOut();

        await db.collection('users').doc(newUid).set({
            uid: newUid,
            email: email,
            displayName: email.split('@')[0],
            role: 'waiter',
            restaurantId: state.selectedBar.id,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        const newWaiters = [...(state.selectedBar.waiters || []), email];
        await db.collection('restaurants').doc(state.selectedBar.id).update({
            waiters: newWaiters
        });
        state.selectedBar.waiters = newWaiters;
        
        input.value = '';
        passInput.value = '';
        renderOwnerWaiters();
        showToast("Mozo creado y agregado");
        
        btn.textContent = originalText;
        btn.disabled = false;
    } catch (e) {
        console.error(e);
        const btn = document.getElementById('btn-add-waiter-detail');
        if (btn) { btn.textContent = 'Crear y Agregar Mozo'; btn.disabled = false; }
        if (e.code === 'auth/email-already-in-use') {
            showToast('Ese email ya tiene cuenta');
        } else {
            showToast("Error al agregar mozo");
        }
    }
}

async function removeWaiterFromBar(email) {
    if (!confirm(`¿Eliminar a ${email}?`)) return;
    try {
        const newWaiters = (state.selectedBar.waiters || []).filter(e => e !== email);
        await db.collection('restaurants').doc(state.selectedBar.id).update({
            waiters: newWaiters
        });
        state.selectedBar.waiters = newWaiters;
        renderOwnerWaiters();
        showToast("Mozo eliminado");
    } catch (e) {
        console.error(e);
        showToast("Error al eliminar mozo");
    }
}

async function addMenuItemToBar() {
    const nameInput = document.getElementById('input-new-item-name');
    const priceInput = document.getElementById('input-new-item-price');
    const catInput = document.getElementById('input-new-item-cat');

    const name = nameInput.value.trim();
    const price = parseFloat(priceInput.value);
    const category = catInput.value.trim();

    if (!name || isNaN(price) || !category || !state.selectedBar) {
        showToast("Completá todos los campos");
        return;
    }

    try {
        const newItem = { id: Date.now().toString(), name, price, category };
        const newMenu = [...(state.selectedBar.menu || []), newItem];
        await db.collection('restaurants').doc(state.selectedBar.id).update({
            menu: newMenu
        });
        state.selectedBar.menu = newMenu;
        nameInput.value = ''; priceInput.value = ''; catInput.value = '';
        renderOwnerMenu();
        showToast("Item agregado");
    } catch (e) {
        console.error(e);
        showToast("Error al agregar item");
    }
}

async function removeMenuItemFromBar(index) {
    if (!confirm("¿Eliminar este item del menú?")) return;
    try {
        const newMenu = [...(state.selectedBar.menu || [])];
        newMenu.splice(index, 1);
        await db.collection('restaurants').doc(state.selectedBar.id).update({
            menu: newMenu
        });
        state.selectedBar.menu = newMenu;
        renderOwnerMenu();
        showToast("Item eliminado");
    } catch (e) {
        console.error(e);
        showToast("Error al eliminar item");
    }
}

async function loadRestaurantMenu(restId) {
    try {
        const doc = await db.collection('restaurants').doc(restId).get();
        if (doc.exists) {
            state.currentMenu = doc.data().menu || [];
            
            const cats = new Set();
            state.currentMenu.forEach(i => cats.add(i.category || 'Otros'));
            state.currentCategories = Array.from(cats);
            
            renderRealCategories();
            if (state.currentCategories.length > 0) {
                renderRealMenuItems(state.currentCategories[0]);
            }
        }
    } catch(e) { console.error(e); }
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
// MENU RENDERING (Firestore)
// ============================================

let selectedCategory = null;
let orderItems = [];
let currentModalItem = null;
let currentQty = 1;

function renderRealCategories() {
    const container = document.getElementById('menu-categories');
    if (!container || !state.currentCategories) return;

    if (!selectedCategory && state.currentCategories.length > 0) {
        selectedCategory = state.currentCategories[0];
    }

    container.innerHTML = state.currentCategories.map(cat =>
        `<button class="category-tab ${cat === selectedCategory ? 'active' : ''}" data-category="${cat}">${cat}</button>`
    ).join('');

    container.querySelectorAll('.category-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            selectedCategory = tab.dataset.category;
            renderRealCategories();
            renderRealMenuItems(selectedCategory);
        });
    });
}

function renderRealMenuItems(category) {
    const container = document.getElementById('menu-items');
    if (!container || !state.currentMenu) return;

    const items = state.currentMenu.filter(item => item.category === category);

    container.innerHTML = items.map(item =>
        `<div class="menu-card" data-item-id="${item.id}">
            <div class="menu-card-info">
                <h4 class="menu-card-name">${item.name}</h4>
                <p class="menu-card-desc">${item.category}</p>
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
            const itemId = card.dataset.itemId;
            const item = state.currentMenu.find(i => i.id === itemId);
            openAddItemModal(item);
        });
    });
}

function renderRealtimeOrders() {
    const container = document.getElementById('order-items-list-display'); 
    const totalDisplay = document.getElementById('room-total-display');
    if (!container || !state.currentOrders) return;
    
    if (state.currentOrders.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-sec);padding:20px;font-size:12px;">No hay pedidos en curso</p>';
        if (totalDisplay) totalDisplay.textContent = '$0';
        return;
    }

    let total = 0;
    container.innerHTML = state.currentOrders.sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)).map(order => {
        const itemTotal = order.price * order.qty;
        total += itemTotal;
        return `
            <div style="padding:12px;background:var(--bg-main);border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
                <div style="flex:1;">
                    <h4 style="margin:0;font-size:13px;color:var(--text-main);">${order.qty}x ${order.name}</h4>
                    <div style="display:flex;gap:5px;align-items:center;margin-top:2px;">
                        <span style="font-size:10px;padding:2px 6px;background:var(--bg-sec);border-radius:10px;color:var(--text-sec);">
                            ${order.ordererName ? order.ordererName.split(' ')[0] : 'Alguien'}
                        </span>
                        ${order.sharedWith.length > 1 ? '<span style="font-size:10px;color:var(--primary);">👥 Splitted</span>' : ''}
                    </div>
                </div>
                <strong style="font-size:13px;color:var(--text-main);">$${itemTotal.toLocaleString('es-AR')}</strong>
            </div>
        `;
    }).join('');

    if (totalDisplay) totalDisplay.textContent = '$' + total.toLocaleString('es-AR');
}

// ============================================
// ORDER MANAGEMENT
// ============================================

function updateQty(change) {
    if (!currentModalItem) return;
    
    currentQty += change;
    if (currentQty < 1) currentQty = 1;
    
    const qtyDisplay = document.getElementById('qty-value');
    if (qtyDisplay) qtyDisplay.textContent = currentQty;
    
    const totalDisplay = document.getElementById('modal-total');
    if (totalDisplay) totalDisplay.textContent = '$' + (currentModalItem.price * currentQty).toLocaleString('es-AR');
}

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
    if (desc) desc.textContent = item.desc || '';
    if (qtyDisplay) qtyDisplay.textContent = '1';
    if (total) total.textContent = '$' + item.price.toLocaleString('es-AR');

    const isWaiter = state.user?.role === 'waiter';

    const payerContainer = document.getElementById('payer-section-container');
    const payerTitle = document.getElementById('payer-section-title');
    const payerOptions = document.getElementById('payer-options');
    const splitSection = document.getElementById('split-section');
    const splitTitle = document.getElementById('split-section-title');
    const participantsContainer = document.getElementById('split-participants');

    if (isWaiter) {
        if (payerContainer) payerContainer.style.display = 'none';
        if (splitSection) {
            splitSection.style.display = 'block';
            if (splitTitle) splitTitle.textContent = '¿Para qué cliente es?';
        }
        
        if (participantsContainer && state.currentRoom) {
            participantsContainer.innerHTML = state.currentRoom.participants.map((p, idx) => `
                <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:8px;background:var(--bg-main);border-radius:8px;">
                    <input type="radio" name="waiter-client-select" class="waiter-client-radio" value="${p.uid}" ${idx === 0 ? 'checked' : ''}>
                    <span>${p.displayName}</span>
                </label>
            `).join('');
            if (state.currentRoom.participants.length === 0) {
                 participantsContainer.innerHTML = '<p class="empty-text" style="font-size:13px;">No hay clientes unidos a la mesa.</p>';
            }
        }
    } else {
        if (payerContainer) payerContainer.style.display = 'block';
        if (payerTitle) payerTitle.textContent = '¿Con quién compartís esto?';
        if (payerOptions) payerOptions.style.display = 'flex';
        
        document.querySelectorAll('.payer-option').forEach(opt => opt.classList.remove('active'));
        const defaultPayer = document.querySelector('.payer-option[data-payer="me"]');
        if (defaultPayer) defaultPayer.classList.add('active');

        if (splitSection) {
            splitSection.style.display = 'none';
            if (splitTitle) splitTitle.textContent = 'Seleccioná a los participantes:';
        }

        if (participantsContainer && state.currentRoom) {
            participantsContainer.innerHTML = state.currentRoom.participants.map(p => `
                <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:8px;background:var(--bg-main);border-radius:8px;">
                    <input type="checkbox" class="split-checkbox" value="${p.uid}" ${p.uid === state.user.uid ? 'checked disabled' : ''}>
                    <span>${p.uid === state.user.uid ? 'Yo (' + getFirstName(p.displayName) + ')' : p.displayName}</span>
                </label>
            `).join('');
        }
    }

    if (modal) modal.classList.add('active');
}

function closeAddItemModal() {
    const modal = document.getElementById('modal-add-item');
    if (modal) modal.classList.remove('active');
    currentModalItem = null;
}

function addToOrder() {
    if (!currentModalItem) return;

    const isWaiter = state.user?.role === 'waiter';

    if (isWaiter) {
        const selectedRadio = document.querySelector('input[name="waiter-client-select"]:checked');
        if (!selectedRadio) return showToast('Seleccioná un cliente primero');
        
        const clientUid = selectedRadio.value;
        const clientObj = state.currentRoom.participants.find(p => p.uid === clientUid);
        const clientName = clientObj ? clientObj.displayName : 'Cliente';
        
        const roomCode = state.currentRoom.code;
        const ordersRef = db.collection('rooms').doc(roomCode).collection('orders');
        
        ordersRef.add({
            hash: currentModalItem.id + '-' + clientUid + '-' + Date.now(),
            id: currentModalItem.id,
            name: currentModalItem.name,
            price: currentModalItem.price,
            qty: currentQty,
            sharedWith: [clientUid],
            orderedBy: clientUid, 
            ordererName: clientName + " (Mozo)", 
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'pending' // Or confirmed depending on next features
        }).then(() => {
            showToast('Pedido cargado a ' + getFirstName(clientName));
        }).catch(e => {
            console.error("Waiter add error:", e);
            showToast("Error al cargar pedido");
        });

        closeAddItemModal();
        return;
    }

    // Check who it's shared with (CLIENT)
    const activePayer = document.querySelector('.payer-option.active')?.dataset.payer;
    let sharedWith = [state.user?.uid]; // Use real UID
    
    if (activePayer === 'split') {
        const checkboxes = document.querySelectorAll('.split-checkbox:checked');
        sharedWith = Array.from(checkboxes).map(cb => cb.value);
    }

    const itemHash = currentModalItem.id + '-' + sharedWith.sort().join(',');
    const existingIndex = orderItems.findIndex(item => item.hash === itemHash);
    
    if (existingIndex >= 0) {
        orderItems[existingIndex].qty += currentQty;
    } else {
        orderItems.push({
            hash: itemHash,
            id: currentModalItem.id, // item id
            name: currentModalItem.name,
            price: currentModalItem.price,
            qty: currentQty,
            sharedWith: sharedWith
        });
    }

    updateOrderBadge();
    closeAddItemModal();
    showToast(currentQty + 'x ' + currentModalItem.name + ' en el carrito');
}

async function confirmOrder() {
    if (orderItems.length === 0) return showToast('Nada para confirmar');
    if (!state.currentRoom?.code) return showToast('No hay una mesa activa');

    showToast('Enviando pedido...');
    try {
        const roomCode = state.currentRoom.code;
        const ordersRef = db.collection('rooms').doc(roomCode).collection('orders');
        
        // Push each item as a separate document for better real-time updates / logic later
        const batch = db.batch();
        
        orderItems.forEach(item => {
            const newOrderRef = ordersRef.doc();
            batch.set(newOrderRef, {
                ...item,
                orderedBy: state.user.uid,
                ordererName: state.user.displayName,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'pending' // Or 'confirmed'
            });
        });

        await batch.commit();

        showToast('¡Pedido confirmado! 🎉');
        orderItems = [];
        updateOrderBadge();
        goBack(); // Return to room menu
    } catch(e) {
        console.error("Error confirming order:", e);
        showToast('Error al enviar el pedido');
    }
}

function updateOrderBadge() {
    const badge = document.getElementById('order-count');
    if (!badge) return;
    const count = orderItems.reduce((sum, item) => sum + item.qty, 0);
    badge.textContent = count;
    badge.parentElement.style.display = count > 0 ? 'flex' : 'none';
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
        container.innerHTML = orderItems.map((item, i) => {
            const splitRatio = item.sharedWith.length;
            const myShare = (item.price * item.qty) / splitRatio;
            const splitText = splitRatio > 1 ? `<span style="font-size:12px;color:var(--primary);">(Dividido entre ${splitRatio})</span>` : '';
            
            return `<div class="order-item-card">
                <div class="order-item-info">
                    <h4>${item.name} ${splitText}</h4>
                    <p class="order-item-qty">${item.qty}x $${item.price.toLocaleString('es-AR')}</p>
                </div>
                <div class="order-item-right">
                    <span class="order-item-total">$${myShare.toLocaleString('es-AR')}</span>
                    <button class="order-item-remove" data-index="${i}" aria-label="Eliminar">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
            </div>`;
        }).join('');

        const subtotal = orderItems.reduce((sum, item) => sum + ((item.price * item.qty) / item.sharedWith.length), 0);
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
// ROLE MANAGEMENT (NEW)
// ============================================

function setRole(role) {
    if (!state.user) return;
    state.user.role = role;
    localStorage.setItem('tb_mock_role', role);
    routeUserByRole(role);
}

// ============================================
// OWNER DASHBOARD LOGIC
// ============================================

async function loadWaiterData() {
    const list = document.getElementById('waiter-tables-list');
    if (!list || !state.user || !state.user.uid) return;

    try {
        const query = db.collection('rooms')
                        .where('waiterId', '==', state.user.uid)
                        .where('status', '==', 'active');
                        
        query.onSnapshot(snapshot => {
            if (snapshot.empty) {
                list.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;"><div class="empty-icon">🍽️</div><p class="empty-text">No tenés mesas activas</p><p class="empty-sub">Creá una mesa nueva arriba</p></div>`;
            } else {
                list.innerHTML = '';
                snapshot.forEach(doc => {
                    const room = doc.data();
                    list.innerHTML += `<div class="room-card" style="padding:24px 15px; background:var(--card-bg); border-radius:16px; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; box-shadow:0 8px 16px rgba(0,0,0,0.05); cursor:pointer; transition: transform 0.2s ease;" onclick="enterWaiterRoom('${room.code}')">
                        <h4 style="margin:0 0 8px 0; font-size:22px; color:var(--text-main); font-weight:800;">${room.table}</h4>
                        <p style="margin:0; font-size:13px; color:var(--text-sec); letter-spacing:0.5px;">Cód: <strong style="color:var(--primary);">${room.code}</strong></p>
                    </div>`;
                });
            }
        });
    } catch(e) {
        console.error("Error loading waiter tables:", e);
        // Requires index for waiterId, status, createdAt! We might get a perm error in console. If so we can remove orderBy.
    }
}
// ============================================
// BAR CREATION WIZARD (MULTI-BAR ADAPTED)
// ============================================

async function handleOwnerCreateRest() {
    const input = document.getElementById('input-owner-restaurant-name');
    const name = input?.value.trim();
    if (!name) return showToast('Ingresá el nombre');
    
    const restData = {
        name: name,
        ownerId: state.user.uid,
        waiters: [],
        menu: [],
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        const docRef = await db.collection('restaurants').add(restData);
        state.tempResourceId = docRef.id; // Store ID for next steps
        
        showToast('Restaurante creado: ' + name);
        document.getElementById('owner-setup').style.display = 'none';
        document.getElementById('owner-manage-waiters').style.display = 'block';
    } catch(e) {
        console.error(e);
        showToast('Error al crear restaurante');
    }
}

async function handleOwnerAddWaiter() {
    const input = document.getElementById('input-waiter-email');
    const passInput = document.getElementById('input-waiter-password');
    if (!input?.value || !input.value.includes('@')) return showToast('Email inválido');
    if (!passInput?.value || passInput.value.length < 6) return showToast('Contraseña corta (mínimo 6)');
    
    const email = input.value.toLowerCase().trim();
    const password = passInput.value;
    const restId = state.tempResourceId;
    if (!restId) return showToast('Error: No se encontró el ID del restaurante');
    
    try {
        const btn = document.getElementById('btn-owner-add-waiter');
        const originalText = btn.textContent;
        btn.textContent = 'Creando...';
        btn.disabled = true;

        showToast('Creando cuenta del mozo...');
        const userCreds = await secondaryApp.auth().createUserWithEmailAndPassword(email, password);
        const newUid = userCreds.user.uid;
        await secondaryApp.auth().signOut();

        await db.collection('users').doc(newUid).set({
            uid: newUid,
            email: email,
            displayName: email.split('@')[0],
            role: 'waiter',
            restaurantId: restId,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await db.collection('restaurants').doc(restId).update({
            waiters: firebase.firestore.FieldValue.arrayUnion(email)
        });
        
        const list = document.getElementById('waiters-list');
        list.innerHTML += `<div style="padding:10px;background:var(--bg-sec);border-radius:8px;display:flex;justify-content:space-between;margin-top:10px;">
            <span>${email}</span>
            <span style="color:var(--text-sec);font-size:12px;">Mozo</span>
        </div>`;
        
        showToast('Mozo creado e invitado');
        input.value = '';
        passInput.value = '';
        btn.textContent = originalText;
        btn.disabled = false;
        
        const continueBtn = document.getElementById('btn-owner-continue-menu');
        if (continueBtn) continueBtn.style.display = 'block';
    } catch(e) {
        console.error(e);
        const btn = document.getElementById('btn-owner-add-waiter');
        if (btn) { btn.textContent = 'Crear y Agregar Mozo'; btn.disabled = false; }
        if (e.code === 'auth/email-already-in-use') {
            showToast('Ese email ya tiene cuenta en Firebase');
        } else {
            showToast('Error al crear cuenta del mozo');
        }
    }
}

function handleOwnerContinueMenu() {
    document.getElementById('owner-manage-waiters').style.display = 'none';
    document.getElementById('owner-manage-menu').style.display = 'block';
}

async function handleOwnerAddMenuItem() {
    const nameInput = document.getElementById('input-menu-name');
    const priceInput = document.getElementById('input-menu-price');
    const catInput = document.getElementById('input-menu-category');
    const restId = state.tempResourceId;

    if (!nameInput.value || !priceInput.value) return showToast('Completá nombre y precio');
    if (!restId) return showToast('Error de sistema');
    
    const newItem = {
        id: 'item_' + Date.now(),
        name: nameInput.value.trim(),
        price: parseFloat(priceInput.value),
        category: catInput.value
    };

    try {
        await db.collection('restaurants').doc(restId).update({
            menu: firebase.firestore.FieldValue.arrayUnion(newItem)
        });
        
        const list = document.getElementById('menu-items-list');
        list.innerHTML += `<div style="padding:12px;background:var(--bg-sec);border-radius:8px;display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
            <div>
                <h4 style="margin:0;font-size:14px;color:var(--text-main);">${newItem.name}</h4>
                <p style="margin:2px 0 0 0;font-size:12px;color:var(--text-sec);">${newItem.category}</p>
            </div>
            <strong style="color:var(--text-main);">$${newItem.price.toLocaleString('es-AR')}</strong>
        </div>`;

        showToast('Item agregado al menú');
        nameInput.value = '';
        priceInput.value = '';
    } catch (e) {
        console.error(e);
        showToast('Error agregando al menú');
    }
}

function handleOwnerFinishSetup() {
    showToast('¡Restaurante configurado exitosamente! 🎉');
    loadOwnerData(); // Reload all cards and go to cards view
}

function loadClientData() {
    renderRecentRooms();
}

function addRecentRoom(roomData) {
    if (!roomData || !roomData.code) return;
    
    let recent = JSON.parse(localStorage.getItem('tb_recent_rooms') || '[]');
    
    const newRoom = {
        code: roomData.code,
        table: roomData.table || 'Mesa',
        timestamp: Date.now()
    };
    
    recent = recent.filter(r => r.code !== newRoom.code);
    recent.unshift(newRoom);
    
    if (recent.length > 5) recent.pop();
    
    localStorage.setItem('tb_recent_rooms', JSON.stringify(recent));
    renderRecentRooms();
}

function renderRecentRooms() {
    const list = document.getElementById('rooms-list');
    if (!list) return;
    
    const recent = JSON.parse(localStorage.getItem('tb_recent_rooms') || '[]');
    
    if (recent.length === 0) {
        list.innerHTML = `
            <div class="empty-state" id="empty-rooms">
                <div class="empty-icon">🧾</div>
                <p class="empty-text">No tenés salas recientes</p>
                <p class="empty-sub">Unite con un código</p>
            </div>
        `;
        return;
    }
    
    list.innerHTML = recent.map(room => `
        <div class="room-card" style="padding:15px; background:var(--bg-main); border:1px solid var(--border); border-radius:12px; display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="quickJoinRoom('${room.code}')">
            <div>
                <h4 style="margin:0; font-size:16px; color:var(--text-main);">${room.table}</h4>
                <p style="margin:4px 0 0 0; font-size:12px; color:var(--text-sec);">Código: <strong style="color:var(--primary);">${room.code}</strong></p>
            </div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
    `).join('');
}

function quickJoinRoom(code) {
    const codeInput = document.getElementById('input-room-code');
    if (codeInput) codeInput.value = code;
    showScreen('screen-join-room');
    setTimeout(() => {
        const btn = document.getElementById('btn-submit-join');
        if (btn && !btn.disabled) btn.click();
    }, 100);
}

// ============================================
// WAITER DASHBOARD LOGIC
// ============================================

async function handleWaiterCreateTable() {
    if (!state.user || !state.user.restaurantId) {
        return showToast('No estás asignado a un restaurante');
    }

    const btn = document.getElementById('btn-waiter-create-table');
    if (btn) btn.disabled = true;

    let nextTableNum = 1;
    try {
        const snapshot = await db.collection('rooms')
            .where('waiterId', '==', state.user.uid)
            .get();
        nextTableNum = snapshot.size + 1;
    } catch(e) {
        console.warn("Could not fetch table count", e);
    }

    const code = generateRoomCode();
    const tableNumber = 'Mesa ' + nextTableNum;
    
    const newRoom = {
        code: code,
        restaurantId: state.user.restaurantId,
        table: tableNumber,
        waiterId: state.user.uid,
        waiterEmail: state.user.email || '',
        status: 'active',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        participants: []
    };

    try {
        await db.collection('rooms').doc(code).set(newRoom);
        showToast('Mesa creada. Código: ' + code);
        enterWaiterRoom(code);
    } catch(e) {
        console.error("Error creating table:", e);
        showToast('Error al crear la mesa');
    } finally {
        const btn = document.getElementById('btn-waiter-create-table');
        if (btn) btn.disabled = false;
    }
}

async function enterWaiterRoom(code) {
    try {
        const doc = await db.collection('rooms').doc(code).get();
        if (doc.exists) {
            state.currentRoom = doc.data();
            
            const roomName = document.getElementById('room-name');
            const roomCode = document.getElementById('room-code-display');
            if (roomName) roomName.textContent = state.currentRoom.table;
            if (roomCode) roomCode.textContent = 'Código: ' + code;
            
            // Waiters also see the menu
            await loadRestaurantMenu(state.currentRoom.restaurantId);
            
            showScreen('screen-room');
            listenToRoom(code);
        }
    } catch(e) {
        console.error(e);
        showToast('Error al entrar a la mesa');
    }
}

// ============================================
// EVENT LISTENERS
// ============================================

function initEventListeners() {
    // --- Owner ---
    document.getElementById('btn-owner-create-rest')?.addEventListener('click', handleOwnerCreateRest);
    document.getElementById('btn-owner-add-waiter')?.addEventListener('click', handleOwnerAddWaiter);
    document.getElementById('btn-owner-continue-menu')?.addEventListener('click', handleOwnerContinueMenu);
    document.getElementById('btn-owner-add-menu-item')?.addEventListener('click', handleOwnerAddMenuItem);
    document.getElementById('btn-owner-finish-setup')?.addEventListener('click', handleOwnerFinishSetup);

    // --- Waiter ---
    document.getElementById('btn-waiter-create-table')?.addEventListener('click', handleWaiterCreateTable);
    document.getElementById('btn-waiter-settings')?.addEventListener('click', () => showScreen('screen-settings'));

    // --- Login ---
    document.getElementById('btn-email-auth')?.addEventListener('click', loginWithEmail);
    document.getElementById('btn-toggle-auth')?.addEventListener('click', toggleAuthMode);
    document.getElementById('btn-google-login')?.addEventListener('click', loginWithGoogle);

    // --- Header Actions ---
    document.getElementById('btn-settings')?.addEventListener('click', () => showScreen('screen-settings'));
    // --- Owner Expansion ---
    document.getElementById('btn-owner-add-new-bar')?.addEventListener('click', () => {
        showScreen('screen-owner-dashboard');
    });

    document.getElementById('btn-back-to-restaurants')?.addEventListener('click', () => {
        if (barTablesUnsubscribe) barTablesUnsubscribe();
        showOwnerRestaurants();
    });

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
            btn.classList.add('active');
            document.getElementById(`tab-${tab}`).style.display = 'block';
        });
    });

    document.getElementById('btn-add-waiter-detail')?.addEventListener('click', addWaiterToBar);
    document.getElementById('btn-add-item-detail')?.addEventListener('click', addMenuItemToBar);

    document.getElementById('btn-profile')?.addEventListener('click', () => showScreen('screen-settings'));
    document.getElementById('btn-owner-profile-card')?.addEventListener('click', () => showScreen('screen-settings'));
    document.getElementById('btn-owner-settings')?.addEventListener('click', () => showScreen('screen-settings'));
    document.getElementById('btn-settings')?.addEventListener('click', () => showScreen('screen-settings'));
    document.getElementById('btn-waiter-settings')?.addEventListener('click', () => showScreen('screen-settings'));

    // --- Home Actions ---
    document.getElementById('btn-create-room')?.addEventListener('click', () => showScreen('screen-create-room'));
    document.getElementById('btn-join-room')?.addEventListener('click', () => showScreen('screen-join-room'));

    // --- Back Buttons ---
    document.getElementById('btn-back-join')?.addEventListener('click', goBack);
    document.getElementById('btn-back-create')?.addEventListener('click', goBack);
    document.getElementById('btn-back-room')?.addEventListener('click', () => {
        orderItems = [];
        updateOrderBadge();
        goHome();
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
    document.getElementById('btn-confirm-order')?.addEventListener('click', confirmOrder);

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
        if (window.location.hash === '#owner') {
            localStorage.setItem('tb_intent', 'owner');
        } else {
            localStorage.removeItem('tb_intent');
        }
    });

    // Check initial hash
    if (window.location.hash === '#owner') {
        localStorage.setItem('tb_intent', 'owner');
    } else {
        localStorage.removeItem('tb_intent');
    }
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
