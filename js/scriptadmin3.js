// Check and redirect with auth
function checkAndRedirect(url) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const authToken = sessionStorage.getItem('authToken');

    if (currentUser.role === 'admin' && authToken) {
        window.location.href = url;
    } else {
        showToast('Please log in as admin');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
    }
}

// DOM Elements
const loader = document.getElementById('loader');
const logoutBtn = document.getElementById('logout-btn');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const refreshBtn = document.getElementById('refresh-btn');
const statusFilter = document.getElementById('status-filter');
const timeFilter = document.getElementById('time-filter');
const ordersList = document.getElementById('orders-list');
const orderModal = document.getElementById('order-modal');
const closeOrderModal = document.getElementById('close-order-modal');
const updateStatusBtn = document.getElementById('update-status-btn');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');

// Current order being viewed
let currentOrder = null;

// Check initial auth state
function checkAdminAuth() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const authToken = sessionStorage.getItem('authToken');

    if (!currentUser || !currentUser.role || currentUser.role !== 'admin' || !authToken) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// Initial auth check
if (!checkAdminAuth()) {
    window.location.href = 'login.html';
}

// Authentication state observer
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        // Check if user has admin role
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        if (currentUser.role === 'admin') {
            loader.style.display = 'none';
            loadOrders();
        } else {
            // If not admin, redirect to login
            firebase.auth().signOut().then(() => {
                localStorage.removeItem('currentUser');
                sessionStorage.removeItem('authToken');
                window.location.href = 'login.html';
            });
        }
    } else {
        // Check if we have stored credentials
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const authToken = sessionStorage.getItem('authToken');
        
        if (currentUser.role === 'admin' && authToken) {
            // Try to reauthenticate
            loader.style.display = 'none';
            loadOrders();
        } else {
            // No stored credentials, redirect to login
            window.location.href = 'login.html';
        }
    }
});

// Load orders
function loadOrders() {
    if (!checkAdminAuth()) {
        return;
    }

    ordersList.innerHTML = '<div class="loader"></div>';
    const ordersRef = firebase.firestore().collection('orders');
    let query = ordersRef.orderBy('timestamp', 'desc');

    // Apply status filter
    const status = statusFilter.value;
    if (status !== 'all') {
        query = query.where('status', '==', status);
    }

    // Apply time filter
    const timeValue = timeFilter.value;
    if (timeValue !== 'all') {
        const now = new Date();
        let startDate = new Date();

        switch(timeValue) {
            case 'today':
                startDate.setHours(0, 0, 0, 0);
                break;
            case 'yesterday':
                startDate.setDate(startDate.getDate() - 1);
                startDate.setHours(0, 0, 0, 0);
                break;
            case 'week':
                startDate.setDate(startDate.getDate() - 7);
                break;
            case 'month':
                startDate.setMonth(startDate.getMonth() - 1);
                break;
        }

        query = query.where('timestamp', '>=', startDate.getTime());
    }

    query.get()
        .then((snapshot) => {
            ordersList.innerHTML = '';
            if (snapshot.empty) {
                ordersList.innerHTML = '<p class="no-orders">No orders found</p>';
                return;
            }
            snapshot.forEach((doc) => {
                const order = doc.data();
                order.id = doc.id;
                displayOrder(order);
            });
        })
        .catch((error) => {
            showToast('Error loading orders: ' + error.message);
        });
}

// Display single order
function displayOrder(order) {
    const orderElement = document.createElement('div');
    orderElement.className = 'order-item';
    const date = new Date(order.timestamp);
    const formattedDate = date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
    const formattedTime = date.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });

    orderElement.innerHTML = `
        <div class="order-header">
            <div class="order-header-left">
                <h4>Order #${order.id}</h4>
                <span class="status ${order.status}">${order.status}</span>
            </div>
            <div class="order-time">
                <i class="fas fa-calendar-alt"></i> ${formattedDate}
                <i class="fas fa-clock"></i> ${formattedTime}
            </div>
        </div>
        <div class="order-info">
            <div class="customer-info">
                <p><i class="fas fa-user"></i> ${order.customerName || 'N/A'}</p>
                <p><i class="fas fa-chair"></i> Table: ${order.tableNumber || 'N/A'}</p>
            </div>
            <div class="order-items-preview">
                <h5>Items:</h5>
                <ul>
                    ${order.items.slice(0, 2).map(item => `
                        <li>${item.name} × ${item.quantity}</li>
                    `).join('')}
                    ${order.items.length > 2 ? `<li>+${order.items.length - 2} more items...</li>` : ''}
                </ul>
            </div>
            <p class="order-total"><strong>Total:</strong> ₹${order.total}</p>
        </div>
        <div class="order-actions">
            <button class="view-details-btn" onclick="viewOrderDetails('${order.id}')">
                <i class="fas fa-eye"></i> View Details
            </button>
        </div>
    `;
    ordersList.appendChild(orderElement);
}

