// DOM Elements
const authTabs = document.querySelectorAll('.auth-tab');
const authForms = document.querySelectorAll('.auth-form');
const switchToSignup = document.getElementById('switch-to-signup');
const switchToLogin = document.getElementById('switch-to-login');
const loginForm = document.getElementById('login-form-element');
const signupForm = document.getElementById('signup-form-element');
const roleOptions = document.querySelectorAll('.role-option');
const roleInput = document.getElementById('signup-role');
const adminCodeGroup = document.getElementById('admin-code-group');
const staffCodeGroup = document.getElementById('staff-code-group');
const togglePasswordButtons = document.querySelectorAll('.toggle-password');
const successModal = document.getElementById('success-modal');
const successTitle = document.getElementById('success-title');
const successMessage = document.getElementById('success-message');
const successAction = document.getElementById('success-action');
const closeModalButtons = document.querySelectorAll('.close-modal');
const loader = document.getElementById('loader');

// Firebase references
const auth = window.auth;
const db = window.db;

// Verification codes - Base64 encoded for minimal obfuscation
const ADMIN_CODE = atob('QURNSU4yMDI1'); // ADMIN2025
const STAFF_CODE = atob('U1RBRkYyMDI1'); // STAFF2025

// Switch between login and signup tabs
function switchTab(tabName) {
    authTabs.forEach(tab => {
        if (tab.dataset.tab === tabName) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    authForms.forEach(form => {
        if (form.id === `${tabName}-form`) {
            form.classList.add('active');
        } else {
            form.classList.remove('active');
        }
    });
}

// Show error message
function showError(inputId, message) {
    const errorElement = document.getElementById(`${inputId}-error`);
    const inputElement = document.getElementById(inputId);
    
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.classList.add('show');
    }
    
    if (inputElement) {
        inputElement.classList.add('input-error');
    }
}

// Clear error message
function clearError(inputId) {
    const errorElement = document.getElementById(`${inputId}-error`);
    const inputElement = document.getElementById(inputId);
    
    if (errorElement) {
        errorElement.textContent = '';
        errorElement.classList.remove('show');
    }
    
    if (inputElement) {
        inputElement.classList.remove('input-error');
    }
}

// Validate email format
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Validate password strength
function isValidPassword(password) {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    return passwordRegex.test(password);
}

// Validate phone number
function isValidPhone(phone) {
    const phoneRegex = /^\d{10}$/;
    return phoneRegex.test(phone);
}

// Show success modal
function showSuccessModal(title, message, actionText, actionCallback) {
    successTitle.textContent = title;
    successMessage.textContent = message;
    successAction.textContent = actionText;
    
    successAction.onclick = actionCallback;
    
    successModal.classList.add('open');
}

// Helper function to handle user authentication
async function authenticateUser(userData) {
    try {
        // Get auth token if user is signed in
        if (auth.currentUser) {
            const token = await auth.currentUser.getIdToken(true);
            sessionStorage.setItem('authToken', token);
        }

        // Save user data in localStorage
        localStorage.setItem('currentUser', JSON.stringify(userData));
        
        // Redirect based on role
        const redirectUrl = userData.role === 'admin' ? 'admin.html' : 
                          userData.role === 'staff' ? 'staff.html' : 
                          'index.html';
        
        showSuccessModal(
            'Success!',
            `Welcome ${userData.name}!`,
            'Continue',
            () => {
                window.location.href = redirectUrl;
            }
        );
    } catch (error) {
        console.error('Error in authentication:', error);
        showError('login-email', 'An error occurred during authentication. Please try again.');
    }
}

// Login form submission
loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    
    // Clear previous errors
    clearError('login-email');
    clearError('login-password');
    
    // Basic validation
    if (!email || !isValidEmail(email)) {
        showError('login-email', 'Please enter a valid email');
        return;
    }
    
    if (!password) {
        showError('login-password', 'Password is required');
        return;
    }
    
    try {
        // Sign in with Firebase Auth
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Get user data from Firestore
        const userDoc = await db.collection('users').doc(user.uid).get();
        const userData = userDoc.data();
        
        if (!userData) {
            showError('login-email', 'No account found with this email');
            return;
        }

        // Store user data and authenticate
        authenticateUser({
            uid: user.uid,
            ...userData
        });
    } catch (error) {
        console.error('Error during login:', error);
        if (error.code === 'auth/user-not-found') {
            showError('login-email', 'No account found with this email');
        } else if (error.code === 'auth/wrong-password') {
            showError('login-password', 'Incorrect password');
        } else {
            showError('login-email', 'An error occurred during login. Please try again.');
        }
    }
});

