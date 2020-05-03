window.addEventListener('blur',()=>pressed = {},false);
var KEYS = {left: 37, right: 39, forward: 38, reverse: 40};
var pressed={};
document.onkeydown=function(e){
     e = e || window.event;
     pressed[e.keyCode] = true;
}

document.onkeyup=function(e){
     e = e || window.event;
     pressed[e.keyCode] = false;
}

function isPressed(keyCode) {
    if (keyCode in pressed) {
        return pressed[keyCode];
    }
    return false;
}

var socket = io();
socket.on('connect', function() {
    statustag.textContent = "Ready";
});
socket.on('reconnect', function() {
    statustag.textContent = "Ready";
});
socket.on('disconnect', function() {
    statustag.textContent = "Disconnected";
});

setInterval(() => {
    left.textContent = isPressed(KEYS.left);
    right.textContent = isPressed(KEYS.right);
    forward.textContent = isPressed(KEYS.forward);
    reverse.textContent = isPressed(KEYS.reverse);
    socket.emit('keys', {
        "left" : isPressed(KEYS.left),
        "right" : isPressed(KEYS.right),
        "forward" : isPressed(KEYS.forward),
        "reverse" : isPressed(KEYS.reverse)
    });
}, 100);
