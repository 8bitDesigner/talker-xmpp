var xmpp = require('node-xmpp')

function Room(jid, client) {
  this.jid = jid
  this.client = client
  this._bindEvents()
  this.join()
}

Room.prototype._bindEvents = function() {
  var bare = this.jid.bare()

  this.client.on(bare+':message',  this.handleMessage.bind(this))
  this.client.on(bare+':presence', this.handlePresence.bind(this))
}

Room.prototype._unbindEvents = function() {
  var bare = this.jid.bare()

  this.client.removeAllListeners(bare+':message')
  this.client.removeAllListeners(bare+':presence')
}


Room.prototype.join = function() {
  this.room = this.client.talker.join(this.jid.user)

  var events = [ 'error', 'timeout', 'connect', 'message', 'join', 'users', 'idle', 'back', 'leave' ]
  events.forEach(function(event) {
    this.room.on(event, function(payload) { console.log('event happened', event, payload) })
  }.bind(this))

  this.room.on('connect', function() { console.log('talker client connected') })

  this.room.on('disconnect', function() { console.log('talker client disconnected') })

  this.room.on('error', function(err) {
    console.error('talker error', err)
    process.exit(1)
  })

  this.room.once('users', function(data) {
    var sorted = data.users.sort(function(a, b) {
      var client = this.client.jid.bare().toString()
      if (a.email !== client && b.email !== client) {
        return 0
      } else if (a.email == client) {
        return 1
      } else if (b.email == client) {
        return -1
      }
    }.bind(this))

    sorted.forEach(function(user) {
      this.broadcastJoin(user)
    }.bind(this))

    // this.broadcastHistory()

    this.room.on('message', this.broadcastMessage.bind(this))

    this.room.on('join', function(data) {
      this.broadcastJoin(data.user)
    }.bind(this))

    this.room.on('leave', function(data) {
      this.broadcastLeave(data.user)
    }.bind(this))

  }.bind(this))

  this.room.on('disconnect', this.handleDisconnect.bind(this))
  this.room.on('timeout', this.handleDisconnect.bind(this))
  this.room.on('error', this.handleDisconnect.bind(this))
  this.room.on('connect', function() { this.reconnecting = false }.bind(this))
}

Room.prototype.leave = function() {
  this.room.leave()
  // Where can I get a user name?
  // this.broadcastLeave({user: name})
  this._unbindEvents()
}

Room.prototype.handleMessage = function(stanza) {
  this.room.message(stanza.getChildText('body'))
}

Room.prototype.handlePresence = function(stanza) {
  if (stanza.attrs.type == 'unavailable') { this.leave() }
}

Room.prototype._send = function(xml) {
  this.client.send(xml.root().toString())
}

Room.prototype.handleDisconnect = function() {
  var self = this;

  if (!this.reconnecting) {
    this.reconnecting = true
    console.log('room died, disconnecting and reconnecting in 1 second')
    setTimeout(function() {
      self.room.reconnect()
    }, 1000)
  }
}

Room.prototype.broadcastJoin = function(user) {
  var to = this.client.jid
    , from = new xmpp.JID(this.jid.user, this.jid.domain, user.name)
    , origin = new xmpp.JID(user.email)
    , xml

  xml = new xmpp.Presence({ from: from.toString(), to: to.toString() })
            .c('x', {xmlns: 'http://jabber.org/protocol/muc#user'})
              .c('item', {affiliation: 'member', role: 'participant'}).up()

  if (to.bare().equals(origin)) {
    xml.c('status', {code: 110 }).up()
       .c('status', {code: 210 })
  }

  this._send(xml)
}

Room.prototype.broadcastLeave = function(user) {
  var to = this.client.jid
    , from = new xmpp.JID(this.jid.user, this.jid.domain, user.name)
    , origin = new xmpp.JID(user.email)
    , xml

  xml = new xmpp.Presence({ from: from.toString(), to: to.toString(), type: 'unavailable' })
            .c('x', {xmlns: 'http://jabber.org/protocol/muc#user'})
              .c('item', {affiliation: 'member', role: 'none'}).up()

  if (to.bare().equals(origin)) {
    xml.c('status', {code: 110 })
  }

  this._send(xml)
}

Room.prototype.broadcastMessage = function(data) {
  this._send(
    new xmpp.Message({
      from: new xmpp.JID(this.jid.user, this.jid.domain, data.user.name),
      type: 'groupchat'
    }).c('body').t(data.content)
  )
}

module.exports = Room;
