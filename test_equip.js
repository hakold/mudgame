const io = require('socket.io-client');
const socket = io('http://127.0.0.1:3000');

let userId = null;
let charName = null;

socket.on('connect', () => {
  console.log('[+] Connected');
  socket.emit('login', { username: 'testuser1', password: 'test1234' });
});

socket.on('login_success', (data) => {
  userId = data.user?._id;
  charName = data.user?.characterName;
  console.log('[+] Logged in as:', charName, 'level:', data.user?.level, 'gold:', data.user?.gold);
  console.log('[*] Current room:', data.user?.location?.roomId);
  
  // Move to blacksmith
  socket.emit('move', { direction: 'west' });
});

let movedToBlacksmith = false;

socket.on('move_success', (data) => {
  console.log('[*] Moved to:', data.room?.name, 'services:', data.room?.services);
  if (data.room?.services?.includes('buy_weapon') && !movedToBlacksmith) {
    movedToBlacksmith = true;
    console.log('[*] At blacksmith! Requesting shop list...');
    socket.emit('shop_list');
  }
});

socket.on('shop_items', (data) => {
  console.log('[*] Shop items:', data.items?.length);
  const weapon = data.items?.find(i => i.type === 'weapon');
  if (weapon) {
    console.log('[*] Buying weapon:', weapon.id, weapon.name, 'price:', weapon.price);
    socket.emit('buy_item', { itemId: weapon.id, quantity: 1 });
  }
});

socket.on('item_bought', (data) => {
  console.log('[+] Bought:', data.item?.name, 'gold left:', data.totalGold);
  console.log('[*] Now trying to equip...');
  // Need to find the inventory item _id
  // The buy response doesn't include inventoryId, so let's use the item name
  socket.emit('use_item', { inventoryId: 'weapon_wooden_sword' });
});

socket.on('item_equipped', (data) => {
  console.log('[+] EQUIPPED! item:', data.item?.name, 'slot:', data.slot);
  socket.disconnect();
  process.exit(0);
});

socket.on('error', (data) => {
  console.log('[-] Error:', data.message);
});

socket.on('system_message', (data) => {
  console.log('[*] System:', data.message || data.content);
});

socket.on('disconnect', () => {
  console.log('[-] Disconnected');
});

setTimeout(() => {
  console.log('[!] Timeout');
  socket.disconnect();
  process.exit(1);
}, 15000);