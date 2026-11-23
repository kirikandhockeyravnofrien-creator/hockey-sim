// =====================  КЛУБЫ КХЛ (сезон 2026/27)  =====================
// id — имя файла эмблемы: assets/clubs/<id>.png
// rating — ОРИЕНТИРОВОЧНЫЙ рейтинг клуба (в КХЛ примерно 60–73). Когда появятся составы игроков,
//          рейтинг клуба будет считаться из рейтингов игроков.
// color — цвет клуба (плашка очков в таблице, акценты)
const KHL_CLUBS = [
  // Запад
  { id: 'cska',         name: 'ЦСКА',          city: 'Москва',          short: 'ЦСК', conf: 'west', color: '#d62828', rating: 73 },
  { id: 'lokomotiv',    name: 'Локомотив',     city: 'Ярославль',       short: 'ЛОК', conf: 'west', color: '#e03a3e', rating: 72 },
  { id: 'torpedo',      name: 'Торпедо',       city: 'Нижний Новгород', short: 'ТОР', conf: 'west', color: '#2b4ea0', rating: 71 },
  { id: 'severstal',    name: 'Северсталь',    city: 'Череповец',       short: 'СЕВ', conf: 'west', color: '#e8b800', rating: 69 },
  { id: 'spartak',      name: 'Спартак',       city: 'Москва',          short: 'СПА', conf: 'west', color: '#c8102e', rating: 69 },
  { id: 'ska',          name: 'СКА',           city: 'Санкт-Петербург', short: 'СКА', conf: 'west', color: '#1f4fb5', rating: 69 },
  { id: 'dinamo-msk',   name: 'Динамо Мск',    city: 'Москва',          short: 'ДМС', conf: 'west', color: '#1f56c4', rating: 67 },
  { id: 'dinamo-mn',    name: 'Динамо Мн',     city: 'Минск',           short: 'ДМН', conf: 'west', color: '#27b3e6', rating: 66 },
  { id: 'dragons',      name: 'Драконы',       city: 'Шанхай',          short: 'ДРА', conf: 'west', color: '#1c2f6e', rating: 66 },
  { id: 'sochi',        name: 'ХК Сочи',       city: 'Сочи',            short: 'СОЧ', conf: 'west', color: '#0f8f8f', rating: 61 },
  { id: 'lada',         name: 'Лада',          city: 'Тольятти',        short: 'ЛАД', conf: 'west', color: '#1f6fd1', rating: 60 },
  // Восток
  { id: 'metallurg',    name: 'Металлург',     city: 'Магнитогорск',    short: 'ММГ', conf: 'east', color: '#1f4fb5', rating: 73 },
  { id: 'ak-bars',      name: 'Ак Барс',       city: 'Казань',          short: 'АКБ', conf: 'east', color: '#1f9d55', rating: 70 },
  { id: 'avangard',     name: 'Авангард',      city: 'Омск',            short: 'АВГ', conf: 'east', color: '#d62828', rating: 70 },
  { id: 'neftekhimik',  name: 'Нефтехимик',    city: 'Нижнекамск',      short: 'НЕФ', conf: 'east', color: '#1f4fb5', rating: 69 },
  { id: 'avtomobilist', name: 'Автомобилист',  city: 'Екатеринбург',    short: 'АВТ', conf: 'east', color: '#d62828', rating: 68 },
  { id: 'salavat',      name: 'Салават Юлаев', city: 'Уфа',             short: 'САЛ', conf: 'east', color: '#1f9d55', rating: 67 },
  { id: 'amur',         name: 'Амур',          city: 'Хабаровск',       short: 'АМУ', conf: 'east', color: '#f2701d', rating: 66 },
  { id: 'barys',        name: 'Барыс',         city: 'Астана',          short: 'БАР', conf: 'east', color: '#1f6fd1', rating: 66 },
  { id: 'traktor',      name: 'Трактор',       city: 'Челябинск',       short: 'ТРК', conf: 'east', color: '#6b6b73', rating: 66 },
  { id: 'admiral',      name: 'Адмирал',       city: 'Владивосток',     short: 'АДМ', conf: 'east', color: '#c9a227', rating: 64 },
  { id: 'sibir',        name: 'Сибирь',        city: 'Новосибирск',     short: 'СИБ', conf: 'east', color: '#1f6fd1', rating: 61 }
];