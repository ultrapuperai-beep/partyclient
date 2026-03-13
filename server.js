const WebSocket = require('ws');
const PORT = process.env.PORT || 10000;

const wss = new WebSocket.Server({ port: PORT });
const parties = new Map();

console.log(`WebSocket server started on port ${PORT}`);

wss.on('connection', (ws) => {
    let currentParty = null;
    let playerName = null;
    
    console.log('New client connected');
    
    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data);
            
            if (msg.type === 'join') {
                currentParty = msg.partyId;
                playerName = msg.playerName;
                
                const isNewParty = !parties.has(currentParty);
                
                if (isNewParty) {
                    parties.set(currentParty, new Map());
                }
                
                parties.get(currentParty).set(playerName, ws);
                console.log(`${playerName} joined party ${currentParty}`);
                
                // Send join confirmation
                ws.send(JSON.stringify({
                    type: 'join_confirm',
                    isNewParty: isNewParty,
                    partyId: currentParty
                }));
                
                broadcast(currentParty, {
                    type: 'player_joined',
                    playerName: playerName
                }, playerName);
                
                // Send list of current members
                const members = Array.from(parties.get(currentParty).keys());
                ws.send(JSON.stringify({
                    type: 'party_members',
                    members: members
                }));
            }
            
            if (msg.type === 'position') {
                broadcast(currentParty, {
                    type: 'position',
                    playerName: playerName,
                    x: msg.x,
                    y: msg.y,
                    z: msg.z,
                    dimension: msg.dimension,
                    health: msg.health,
                    armor: msg.armor
                }, playerName);
            }
            
            if (msg.type === 'chat') {
                broadcast(currentParty, {
                    type: 'chat',
                    playerName: playerName,
                    message: msg.message
                }, playerName);
            }
            
        } catch (e) {
            console.error('Error parsing message:', e);
        }
    });
    
    ws.on('close', () => {
        if (currentParty && parties.has(currentParty)) {
            parties.get(currentParty).delete(playerName);
            
            if (parties.get(currentParty).size === 0) {
                parties.delete(currentParty);
            } else {
                broadcast(currentParty, {
                    type: 'player_left',
                    playerName: playerName
                });
            }
            
            console.log(`${playerName} left party ${currentParty}`);
        }
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

function broadcast(partyId, message, excludePlayer = null) {
    if (!parties.has(partyId)) return;
    
    const partyMembers = parties.get(partyId);
    partyMembers.forEach((client, name) => {
        if (name !== excludePlayer && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}

wss.on('error', (error) => {
    console.error('Server error:', error);
});
