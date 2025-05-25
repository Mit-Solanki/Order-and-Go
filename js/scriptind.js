// Global state
window.menuItems = []; // Global menu items array

// Initialize user state
function initializeUserState() {
    const savedUserData = localStorage.getItem('currentUser');
    return savedUserData ? JSON.parse(savedUserData) : null;
}

// Global state object to manage cart and user state
const appState = {
    cart: [],
    currentUser: initializeUserState(),
    
    // Save cart to localStorage and Firestore
    async saveCart() {
        if (this.currentUser) {
            try {
                // Save to both localStorage and Firestore for synchronization
                localStorage.setItem(`cart_${this.currentUser.email}`, JSON.stringify(this.cart));
                
                // Save to Firestore with server timestamp
                await db.collection('carts').doc(this.currentUser.uid).set({
                    items: this.cart,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            } catch (error) {
                console.error('Error saving cart:', error);
                // Continue with localStorage save even if Firestore fails
            }
        }
    },
    
    // Load cart from Firestore and fall back to localStorage
    async loadCart() {
        if (this.currentUser) {
            try {
                // Try to get cart from Firestore first
                const cartDoc = await db.collection('carts').doc(this.currentUser.uid).get();
                if (cartDoc.exists) {
                    const cartData = cartDoc.data();
                    this.cart = cartData.items;
                } else {
                    // Fall back to localStorage if no Firestore data
                    const savedCart = localStorage.getItem(`cart_${this.currentUser.email}`);
                    if (savedCart) {
                        this.cart = JSON.parse(savedCart);
                        // Sync to Firestore
                        await this.saveCart();
                    }
                }
                this.updateCartDisplay();
            } catch (error) {
                console.error('Error loading cart:', error);
                // Fall back to localStorage on error
                const savedCart = localStorage.getItem(`cart_${this.currentUser.email}`);
                if (savedCart) {
                    this.cart = JSON.parse(savedCart);
                    this.updateCartDisplay();
                }
            }
        }
    },
      // Update cart display
    updateCartDisplay() {
        const cartCount = document.getElementById('cart-count');
        const cartModal = document.getElementById('cart-modal');
        const totalItems = this.cart.reduce((sum, item) => sum + item.quantity, 0);
        
        // Update cart count badge
        cartCount.textContent = totalItems;
        cartCount.style.display = totalItems > 0 ? 'block' : 'none';
        
        // Update cart modal if it's open
        if (cartModal.classList.contains('open')) {
            updateCartItems();
        }
    },
    
    // Add item to cart
    addToCart(item) {
        if (!this.currentUser) {
            const loginRequiredModal = document.getElementById('login-required-modal');
            loginRequiredModal.classList.add('open');
            
            // Add event listeners for login/register buttons in the modal
            document.getElementById('go-to-login-btn').onclick = () => {
                window.location.href = 'login.html';
            };
            document.getElementById('go-to-register-btn').onclick = () => {
                window.location.href = 'login.html#signup';
            };
            return false;
        }

        const existingItem = this.cart.find(cartItem => cartItem.id === item.id);
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            this.cart.push({
                ...item,
                quantity: 1
            });
        }
        
        this.saveCart();
        this.updateCartDisplay();
        return true;
    },
    
    // Remove item from cart
    removeFromCart(itemId) {
        this.cart = this.cart.filter(item => item.id !== itemId);
        this.saveCart();
        this.updateCartDisplay();
    },
    
    // Update item quantity
    updateQuantity(itemId, change) {
        const item = this.cart.find(item => item.id === itemId);
        if (item) {
            item.quantity += change;
            if (item.quantity <= 0) {
                this.removeFromCart(itemId);
            } else {
                this.saveCart();
                this.updateCartDisplay();
            }
        }
    },
    
    // Clear cart
    clearCart() {
        this.cart = [];
        this.saveCart();
        this.updateCartDisplay();
    },
    
    // Update UI for logged in user
    updateUIForLoggedInUser() {
        if (!this.currentUser) return;
        
        const loginBtn = document.getElementById('login-btn');
        loginBtn.innerHTML = `
            <i class="fas fa-user"></i>
            <span>${this.currentUser.name}</span>
            <i class="fas fa-chevron-down"></i>
        `;
        loginBtn.classList.add('logged-in');
        
        // Create user menu if it doesn't exist
        if (!document.querySelector('.user-menu')) {
            const userMenu = createUserMenu();
            document.querySelector('.user-actions').appendChild(userMenu);
        }
    },
    
    // Set up real-time cart sync
    setupCartSync() {
        if (this.currentUser) {
            return db.collection('carts').doc(this.currentUser.uid)
                .onSnapshot((doc) => {
                    if (doc.exists) {
                        const cartData = doc.data();
                        // Only update if the change was from another device/tab
                        const localCart = localStorage.getItem(`cart_${this.currentUser.email}`);
                        if (localCart !== JSON.stringify(cartData.items)) {
                            this.cart = cartData.items;
                            localStorage.setItem(`cart_${this.currentUser.email}`, JSON.stringify(this.cart));
                            this.updateCartDisplay();
                        }
                    }
                }, (error) => {
                    console.error('Error syncing cart:', error);
                });
        }
    }
};

// Create user menu dropdown
function createUserMenu() {
    const userMenu = document.createElement('div');
    userMenu.className = 'user-menu';
    userMenu.innerHTML = `
        <div class="user-menu-item">
            <i class="fas fa-user-circle"></i>
            <span>Profile</span>
        </div>
        <div class="user-menu-item">
            <i class="fas fa-history"></i>
            <span>Order History</span>
        </div>
        <div class="user-menu-item" id="logout-btn">
            <i class="fas fa-sign-out-alt"></i>
            <span>Logout</span>
        </div>
    `;
    
    // Add click handler for logout
    userMenu.querySelector('#logout-btn').addEventListener('click', () => {
        localStorage.removeItem('currentUser');
        window.location.reload();
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.user') && !e.target.closest('.user-menu')) {
            userMenu.classList.remove('show');
        }
    });
    
    return userMenu;
}

