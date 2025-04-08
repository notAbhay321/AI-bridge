// Firebase App (the core Firebase SDK) for Chrome Extension
(function(window) {
  // Initialize Firebase namespace if it doesn't exist
  window.firebase = window.firebase || {};
  
  // Add initialization function
  window.firebase.initializeApp = function(config) {
    this.app = {
      name: '[DEFAULT]',
      options: config
    };
    this.apps = [this.app];
    return this.app;
  };
  
  // Add Firestore functionality
  window.firebase.firestore = function() {
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
  };

  // Add Auth functionality
  window.firebase.auth = function() {
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
  };
  
  // Make Firestore available globally if not already set
  if (!window.database) {
    window.database = window.firebase.firestore();
  }
})(window); 