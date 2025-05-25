// Initialize Firebase
const auth = firebase.auth();
const db = firebase.firestore();

// DOM Elements
const loader = document.querySelector('.loader-container');
const ordersContainer = document.getElementById('orders-container');
const filterBtns = document.querySelectorAll('.filter-btn');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const refreshBtn = document.getElementById('refresh-btn');
const orderModal = document.getElementById('order-modal');
const closeModalBtn = document.querySelector('.close-modal');
const navLinks = document.querySelectorAll('.sidebar-nav a');
const contentSections = document.querySelectorAll('.content-section');
const logoutBtn = document.getElementById('logout-btn');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');

// Menu Management
let menuItems = [];
const menuItemsGrid = document.getElementById('menu-items-grid');
const menuSearchInput = document.getElementById('menu-search');
const menuSearchBtn = document.getElementById('menu-search-btn');
const editMenuModal = document.getElementById('edit-menu-modal');
const editMenuForm = document.getElementById('edit-menu-form');
const closeMenuModal = document.getElementById('close-menu-modal');

// Global Variables
let currentFilter = 'all';
let orders = [];
let currentStaff = null;

// Check Authentication
auth.onAuthStateChanged(async (user) => {
    if (user) {
        try {
            const staffDoc = await db.collection('users').doc(user.uid).get();
            const staffData = staffDoc.data();
            
            if (staffData && staffData.role === 'staff') {
                currentStaff = { ...staffData, uid: user.uid };
                initializeApp();
            } else {
                window.location.href = 'login.html';
            }
        } catch (error) {
            console.error('Error checking staff status:', error);
            showToast('Error verifying staff credentials');
        }
    } else {
        window.location.href = 'login.html';
    }
});

// Initialize App
async function initializeApp() {
    // Load initial orders
    await loadOrders();
    
    // Set up real-time orders listener
    setupOrdersListener();
    
    // Load menu items
    await loadMenuItems();
    
    // Update profile info
    updateProfileInfo();
    
    // Hide loader
    loader.style.opacity = '0';
    setTimeout(() => loader.style.display = 'none', 500);
}

// Load Orders
async function loadOrders() {
    try {
        const snapshot = await db.collection('orders')
            .orderBy('createdAt', 'desc')
            .get();
        
        orders = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        filterAndDisplayOrders();
    } catch (error) {
        console.error('Error loading orders:', error);
        showToast('Error loading orders');
    }
}

// Set up real-time orders listener
function setupOrdersListener() {
    db.collection('orders')
        .orderBy('createdAt', 'desc')
        .onSnapshot((snapshot) => {
            let hasChanges = false;
            
            snapshot.docChanges().forEach((change) => {
                const order = { id: change.doc.id, ...change.doc.data() };
                
                if (change.type === 'added' && !orders.some(o => o.id === order.id)) {
                    // Only add if the order doesn't already exist
                    hasChanges = true;
                    orders.unshift(order);
                } else if (change.type === 'modified') {
                    const index = orders.findIndex(o => o.id === order.id);
                    if (index !== -1) {
                        hasChanges = true;
                        orders[index] = order;
                    }
                } else if (change.type === 'removed') {
                    const initialLength = orders.length;
                    orders = orders.filter(o => o.id !== order.id);
                    hasChanges = initialLength !== orders.length;
                }
            });
            
            // Only update display if there were actual changes
            if (hasChanges) {
                filterAndDisplayOrders();
            }
        });
}

// Filter and Display Orders
function filterAndDisplayOrders() {
    let filteredOrders = orders;
    
    // Apply status filter
    if (currentFilter !== 'all') {
        filteredOrders = orders.filter(order => order.status === currentFilter);
    }
    
    // Apply search filter
    const searchTerm = searchInput.value.toLowerCase().trim();
    if (searchTerm) {
        filteredOrders = filteredOrders.filter(order => 
            order.id.toLowerCase().includes(searchTerm) ||
            order.customerName.toLowerCase().includes(searchTerm) ||
            order.customerEmail.toLowerCase().includes(searchTerm)
        );
    }
    
    displayOrders(filteredOrders);
}

