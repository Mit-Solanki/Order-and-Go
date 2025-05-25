// This file is now only for initializing menu items data
// Firebase initialization is handled in firebase-init.js
const db = firebase.firestore();

// Initial menu items data
const initialMenuItems = [
    {
        id: 1,
        name: 'Masala Chai',
        category: 'drinks',
        price: 30,
        description: 'Aromatic Indian tea with spices',
        image: 'https://images.pexels.com/photos/1793035/pexels-photo-1793035.jpeg',
        status: true
    },
    {
        id: 2,
        name: 'Cold Coffee',
        category: 'drinks',
        price: 50,
        image: 'https://images.pexels.com/photos/2615323/pexels-photo-2615323.jpeg',
        description: 'Chilled coffee with ice cream',
        status: true
    },
    {
        id: 3,
        name: 'Fresh Lime Soda',
        category: 'drinks',
        price: 25,
        image: 'https://images.pexels.com/photos/1793033/pexels-photo-1793033.jpeg',
        description: 'Refreshing lime soda with mint',
        status: true
    },
    {
        id: 6,
        name: 'Vada Pav',
        category: 'food',
        price: 25,
        image: 'https://images.pexels.com/photos/16395615/pexels-photo-16395615.jpeg',
        description: 'Popular Mumbai street food',
        status: true
    },
    {
        id: 7,
        name: 'Samosa',
        category: 'food',
        price: 15,
        image: 'https://images.pexels.com/photos/5946625/pexels-photo-5946625.jpeg',
        description: 'Fried pastry with savory filling',
        status: true
    },
    {
        id: 11,
        name: 'Aloo Bhujia',
        category: 'crisps',
        price: 20,
        image: 'https://images.pexels.com/photos/13258183/pexels-photo-13258183.jpeg',
        description: 'Spicy potato snack',
        status: true
    },
    {
        id: 15,
        name: 'Gulab Jamun',
        category: 'dessert',
        price: 40,
        image: 'https://images.pexels.com/photos/13258242/pexels-photo-13258242.jpeg',
        description: 'Sweet milk-solid-based dessert',
        status: true
    }
];

// Function to initialize the menu items collection
async function initializeMenuItems() {
    try {
        const menuItemsRef = db.collection('menuItems');
        const batch = db.batch();

        // Get existing menu items
        const snapshot = await menuItemsRef.get();
        if (!snapshot.empty) {
            console.log('Menu items collection already exists');
            return;
        }

        // Add all menu items in a batch
        initialMenuItems.forEach(item => {
            const docRef = menuItemsRef.doc(item.id.toString());
            batch.set(docRef, item);
        });

        // Commit the batch
        await batch.commit();
        console.log('Successfully initialized menu items collection');
    } catch (error) {
        console.error('Error initializing menu items:', error);
    }
}

// Call the initialization function
initializeMenuItems();