// Signup form submission
signupForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const phone = document.getElementById('signup-phone').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;
    const role = roleInput.value || 'customer';
    const termsChecked = document.getElementById('terms').checked;
    const address = document.getElementById('signup-address').value.trim();
    
    // Clear all previous errors
    ['name', 'email', 'phone', 'password', 'confirm-password', 'terms'].forEach(field => {
        clearError(`signup-${field}`);
    });
    
    // Validate all fields
    let hasErrors = false;
    
    if (!name) {
        showError('signup-name', 'Name is required');
        hasErrors = true;
    }
    
    if (!email || !isValidEmail(email)) {
        showError('signup-email', 'Please enter a valid email');
        hasErrors = true;
    }
    
    if (!phone || !isValidPhone(phone)) {
        showError('signup-phone', 'Please enter a valid phone number');
        hasErrors = true;
    }
    
    if (!password || !isValidPassword(password)) {
        showError('signup-password', 'Password must be at least 8 characters with 1 uppercase, 1 lowercase, and 1 number');
        hasErrors = true;
    }
    
    if (password !== confirmPassword) {
        showError('signup-confirm-password', 'Passwords do not match');
        hasErrors = true;
    }
    
    if (!termsChecked) {
        showError('terms', 'You must accept the terms and conditions');
        hasErrors = true;
    }

    if (hasErrors) return;

    try {
        // If role is admin/staff, verify code first
        if (role === 'admin') {
            const adminCode = document.getElementById('admin-code').value;
            if (adminCode !== ADMIN_CODE) {
                showError('admin-code', 'Invalid admin verification code');
                return;
            }
        } else if (role === 'staff') {
            const staffCode = document.getElementById('staff-code').value;
            if (staffCode !== STAFF_CODE) {
                showError('staff-code', 'Invalid staff verification code');
                return;
            }
        }

        // Create user with Firebase Auth
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Create user document in Firestore
        await db.collection('users').doc(user.uid).set({
            name,
            email,
            phone,
            role,
            address,
            registeredDate: new Date().toISOString()
        });

        // Show success message and authenticate user
        const userData = {
            uid: user.uid,
            name,
            email,
            phone,
            role,
            address
        };
        
        authenticateUser(userData);
    } catch (error) {
        console.error('Error during signup:', error);
        if (error.code === 'auth/email-already-in-use') {
            showError('signup-email', 'This email is already registered');
        } else {
            showError('signup-email', 'An error occurred during signup. Please try again.');
        }
    }
});

// Tab switching
authTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        switchTab(tab.dataset.tab);
    });
});

// Switch links
switchToSignup.addEventListener('click', (e) => {
    e.preventDefault();
    switchTab('signup');
});

switchToLogin.addEventListener('click', (e) => {
    e.preventDefault();
    switchTab('login');
});

// Role selection
roleOptions.forEach(option => {
    option.addEventListener('click', () => {
        roleOptions.forEach(opt => opt.classList.remove('active'));
        option.classList.add('active');
        
        const role = option.dataset.role;
        roleInput.value = role;
        
        // Show/hide verification code fields
        adminCodeGroup.style.display = role === 'admin' ? 'block' : 'none';
        staffCodeGroup.style.display = role === 'staff' ? 'block' : 'none';
    });
});

// Toggle password visibility
togglePasswordButtons.forEach(button => {
    button.addEventListener('click', () => {
        const input = button.previousElementSibling;
        const icon = button.querySelector('i');
        
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    });
});

// Close modal
closeModalButtons.forEach(button => {
    button.addEventListener('click', () => {
        successModal.classList.remove('open');
    });
});

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    if (e.target === successModal) {
        successModal.classList.remove('open');
    }
});

// Initialize
window.addEventListener('load', () => {
    // Set default role
    roleOptions[0].classList.add('active');
    roleInput.value = 'customer';
    
    // Show loader
    setTimeout(() => {
        loader.classList.add('hidden');
        setTimeout(() => {
            loader.style.display = 'none';
        }, 500);
    }, 1000);
});
