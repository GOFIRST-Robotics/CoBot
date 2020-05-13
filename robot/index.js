var Pusher = require('pusher');

var pusher = new Pusher({
  appId: '993137',
  key: '9627d07a9c6ddb39f270',
  secret: '0c50c0376881a64ae66f',
  cluster: 'us2',
  encrypted: true
});

pusher.trigger('my-channel', 'my-event', {
  "message": "hello world"
});