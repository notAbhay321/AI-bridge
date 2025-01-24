// Firebase App (the core Firebase SDK) for Chrome Extension
const firebase = {
    apps: [],
    initializeApp: function(config) {
        const app = {
            name: '[DEFAULT]',
            options: config,
            auth: () => this._auth
        };
        this.apps.push(app);
        return app;
    },
    _auth: null,
    auth: function() {
        if (!this._auth) {
            this._auth = new FirebaseAuth();
        }
        return this._auth;
    }
};

window.firebase = firebase; 