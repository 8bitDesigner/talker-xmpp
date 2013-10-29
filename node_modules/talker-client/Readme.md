# What is this?
A high-ish level interface for [Talker](http://talkerapp.com/)

## How do I use it?

``` javascript
var Talker = require('talker-client')
  , client = new Talker({ account: 'test', token: 'your token here' })

client.getRooms(function(err, rooms) {
  var firstRoom = rooms.pop()
    , room = client.join(firstRoom.id)

  room.on('users', function(message) {
    console.log('users currently connected', message.users)
    message.users.forEach(function(user) {
      if (user.name  === 'paul.sweeney') { room.message('oh hai, Paul!') }
    })
  })
})
```

# API Docs

## Class: `Talker`
Usage:
``` javascript
var client = new Talker({ account: 'your account', token: 'your token' })
```

`account` is your Talker subdomain (eg: `[youraccount].talker.com` )  
`token` is account token, you can find this by going to [http://talkerapp.com/settings](http://talkerapp.com/settings)

### Methods
#### `getRooms(callback)`
Returns a list of rooms, and the list of users for each room:

``` json
[
  {
    "name": "Main",
    "id": 38287,
    "account": { "id": 36142 },
    "users": [
      { "name": "User", "id": 69351 }
    ]
  }
]
```

#### `join(roomId)`
Return an instance of the `Room` class.

### Properties
#### `rooms`
`rooms` is a key/value hash of room IDs to their connected room instaces. eg:

``` javascript
var client = new Talker({ ... })
client.join(1234)
client.room[1234].send('Oh hai')
```


### Events
All `Room` events are emitted on the client directly, with the first parameter
being the room ID and the second being the event payload:

``` javascript
var client = new Talker({ ... })
  , room = client.join(1234)

client.on('message', function(1234, message) { ... })
room.on('message', function(message) { ... })
```

## Class: `Room`
Created by calling `join` on a Talker client instance

### Methods
#### `mesasge(content [, to])`
Sends a mesasge to the room. Specifying a user ID as the second parameter will
send a private message to that user.

#### `leave()`
Leaves a room.

### Events
#### `connect`
Emitted when you've connected to the Talker Room

#### `error`
Emitted whenever the client encounters an error from Talker

#### `message`
Emitted when a user in the talker room sends a message:

``` json
{
  "type": "message",
  "content": "message to send",
  "user": { "id": "unique id", "name": "user name" },
  "time": 1255447115
}
```

#### `join`
Emitted when a new user joins the room

``` json
{
  "type": "join",
  "user": { "id": "unique id", "name": "user name" },
  "time": 1255447115,
}
```

#### `users`
Emitted when you join a room, the payload is a list of all the users currently
in the room:

``` json
{
  "type": "users",
  "users": [
    { "id": "unique id", "name": "user name" }
  ]
}
```

#### `idle`
Emitted when a user in the room goes idle

```json
{
  "type": "idle",
  "user": { "id": "unique id", "name": "user name" },
  "time": 1255447115,
}
```

#### `back`
Emitted when a user in the room returns from being idle

```json
{
  "type": "back",
  "user": { "id": "unique id", "name": "user name" },
  "time": 1255447115,
}
```


#### `leave`
Emitted when a user leaves the room

```json
{
  "type": "leave",
  "user": "user unique id",
  "time": 1255447115,
}
```
