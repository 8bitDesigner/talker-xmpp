var xmpp = require('node-xmpp')
  , Room = require('./models/room')
  , Talker = require('talker-client')
  , opts = {
      domain: 'talker-bridge.herokuapp.com',
      port: '5222'
    }

console.log('setting up server!')

// Sets up the server.
var c2s = new xmpp.C2SServer(opts);

// On Connect event. When a client connects.
c2s.on("connect", function(client) {
  console.log('client connected')

  // Allows the developer to authenticate users against anything they want.
  client.on("authenticate", function(opts, cb) {
    client.talker = new Talker({ account: opts.user, token: opts.password })
    cb(null)
  });

  // Stanza routing
  client.on("stanza", function(stanza) {
    client.emit(stanza.name, stanza)
    console.log(stanza.toString())
  })

  client.on('presence', function(stanza) {
    if (!stanza.attrs.to || stanza.attrs.type) { return }

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
    var type = stanza.attrs.type
      , from = stanza.attrs.from
      , id = stanza.attrs.id
      , query = stanza.getChild('query') ? stanza.getChild('query').attrs.xmlns : undefined
      , response

    // Answer all queries with an empty response
    if (type === 'get' && query) {
      response = new xmpp.Iq({ to: from, type: 'result', id: id }).c('query', { xmlns: query})
    }

    if (response) { client.send(response.root().toString()) }
  })

  client.on('error', function(err) {
    console.error('oops', err)
    process.exit(1)
  })
});
