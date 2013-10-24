var xmpp = require('node-xmpp')
  , Roster = require('./roster')

function Room(jid, client) {
  var self = this
    , bare = jid.bare().toString()

  this.jid = jid
  this.client = client

  // Messages and Presences from the XMPP client are emitted with our bare
  // room JID on the front
  this.client.on(bare+':message',  this.handleMessage.bind(this))
  this.client.on(bare+':presence', this.handlePresence.bind(this))

  // When the Roster changes, we need to inform the XMPP client
  this.roster = new Roster(client.jid, jid.resource)
  this.roster.on('add',    function(jid) { self.broadcastPresence('join',  jid) })
  this.roster.on('remove', function(jid) { self.broadcastPresence('leave', jid) })

  // Wire up our Talker interface
  this.join()
}

Room.prototype.join = function() {
  var self = this;
  this.room = this.client.talker.join(this.jid.user)

  this.room.on('connect', function() { console.log('talker client connected') })

  // When talker receives roster updates, update our internal roster
  // which will in turn, emit XMPP presence stanzas
  this.room.on('users',   function(data) { self.roster.addTalkerUsers(data.users) })
  this.room.on('join',    function(data) { self.roster.add(data.user) })
  this.room.on('leave',   function(data) { self.roster.remove(data.user) })

  // When talker receives messages, emit them as XMPP messages
  this.room.on('message', function(data) { self.broadcastMessage(data) })

  // Shit-hitting-the-fan management
  this.room.on('error',   function(e) { self.handleDisconnect(e) })
}


// Messages from our client to Talker
Room.prototype.handleMessage = function(stanza) {
  this.room.message(stanza.getChildText('body'))
}

// Presence from the client to Talker
Room.prototype.handlePresence = function(stanza) {
  var bare = this.client.bare().toString()

  // At the moment, the only presence we care about is 'unavailable', which
  // means the client has left the MUC, so we should remove our event listeners
  // and allow the room object to be reaped by the GC
  if (stanza.attrs.type == 'unavailable') {
    this.broadcastPresence('leave', this.roster.getClient())
    this.room.leave()
    this.room.removeAllListeners()
    this.client.removeAllListeners(bare+':message')
    this.client.removeAllListeners(bare+':presence')
  }
}

Room.prototype.handleDisconnect = function(err) {
  var self = this;

  console.log('disconnected because of ', err)

  // Show a mass exodus from the chat room
  this.roster.evacuate()

  // Queue up a reconnect attempt
  setTimeout(function() {
    console.log('attempting reconnect')
    self.room.reconnect()
  }, 3000)
}


Room.prototype._send = function(xml) {
  this.client.send(xml.root().toString())
}

// Presence from Talker to the client
Room.prototype.broadcastPresence = function(event, user) {
  console.log('broadcasting presence', event, user)

  var to = this.client.jid
    , from = new xmpp.JID(this.jid.user, this.jid.domain, user.resource)
    , role = (event === 'join') ? 'participant' : 'none'
    , xml

  xml = new xmpp.Presence({ from: from.toString(), to: to.toString() })
            .c('x', {xmlns: 'http://jabber.org/protocol/muc#user'})
              .c('item', {affiliation: 'member', role: role}).up()

  if (user.isClient) {
    xml.c('status', {code: 110 }).up()
    if (event == 'join') { xml.c('status', {code: 210 }).up() }
  }

  this._send(xml)
}

// Messages from Talker to the client
Room.prototype.broadcastMessage = function(data) {
  var user = this.roster.findTalkerUser(data.user).pop()
    , nick = user ? user.resource : data.user.name

  this._send(
    new xmpp.Message({
      from: new xmpp.JID(this.jid.user, this.jid.domain, nick),
      type: 'groupchat'
    }).c('body').t(data.content)
  )
}

module.exports = Room;
