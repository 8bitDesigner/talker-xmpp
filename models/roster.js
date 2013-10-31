var util = require('util')
  , Emitter = require('events').EventEmitter
  , xmpp = require('node-xmpp')

function Roster(clientJid, clientNick) {
  Emitter.call(this)
  this.users = []

  clientJid.setResource(clientNick)
  this.client = clientJid
}

util.inherits(Roster, Emitter)

Roster.prototype.get = function() {
  return this.users
}

Roster.prototype.getClient = function() {
  return this.users.filter(function(u) { return u.isClient }).pop()
}

Roster.prototype.find = function(jid) {
  return this.users.filter(function(user, i) {
    return user.equals(jid)
  })
}

Roster.prototype.add = function(user) {
  if (!(user instanceof xmpp.JID)) {
    return this.add(this.talkerToJid(user))
  }

  if (this.find(user).length) { return }

  this.users.push(user)
  this.emit('add', user)
}

Roster.prototype.remove = function(user) {
  if (!(user instanceof xmpp.JID)) {
    return this.remove(this.talkerToJid(user))
  }

  this.users = this.users.filter(function(u) { return !u.equals(user) })
  this.emit('remove', user)
}

Roster.prototype.talkerToJid = function(user) {
  var jid = new xmpp.JID(user.email)

  if (this.isClient(jid)) {
    jid.isClient = true
    jid.setResource(this.client.resource)
  } else {
    jid.setResource(user.name)
  }

  return jid
}

Roster.prototype.isClient = function(jid) {
  return jid.bare().toString() == this.client.bare().toString()
}

Roster.prototype.findTalkerUser = function(user) {
  return this.users.filter(function(jid) {
    return jid.bare().equals(new xmpp.JID(user.email))
  })
}

Roster.prototype.addTalkerUsers = function(talkerUsers) {
  var self = this
    , jids = talkerUsers.map(this.talkerToJid.bind(this))

  this.sortByClient(jids).map(this.add.bind(this))
}

Roster.prototype.sortByClient = function(jids) {
  var client = this.client.toString()
    , self = this

  return jids.sort(function(a, b) {
    if (self.isClient(a)) {
      return 1
    } else if (self.isClient(b)) {
      return -1
    } else {
      return 0
    }
  })
}


module.exports = Roster
