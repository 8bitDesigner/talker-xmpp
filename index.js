var xmpp = require('node-xmpp')
  , Room = require('./models/room')
  , Talker = require('talker-client')
  , opts = {
      domain: 'localhost',
      port: '5222'
    }

// Sets up the server.
var c2s = new xmpp.C2SServer(opts);

// On Connect event. When a client connects.
c2s.on("connect", function(client) {

  // Allows the developer to authenticate users against anything they want.
  client.on("authenticate", function(opts, cb) {
    client.talker = new Talker({ account: opts.user, token: opts.password })
    cb(null)
  });

  // Stanza routing
  client.on("stanza", function(stanza) {
    client.emit(stanza.name, stanza)
  })

  client.on('presence', function(stanza) {
    if (!stanza.attrs.to) { return }

    var toJid = new xmpp.JID(stanza.attrs.to)
      , bareJid = toJid.bare().toString()
      , room

    // Directed MUC joining presence
    if (stanza.getChild('x', 'http://jabber.org/protocol/muc')) {
      room = new Room(toJid, client)

    // Directed presence to an entitiy
    } else {
      client.emit(bareJid+':presence', stanza)
    }
  })

  client.on('message', function(stanza) {
    if (!stanza.attrs.to) { return }

    var toJid = new xmpp.JID(stanza.attrs.to)
      , bare = toJid.bare().toString()

    if (stanza.attrs.type === 'groupchat') {
      client.emit(bare+':message', stanza)
    }
  })

  client.on('iq', function(stanza) {
    // Send back an empty roster if asked
    if (stanza.attrs.type === 'get' && stanza.getChild('query', 'jabber:iq:roster')) {
      var response = new xmpp.Iq({ to: stanza.attrs.from, type: 'result', id: stanza.attrs.id })
                          .c('query', { xmlns: 'jabber:iq:roster'})

      client.send(response.root().toString())
    }
  })

  client.on('error', function(err) {
    console.error('oops', err)
    process.exit(1)
  })
});
