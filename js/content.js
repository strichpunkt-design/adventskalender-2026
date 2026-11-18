// All copy lives here. Every text is { de, en }. German is the default.
export const T = {
  find: { de: n => `Zu Tür ${n}`, en: n => `Go to door ${n}` },
  reopen: { de: n => `Tür ${n} ansehen`, en: n => `See door ${n}` },
  soon: { de: d => d === 1 ? 'Morgen geht’s los' : `Noch ${d} Tage`, en: d => d === 1 ? 'Starts tomorrow' : `${d} days to go` },
  sleeps: { de: d => d === 1 ? 'Noch 1 Mal schlafen' : `Noch ${d} Mal schlafen`, en: d => d === 1 ? '1 more sleep' : `${d} more sleeps` },
  walk: { de: 'Ziehen oder scrollen: geh die Straße entlang', en: 'Drag or scroll to walk down the street' },
  compass: { de: (n, k, dir) => `${dir < 0 ? '← ' : ''}Tür ${n} · ${k} ${k === 1 ? 'Haus' : 'Häuser'}${dir > 0 ? ' →' : ''}`, en: (n, k, dir) => `${dir < 0 ? '← ' : ''}Door ${n} · ${k} ${k === 1 ? 'house' : 'houses'}${dir > 0 ? ' →' : ''}` },
  here: { de: n => `Tür ${n} ist hier`, en: n => `Door ${n} is here` },
  need_name: { de: 'Sag uns erst deinen Namen.', en: 'Tell us your name first.' },
  sound: { de: 'Ton', en: 'Sound' },
  date: { de: n => `${n}. Dezember`, en: n => `December ${n}` },
  somewhere: { de: 'Hier', en: 'Here' },
  ob_kicker: { de: 'Strichpunkt Advent 2026', en: 'Strichpunkt Advent 2026' },
  ob_title: { de: '24 Türen', en: '24 doors' },
  ob_name: { de: 'Dein Name', en: 'Your name' },
  ob_where: { de: 'Das Plakat zeigt das Wetter bei dir.', en: 'The poster shows the weather where you are.' },
  ob_geo: { de: 'Standort nutzen', en: 'Use my location' },
  ob_pick: { de: 'Stadt wählen', en: 'Pick a city' },
  ob_other: { de: 'Andere Stadt', en: 'Another city' },
  ob_go: { de: 'Los', en: 'Go' },
  ob_ok: { de: c => `Gefunden: ${c}`, en: c => `Found: ${c}` },
  ob_fail: { de: 'Kein Standort. Wähl eine Stadt.', en: 'No location. Pick a city.' },
  ob_nocity: { de: 'Stadt nicht gefunden. Versuch eine andere.', en: 'City not found. Try another.' },
  ob_need: { de: 'Wähl einen Standort oder eine Stadt.', en: 'Choose your location or a city.' },
  post: { de: 'Posten', en: 'Post' },
  image: { de: 'Bild wählen', en: 'Choose image' },
  empty: { de: 'Noch leer. Mach den Anfang.', en: 'Still empty. Go first.' },
  need_text: { de: 'Schreib erst etwas.', en: 'Write something first.' },
  need_link: { de: 'Füg einen Link ein, der mit https:// beginnt.', en: 'Paste a link that starts with https://.' },
  need_draw: { de: 'Zeichne erst etwas.', en: 'Draw something first.' },
  need_img: { de: 'Wähl erst ein Bild.', en: 'Choose an image first.' },
  failed: { de: 'Das hat nicht geklappt. Versuch es noch mal.', en: 'That didn’t work. Try again.' },
  local: { de: 'Testmodus: Beiträge bleiben nur in diesem Browser.', en: 'Test mode: posts stay in this browser only.' },
  again: { de: 'Noch mal', en: 'Again' },
  check: { de: 'Prüfen', en: 'Check' },
  start: { de: 'Start', en: 'Start' },
  next: { de: 'Weiter', en: 'Next' },
  score: { de: 'Punkte', en: 'Score' },
  share_score: { de: 'Ergebnis posten', en: 'Post score' },
  to_wall: { de: 'An die Wand', en: 'To the wall' },
  clear: { de: 'Löschen', en: 'Clear' },
  you: { de: 'Du', en: 'You' },
  target: { de: 'Ziel', en: 'Target' },
};

