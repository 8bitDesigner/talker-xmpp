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
  this.room.on('error', this.handleDisconnect.bind(this))

  function isMessage(e) { return e.type === 'message' }
  function sendMessage(m) { self.broadcastMessage(m, true) }

  // Per spec - process the following room join events in order
  this.room.on('connect', function() {
    self.room.once('users', function(data) {
      // First send initial presence for all users in room
      self.roster.addTalkerUsers(data.users)
      self.room.getEvents(function(events) {
        // Then send any delayed messages
        events.filter(isMessage).forEach(sendMessage)

        // Lastly, start processing normal room events
        self.room.on('join',    function(data) { self.roster.add(data.user) })
        self.room.on('idle',    function(data) { self.broadcastPresence('away', data.user) })
        self.room.on('back',    function(data) { self.broadcastPresence('', data.user) })
        self.room.on('leave',   function(data) { self.roster.remove(data.user) })
        self.room.on('message', function(data) { self.broadcastMessage(data) })
      })
    })
  })
}


// Messages from our client to Talker
Room.prototype.handleMessage = function(stanza) {
  this.room.message(stanza.getChildText('body'))
}

// Presence from the client to Talker
Room.prototype.handlePresence = function(stanza) {
  var bare = this.client.jid.bare().toString()

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
  var to = this.client.jid
    , from = new xmpp.JID(this.jid.user, this.jid.domain, user.resource)
    , role = (event === 'leave') ? 'none' : 'participant'
    , xml = new xmpp.Presence({ from: from.toString(), to: to.toString() })

  // Attach a show key if we were given an availability presence
  if (event && event !== 'leave' && event !== 'join') {
    xmpp.c('show').t(event).root()
  }

  // Attach the MUC bits here
  xml.c('x', {xmlns: 'http://jabber.org/protocol/muc#user'})
       .c('item', {affiliation: 'member', role: role}).up()

  // Send any necessary self presence, or JID assignment status codes
  if (user.isClient) {
    xml.c('status', {code: 110 }).up()
    if (event == 'join') { xml.c('status', {code: 210 }).up() }
  }

  this._send(xml)
}

// Messages from Talker to the client
Room.prototype.broadcastMessage = function(data, delayed) {
  var user = this.roster.findTalkerUser(data.user).pop()
    , nick = user ? user.resource : data.user.name
    , xml = new xmpp.Message({
        from: new xmpp.JID(this.jid.user, this.jid.domain, nick),
        type: 'groupchat'
      })

  xml.c('body').t(data.content).root()

  if (delayed) {
    xml.c('delay', {xmlns: 'urn:xmpp:delay', from: this.jid.bare(),
                    stamp: data.time.toISOString()
    })
  }

  this._send(xml)
}

module.exports = Room;