// Update login button handler
document.getElementById('login-btn').addEventListener('click', function(e) {
    if (appState.currentUser) {
        e.stopPropagation();
        const userMenu = document.querySelector('.user-menu');
        if (userMenu) {
            userMenu.classList.toggle('show');
        }
        return;
    }
    window.location.href = 'login.html';
});

// Initialize DOM elements
const menuItemsContainer = document.getElementById('menu-items');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const cartModal = document.getElementById('cart-modal');
const cartBtn = document.querySelector('.cart');
const closeCartBtn = document.getElementById('close-cart');

// Setup search functionality
function setupSearch() {
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const searchResults = document.getElementById('search-results');
    const searchQuery = document.getElementById('search-query');
    const clearSearchBtn = document.getElementById('clear-search');
    
    function performSearch() {
        const query = searchInput.value.toLowerCase().trim();
        if (query === '') {
            searchResults.style.display = 'none';
            displayMenuItems(menuItems);
            return;
        }
        
        const filtered = menuItems.filter(item =>
            item.name.toLowerCase().includes(query) ||
            item.description.toLowerCase().includes(query) ||
            item.category.toLowerCase().includes(query)
        );
        
        searchResults.style.display = 'flex';
        searchQuery.textContent = query;
        displayMenuItems(filtered);
    }
    
    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
    
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchResults.style.display = 'none';
        displayMenuItems(menuItems);
    });
}

