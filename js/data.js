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
      { desc: 'Тесная рубка с картами и старым радио. Координируем базу вручную.', cost: {}, generation: {} },
      { desc: 'Оборудованная рубка: связь, обзор, стол для планирования операций.', cost: { r_metal: 25, r_people: 2 }, generation: {} },
      { desc: 'Полноценный командный пункт: дальняя связь, карты региона, ситуационная комната.', cost: { r_metal: 70, r_people: 4 }, generation: {} }
    ]},
    { id: 'rm_med', name: 'Медблок', level: 1, levels: [
      { desc: 'Пара коек и аптечка.', cost: {}, generation: {} },
      { desc: 'Отдельная палата, хирургический стол.', cost: { r_metal: 30, r_people: 2 }, generation: {} },
      { desc: 'Полноценный лазарет с изолятором.', cost: { r_metal: 80, r_people: 4, r_animals: 5 }, generation: {} }
    ]},
    { id: 'rm_gen', name: 'Генераторная', level: 1, levels: [
      { desc: 'Старый дизель-генератор.', cost: {}, generation: {} },
      { desc: 'Резервный генератор, стабильное питание.', cost: { r_metal: 40, r_people: 2 }, generation: {} },
      { desc: 'Энергостанция с накопителями.', cost: { r_metal: 100, r_people: 3 }, generation: {} }
    ]},
    { id: 'rm_living', name: 'Жилые помещения', level: 1, levels: [
      { desc: 'Общий барак на 10 мест.', cost: {}, generation: {} },
      { desc: 'Отдельные комнаты, печи.', cost: { r_metal: 30, r_people: 3 }, generation: {} },
      { desc: 'Комфортные казармы с водой.', cost: { r_metal: 80, r_people: 5 }, generation: {} }
    ]},
    { id: 'rm_pens', name: 'Загоны', level: 1, levels: [
      { desc: 'Пара деревянных загонов.', cost: {}, generation: {} },
      { desc: 'Крепкие загоны с кормушками.', cost: { r_metal: 25, r_people: 2 }, generation: {} },
      { desc: 'Большой скотный двор.', cost: { r_metal: 60, r_people: 3, r_animals: 5 }, generation: {} }
    ]},
    { id: 'rm_arsenal', name: 'Арсенал', level: 1, levels: [
      { desc: 'Шкаф с оружием под замком.', cost: {}, generation: {} },
      { desc: 'Оружейная комната с витринами.', cost: { r_metal: 30, r_people: 2 }, generation: {} },
      { desc: 'Хранилище с бронированной дверью.', cost: { r_metal: 90, r_people: 3 }, generation: {} }
    ]},
    { id: 'rm_training', name: 'Тренировочная площадка', level: 1, levels: [
      { desc: 'Пара мешков с песком.', cost: {}, generation: {} },
      { desc: 'Полоса препятствий, манекены.', cost: { r_metal: 20, r_people: 3 }, generation: {} },
      { desc: 'Полигон со стрельбищем.', cost: { r_metal: 70, r_people: 4 }, generation: {} }
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
  generation: {
    enabled: false,
    intervalMin: 5,
    lastTick: 0
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
    if (typeof s.resources[ri].max !== 'number') s.resources[ri].max = 100;
  }

  if (!s.generation || typeof s.generation !== 'object') {
    s.generation = { enabled: false, intervalMin: 5, lastTick: 0 };
  } else {
    if (typeof s.generation.enabled !== 'boolean') s.generation.enabled = false;
    if (typeof s.generation.intervalMin !== 'number' || s.generation.intervalMin <= 0) s.generation.intervalMin = 5;
    if (typeof s.generation.lastTick !== 'number') s.generation.lastTick = 0;
  }

  for (var k = 0; k < s.rooms.length; k++) {
    var room = s.rooms[k];
    if (!room.id) room.id = uid();
    if (!Array.isArray(room.levels)) {
      var maxL = room.maxLevel || 5;
      var arr = [];
      for (var i = 1; i <= maxL; i++) {
        arr.push({ desc: i === 1 ? (room.desc || 'Стартовый уровень') : ('Уровень ' + i), cost: {}, generation: {} });
      }
      room.levels = arr;
      delete room.maxLevel;
      delete room.desc;
    }
    if (!room.levels.length) room.levels = [{ desc: 'Стартовый уровень', cost: {}, generation: {} }];
    for (var j = 0; j < room.levels.length; j++) {
      var lvl = room.levels[j];
      if (!lvl.cost || typeof lvl.cost !== 'object') lvl.cost = {};
      if (!lvl.generation || typeof lvl.generation !== 'object') lvl.generation = {};
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

  // Firebase теряет пустые массивы — восстанавливаем их в movement
  if (s.map.movement) {
    if (!Array.isArray(s.map.movement.yesVotes)) s.map.movement.yesVotes = [];
    if (!Array.isArray(s.map.movement.noVotes)) s.map.movement.noVotes = [];
  }

  // Глобальная страховка: если Firebase вернул что-то не то — не даём рендеру упасть
  if (!Array.isArray(s.rooms)) s.rooms = [];
  if (!Array.isArray(s.resources)) s.resources = [];
  if (!Array.isArray(s.users)) s.users = [];
  if (!Array.isArray(s.requests)) s.requests = [];
  if (!s.map || typeof s.map !== 'object') {
    s.map = {
      image: null, naturalWidth: 0, naturalHeight: 0,
      scaleRatio: 45000000, physicalWidthCm: 30,
      baseSpeed: 5, generatorBonus: 0.2, speedMultiplier: 1.0,
      generatorRoomId: 'rm_gen', markers: [], currentLocation: { x: 50, y: 50 },
      movement: null
    };
  }
  if (!Array.isArray(s.map.markers)) s.map.markers = [];
  if (!s.map.currentLocation) s.map.currentLocation = { x: 50, y: 50 };
  if (!s.generation || typeof s.generation !== 'object') {
    s.generation = { enabled: false, intervalMin: 5, lastTick: 0 };
  }

  return s;
}