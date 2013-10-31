var xmpp = require('node-xmpp')
  , domain = require('domain').create()
  , Room = require('./models/room')
  , Talker = require('talker-client')
  , opts = {
      domain: 'localhost',
      port: '5222'
    }


var server = new xmpp.C2SServer(opts)

// Sets up the server.
//
function boot(server) {
  console.log('Talker bridge now listening on port', opts.port)

  // On Connect event. When a client connects.
  server.on("connect", function(client) {

    client.rooms = []

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
      // Needs a target
      if (!stanza.attrs.to) { return }

      var toJid = new xmpp.JID(stanza.attrs.to)
        , isMuc = stanza.getChild('x', 'http://jabber.org/protocol/muc')
        , bareJid = toJid.bare().toString()

      // Directed MUC joining presence
      if (isMuc && !stanza.attrs.type) {
        domain.run(function() {
          client.rooms.push(new Room(toJid, client))
        })
      } else if (stanza.attrs.type) {
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

    domain.on('error', function(err) {
      console.error('domain oops', err.stack ? err.stack.replace('\n',"\n") : err)
      process.exit(1)
    })

    client.on('error', function(err) {
      console.error('oops', err.stack ? err.stack.replace('\n',"\n") : err)
      process.exit(1)
    })
  });
}

boot(server)
