// Firebase Firestore implementation
(function(window) {
  // Initialize Firestore namespace if it doesn't exist
  window.firebase = window.firebase || {};
  
  // Helper function to convert timestamps
  function convertTimestamps(data) {
    if (!data) return null;
    const result = { ...data };
    
    for (const [key, value] of Object.entries(result)) {
      if (value && typeof value === 'object' && value.seconds !== undefined) {
        result[key] = value.seconds * 1000;
      } else if (value && typeof value === 'object') {
        result[key] = convertTimestamps(value);
      }
    }
    
    return result;
  }

  // Helper function to get user token
  async function getValidToken() {
    try {
      const user = window.firebase.auth().currentUser;
      if (!user) return null;
      return await user.getIdToken(true);
    } catch (error) {
      console.error('Error getting valid token:', error);
      return null;
    }
  }

  // Create a proper document snapshot class
  class DocumentSnapshot {
    constructor(exists, data) {
      this._exists = exists;
      this._data = data;
    }
    
    get exists() {
      return this._exists;
    }
    
    data() {
      return this._data;
    }
  }

  // Add Firestore functionality
  window.firebase.firestore = function() {
    if (!this._firestore) {
      this._firestore = {
        // Add FieldValue object with serverTimestamp method
        FieldValue: {
          serverTimestamp: function() {
            return { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 };
          }
        },
        collection: function(path) {
          return {
            doc: function(id) {
              return {
                get: async function() {
                  try {
                    const token = await getValidToken();
                    if (!token) {
                      throw new Error('No authenticated user found');
                    }
                    
                    // Try to get data from local storage as a fallback
                    const pathParts = path.split('/');
                    if (pathParts.length >= 4 && pathParts[0] === 'users' && pathParts[2] === 'chats') {
                      const userId = pathParts[1];
                      const chatId = pathParts[3];
                      
                      // Check if this is the current user
                      const currentUser = JSON.parse(localStorage.getItem('user'));
                      if (currentUser && currentUser.uid === userId) {
                        const result = await chrome.storage.local.get('localChats');
                        const localChats = result.localChats || {};
                        const chat = localChats[chatId];
                        
                        if (chat) {
                          return new DocumentSnapshot(true, chat);
                        }
                      }
                    }
                    
                    return new DocumentSnapshot(false, null);
                  } catch (error) {
                    console.error('Error getting document:', error);
                    throw error;
                  }
                },
                set: async function(data) {
                  try {
                    const token = await getValidToken();
                    if (!token) {
                      throw new Error('No authenticated user found');
                    }
                    
                    // Save to local storage as a backup
                    const pathParts = path.split('/');
                    if (pathParts.length >= 4 && pathParts[0] === 'users' && pathParts[2] === 'chats') {
                      const userId = pathParts[1];
                      const chatId = pathParts[3];
                      
                      // Check if this is the current user
                      const currentUser = JSON.parse(localStorage.getItem('user'));
                      if (currentUser && currentUser.uid === userId) {
                        const result = await chrome.storage.local.get('localChats');
                        const localChats = result.localChats || {};
                        localChats[chatId] = {
                          ...data,
                          id: chatId
                        };
                        await chrome.storage.local.set({ localChats });
                      }
                    }
                    
                    return true;
                  } catch (error) {
                    console.error('Error setting document:', error);
                    throw error;
                  }
                }
              };
            },
            get: async function() {
              try {
                const token = await getValidToken();
                if (!token) {
                  throw new Error('No authenticated user found');
                }
                
                // Try to get data from local storage
                const pathParts = path.split('/');
                if (pathParts.length >= 3 && pathParts[0] === 'users' && pathParts[2] === 'chats') {
                  const userId = pathParts[1];
                  
                  // Check if this is the current user
                  const currentUser = JSON.parse(localStorage.getItem('user'));
                  if (currentUser && currentUser.uid === userId) {
                    const result = await chrome.storage.local.get('localChats');
                    const localChats = result.localChats || {};
                    
                    // Convert to array of document snapshots
                    const docs = Object.entries(localChats).map(([id, data]) => {
                      return {
                        id: id,
                        exists: true,
                        data: function() {
                          return data;
                        }
                      };
                    });
                    
                    return { docs };
                  }
                }
                
                return { docs: [] };
              } catch (error) {
                console.error('Error getting collection:', error);
                throw error;
              }
            }
          };
        },
        doc: function(path) {
          return {
            get: async function() {
              try {
                const token = await getValidToken();
                if (!token) {
                  throw new Error('No authenticated user found');
                }
                
                // Try to get data from local storage as a fallback
                const pathParts = path.split('/');
                if (pathParts.length >= 4 && pathParts[0] === 'users' && pathParts[2] === 'chats') {
                  const userId = pathParts[1];
                  const chatId = pathParts[3];
                  
                  // Check if this is the current user
                  const currentUser = JSON.parse(localStorage.getItem('user'));
                  if (currentUser && currentUser.uid === userId) {
                    const result = await chrome.storage.local.get('localChats');
                    const localChats = result.localChats || {};
                    const chat = localChats[chatId];
                    
                    if (chat) {
                      return new DocumentSnapshot(true, chat);
                    }
                  }
                }
                
                return new DocumentSnapshot(false, null);
              } catch (error) {
                console.error('Error getting document:', error);
                throw error;
              }
            },
            set: async function(data) {
              try {
                const token = await getValidToken();
                if (!token) {
                  throw new Error('No authenticated user found');
                }
                
                // Save to local storage as a backup
                const pathParts = path.split('/');
                if (pathParts.length >= 4 && pathParts[0] === 'users' && pathParts[2] === 'chats') {
                  const userId = pathParts[1];
                  const chatId = pathParts[3];
                  
                  // Check if this is the current user
                  const currentUser = JSON.parse(localStorage.getItem('user'));
                  if (currentUser && currentUser.uid === userId) {
                    const result = await chrome.storage.local.get('localChats');
                    const localChats = result.localChats || {};
                    localChats[chatId] = {
                      ...data,
                      id: chatId
                    };
                    await chrome.storage.local.set({ localChats });
                  }
                }
                
                return true;
              } catch (error) {
                console.error('Error setting document:', error);
                throw error;
              }
            },
            delete: async function() {
              try {
                const token = await getValidToken();
                if (!token) {
                  throw new Error('No authenticated user found');
                }
                
                // Delete from local storage as a backup
                const pathParts = path.split('/');
                if (pathParts.length >= 4 && pathParts[0] === 'users' && pathParts[2] === 'chats') {
                  const userId = pathParts[1];
                  const chatId = pathParts[3];
                  
                  // Check if this is the current user
                  const currentUser = JSON.parse(localStorage.getItem('user'));
                  if (currentUser && currentUser.uid === userId) {
                    const result = await chrome.storage.local.get('localChats');
                    const localChats = result.localChats || {};
                    delete localChats[chatId];
                    await chrome.storage.local.set({ localChats });
                  }
                }
                
                return true;
              } catch (error) {
                console.error('Error deleting document:', error);
                throw error;
              }
            }
          };
        }
      };
    }
    return this._firestore;
  };
})(window); 