const ILLUS = ['define', 'create', 'excite', 'empower', 'open', 'responsible', 'passionate', 'curious', 'apply', 'interview1', 'interview2', 'employed'];
const FACT = { de: 'Fun Fact', en: 'Fun fact' }, QUIZ = { de: 'Quiz', en: 'Quiz' }, JOIN = { de: 'Mitmachen', en: 'Join in' };

const D = [
  // 1 · Tue
  { type: 'anim', anim: 'snowman', kicker: FACT, title: { de: 'Über 12 Millionen', en: 'Over 12 million' },
    body: { de: ['So viele Pakete hat DHL in Deutschland an einem einzigen Tag Anfang Dezember 2024 sortiert. Doppelt so viele wie an einem normalen Tag.', 'Unser erstes Türchen kommt ohne Zustellung aus.'],
            en: ['That’s how many parcels DHL sorted in Germany on a single day in early December 2024. Twice as many as on a normal day.', 'Our first door needs no delivery.'] } },
  // 2 · Wed
  { type: 'playlist', mode: 'link', spotify: '', kicker: JOIN, title: { de: 'Die Playlist', en: 'The playlist' },
    body: { de: ['Unsere gemeinsame Weihnachts-Playlist auf Spotify: Jede und jeder darf ein Lieblingslied reinpacken. Oder poste den Link hier und sag, warum genau dieser Song.'],
            en: ['Our shared Christmas playlist on Spotify: everyone gets to add a favourite song. Or post the link here and say why this one.'] },
    ph: { de: 'Warum dieser Song?', en: 'Why this song?' } },
  // 3 · Thu
  { type: 'quiz', qi: 1, kicker: QUIZ, title: { de: 'Wie nennen sich die Einbrecher Harry und Marv in „Kevin – Allein zu Haus“ selbst?', en: 'What do burglars Harry and Marv call themselves in “Home Alone”?' },
    q: { options: { de: ['Die nassen Banditen', 'Die klebrigen Banditen', 'Die Weihnachtsknacker'], en: ['The Wet Bandits', 'The Sticky Bandits', 'The Christmas Crackers'] }, ok: 0,
         why: { de: 'Marv lässt in jedem Haus das Wasser laufen. Das ist ihr Markenzeichen. Die „klebrigen Banditen“ kommen erst in Teil 2.', en: 'Marv leaves the water running in every house. That’s their trademark. The “Sticky Bandits” only arrive in part 2.' } } },
  // 4 · Fri
  { type: 'pickup', art: 'nikolaus', kicker: { de: 'Zum Abholen', en: 'Pick-up' }, title: { de: 'Nikolaus kommt früher', en: 'Nikolaus comes early' },
    body: { de: ['Der 6. Dezember ist ein Sonntag. Darum liegt dein Schoko-Nikolaus schon heute bereit.'], en: ['December 6 is a Sunday. So your chocolate Nikolaus is ready today.'] },
    office: { de: c => `Hol ihn dir im Studio ${c} ab. Einer pro Person, auch wenn es schwerfällt.`, en: c => `Pick it up at the ${c} studio. One each, hard as that is.` },
    remote: { de: 'Nicht im Studio? Sag deinem Team Bescheid, dann legt jemand einen für dich zurück.', en: 'Not in a studio? Tell your team and someone will save one for you.' },
    todo: { de: 'Abgeholt', en: 'Picked up' } },
  // 5 · Sat
  { type: 'anim', anim: 'ball', kicker: FACT, title: { de: 'Sieben Postämter', en: 'Seven post offices' },
    body: { de: ['In Deutschland gibt es sieben offizielle Weihnachtspostämter, an die Kinder ihre Wunschzettel schicken können. Sie heißen zum Beispiel Himmelpfort, Engelskirchen und Nikolausdorf. Jeder Brief mit Absender bekommt eine Antwort.'],
            en: ['Germany has seven official Christmas post offices where children can send their wish lists. They have names like Himmelpfort (Heaven’s Gate), Engelskirchen (Angel Churches) and Nikolausdorf. Every letter with a return address gets a reply.'] } },
  // 6 · Sun
  { type: 'anim', anim: 'adv2', kicker: { de: 'Zweiter Advent', en: 'Second Sunday of Advent' }, title: { de: 'Zwei Kerzen', en: 'Two candles' },
    body: { de: ['Aus zwei Strichpunkten werden Kerzen. Die anderen warten noch.'], en: ['Two semicolons become candles. The others are still waiting.'] }, },
  // 7 · Mon
  { type: 'rsvp', art: 'pretzel', kicker: { de: 'Frühstück', en: 'Breakfast' }, title: { de: 'Frühstück in allen Studios', en: 'Breakfast in every studio' },
    body: { de: ['Der Tag nach Nikolaus beginnt gemeinsam: In jedem Studio gibt es Frühstück. Sag kurz, wo du dabei bist, damit genug Brötchen da sind.'],
            en: ['The day after Nikolaus starts together: breakfast in every studio. Let us know where you’ll join so there are enough rolls.'] },
    studios: [
      { city: 'Stuttgart', when: { de: 'Uhrzeit und Ort folgen', en: 'Time and place to follow' } },
      { city: 'Berlin', when: { de: 'Uhrzeit und Ort folgen', en: 'Time and place to follow' } },
      { city: 'Hamburg', when: { de: 'Uhrzeit und Ort folgen', en: 'Time and place to follow' } },
      { city: 'Basel', when: { de: 'Uhrzeit und Ort folgen', en: 'Time and place to follow' } },
    ] },
  // 8 · Tue
  { type: 'meme', kicker: JOIN, title: { de: 'Meme des Jahres', en: 'Meme of the year' },
    body: { de: ['Häng dein liebstes Weihnachtsmeme an den Baum. Tipp auf eine Kugel zum Ansehen und Mitlachen. Das lustigste Meme wird am 22. gekürt.'],
            en: ['Hang your favourite Christmas meme on the tree. Tap a bauble to look and laugh along. The funniest one is crowned on the 22nd.'] },
    ph: { de: 'Bildunterschrift (optional)', en: 'Caption (optional)' } },
  // 9 · Wed
  { type: 'quiz', qi: 2, kicker: QUIZ, title: { de: 'Wie heißen die Rentiere vom Weihnachtsmann?', en: 'What are Santa’s reindeer called?' },
    q: { options: { de: ['Rudolph, Gandalf und Alf', 'Rudolph, Regen und Schnee', 'Rudolph, Donner und Blitzen'], en: ['Rudolph, Gandalf and Alf', 'Rudolph, Rain and Snow', 'Rudolph, Donner and Blitzen'] }, ok: 2,
         why: { de: 'Donner und Blitzen stammen aus dem Gedicht „A Visit from St. Nicholas“ von 1823. Rudolph kam erst 1939 dazu, als Werbefigur eines Kaufhauses.', en: 'Donner and Blitzen come from the 1823 poem “A Visit from St. Nicholas”. Rudolph only joined in 1939, as a department store’s mascot.' } } },
  // 10 · Thu
  { type: 'recipes', kicker: JOIN, title: { de: 'Das Rezeptregal', en: 'The recipe shelf' },
    body: { de: ['Stell dein Lieblingsrezept ins Regal. Jedes Rezept ist ein kleines Heft, jede Karte trägt deinen Namen. Wer nachbackt, drückt „Hab ich gebacken“.'],
            en: ['Put your favourite recipe on the shelf. Each recipe is a little booklet, each card carries your name. If you bake it, press “I baked it”.'] },
    seed: { t: { de: 'Vanillekipferl', en: 'Vanilla crescents' },
      z: { de: ['250 g Mehl', '200 g kalte Butter', '100 g gemahlene Mandeln', '80 g Zucker', '2 Eigelb', 'Vanillezucker und Puderzucker zum Wälzen'], en: ['250 g flour', '200 g cold butter', '100 g ground almonds', '80 g sugar', '2 egg yolks', 'Vanilla sugar and icing sugar for rolling'] },
      s: { de: ['Alles schnell zu einem glatten Teig kneten, 30 Minuten kalt stellen.', 'Fingerdicke Rollen formen, in kurze Stücke schneiden und zu Hörnchen biegen.', 'Bei 175 °C Ober-/Unterhitze 10 bis 12 Minuten hell backen.', 'Noch warm in Vanille- und Puderzucker wälzen.'],
           en: ['Quickly knead everything into a smooth dough, chill for 30 minutes.', 'Roll finger-thick ropes, cut into short pieces and bend into crescents.', 'Bake at 175 °C (top and bottom heat) for 10 to 12 minutes until pale golden.', 'Roll in vanilla and icing sugar while still warm.'] } } },
  // 11 · Fri
  { type: 'quiz', qi: 3, kicker: QUIZ, title: { de: 'Welches ist laut Guinness das meistverkaufte Weihnachtslied der Welt?', en: 'According to Guinness, which is the best-selling Christmas song in the world?' },
    q: { options: { de: ['„All I Want for Christmas Is You“, Mariah Carey', '„White Christmas“, Bing Crosby', '„Last Christmas“, Wham!'], en: ['“All I Want for Christmas Is You”, Mariah Carey', '“White Christmas”, Bing Crosby', '“Last Christmas”, Wham!'] }, ok: 1,
         why: { de: '„White Christmas“ von Bing Crosby gilt laut Guinness als meistverkaufte Single überhaupt, mit geschätzt 50 Millionen Exemplaren.', en: 'Bing Crosby’s “White Christmas” is listed by Guinness as the best-selling single of all time, with an estimated 50 million copies.' } } },
  // 12 · Sat
  { type: 'anim', anim: 'deer', kicker: FACT, title: { de: 'Rot war schon vorher da', en: 'Red came first' },
    body: { de: ['Coca-Cola hat den roten Mantel des Weihnachtsmanns nicht erfunden. Weihnachtsmänner in Rot gab es schon Ende des 19. Jahrhunderts in Illustrationen. Die Werbung ab 1931 hat sein heutiges Aussehen aber weltweit geprägt.', 'Eine Marke wird stark, wenn alle das Gleiche zeigen.'],
            en: ['Coca-Cola didn’t invent Santa’s red coat. Red Santas appeared in illustrations as early as the late 19th century. But its advertising from 1931 on shaped how he looks worldwide.', 'A brand gets strong when everyone shows the same thing.'] } },
  // 13 · Sun
  { type: 'anim', anim: 'adv3', kicker: { de: 'Dritter Advent', en: 'Third Sunday of Advent' }, title: { de: 'Drei Kerzen', en: 'Three candles' },
    body: { de: ['Drei Kerzen brennen. Die vierte hält noch eine Woche durch.'], en: ['Three candles are burning. The fourth holds out one more week.'] }, },
  // 14 · Mon
  { type: 'charcoal', kicker: { de: 'Knecht Ruprecht', en: 'Knecht Ruprecht' }, title: { de: 'Heute: Kohle', en: 'Today: coal' },
    body: { de: ['Knecht Ruprecht war da und hat nur Kohle dagelassen. Zum Glück ist Kohle ein Zeichenwerkzeug.', 'Du hast 30 Sekunden, sobald du ansetzt. Was dabei rauskommt, hängt in der Galerie.'],
            en: ['Knecht Ruprecht came by and left only coal. Luckily, charcoal is a drawing tool.', 'You have 30 seconds from your first stroke. Whatever comes out hangs in the gallery.'] } },
  // 15 · Tue
  { type: 'quiz', qi: 4, kicker: QUIZ, title: { de: 'Schätzfrage: Wie viele Nadeln hat ein 1,70 Meter hoher Weihnachtsbaum im Schnitt?', en: 'Estimate: how many needles does a 1.70 metre Christmas tree have on average?' },
    q: { slider: true, min: 0, max: 800000, step: 10000, start: 300000, ok: 180000, tol: 50000, unit: { de: 'Nadeln', en: 'needles' },
         why: { de: 'Rund 180.000 Nadeln. Und gefühlt landen alle davon im Teppich.', en: 'Around 180,000 needles. And it feels like all of them end up in the carpet.' } } },
  // 16 · Wed
  { type: 'diy', mode: 'image', kicker: { de: 'Basteln', en: 'Craft' }, title: { de: 'Strichpunkt für den Baum', en: 'A semicolon for the tree' },
    body: { de: ['Ein Anhänger aus unserem Zeichen: Punkt und Komma aus Karton, an einem Faden. Dauert eine Kaffeepause.'], en: ['An ornament made from our sign: a dot and a comma cut from card, on a thread. Takes one coffee break.'] },
    steps: { de: ['Vorlage drucken. Am besten auf festes Papier oder Karton.', 'Punkt und Komma ausschneiden. Wer mag, malt sie lila, schwarz oder weiß an.', 'Oben in den Punkt und oben in das Komma je ein kleines Loch stechen.', 'Einen Faden durchziehen: oben der Punkt, darunter mit etwas Abstand das Komma. Verknoten.', 'An den Baum hängen, Foto machen, hier posten.'],
             en: ['Print the template, ideally on thick paper or card.', 'Cut out the dot and the comma. Paint them lilac, black or white if you like.', 'Punch a small hole at the top of the dot and at the top of the comma.', 'Thread them on: the dot on top, the comma below with a little gap. Tie a knot.', 'Hang it on the tree, take a photo, post it here.'] },
    ph: { de: 'Bildunterschrift (optional)', en: 'Caption (optional)' } },
  // 17 · Thu
  { type: 'dinner', kicker: JOIN, title: { de: 'Was kommt bei dir auf den Tisch?', en: 'What’s on your table?' },
    body: { de: ['Kartoffelsalat mit Würstchen, Raclette oder etwas, das nur deine Familie kennt? Deck deinen Teller an unserer langen Tafel.'], en: ['Potato salad and sausages, raclette, or something only your family knows? Set your plate at our long table.'] } },
  // 18 · Fri
  { type: 'tv', video: 'bYMhOtF-mfc', kicker: { de: 'Fernsehabend', en: 'TV night' }, title: { de: 'Weihnachtsmann & Co. KG', en: 'Weihnachtsmann & Co. KG' },
    body: { de: ['Freitag, Mittagspause, Kultserie: Folge 12, „Strafe muss sein“, im Röhrenfernseher.'], en: ['Friday, lunch break, cult cartoon: episode 12, “Strafe muss sein”, on the tube telly. (In German.)'] } },
  // 19 · Sat
  { type: 'anim', anim: 'flake', kicker: FACT, title: { de: 'Jingle Bells im All', en: 'Jingle Bells in space' },
    body: { de: ['„Jingle Bells“ war das erste Lied, das aus dem Weltall übertragen wurde. Am 16. Dezember 1965 spielten die Astronauten Walter Schirra und Thomas Stafford es an Bord von Gemini 6 auf einer geschmuggelten Mundharmonika und kleinen Glöckchen.'],
            en: ['“Jingle Bells” was the first song ever broadcast from space. On December 16, 1965, astronauts Walter Schirra and Thomas Stafford played it aboard Gemini 6 on a smuggled harmonica and small bells.'] }, },
  // 20 · Sun
  { type: 'anim', anim: 'adv4', kicker: { de: 'Vierter Advent', en: 'Fourth Sunday of Advent' }, title: { de: 'Alle vier Kerzen', en: 'All four candles' },
    body: { de: ['Alle vier brennen. Noch vier Türen bis Heiligabend.'], en: ['All four are burning. Four more doors until Christmas Eve.'] }, },
  // 21 · Mon
  { type: 'quiz', qi: 5, kicker: QUIZ, title: { de: 'In welchem Land isst man an Weihnachten traditionell frittiertes Hähnchen von KFC?', en: 'In which country is fried chicken from KFC a Christmas tradition?' },
    q: { options: { de: ['USA', 'Japan', 'Chile'], en: ['USA', 'Japan', 'Chile'] }, ok: 1,
         why: { de: 'Japan. Eine Werbekampagne von 1974 hat „Kentucky zu Weihnachten“ zur Tradition gemacht. Viele bestellen ihr Weihnachtsessen Wochen vorher.', en: 'Japan. A 1974 ad campaign turned “Kentucky for Christmas” into a tradition. Many people order their Christmas meal weeks ahead.' } } },
  // 22 · Tue
  { type: 'memeaward', from: 8, kicker: { de: 'Siegerehrung', en: 'Award' }, title: { de: 'Das Meme des Jahres', en: 'The meme of the year' },
    body: { de: ['Gezählt sind die Lacher vom Meme-Baum. Hier ist das Podest.'], en: ['We counted the laughs on the meme tree. Here is the podium.'] } },
  // 23 · Wed
  { type: 'quizscore', kicker: QUIZ, title: { de: 'Deine Quiz-Wertung', en: 'Your quiz score' },
    body: { de: ['Fünf Fragen in fünf Türen. So hast du abgeschnitten.'], en: ['Five questions behind five doors. Here’s how you did.'] } },
  // 24 · Thu
  { type: 'elfom', kicker: { de: 'Heiligabend', en: 'Christmas Eve' }, title: { de: 'Frohe Weihnachten', en: 'Merry Christmas' },
    body: { de: ['Das Office Management tanzt uns in die Feiertage. 24 Türen, ein Team. Danke fürs Öffnen, Posten, Raten und Backen.', 'Laptop zu. Wir sehen uns 2027.'],
            en: ['Office Management dances us into the holidays. 24 doors, one team. Thank you for opening, posting, guessing and baking.', 'Laptop closed. See you in 2027.'] },
    people: [{ name: 'Ellen', file: 'ellen' }, { name: 'Franziska', file: 'franziska' }, { name: 'Silke', file: 'silke' }] },
];

export const DOORS = D.map((d, i) => ({ ...d, n: i + 1, illu: d.value || ILLUS[i % ILLUS.length] }));