// Display Orders
function displayOrders(ordersToDisplay) {
    ordersContainer.innerHTML = '';
    
    if (ordersToDisplay.length === 0) {
        ordersContainer.innerHTML = `
            <div class="no-orders">
                <p>No orders found</p>
            </div>
        `;
        return;
    }
    
    ordersToDisplay.forEach(order => {
        const card = document.createElement('div');
        card.className = 'order-card';
        
        // Format timestamp
        const orderDate = order.createdAt?.toDate() || new Date();
        const formattedDate = orderDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        card.innerHTML = `
            <div class="order-header">
                <div class="order-id">#${order.id}</div>
                <div class="order-status status-${order.status}">${formatStatus(order.status)}</div>
            </div>
            <div class="order-info">
                <p><i class="fas fa-user"></i> ${order.customerName}</p>
                <p><i class="fas fa-clock"></i> ${formattedDate}</p>
            </div>
            <div class="order-items">
                <p>${order.items.length} item(s)</p>
                <p class="items-list">${order.items.map(item => item.name).join(', ')}</p>
            </div>
            <div class="order-footer">
                <div class="order-total">₹${order.total}</div>
                <button class="view-details-btn" data-id="${order.id}">
                    View Details
                </button>
            </div>
        `;
        
        ordersContainer.appendChild(card);
    });
    
    // Add event listeners to view details buttons
    document.querySelectorAll('.view-details-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const orderId = btn.dataset.id;
            openOrderDetails(orderId);
        });
    });
}

// Open Order Details
function openOrderDetails(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    
    const modalOrderId = document.getElementById('modal-order-id');
    const modalOrderStatus = document.getElementById('modal-order-status');
    const modalCustomerInfo = document.getElementById('modal-customer-info');
    const modalOrderItems = document.getElementById('modal-order-items');
    const modalOrderSummary = document.getElementById('modal-order-summary');
    const modalOrderActions = document.getElementById('modal-order-actions');
    
    // Update modal content
    modalOrderId.textContent = order.id;
    modalOrderStatus.textContent = formatStatus(order.status);
    modalOrderStatus.className = `order-status status-${order.status}`;
    
    // Customer info
    modalCustomerInfo.innerHTML = `
        <h4>Customer Information</h4>
        <p><i class="fas fa-user"></i> ${order.customerName}</p>
        <p><i class="fas fa-envelope"></i> ${order.customerEmail}</p>
    `;
    
    // Order items
    modalOrderItems.innerHTML = `
        <h4>Order Items</h4>
        ${order.items.map(item => `
            <div class="item">
                <div class="item-info">
                    <span class="item-name">${item.name}</span>
                    <span class="item-quantity">x${item.quantity}</span>
                </div>
                <span class="item-price">₹${item.price * item.quantity}</span>
            </div>
        `).join('')}
    `;
    
    // Order summary
    modalOrderSummary.innerHTML = `
        <h4>Order Summary</h4>
        <div class="summary-item">
            <span>Subtotal:</span>
            <span>₹${order.subtotal}</span>
        </div>
        <div class="summary-item">
            <span>Tax:</span>
            <span>₹${order.tax}</span>
        </div>
        <div class="summary-item total">
            <span>Total:</span>
            <span>₹${order.total}</span>
        </div>
    `;
    
    // Order actions
    modalOrderActions.innerHTML = getOrderActions(order.status, order.id);
    
    // Show modal
    orderModal.classList.add('active');
}

// Get Order Action Buttons
function getOrderActions(status, orderId) {
    switch (status) {
        case 'pending':
            return `
                <button class="action-btn" onclick="updateOrderStatus('${orderId}', 'preparing')">
                    Start Preparing
                </button>
                <button class="action-btn danger" onclick="updateOrderStatus('${orderId}', 'cancelled')">
                    Cancel Order
                </button>
            `;
        case 'preparing':
            return `
                <button class="action-btn" onclick="updateOrderStatus('${orderId}', 'ready')">
                    Mark as Ready
                </button>
            `;
        case 'ready':
            return `
                <button class="action-btn" onclick="updateOrderStatus('${orderId}', 'completed')">
                    Mark as Completed
                </button>
            `;
        default:
            return '';
    }
}

// Update Order Status
async function updateOrderStatus(orderId, newStatus) {
    try {
        await db.collection('orders').doc(orderId).update({
            status: newStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: currentStaff.uid
        });
        
        showToast(`Order ${orderId} ${formatStatus(newStatus)}`);
        orderModal.classList.remove('active');
    } catch (error) {
        console.error('Error updating order status:', error);
        showToast('Error updating order status');
    }
}

// Format Status Text
function formatStatus(status) {
    switch (status) {
        case 'pending': return 'Pending';
        case 'preparing': return 'Preparing';
        case 'ready': return 'Ready for Pickup';
        case 'completed': return 'Completed';
        case 'cancelled': return 'Cancelled';
        default: return status;
    }
}

// Update Profile Info
function updateProfileInfo() {
    const profileInfo = document.getElementById('profile-info');
    
    if (currentStaff) {
        profileInfo.innerHTML = `
            <div class="info-group">
                <label>Name</label>
                <p>${currentStaff.name}</p>
            </div>
            <div class="info-group">
                <label>Email</label>
                <p>${currentStaff.email}</p>
            </div>
            <div class="info-group">
                <label>Role</label>
                <p>Staff</p>
            </div>
        `;
    }
}

