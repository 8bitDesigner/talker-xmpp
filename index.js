var xmpp = require('node-xmpp')
  , domain = require('domain').create()
  , logger = require('./lib/logger')
  , Room = require('./lib/room')
  , Talker = require('talker-client')
  , opts = {
      domain: 'localhost',
      port: '5222'
    }

var server = new xmpp.C2SServer(opts)
logger.info('Talker bridge now listening on port', opts.port)

// On Connect event. When a client connects.
server.on("connect", function(client) {
  client.rooms = []

  // Allows the developer to authenticate users against anything they want.
  client.on("authenticate", function(opts, cb) {
    logger.info('Client connected', opts.user+'@'+opts.domain)
    client.talker = new Talker({ account: opts.user, token: opts.password })
    cb(null)
  });

  // Stanza routing
  client.on("stanza", function(stanza) {
    logger.debug('Stanza received', stanza.toString())
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
    logger.error('Uncaught room error', err.stack ? err.stack.replace('\n',"\n") : err)
    process.exit(1)
  })

  client.on('error', function(err) {
    if (err.message === 'junk after document element') {
      logger.error('Dropped unparseable packet', err)
    } else {
      logger.error('Uncaught client error', err.stack ? err.stack.replace('\n',"\n") : err)
      process.exit(1)
    }
  })
});
