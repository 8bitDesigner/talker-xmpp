# What is this?
Talker is like HipChat or Campfire, only free. This is good. However there's no
third party apps that integrate with it, and it's no longer supported, which is
bad.

This project acts as a XMPP (Jabber) to Talker bridge, so that you can connect
to Talker with your choice of XMPP client.

# How do I set it up?

## Installing and running
1. Check out this repo somewhere
2. `npm rebuild` to recompile binary packages
3. `npm start` to run the bridge

## Connecting to the bridge
There are two things you want to do - first, set up a new account on your XMPP
client of choice and plug in your registered Talker email address as your
account name, and your Talker API token as your password.

Then, go into your client's settings, and plug in the host and port of the
talker bridge, and if you're not using SSL, disable authentication.

Enable the account, and you should be good to go.

## Joining a chat room
Once you're connected, in your XMPP client, find the `Join Room` command, and
plug in the Talker room ID, plus "@" the host of your Talker bridge.
