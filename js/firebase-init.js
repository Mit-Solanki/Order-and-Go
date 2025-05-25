// Initialize Firebase with the correct configuration
try {
    firebase.initializeApp({
        apiKey: "AIzaSyD2JUDruZh91qjnesmgBc3IdL_b4QIPbKo",
        authDomain: "foodordering-3c946.firebaseapp.com",
        projectId: "foodordering-3c946",
        storageBucket: "foodordering-3c946.appspot.com",
        messagingSenderId: "916721729349",
        appId: "1:916721729349:web:247907b73ae7ee0387c82c"
    });

    // Initialize Firestore and Auth first
    const db = firebase.firestore();
    const auth = firebase.auth();

    // Make Firebase services available globally
    window.db = db;
    window.auth = auth;
    
    console.log('Firebase initialized successfully');
} catch (error) {
    console.error('Firebase initialization error:', error);
}

// Setup auth state listener
let cartUnsubscribe = null;

auth.onAuthStateChanged(async (user) => {
    if (user) {
        console.log('User is signed in:', user.email);
        
        try {
            // Get user data from Firestore
            const userDoc = await db.collection('users').doc(user.uid).get();
            const userData = userDoc.data();
            
            if (userData) {
                localStorage.setItem('currentUser', JSON.stringify({
                    uid: user.uid,
                    ...userData
                }));
                
                // Set up cart sync if we're on the index page
                if (window.appState && typeof window.appState.setupCartSync === 'function') {
                    cartUnsubscribe = window.appState.setupCartSync();
                }
            }
        } catch (error) {
            console.error('Error getting user data:', error);
        }
    } else {
        console.log('User is signed out');
        localStorage.removeItem('currentUser');
        sessionStorage.removeItem('authToken');
        
        // Unsubscribe from cart sync
        if (cartUnsubscribe) {
            cartUnsubscribe();
            cartUnsubscribe = null;
        }
    }
});
