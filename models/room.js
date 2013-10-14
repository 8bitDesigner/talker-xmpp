var xmpp = require('node-xmpp')
  , Roster = require('./roster')

function Room(jid, client) {
  this.jid = jid

  this.roster = new Roster()
  this.roster.on('add',    function(jid) { this.broadcastJoin(jid) }.bind(this))
  this.roster.on('remove', function(jid) { this.broadcastLeave(jid) }.bind(this))

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

  var events = [ 'connect', 'message', 'join', 'users', 'idle', 'back', 'leave' ]
  events.forEach(function(event) {
    this.room.on(event, function(payload) { console.log('event happened', event, payload) })
  }.bind(this))

  this.room.once('users', function(data) {
    this.roster.addTalkerUsers(data.users)
    // this.broadcastHistory()

    this.room.on('message', this.broadcastMessage.bind(this))
    this.room.on('join', this.roster.add.bind(this.roster))
    this.room.on('leave', this.roster.remove.bind(this.roster))
  }.bind(this))
}

Room.prototype.leave = function() {
  this.room.leave()
  this._unbindEvents()
  this.roster.removeAllEventListeners()
}

Room.prototype.handleMessage = function(stanza) {
  this.room.message(stanza.getChildText('body'))
}

Room.prototype.handlePresence = function(stanza) {
  // Client disconnected, abandon ship!
  if (stanza.attrs.type == 'unavailable') {
    this.leave()
  }
}


Room.prototype.broadcastJoin = function(user) {
  var to = this.client.jid
    , from = new xmpp.JID(this.jid.user, this.jid.domain, user.resource)
    , xml

  xml = new xmpp.Presence({ from: from.toString(), to: to.toString() })
            .c('x', {xmlns: 'http://jabber.org/protocol/muc#user'})
              .c('item', {affiliation: 'member', role: 'participant'}).up()

  if (to.bare().equals(user.bare())) {
    xml.c('status', {code: 110 }).up()
       .c('status', {code: 210 })
  }

  this._send(xml)
}

Room.prototype.broadcastLeave = function(user) {
  var to = this.client.jid
    , from = new xmpp.JID(this.jid.user, this.jid.domain, user.resource)
    , xml

  xml = new xmpp.Presence({ from: from.toString(), to: to.toString() })
            .c('x', {xmlns: 'http://jabber.org/protocol/muc#user'})
              .c('item', {affiliation: 'member', role: 'participant'}).up()

  if (to.bare().equals(user.bare())) {
    xml.c('status', {code: 110 }).up()
       .c('status', {code: 210 })
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

Room.prototype._send = function(xml) {
  this.client.send(xml.root().toString())
}

module.exports = Room;
