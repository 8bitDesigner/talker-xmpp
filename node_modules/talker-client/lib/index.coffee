tls     = require("tls")
request = require("request")
async   = require("async")
extend  = require("deep-extend")
Emitter = require("events").EventEmitter

module.exports = class TalkerClient extends Emitter
  constructor: (options = {}) ->
    @options = options
    @rooms = {}

  get: (path, cb) ->
    options =
      url: "https://#{@options.account}.talkerapp.com/#{path}"
      headers:
        "Accept": "application/json"
        "Content-Type": "application/json"
        "X-Talker-Token": @options.token
    request.get options, (err, res, body) ->
      json = {}
      try
        json = JSON.parse(body)
      catch e
        err = e
      cb(err, json)

  getRooms: (cb) ->
    @get "rooms.json", (err, rooms) =>
      if (err) then return cb(err, [])
      funcs = []
      funcs.push (cb) => @get("rooms/#{room.id}.json", cb) for room in rooms
      async.parallel funcs, (err, results) ->
        unless err
          results.forEach (result, index) -> rooms[index].users = result.users
        cb(err, rooms)

  join: (room) ->
    connector = new Room(extend(@options, {room: room}))
    connector.client = @
    @rooms[room] = connector
    @bind(connector, room)
    return connector

  bind: (room, ns) ->
    events = ["connect", "message", "join", "users", "idle", "back", "leave"]

    # Repeat room events up to the client object
    repeater = (event, ns) => (payload) => @emit(event, ns, payload)
    room.on event, repeater(event, ns) for event in events

    # Toss the reference to the room object when you close it
    room.on "close", => delete @rooms[ns]

class Room extends Emitter
  constructor: (options = {}) ->
    @host    = options.host or "talkerapp.com"
    @port    = options.port or 8500
    @timeout = options.timeout or 5000
    @room    = options.room
    @token   = options.token
    @setup()

  reconnect: ->
    @destroy()
    @setup()

  setup: ->
    # Create socket to Talker service
    @socket = tls.connect @port, @host, {rejectUnauthorized: false}, =>
      @emit "connect"
      @send "connect", {"room": @room, "token": @token}
      @pinger = setInterval(@ping.bind(@), @timeout)

    # Configure socket
    @socket.setEncoding("utf8")
    @socket.setKeepAlive true

    # Bind events
    @socket.on "close", =>
      @emit "disconnect"
      @destroy()

    @socket.on "error", (err) =>
      if err.code is 'ECONNRESET' then @reconnect()
      else
        @emit "error", err
        @destroy()

    @socket.on "data", (data) =>
      data.split("\n").forEach (line) =>
        return unless line
        message = @normalize JSON.parse(line)
        @emit message.type, message if message

  normalize: (message) =>
    message.content = "/me #{message.content}" if message.action
    message.time = new Date(message.time * 1000)
    delete message.action
    return message

  getUsers: (cb) ->
    @client.get "rooms/#{@room}.json", (err, result) -> cb(result.users)

  getEvents: (cb) ->
    @client.get "rooms/#{@room}.json", (err, result) =>
      truthy = (thing) -> thing?
      cb result.events.filter(truthy).map(@normalize)

  ping: -> @send("ping")

  message: (content, to) ->
    payload =
      content: content
      to: to if to

    if content.indexOf('/me') is 0
      payload.content = content.replace('/me', '')
      payload.action = true

    @send("message", payload)

  destroy: ->
    clearInterval(@pinger)
    @socket.destroy()

  leave: ->
    @send("close")
    @destroy()

  send: (type, message={}) ->
    payload = extend(message, {type: type})
    if @socket.readyState isnt "open"
      return @emit "error", "cannot send with readyState: #{@socket.readyState}"
    @socket.write JSON.stringify(payload), "utf8"