// Load Menu Items
async function loadMenuItems() {
    try {
        const snapshot = await db.collection('menuItems').get();
        menuItems = snapshot.docs.map(doc => ({
            id: parseInt(doc.id),
            ...doc.data()
        }));
        
        displayMenuItems();
    } catch (error) {
        console.error('Error loading menu items:', error);
        showToast('Error loading menu items');
    }
}

// Display Menu Items
function displayMenuItems() {
    const searchTerm = menuSearchInput.value.toLowerCase().trim();
    let filteredItems = menuItems;
    
    if (searchTerm) {
        filteredItems = menuItems.filter(item => 
            item.name.toLowerCase().includes(searchTerm) ||
            item.category.toLowerCase().includes(searchTerm)
        );
    }
    
    menuItemsGrid.innerHTML = '';
    
    if (filteredItems.length === 0) {
        menuItemsGrid.innerHTML = `
            <div class="no-items">
                <p>No menu items found</p>
            </div>
        `;
        return;
    }
    
    filteredItems.forEach(item => {
        const card = document.createElement('div');
        card.className = 'menu-item';
        
        card.innerHTML = `
            <img src="${item.image}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/300x200?text=No+Image'">
            <div class="item-info">
                <div class="item-name">${item.name}</div>
                <div class="item-category">${item.category}</div>
                <div class="item-price">₹${item.price}</div>
                <button class="edit-btn" data-id="${item.id}">
                    Edit Item
                </button>
            </div>
        `;
        
        menuItemsGrid.appendChild(card);
    });
    
    // Add event listeners to edit buttons
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const itemId = parseInt(btn.dataset.id);
            openEditMenuModal(itemId);
        });
    });
}

// Open Edit Menu Modal
function openEditMenuModal(itemId) {
    const item = menuItems.find(i => i.id === itemId);
    if (!item) return;
    
    document.getElementById('menu-item-name').value = item.name;
    document.getElementById('menu-item-price').value = item.price;
    document.getElementById('menu-item-image').value = item.image;
    document.getElementById('menu-item-category').value = item.category;
    
    editMenuForm.onsubmit = async (e) => {
        e.preventDefault();
        
        const updatedItem = {
            ...item,
            price: parseInt(document.getElementById('menu-item-price').value),
            image: document.getElementById('menu-item-image').value
        };
        
        try {
            await db.collection('menuItems').doc(item.id.toString()).update({
                price: updatedItem.price,
                image: updatedItem.image,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: currentStaff.uid
            });
            
            const index = menuItems.findIndex(i => i.id === item.id);
            if (index !== -1) menuItems[index] = updatedItem;
            
            displayMenuItems();
            editMenuModal.classList.remove('active');
            showToast('Menu item updated successfully');
        } catch (error) {
            console.error('Error updating menu item:', error);
            showToast('Error updating menu item');
        }
    };
    
    editMenuModal.classList.add('active');
}

// Search Menu Items
menuSearchBtn.addEventListener('click', displayMenuItems);
menuSearchInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') displayMenuItems();
});

// Close Edit Menu Modal
closeMenuModal.addEventListener('click', () => {
    editMenuModal.classList.remove('active');
});

editMenuModal.addEventListener('click', (e) => {
    if (e.target === editMenuModal) {
        editMenuModal.classList.remove('active');
    }
});

// Event Listeners
filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.status;
        filterAndDisplayOrders();
    });
});

searchBtn.addEventListener('click', filterAndDisplayOrders);
searchInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') filterAndDisplayOrders();
});

refreshBtn.addEventListener('click', loadOrders);

closeModalBtn.addEventListener('click', () => {
    orderModal.classList.remove('active');
});

orderModal.addEventListener('click', (e) => {
    if (e.target === orderModal) {
        orderModal.classList.remove('active');
    }
});

// Navigation
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        
        const section = link.dataset.section;
        
        navLinks.forEach(l => l.parentElement.classList.remove('active'));
        link.parentElement.classList.add('active');
        
        contentSections.forEach(s => s.classList.remove('active'));
        document.getElementById(`${section}-section`).classList.add('active');
    });
});

// Logout
logoutBtn.addEventListener('click', async () => {
    try {
        await auth.signOut();
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Error signing out:', error);
        showToast('Error signing out');
    }
});

// Show Toast Message
function showToast(message) {
    toastMessage.textContent = message;
    toast.classList.add('active');
    
    setTimeout(() => {
        toast.classList.remove('active');
    }, 3000);
}
