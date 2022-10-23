const mineflayer = require('mineflayer')
const autoEat = require("mineflayer-auto-eat")
const vec3 = require('vec3')
const fs = require('fs')
let vectors = [new vec3(163, 105, -296), new vec3(165, 105, -296), new vec3(167, 105, -296), new vec3(169, 105, -296), new vec3(171, 105, -296), new vec3(173, 105, -296), new vec3(175, 105, -296), new vec3(177, 105, -296), new vec3(179, 105, -296), new vec3(181, 105, -296), new vec3(183, 105, -296), new vec3(185, 105, -296), new vec3(187, 105, -296), new vec3(189, 105, -296), ]
let buttonPos = [new vec3(175, 105, -306), new vec3(175, 105, -305), new vec3(175, 105, -304), new vec3(175, 105, -303), new vec3(175, 105, -302), new vec3(175, 105, -301), new vec3(175, 105, -300), new vec3(177, 105, -300), new vec3(177, 105, -301), new vec3(177, 105, -302), new vec3(177, 105, -303), new vec3(177, 105, -304), new vec3(177, 105, -305), new vec3(177, 105, -306), ]
let players = []
let pearls = [];
let PearlPlayer = new Map();
let lastSeenEnderPearls = {}
let lastMessageSent = getNanoSecTime()
let messagesWaiting = []
let lastPlayerCommand = new Map();
let lastPacket = getNanoSecTime()
loadPlayerPearlUuid()
//load credentials from file credentials.txt are ip, username, password, chatEncryptionKey
let credentials = fs.readFileSync(".gitignore/credentials.txt.txt").toString().split("\n")
let bot
let isConnected = false
const connect = () => {
    if(isConnected) {
        return
    }
    const instance = mineflayer.createBot({
        host: credentials[0],
        port: 25565,
        username: credentials[1],
        password: credentials[2],
        version: "1.18.2",
        auth: 'microsoft'
    })
    bot = instance
    let spawnTime = getNanoSecTime()
    instance.once('spawn', () => {
        isConnected = true
        instance.autoEat.options = {
            priority: 'saturation',
            bannedFood: []
        }
    })
    instance.loadPlugin(autoEat)
    // Chat event
    instance.on('whisper', (username, message) => {
        if(username === instance.username) return;
        let decryptMessage = decrypt(encodeBase64(message)).toLowerCase().replace(/[^a-zA-Z0-9! ]/g, '').replace(/\s*$/, '');
        message = message.replace(/[^a-zA-Z0-9! ]/g, "").toLowerCase().replace(/\s*$/, '');
        if(lastPlayerCommand.get(username) === undefined) {
            lastPlayerCommand.set(username, getNanoSecTime())
        } else if(((getNanoSecTime() - lastPlayerCommand.get(username)) < 3000) && message !== '!tp spawn' && decryptMessage !== '!tp spawn') {
            sendWhisperToPlayer(username, getMessage("Please wait a second", message, decryptMessage), instance)
            return
        }
        lastPlayerCommand.set(username, getNanoSecTime())
        if(message === 'tp spawn' || decryptMessage === 'tp spawn') {
            //get uuid of player
            const player = instance.players[username]
            let contains = false
            PearlPlayer.forEach((value, key) => {
                if(player !== undefined && value === player.uuid) {
                    pearls.forEach(pearl => {
                        if(pearl.uuid === key) {
                            contains = true
                            let pos = pearlPosToButton(pearl.position)
                            if(pos !== undefined) {
                                instance.activateBlock(instance.blockAt(pos))
                            }
                        }
                    })
                }
            })
            if(!contains) {
                sendWhisperToPlayer(username, getMessage("You did not set a pearl yet", "tp spawn", decryptMessage), instance)
            }
        } else if(message === 'stations' || decryptMessage === 'stations') {
            sendWhisperToPlayer(username, getMessage("There is currently only the \"spawn\" station", "stations", decryptMessage), instance)
        } else if(message === 'getslot' || decryptMessage === 'getslot') {
            const player = instance.players[username]
            let contains = false
            PearlPlayer.forEach((value, key) => {
                if(player !== undefined && value === player.uuid) {
                    pearls.forEach(pearl => {
                        if(pearl.uuid === key) {
                            contains = true
                            let pos = pearl.position
                            if(pos !== undefined) {
                                sendWhisperToPlayer(username, getMessage("Slot: " + vectorToNumb(pos), "getslot", decryptMessage), instance)
                            }
                        }
                    })
                }
            })
            if(!contains) {
                sendWhisperToPlayer(username, getMessage("You did not set a pearl yet", "!getslot", decryptMessage), instance)
            }
        } else if(message.includes('getslotbynumber') && username === "HNS_yt" && message.split(" ").length === 2 || decryptMessage.includes('getslotbynumber') && username === "HNS_yt" && decryptMessage.split(" ").length === 2) {
            let number = message.split(" ")[1]
            if(number >= 1 && number <= 14) {
                let pos = numbToVector(number)
                pearls.forEach(pearl => {
                    if(Math.floor(pearl.position.x) === pos.x && Math.floor(pearl.position.z) === pos.z) {
                        sendWhisperToPlayer(username, getMessage("Slot: " + vectorToNumb(pos) + " is set by " + PearlPlayer.get(pearl.uuid), "getslotbynumber", decryptMessage), instance)
                    }
                })
            } else {
                sendWhisperToPlayer(username, "Number must be between 1 and 14", instance)
            }
        } else if(message === 'help' || decryptMessage === 'help') {
            sendWhisperToPlayer(username, getMessage('use \"tp spawn\" to teleport to spawn, use \"getslot\" to get the slots set by you, use \"stations\" to get the stations, use \"help\" to see all commands', 'help', decryptMessage), instance)
        } else {
            sendWhisperToPlayer(username, getMessage("Unknown command use !help to see all commands", message, decryptMessage), instance)
        }
    })
    //Save every entity to get the nearest player to the pearl
    instance.on('entityMoved', (entity) => {
        if(entity.type === 'player') {
            //remove old entity
            players = players.filter(e => e.uuid !== entity.uuid)
            //add new entity
            players.push(entity)
        } else if(entity.mobType === "Thrown Ender Pearl") {
            //remove old entity
            pearls = pearls.filter(e => e.uuid !== entity.uuid)
            //add new entity
            pearls.push(entity)
            lastSeenEnderPearls[entity.uuid] = getNanoSecTime()
        }
    })
    //last packet received from server
    instance.on('packet', () => {
        lastPacket = getNanoSecTime()
    })
    //LOG if someone is griefing
    instance.on('blockUpdate', (oldBlock, newBlock) => {
        //contains Piston in word
        if(oldBlock.type === 0 || oldBlock.displayName.includes("Piston") || newBlock.type !== 0 && newBlock.displayName !== "Lava") {
            return
        }
        //get the nearest player
        let nearest = players[0]
        players.forEach(player => {
            if(player.position.distanceTo(newBlock.position) < nearest.position.distanceTo(newBlock.position) && player.uuid !== instance.player.uuid) {
                nearest = player
            }
        })
        // all players in range of 100 blocks
        let playersInRange = ""
        players.forEach(player => {
            if(player.position.distanceTo(newBlock.position) < 100) {
                playersInRange += 'Username: ' + player.username + " UUID: " + player.uuid + " Distance: " + player.position.distanceTo(newBlock.position) + " Pos: " + player.position + " "
            }
        })
        fs.appendFile('logBlockBreak.txt', 'BlockUpdate: ' + oldBlock.displayName + ' -> ' + newBlock.displayName + ' at ' + newBlock.position + ' by ' + newBlock.metadata + ' at ' + getNanoSecTime() + ' by ' + nearest.username + ' ' + nearest.uuid + ' ' + nearest.position + ' ' + playersInRange + ' ' + '\n', function(err) {
            if(err) throw err;
        });
    })
    //on damage log
    instance.on('entityHurt', (entity) => {
        if(entity.type === 'player' || entity.mobType === 'Villager') {
            let nearest = players[0]
            players.forEach(player => {
                if(player.position.distanceTo(entity.position) < nearest.position.distanceTo(entity.position) && player.username !== entity.username) {
                    nearest = player
                    //write to file
                }
            })
            // all players in range
            let playersInRange = " "
            players.forEach(player => {
                playersInRange += 'Username: ' + player.username + " UUID: " + player.uuid + " Distance: " + player.position.distanceTo(entity.position) + " Pos: " + player.position + " "
            })
            fs.appendFile('logDamage.txt', 'Damage: Attacker: username: ' + nearest.username + ' uuid: ' + nearest.uuid + ' Target: Type: ' + entity.type + ' MobType: ' + entity.mobType + ' Username: ' + entity.username + ' UUID: ' + entity.uuid + ' pos: ' + entity.position + ' at ' + getNanoSecTime() + ' ' + playersInRange + ' ' + '\n', function(err) {
                if(err) throw err;
            });
        }
    })
    //on velocity change
    instance._client.on('physicsTick', () => {
        instance.entity.velocity.set(0, 0, 0)
        if(instance.food === 20) {
            instance.autoEat.disable()
        } else {
            instance.autoEat.enable()
        }
    })
    instance.on('physicTick', () => {
        //remove old pearls
        pearls = pearls.filter(pearl => {
            return getNanoSecTime() - lastSeenEnderPearls[pearl.uuid] <= 1000000000;
        })
        //if playerPearl has pearls that are not in the pearl list remove them
        PearlPlayer.forEach((value, key) => {
            if(!pearls.some(pearl => pearl.uuid === key)) {
                PearlPlayer.delete(key)
            }
        })
    })
    instance.on('entityGone', (entity) => {
        if(entity.type === 'player') {
            players.splice(players.indexOf(entity), 1)
        } else if(entity.mobType === "Thrown Ender Pearl") {
            // test if the pearls uuid is in PlayerPearl
            if(PearlPlayer.get(entity.uuid) !== undefined) {
                PearlPlayer.delete(entity.uuid)
            }
            pearls.splice(pearls.indexOf(entity), 1)
        }
    })
    instance.on("entityUpdate", (entity) => {
        if(entity.type === 'player') {
            //remove old entity
            players = players.filter(e => e.uuid !== entity.uuid)
            //add new entity
            players.push(entity)
        } else if(entity.mobType === "Thrown Ender Pearl") {
            //remove old entity
            pearls = pearls.filter(e => e.uuid !== entity.uuid)
            //add new entity
            pearls.push(entity)
            lastSeenEnderPearls[entity.uuid] = getNanoSecTime()
        }
    })
    instance.on('entitySpawn', (entity) => {
        if(entity.type === 'player') {
            //remove old entity
            players = players.filter(e => e.id !== entity.id)
            //add new entity
            players.push(entity)
        } else if(entity.mobType === "Thrown Ender Pearl") {
            //remove old entity
            pearls = pearls.filter(e => e.id !== entity.id)
            //add new entity
            pearls.push(entity)
        }
        // if pearl is thrown and there is a player near it save the player and pearl in PlayerPearl
        if(entity.displayName === "Thrown Ender Pearl" && players.length > 0) {
            let nearest = players[0]
            for(let index = 0; index < players.length; index++) {
                // after 5 seconds of spawning do smith
                if(entity.position.distanceTo(players[index].position) < entity.position.distanceTo(nearest.position) && entity.position.distanceTo(players[index].position) < 3 && getNanoSecTime() - spawnTime > 500) {
                    //log the nearest player and distance
                    nearest = players[index]
                    //add to PlayerPearl + uuid of player and uuid of pearl
                    PearlPlayer.set(entity.uuid, nearest.uuid)
                    savePearlPlayerUuid()
                    let slot = vectorToNumb(instance.entities[nearest.id].position)
                    if(slot !== undefined) {
                        sendWhisperToPlayer(nearest.username, "you have thrown a pearl at slot " + slot, instance)
                    }
                }
            }
        }
    })
    instance.on('error', (err) => {
        console.log(err)
        isConnected = false
        setTimeout(connect, 10000)
    })
    instance.on('kicked', function(reason) {
        console.log("kicked for " + reason)
        isConnected = false
        setTimeout(connect, 10000)
    })
    instance.on('disconnect', function() {
        console.log("disconnected")
        isConnected = false
        setTimeout(connect, 10000)
    })
}
setTimeout(connect, 5000)

