// fire_auth.js
// VERSION 0.01
'use strict';
import * as firebase from "firebase/app";
import "firebase/auth";
import * as firebaseui from 'firebaseui';
import 'firebaseui/dist/firebaseui.css';

// Note: diff btwn authentication & authorization;
// But both are done here, & in (cloud) function

const ui_config = {
  signInOptions: [
    {
      provider: firebase.auth.EmailAuthProvider.PROVIDER_ID,
      signInMethod: firebase.auth.EmailAuthProvider.EMAIL_LINK_SIGN_IN_METHOD,
      forceSameDevice: false
    },
    {
      provider: firebase.auth.GoogleAuthProvider.PROVIDER_ID,
      scopes: [
        //'https://www.googleapis.com/auth/contacts.readonly'
      ],
      customParameters: {
        // Forces account selection even when one account
        // is available.
        prompt: 'select_account'
      }
    },
  ],
}

function onAuthChange(user){
  if (user) {
    // User is signed in.
    var displayName = user.displayName;
    var email = user.email;
    var emailVerified = user.emailVerified;
    var photoURL = user.photoURL;
    var uid = user.uid;
    var phoneNumber = user.phoneNumber;
    var providerData = user.providerData;
    user.getIdToken().then(function(accessToken) {
      document.getElementById('sign-in-status').textContent = 'Signed in';
      document.getElementById('sign-in').textContent = 'Sign out';
      document.getElementById('account-details').textContent = JSON.stringify({
        displayName: displayName,
        email: email,
        emailVerified: emailVerified,
        phoneNumber: phoneNumber,
        photoURL: photoURL,
        uid: uid,
        accessToken: accessToken,
        providerData: providerData
      }, null, '  ');
    });
  } else {
    // User is signed out.
    document.getElementById('sign-in-status').textContent = 'Signed out';
    document.getElementById('sign-in').textContent = 'Sign in';
    document.getElementById('account-details').textContent = 'null';
  }
}

// Handle login
// https://firebase.google.com/docs/auth/web/firebaseui
export async function ui_init(firebase){
  await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.NONE);
  firebase.auth().onAuthStateChange(this.onAuthChange, (err)=>{console.log(err);});
  const ui = new firebaseui.auth.AuthUI(firebase.auth());
  ui.start('#firebaseui-auth-container', ui_config);
  return ui;
};
//module.exports.ui_init = this.ui_init;