// View order details
function viewOrderDetails(orderId) {
    const orderRef = firebase.firestore().collection('orders').doc(orderId);
    
    orderRef.get()
        .then((doc) => {
            if (doc.exists) {
                currentOrder = doc.data();
                currentOrder.id = doc.id;
                showOrderDetails();
            } else {
                showToast('Order not found');
            }
        })
        .catch((error) => {
            showToast('Error loading order details: ' + error.message);
        });
}

// Show order details in modal
function showOrderDetails() {
    const orderDetails = document.getElementById('order-details');
    orderDetails.innerHTML = `
        <h4>Order #${currentOrder.id}</h4>
        <p class="status ${currentOrder.status}">Status: ${currentOrder.status}</p>
        <p>Customer: ${currentOrder.customerName || 'N/A'}</p>
        <p>Table: ${currentOrder.tableNumber || 'N/A'}</p>
        <p>Time: ${new Date(currentOrder.timestamp).toLocaleString()}</p>
        <h5>Items:</h5>
        <ul class="order-items">
            ${currentOrder.items.map(item => `
                <li>${item.name} x${item.quantity} - ₹${item.price * item.quantity}</li>
            `).join('')}
        </ul>
        <p class="order-total">Total: ₹${currentOrder.total}</p>
    `;
    orderModal.style.display = 'block';
}

// Update order status
function updateOrderStatus(status) {
    if (!currentOrder) return;
    
    const validStatuses = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
        showToast('Invalid status');
        return;
    }

    const orderRef = firebase.firestore().collection('orders').doc(currentOrder.id);
    
    orderRef.update({
        status: status,
        lastUpdated: Date.now()
    })
    .then(() => {
        showToast('Order status updated successfully');
        orderModal.style.display = 'none';
        loadOrders();
    })
    .catch((error) => {
        showToast('Error updating order status: ' + error.message);
    });
}

// Menu management
let currentMenuItem = null;

function loadMenuItems() {
    const menuList = document.getElementById('menu-list');
    menuList.innerHTML = '<div class="loader"></div>';
    
    const menuRef = firebase.firestore().collection('menuItems');
    const categoryFilter = document.getElementById('category-filter').value;
    
    let query = menuRef;
    if (categoryFilter !== 'all') {
        query = query.where('category', '==', categoryFilter);
    }
    
    query.get()
        .then((snapshot) => {
            menuList.innerHTML = '';
            if (snapshot.empty) {
                menuList.innerHTML = '<p class="no-items">No menu items found</p>';
                return;
            }
            snapshot.forEach((doc) => {
                const item = doc.data();
                item.id = doc.id;
                displayMenuItem(item);
            });
        })
        .catch((error) => {
            showToast('Error loading menu items: ' + error.message);
        });
}

function displayMenuItem(item) {
    const menuList = document.getElementById('menu-list');
    const itemElement = document.createElement('div');
    itemElement.className = 'menu-item';
    itemElement.innerHTML = `
        <div class="menu-item-header">
            <h4>${item.name}</h4>
            <div class="menu-item-actions">
                <button class="edit-btn" onclick="editMenuItem('${item.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="delete-btn" onclick="deleteMenuItem('${item.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
        <div class="menu-item-content">
            <p>${item.description}</p>
            <p class="price">₹${item.price}</p>
            <p class="category">${item.category}</p>
            ${item.image ? `<img src="${item.image}" alt="${item.name}">` : ''}
        </div>
    `;
    menuList.appendChild(itemElement);
}

function editMenuItem(itemId) {
    const menuRef = firebase.firestore().collection('menuItems').doc(itemId);
    
    menuRef.get()
        .then((doc) => {
            if (doc.exists) {
                currentMenuItem = doc.data();
                currentMenuItem.id = doc.id;
                showMenuModal('Edit Menu Item');
            }
        })
        .catch((error) => {
            showToast('Error loading menu item: ' + error.message);
        });
}

function deleteMenuItem(itemId) {
    if (confirm('Are you sure you want to delete this item?')) {
        const menuRef = firebase.firestore().collection('menuItems').doc(itemId);
        
        menuRef.delete()
            .then(() => {
                showToast('Menu item deleted successfully');
                loadMenuItems();
            })
            .catch((error) => {
                showToast('Error deleting menu item: ' + error.message);
            });
    }
}