function isDecrypted(decrypted, is) {
    return decrypted === is;
}

function getNanoSecTime() {
    return new Date();
}

function numbToVector(slot) {
    //slot is not under null and not over the length of vectors
    if(slot != null && slot < vectors.length) {
        return vectors[slot]
    }
}

function vectorToNumb(pos) {
    let vec = vec3(Math.floor(pos.x), 105, Math.floor(pos.z))
    let returnable
    for(let index = 0; index < vectors.length; index++) {
        if(vec.x === vectors[index].x && vec.z === vectors[index].z) {
            returnable = index + 1
        }
    }
    return returnable
}

function savePearlPlayerUuid() {
    let data = JSON.stringify(Array.from(PearlPlayer.entries()))
    fs.writeFileSync('PearlPlayer.json', data)
}

function loadPlayerPearlUuid() {
    if(fs.existsSync('PearlPlayer.json')) {
        PearlPlayer = new Map(JSON.parse(fs.readFileSync('PearlPlayer.json')));
        console.log("loaded PearlPlayer")
    }
}

function pearlPosToButton(pos) {
    if(pos === undefined) {
        return undefined
    }
    // if x and z are equal to the pearl position return the button
    for(let index = 0; index < vectors.length; index++) {
        if(Math.floor(pos.x) === vectors[index].x && Math.floor(pos.z) === vectors[index].z) {
            return buttonPos[index]
        }
    }
}

