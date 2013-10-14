var util = require('util')
  , Emitter = require('events').EventEmitter
  , xmpp = require('node-xmpp')

function Roster() {
  Emitter.call(this)
  this.users = []
}

util.inherits(Roster, Emitter)

Roster.prototype.get = function() {
  return this.users
}

Roster.prototype.find = function(jid) { 
  return this.users.filter(function(user, i) {
    return user.equals(jid)
  })
}

Roster.prototype.add = function(user) {
  var jid = new xmpp.JID(user.email)
  jid.setResource(user.name)

  if (this.find(jid).length) { return }

  this.users.push(jid)
  this.emit('add', jid)
}

Roster.prototype.remove = function(jid) {
  this.users = this.users.filter(function(user) {
    return !user.equals(jid)
  })

  this.emit('remove', jid)
}


Roster.prototype.addTalkerUsers = function(users) {
  users.forEach(this.add.bind(this))
}

module.exports = Roster