function showMenuModal(title = 'Add Menu Item') {
    const modal = document.getElementById('menu-modal');
    const modalTitle = document.getElementById('menu-modal-title');
    const form = document.getElementById('menu-form');
    
    modalTitle.textContent = title;
    
    if (currentMenuItem) {
        form['item-name'].value = currentMenuItem.name;
        form['item-description'].value = currentMenuItem.description;
        form['item-price'].value = currentMenuItem.price;
        form['item-category'].value = currentMenuItem.category;
        form['item-image'].value = currentMenuItem.image || '';
    } else {
        form.reset();
    }
    
    modal.style.display = 'block';
}

// Event Listeners
logoutBtn.addEventListener('click', () => {
    firebase.auth().signOut()
        .then(() => {
            localStorage.removeItem('currentUser');
            sessionStorage.removeItem('authToken');
            window.location.href = 'login.html';
        })
        .catch((error) => {
            showToast('Error logging out: ' + error.message);
        });
});

refreshBtn.addEventListener('click', loadOrders);

closeOrderModal.addEventListener('click', () => {
    orderModal.style.display = 'none';
});

updateStatusBtn.addEventListener('click', () => {
    const newStatus = prompt('Enter new status (pending/preparing/ready/completed/cancelled):');
    if (newStatus) {
        updateOrderStatus(newStatus.toLowerCase());
    }
});

// Search functionality
let searchTimeout;
searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        const searchTerm = e.target.value.toLowerCase();
        const orders = document.querySelectorAll('.order-item');
        
        orders.forEach(order => {
            const text = order.textContent.toLowerCase();
            order.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    }, 300);
});

// Filter functionality
statusFilter.addEventListener('change', loadOrders);
timeFilter.addEventListener('change', loadOrders);
document.getElementById('category-filter').addEventListener('change', loadMenuItems);

// Toast notification
function showToast(message, duration = 3000) {
    toastMessage.textContent = message;
    toast.style.display = 'block';
    setTimeout(() => {
        toast.style.display = 'none';
    }, duration);
}

// Initial load
window.addEventListener('load', () => {
    if (checkAdminAuth()) {
        loader.style.display = 'none';
        
        // Show active section based on hash or default to orders
        const hash = window.location.hash || '#orders-section';
        const sectionId = hash.replace('#', '');
        
        // Set initial active states
        document.querySelectorAll('.content-section').forEach(section => {
            section.style.display = 'none';
            section.classList.remove('active');
        });
        
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.querySelector(`[data-section="${sectionId}"]`)) {
                item.classList.add('active');
            }
        });
        
        // Show active section
        const activeSection = document.getElementById(sectionId);
        if (activeSection) {
            activeSection.style.display = 'block';
            activeSection.classList.add('active');
            
            // Load appropriate content
            if (sectionId === 'menu-section') {
                loadMenuItems();
            } else {
                loadOrders();
            }
        }
    }
});

// Handle section switching
document.querySelectorAll('.sidebar-nav a').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Update navigation active state
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        link.parentElement.classList.add('active');
        
        // Get section ID
        const sectionId = link.dataset.section;
        
        // Hide all sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.style.display = 'none';
            section.classList.remove('active');
        });
        
        // Show selected section
        const selectedSection = document.getElementById(sectionId);
        selectedSection.style.display = 'block';
        selectedSection.classList.add('active');
        
        // Load appropriate content
        if (sectionId === 'menu-section') {
            loadMenuItems();
        } else if (sectionId === 'orders-section') {
            loadOrders();
        }
    });
});

// Menu form submission
document.getElementById('menu-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const form = e.target;    const menuItem = {
        name: form['item-name'].value,
        description: form['item-description'].value,
        price: parseFloat(form['item-price'].value),
        category: form['item-category'].value,
        image: form['item-image'].value || null,
        status: true, // Set item as active by default
        id: Date.now(), // Generate a unique ID
        lastUpdated: Date.now()
    };
    
    const menuRef = firebase.firestore().collection('menuItems');
    
    (currentMenuItem 
        ? menuRef.doc(currentMenuItem.id).update(menuItem)
        : menuRef.add(menuItem)
    ).then(() => {
        showToast(`Menu item ${currentMenuItem ? 'updated' : 'added'} successfully`);
        document.getElementById('menu-modal').style.display = 'none';
        loadMenuItems();
    }).catch((error) => {
        showToast(`Error ${currentMenuItem ? 'updating' : 'adding'} menu item: ${error.message}`);
    });
});

document.getElementById('add-item-btn').addEventListener('click', () => {
    currentMenuItem = null;
    showMenuModal();
});

document.getElementById('close-menu-modal').addEventListener('click', () => {
    document.getElementById('menu-modal').style.display = 'none';
});
