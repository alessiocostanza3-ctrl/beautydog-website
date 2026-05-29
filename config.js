/* ==========================================================================
   BeautyDog - Configuration Settings
   ========================================================================== */

// 1. General Salon Configuration
const CONFIG = {
    // Current local email for notifications (Swap this with the owner's email)
    OWNER_EMAIL: "alessiocostanza3@gmail.com",
    
    // Salon Telephone Number (Format: CountryCode + Number, no spaces or symbols)
    // Used for direct WhatsApp messaging confirmation
    SALON_PHONE: "393208821749",
    
    // Auto-Approve Bookings: If true, bookings are confirmed immediately in DB.
    // If false, they go to "Pending" and must be approved in admin.html
    AUTO_APPROVE: false,

    // Gemini API Key for AI Chatbot (Get it from Google AI Studio: https://aistudio.google.com/)
    GEMINI_API_KEY: "YOUR_GEMINI_API_KEY",

    // EmailJS Configuration (Used for sending automated email notifications)
    // Register at https://www.emailjs.com/ (Free tier allows 200 emails/month)
    EMAILJS_SERVICE_ID: "YOUR_EMAILJS_SERVICE_ID",
    EMAILJS_TEMPLATE_ID: "YOUR_EMAILJS_TEMPLATE_ID",
    EMAILJS_PUBLIC_KEY: "YOUR_EMAILJS_PUBLIC_KEY"
};

// 2. Firebase Configuration (Serverless Database & Auth)
// Register a free project at https://console.firebase.google.com/
// Create a Web App, select Firestore Database and Authentication (Email/Password)
const firebaseConfig = {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "YOUR_FIREBASE_AUTH_DOMAIN",
    projectId: "YOUR_FIREBASE_PROJECT_ID",
    storageBucket: "YOUR_FIREBASE_STORAGE_BUCKET",
    messagingSenderId: "YOUR_FIREBASE_MESSAGING_SENDER_ID",
    appId: "YOUR_FIREBASE_APP_ID"
};