function encodeBase64(message) {
    return Buffer.from(message).toString('base64');
}

function decrypt(message) {
    try {
        return require('child_process').execSync('java -jar Decryptor.jar ' + credentials[3] + ' -d \"' + message + "\"").toString().replace("\n", '').replace("\r", '')
    } catch(e) {
        return "error"
    }
}

function encrypt(message) {
    try {
        return require('child_process').execSync('java -jar Decryptor.jar ' + credentials[3] + ' -e \"' + message + "\"").toString().replace("\n", "").replace("\r", "")
    } catch(e) {
        return undefined
    }
}

function sendWhisperToPlayer(player, message, instance) {
    let encodedMessage = encodeBase64(message)
    if(messagesWaiting.indexOf(encodedMessage) === -1) {
        messagesWaiting.push(encodedMessage)
    }
    console.log(messagesWaiting.length)
    if(getNanoSecTime() - lastMessageSent > 500) {
        if(instance !== undefined && instance.players[player] !== undefined) {
            instance.chat("/msg " + player + " " + message)
        }
        lastMessageSent = getNanoSecTime()
        //remove message from array
        messagesWaiting.splice(messagesWaiting.indexOf(encodedMessage), 1)
    } else if(messagesWaiting.length <= 4 && getNanoSecTime() - lastPacket < 2000) {
        setTimeout(sendWhisperToPlayer, 500, player, message, instance)
    } else {
        //ignore message and remove it from array
        messagesWaiting.splice(messagesWaiting.indexOf(encodedMessage), 1)
    }
}

function getMessage(toSend, command, decryptMessage) {
    if(isDecrypted(decryptMessage, command)) {
        let send = encrypt(toSend)
        if(send === undefined) {
            send = toSend
        }
        toSend = send
    }
    return toSend
}