// Load menu items from Firestore with error handling
async function loadMenuItems() {
    try {
        const snapshot = await window.db.collection('menuItems').get();
        if (snapshot.empty) {
            console.log('No menu items found in Firestore');
            menuItemsContainer.innerHTML = '<div class="no-items">No items available</div>';
            return;
        }

        window.menuItems = snapshot.docs.map(doc => ({
            id: parseInt(doc.id),
            ...doc.data(),
            // Ensure image property exists and has a fallback
            image: doc.data().image || 'https://via.placeholder.com/300x200?text=No+Image'
        }));

        // Sort items by category
        window.menuItems.sort((a, b) => a.category.localeCompare(b.category));
        
        // Set up category filters
        setupCategoryFilters();
        
        // Display all items initially
        displayMenuItems(window.menuItems);
    } catch (error) {
        console.error('Error loading menu items:', error);
        menuItemsContainer.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                <p>Error loading menu items. Please try again later.</p>
            </div>
        `;
    }
}

// Setup category filters
function setupCategoryFilters() {
    const categoryBtns = document.querySelectorAll('.category-btn');
    
    categoryBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons
            categoryBtns.forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            btn.classList.add('active');
            
            const category = btn.dataset.category;
            const filtered = category === 'all' 
                ? menuItems 
                : menuItems.filter(item => item.category === category);
            
            displayMenuItems(filtered);
        });
    });
}

// Display menu items with animation
function displayMenuItems(items) {
    const menuItemsContainer = document.getElementById('menu-items');
    menuItemsContainer.innerHTML = '';
    
    if (items.length === 0) {
        menuItemsContainer.innerHTML = `
            <div class="no-items">
                <i class="fas fa-search"></i>
                <p>No items found</p>
                <p class="subtitle">Try a different search term or category</p>
            </div>
        `;
        return;
    }
    
    items.forEach((item, index) => {
        if (!item.status) return; // Skip inactive items

        const menuItem = document.createElement('div');
        menuItem.classList.add('menu-item');
        menuItem.style.animationDelay = `${index * 0.1}s`;
        menuItem.innerHTML = `
            <div class="menu-item-img">
                <img src="${item.image}" alt="${item.name}" 
                     onerror="this.src='https://via.placeholder.com/300x200?text=Image+Not+Found'">
            </div>
            <div class="menu-item-info">
                <div class="menu-item-header">
                    <h3 class="menu-item-title">${item.name}</h3>
                    <span class="menu-item-category">${item.category}</span>
                </div>
                <p class="menu-item-description">${item.description}</p>
                <div class="menu-item-footer">
                    <div class="menu-item-price">₹${item.price}</div>
                    <button class="add-to-cart-btn" data-id="${item.id}">
                        <i class="fas fa-plus"></i> Add to Cart
                    </button>
                </div>
            </div>
        `;
        menuItemsContainer.appendChild(menuItem);
    });

    // Add event listeners for add to cart buttons
    document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const itemId = parseInt(e.target.closest('.add-to-cart-btn').dataset.id);
            const menuItem = menuItems.find(item => item.id === itemId);
            
            if (appState.addToCart(menuItem)) {
                // Show success animation
                const button = e.target.closest('.add-to-cart-btn');
                button.innerHTML = '<i class="fas fa-check"></i> Added';
                button.classList.add('added');
                
                setTimeout(() => {
                    button.innerHTML = '<i class="fas fa-plus"></i> Add to Cart';
                    button.classList.remove('added');
                }, 2000);
            }
        });
    });
}

// Setup cart modal functionality
function setupCartModal() {
    // Toggle cart modal when clicking cart icon
    cartBtn.addEventListener('click', () => {
        cartModal.classList.add('open');
        updateCartItems();
    });

    // Close cart when clicking close button
    closeCartBtn.addEventListener('click', () => {
        cartModal.classList.remove('open');
    });

    // Close cart when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === cartModal) {
            cartModal.classList.remove('open');
        }
    });
}

// Update cart items display
function updateCartItems() {
    const cartItemsContainer = document.getElementById('cart-items');
    const cartTotal = document.getElementById('cart-total');
    
    if (!appState.cart.length) {
        cartItemsContainer.innerHTML = '<div class="empty-cart"><i class="fas fa-shopping-cart"></i><p>Your cart is empty</p></div>';
        cartTotal.textContent = '₹0';
        return;
    }

    let total = 0;
    cartItemsContainer.innerHTML = appState.cart.map(item => {
        total += item.price * item.quantity;
        return `
            <div class="cart-item" data-id="${item.id}">
                <div class="cart-item-img">
                    <img src="${item.image}" alt="${item.name}">
                </div>
                <div class="cart-item-info">
                    <h4>${item.name}</h4>
                    <span class="cart-item-price">₹${item.price}</span>
                </div>
                <div class="cart-item-quantity">
                    <button class="quantity-btn decrease"><i class="fas fa-minus"></i></button>
                    <span>${item.quantity}</span>
                    <button class="quantity-btn increase"><i class="fas fa-plus"></i></button>
                </div>
                <button class="remove-item"><i class="fas fa-times"></i></button>
            </div>
        `;
    }).join('');    cartTotal.textContent = `₹${total}`;
    
    // Update checkout button state
    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) {
        checkoutBtn.disabled = !appState.currentUser || !appState.cart.length;
        checkoutBtn.onclick = handleCheckout;
    }

    // Add event listeners for quantity buttons and remove buttons
    cartItemsContainer.querySelectorAll('.quantity-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const itemId = parseInt(e.target.closest('.cart-item').dataset.id);
            const change = btn.classList.contains('increase') ? 1 : -1;
            appState.updateQuantity(itemId, change);
            updateCartItems();
        });
    });

    cartItemsContainer.querySelectorAll('.remove-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const itemId = parseInt(e.target.closest('.cart-item').dataset.id);
            appState.removeFromCart(itemId);
            updateCartItems();
        });
    });
}

// Handle checkout process
async function handleCheckout() {
    if (!appState.currentUser || !appState.cart.length) return;    try {
        // Calculate totals
        const subtotal = appState.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const tax = subtotal * 0.05; // 5% tax
        const total = subtotal + tax;

        // Create order object
        const order = {
            userId: appState.currentUser.uid,
            customerName: appState.currentUser.name,
            customerEmail: appState.currentUser.email,            items: appState.cart,
            subtotal,
            tax,
            total,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            notes: ''
        };

        // Save order to Firestore
        await db.collection('orders').add(order);

        // Clear the cart
        appState.clearCart();

        // Close cart modal
        cartModal.classList.remove('open');

        // Show order confirmation modal
        const orderModal = document.getElementById('order-modal');
        const orderDetails = document.getElementById('order-details');
        
        // Update order details in modal
        orderDetails.innerHTML = `
            <h4>Order Summary</h4>
            <div class="order-items">
                ${order.items.map(item => `
                    <div class="order-item">
                        <span>${item.name} x ${item.quantity}</span>
                        <span>₹${item.price * item.quantity}</span>
                    </div>
                `).join('')}
            </div>
            <div class="order-summary">
                <div class="summary-line">
                    <span>Subtotal:</span>
                    <span>₹${subtotal}</span>
                </div>                <div class="summary-line">
                    <span>Tax (5%):</span>
                    <span>₹${tax}</span>
                </div>
                <div class="summary-line total">
                    <span>Total:</span>
                    <span>₹${total}</span>
                </div>
            </div>
        `;

        orderModal.classList.add('open');

        // Add event listener for continue shopping button
        const continueShoppingBtn = document.getElementById('continue-shopping');
        continueShoppingBtn.onclick = () => {
            orderModal.classList.remove('open');
        };

    } catch (error) {
        console.error('Error during checkout:', error);
        showNotification('Error processing your order. Please try again.');
    }
}

// Initialize application on page load
window.addEventListener('DOMContentLoaded', async () => {
    const loader = document.getElementById('loader');
    
    try {
        // Load menu items first
        await loadMenuItems();
        
        // Update UI for logged in user and load cart if user exists
        if (appState.currentUser) {
            appState.updateUIForLoggedInUser();
            await appState.loadCart();
        }
        
        // Setup search functionality
        setupSearch();
        
        // Setup cart modal
        setupCartModal();
        
        // Setup category filters
        setupCategoryFilters();
        
        // Hide loader after everything is loaded
        loader.style.display = 'none';
    } catch (error) {
        console.error('Error initializing app:', error);
        showNotification('Error loading the application. Please refresh the page.');
    }
    
    // Close modals when clicking close button
    document.querySelectorAll('.close-modal').forEach(button => {
        button.addEventListener('click', () => {
            const modal = button.closest('.modal');
            if (modal) modal.classList.remove('open');
        });
    });
});