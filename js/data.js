var DEFAULT_STATE = {
  baseName: "Скараб",
  adminPassword: "admin",
  resources: [
    { id: 'r_metal',   name: 'Металл',   current: 60, max: 200, noDeduct: false },
    { id: 'r_animals', name: 'Животные', current: 10, max: 100, noDeduct: false },
    { id: 'r_people',  name: 'Люди',     current: 20, max: 100, noDeduct: false }
  ],
  rooms: [
    { id: 'rm_rubka', name: 'Рубка', level: 1, levels: [
      { desc: 'Тесная рубка с картами и старым радио. Координируем базу вручную.', cost: {} },
      { desc: 'Оборудованная рубка: связь, обзор, стол для планирования операций.', cost: { r_metal: 25, r_people: 2 } },
      { desc: 'Полноценный командный пункт: дальняя связь, карты региона, ситуационная комната.', cost: { r_metal: 70, r_people: 4 } }
    ]},
    { id: 'rm_med', name: 'Медблок', level: 1, levels: [
      { desc: 'Пара коек и аптечка.', cost: {} },
      { desc: 'Отдельная палата, хирургический стол.', cost: { r_metal: 30, r_people: 2 } },
      { desc: 'Полноценный лазарет с изолятором.', cost: { r_metal: 80, r_people: 4, r_animals: 5 } }
    ]},
    { id: 'rm_gen', name: 'Генераторная', level: 1, levels: [
      { desc: 'Старый дизель-генератор.', cost: {} },
      { desc: 'Резервный генератор, стабильное питание.', cost: { r_metal: 40, r_people: 2 } },
      { desc: 'Энергостанция с накопителями.', cost: { r_metal: 100, r_people: 3 } }
    ]},
    { id: 'rm_living', name: 'Жилые помещения', level: 1, levels: [
      { desc: 'Общий барак на 10 мест.', cost: {} },
      { desc: 'Отдельные комнаты, печи.', cost: { r_metal: 30, r_people: 3 } },
      { desc: 'Комфортные казармы с водой.', cost: { r_metal: 80, r_people: 5 } }
    ]},
    { id: 'rm_pens', name: 'Загоны', level: 1, levels: [
      { desc: 'Пара деревянных загонов.', cost: {} },
      { desc: 'Крепкие загоны с кормушками.', cost: { r_metal: 25, r_people: 2 } },
      { desc: 'Большой скотный двор.', cost: { r_metal: 60, r_people: 3, r_animals: 5 } }
    ]},
    { id: 'rm_arsenal', name: 'Арсенал', level: 1, levels: [
      { desc: 'Шкаф с оружием под замком.', cost: {} },
      { desc: 'Оружейная комната с витринами.', cost: { r_metal: 30, r_people: 2 } },
      { desc: 'Хранилище с бронированной дверью.', cost: { r_metal: 90, r_people: 3 } }
    ]},
    { id: 'rm_training', name: 'Тренировочная площадка', level: 1, levels: [
      { desc: 'Пара мешков с песком.', cost: {} },
      { desc: 'Полоса препятствий, манекены.', cost: { r_metal: 20, r_people: 3 } },
      { desc: 'Полигон со стрельбищем.', cost: { r_metal: 70, r_people: 4 } }
    ]}
  ],
  map: {
    image: null,
    naturalWidth: 0,
    naturalHeight: 0,
    scaleRatio: 45000000,
    physicalWidthCm: 30,
    baseSpeed: 5,
    generatorBonus: 0.2,
    speedMultiplier: 1.0,
    generatorRoomId: 'rm_gen',
    markers: [],
    currentLocation: { x: 50, y: 50 },
    movement: null
  },
  users: [],
  requests: []
};

function migrate(s) {
  if (!s || typeof s !== 'object') return JSON.parse(JSON.stringify(DEFAULT_STATE));
  if (!Array.isArray(s.rooms)) s.rooms = [];
  if (!Array.isArray(s.resources)) s.resources = [];
  if (!Array.isArray(s.users)) s.users = [];
  if (!Array.isArray(s.requests)) s.requests = [];
  if (!s.baseName) s.baseName = 'Скараб';
  if (!s.adminPassword) s.adminPassword = 'admin';

  for (var ri = 0; ri < s.resources.length; ri++) {
    if (typeof s.resources[ri].noDeduct !== 'boolean') s.resources[ri].noDeduct = false;
  }
  for (var k = 0; k < s.rooms.length; k++) {
    var room = s.rooms[k];
    if (!room.id) room.id = uid();
    if (!Array.isArray(room.levels)) {
      var maxL = room.maxLevel || 5;
      var arr = [];
      for (var i = 1; i <= maxL; i++) {
        arr.push({ desc: i === 1 ? (room.desc || 'Стартовый уровень') : ('Уровень ' + i), cost: {} });
      }
      room.levels = arr;
      delete room.maxLevel;
      delete room.desc;
    }
    if (!room.levels.length) room.levels = [{ desc: 'Стартовый уровень', cost: {} }];
    for (var j = 0; j < room.levels.length; j++) {
      if (!room.levels[j].cost) room.levels[j].cost = {};
    }
    if (typeof room.level !== 'number' || room.level < 1) room.level = 1;
    if (room.level > room.levels.length) room.level = room.levels.length;
  }
  if (!s.map || typeof s.map !== 'object') {
    s.map = {
      image: null, naturalWidth: 0, naturalHeight: 0,
      scaleRatio: 45000000, physicalWidthCm: 30,
      baseSpeed: 5, generatorBonus: 0.2, speedMultiplier: 1.0,
      generatorRoomId: 'rm_gen', markers: [], currentLocation: { x: 50, y: 50 },
      movement: null
    };
  } else {
    if (!s.map.markers || !Array.isArray(s.map.markers)) s.map.markers = [];
    if (!s.map.currentLocation) s.map.currentLocation = { x: 50, y: 50 };
    if (typeof s.map.scaleRatio !== 'number') {
      if (typeof s.map.widthKm === 'number' && s.map.widthKm > 0 && s.map.naturalWidth > 0) {
        s.map.scaleRatio = Math.round(s.map.widthKm * 100000 / 30);
      } else {
        s.map.scaleRatio = 45000000;
      }
    }
    if (typeof s.map.physicalWidthCm !== 'number') s.map.physicalWidthCm = 30;
    delete s.map.widthKm;
    if (typeof s.map.baseSpeed !== 'number') s.map.baseSpeed = 5;
    if (typeof s.map.generatorBonus !== 'number') s.map.generatorBonus = 0.2;
    if (typeof s.map.speedMultiplier !== 'number') s.map.speedMultiplier = 1.0;
    if (!s.map.generatorRoomId) s.map.generatorRoomId = 'rm_gen';
    if (typeof s.map.naturalWidth !== 'number') s.map.naturalWidth = 0;
    if (typeof s.map.naturalHeight !== 'number') s.map.naturalHeight = 0;
    if (typeof s.map.movement === 'undefined') s.map.movement = null;
    for (var mi = 0; mi < s.map.markers.length; mi++) {
      var mk = s.map.markers[mi];
      if (typeof mk.permanent !== 'boolean') mk.permanent = false;
      if (!mk.emoji) mk.emoji = LEGACY_MARKER_TYPES[mk.type] || '❓';
      if (typeof mk.name !== 'string') mk.name = '';
    }
  }
  for (var ui = 0; ui < s.users.length; ui++) {
    if (typeof s.users[ui].kickedAt !== 'number') s.users[ui].kickedAt = 0;
  }
  return s;
}