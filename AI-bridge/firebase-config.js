// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDxNSWtQXwTZXtxZKNPqDi9tgOxZbKPxoM",
  authDomain: "ai-bridge-321.firebaseapp.com",
  projectId: "ai-bridge-321",
  storageBucket: "ai-bridge-321.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef1234567890",
  measurementId: "G-ABCDEF1234"
};

// Initialize Firebase
window.firebase = {
  initializeApp: function(config) {
    this.app = {
      name: '[DEFAULT]',
      options: config
    };
    return this.app;
  },
  apps: [],
  auth: function() {
    if (!this._auth) {
      this._auth = {
        currentUser: null,
        onAuthStateChanged: function(callback) {
          // Implement auth state change listener
          return function() {};
        },
        signInWithCustomToken: async function(token) {
          // Implement custom token sign in
          return { user: { uid: 'test-user' } };
        }
      };
    }
    return this._auth;
  },
  firestore: function() {
    if (!this._firestore) {
      this._firestore = {
        collection: function(path) {
          return {
            doc: function(id) {
              return {
                get: async function() {
                  return {
                    exists: true,
                    data: function() {
                      return {};
                    }
                  };
                },
                set: async function(data) {
                  // Implement document set
                  return true;
                }
              };
            },
            get: async function() {
              return {
                docs: []
              };
            }
          };
        },
        doc: function(path) {
          return {
            get: async function() {
              return {
                exists: true,
                data: function() {
                  return {};
                }
              };
            },
            set: async function(data) {
              // Implement document set
              return true;
            }
          };
        }
      };
    }
    return this._firestore;
  }
};

// Initialize Firebase with config
window.firebase.initializeApp(firebaseConfig);

// Make Firestore available globally
window.database = window.firebase.firestore(); 