// =====================  СОСТАВЫ КЛУБОВ КХЛ  =====================
// Состав: список игроков с сайта sportmail.ru (страница «Состав» клуба, данные на 16.11.2026).
// r — ПРЕДВАРИТЕЛЬНЫЙ рейтинг игрока (50–99): оценка автора по уровню игрока, возрасту и
//     результативности в сезоне. Это не официальный рейтинг; его можно править здесь.
// slug — имя файла фото: assets/players/<клуб>/<slug>.jpg (или .png)
// pos — G вратарь, D защитник, F нападающий
const KHL_ROSTERS = {
  cska: {
    updated: '2026-11-16',
    source: 'sportmail.ru',
    players: [
      { n: 31, name: 'Александр Самонов', slug: 'samonov-aleksandr', pos: 'G', born: '1995-08-23', r: 80 },
      { n: 33, name: 'Дмитрий Гамзин', slug: 'gamzin-dmitriy', pos: 'G', born: '2003-04-08', r: 72 },
      { n: 4, name: 'Иван Юкин', slug: 'yukin-ivan', pos: 'D', born: '2007-07-16', r: 58 },
      { n: 5, name: 'Дмитрий Саморуков', slug: 'samorukov-dmitriy', pos: 'D', born: '1999-06-16', r: 76 },
      { n: 9, name: 'Егор Замула', slug: 'zamula-egor', pos: 'D', born: '2000-03-30', r: 82 },
      { n: 22, name: 'Роберт Хэмилтон', slug: 'hamilton-robert', pos: 'D', born: '1994-03-31', r: 82 },
      { n: 28, name: 'Иван Патрихаев', slug: 'patrikhaev-ivan', pos: 'D', born: '2006-02-03', r: 62 },
      { n: 49, name: 'Егор Брютов', slug: 'bryutov-egor', pos: 'D', born: '2001-07-11', r: 71 },
      { n: 55, name: 'Никита Охотюк', slug: 'okhotyuk-nikita', pos: 'D', born: '2000-12-04', r: 78 },
      { n: 65, name: 'Алекс Коттон', slug: 'cotton-alex', pos: 'D', born: '2001-05-12', r: 72 },
      { n: 76, name: 'Матвей Шуравин', slug: 'shuravin-matvey', pos: 'D', born: '2006-03-22', r: 62 },
      { n: 79, name: 'Джереми Рой', slug: 'roy-jeremy', pos: 'D', born: '1997-05-14', r: 80 },
      { n: 80, name: 'Артем Барабоша', slug: 'barabosha', pos: 'D', born: '2004-03-18', r: 68 },
      { n: 89, name: 'Никита Нестеров', slug: 'nesterov-nikita', pos: 'D', born: '1993-03-28', r: 82 },
      { n: 10, name: 'Клим Костин', slug: 'kostin-klim', pos: 'F', born: '1999-05-05', r: 77 },
      { n: 13, name: 'Прохор Полтапов', slug: 'poltapov-prokhor', pos: 'F', born: '2003-02-01', r: 85 },
      { n: 15, name: 'Павел Карнаухов', slug: 'karnaukhov-pavel', pos: 'F', born: '1997-03-15', r: 77 },
      { n: 19, name: 'Иван Дроздов', slug: 'drozdov-ivan', pos: 'F', born: '1999-11-15', r: 76 },
      { n: 26, name: 'Дерек Барак', slug: 'barak-derek', pos: 'F', born: '1995-02-27', r: 74 },
      { n: 27, name: 'Максим Соркин', slug: 'sorkin-maksim', pos: 'F', born: '2000-04-19', r: 86 },
      { n: 34, name: 'Денис Гурьянов', slug: 'guryanov-denis', pos: 'F', born: '1997-06-07', r: 80 },
      { n: 51, name: 'Николай Коваленко', slug: 'kovalenko-nikolay', pos: 'F', born: '1999-10-17', r: 86 },
      { n: 58, name: 'Егор Фатеев', slug: 'fateev-egor', pos: 'F', born: '1997-11-03', r: 70 },
      { n: 61, name: 'Марат Хайруллин', slug: 'khayrullin-marat', pos: 'F', born: '1996-07-15', r: 83 },
      { n: 63, name: 'Тахир Мингачев', slug: 'mingachev-takhir', pos: 'F', born: '2001-07-31', r: 72 },
      { n: 69, name: 'Олег Майстренко', slug: 'maystrenko-oleg', pos: 'F', born: '2005-01-06', r: 66 },
      { n: 72, name: 'Дмитрий Бучельников', slug: 'buchelnikov-dmitriy', pos: 'F', born: '2003-09-06', r: 82 },
      { n: 87, name: 'Ярослав Яппаров', slug: 'yapparov-yaroslav', pos: 'F', born: '2004-03-22', r: 70 },
      { n: 95, name: 'Назар Привалов', slug: 'privalov-nazar', pos: 'F', born: '2009-05-25', r: 64 },
      { n: 97, name: 'Алексей Чуркин', slug: 'churkin-aleksey', pos: 'F', born: '2004-04-29', r: 68 },
      { n: 98, name: 'Максим Мамин', slug: 'mamin-maksim', pos: 'F', born: '1995-01-13', r: 82 },
      { n: null, name: 'Райли Савчук', slug: 'sawchuk-riley', pos: 'F', born: '1999-03-18', r: 78 },
    ]
  }
};