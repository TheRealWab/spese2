// Parole italiane per cercare le icone Lucide (che hanno nomi e parole chiave solo in inglese).
// Ogni parola (senza accenti, minuscola) rimanda a una o più parole inglesi; la ricerca trova le icone
// il cui nome o le cui parole chiave iniziano con quelle parole. Un test controlla che ogni voce trovi almeno un'icona.
// Mancano delle parole? Si aggiungono qui.

export const PAROLE_IT = {
  // ---- Animali ----
  gatto: ['cat'], gatti: ['cat'], cane: ['dog'], cani: ['dog'], animale: ['paw-print', 'dog', 'cat'], animali: ['paw-print', 'dog', 'cat'],
  zampa: ['paw-print'], osso: ['bone'], pesce: ['fish'], pesci: ['fish'], uccello: ['bird'], coniglio: ['rabbit'], scoiattolo: ['squirrel'],
  tartaruga: ['turtle'], insetto: ['bug'], lumaca: ['snail'], topo: ['rat'], veterinario: ['paw-print', 'stethoscope'], lettiera: ['cat', 'paw-print'],
  crocchette: ['bone', 'paw-print'],

  // ---- Cibo e bevande ----
  caffe: ['coffee'], cappuccino: ['coffee'], bar: ['coffee', 'beer', 'martini'], colazione: ['croissant', 'coffee', 'egg'], cornetto: ['croissant'],
  pane: ['croissant', 'wheat', 'sandwich'], panificio: ['croissant', 'wheat'], pizza: ['pizza'], pasta: ['wheat', 'utensils'], panino: ['sandwich'],
  frutta: ['apple', 'cherry', 'banana', 'grape', 'citrus'], mela: ['apple'], banana: ['banana'], uva: ['grape'], arancia: ['citrus'], ciliegia: ['cherry'],
  verdura: ['carrot', 'salad', 'leafy-green'], insalata: ['salad'], carota: ['carrot'], carne: ['beef', 'drumstick'], macelleria: ['beef', 'drumstick'],
  pollo: ['drumstick'], prosciutto: ['ham'], pescheria: ['fish'], gelato: ['ice-cream-cone', 'ice-cream-bowl'], gelateria: ['ice-cream-cone'],
  dolce: ['cake', 'cookie', 'candy', 'cupcake'], dolci: ['cake', 'cookie', 'candy', 'cupcake'], torta: ['cake'], biscotti: ['cookie'], cioccolato: ['candy', 'cookie'],
  caramelle: ['candy', 'lollipop'], ciambella: ['donut'], birra: ['beer'], vino: ['wine'], cocktail: ['martini'], aperitivo: ['martini', 'wine', 'beer'],
  ristorante: ['utensils', 'chef-hat', 'concierge-bell'], ristoranti: ['utensils', 'chef-hat'], cena: ['utensils', 'soup'], pranzo: ['utensils', 'soup'],
  cucina: ['chef-hat', 'cooking-pot', 'utensils-crossed'], zuppa: ['soup'], supermercato: ['shopping-cart', 'store', 'shopping-basket'],
  spesa: ['shopping-cart', 'shopping-basket'], alimentari: ['shopping-basket', 'apple', 'wheat'], latte: ['milk'], uova: ['egg'], acqua: ['droplet', 'glass-water'],
  bibita: ['cup-soda', 'glass-water'], bibite: ['cup-soda', 'glass-water'], lattina: ['cup-soda'], macchinetta: ['cup-soda', 'coffee'], macchinette: ['cup-soda', 'coffee'],
  distributore: ['cup-soda', 'fuel'], tabaccheria: ['cigarette'], sigarette: ['cigarette'], fumo: ['cigarette'],

  // ---- Casa ----
  casa: ['house'], affitto: ['house', 'key', 'building'], mutuo: ['house', 'landmark'], condominio: ['building', 'building-2'], bolletta: ['receipt', 'zap', 'lightbulb'],
  bollette: ['receipt', 'zap', 'lightbulb'], luce: ['lightbulb', 'zap'], elettricita: ['zap', 'plug'], corrente: ['zap', 'plug'], gas: ['flame'], riscaldamento: ['flame', 'thermometer'],
  internet: ['wifi', 'globe', 'router'], wifi: ['wifi'], arredamento: ['armchair', 'sofa', 'lamp'], divano: ['sofa'], poltrona: ['armchair'], letto: ['bed'], lampada: ['lamp'],
  pulizie: ['brush-cleaning', 'spray-can', 'washing-machine'], lavatrice: ['washing-machine'], bucato: ['washing-machine', 'shirt'], bagno: ['bath', 'shower-head'],
  doccia: ['shower-head'], giardino: ['trees', 'sprout', 'shovel'], pianta: ['sprout', 'leaf', 'flower'], piante: ['sprout', 'leaf', 'flower'], fiori: ['flower', 'flower-2'],
  fiore: ['flower'], traslochi: ['truck', 'package'], trasloco: ['truck', 'package'], chiave: ['key'], serratura: ['lock'], porta: ['door-open', 'door-closed'],

  // ---- Trasporti e viaggi ----
  auto: ['car'], macchina: ['car'], benzina: ['fuel'], carburante: ['fuel'], diesel: ['fuel'], gasolio: ['fuel'], rifornimento: ['fuel'], treno: ['train-front', 'train-track'],
  autobus: ['bus'], bus: ['bus'], metro: ['train-front-tunnel', 'tram-front'], metropolitana: ['train-front-tunnel', 'tram-front'], tram: ['tram-front'], taxi: ['car-taxi-front'],
  moto: ['bike', 'motorbike'], motorino: ['bike', 'motorbike'], scooter: ['bike', 'motorbike'], bici: ['bike'], bicicletta: ['bike'], aereo: ['plane'], volo: ['plane-takeoff', 'plane'],
  traghetto: ['ship'], nave: ['ship'], barca: ['sailboat', 'ship'], parcheggio: ['square-parking', 'circle-parking'], pedaggio: ['route', 'milestone'],
  autostrada: ['route', 'milestone'], biglietto: ['ticket'], biglietti: ['ticket'], viaggio: ['plane', 'luggage', 'map', 'compass'], viaggi: ['plane', 'luggage', 'map'],
  valigia: ['luggage'], vacanza: ['tree-palm', 'umbrella', 'sun', 'luggage'], vacanze: ['tree-palm', 'umbrella', 'sun', 'luggage'], hotel: ['hotel', 'bed-double'],
  albergo: ['hotel', 'bed-double'], mare: ['waves', 'sailboat', 'shell'], spiaggia: ['umbrella', 'waves', 'tree-palm'], montagna: ['mountain', 'mountain-snow'],
  campeggio: ['tent', 'tent-tree'], officina: ['wrench'], meccanico: ['wrench'], tagliando: ['wrench', 'car'], mappa: ['map'], trasporti: ['bus', 'train-front', 'car'],
  trasporto: ['bus', 'train-front', 'car'], camion: ['truck'], consegna: ['truck', 'package'],

  // ---- Salute e cura ----
  farmacia: ['pill', 'cross', 'syringe'], medicina: ['pill', 'tablets'], medicine: ['pill', 'tablets'], pillola: ['pill'], medico: ['stethoscope'], dottore: ['stethoscope'],
  dentista: ['smile', 'stethoscope'], ospedale: ['hospital', 'ambulance'], ambulanza: ['ambulance'], visita: ['stethoscope', 'clipboard'], salute: ['heart-pulse', 'activity'],
  cuore: ['heart', 'heart-pulse'], occhiali: ['glasses'], vista: ['eye'], occhio: ['eye'], terapia: ['brain', 'heart-pulse'], psicologo: ['brain'], analisi: ['microscope', 'test-tube', 'flask-conical'],
  vaccino: ['syringe'], benessere: ['flower', 'sparkles', 'leaf'], spa: ['flower', 'sparkles'], massaggio: ['hand', 'sparkles'], parrucchiere: ['scissors'], capelli: ['scissors'],
  barbiere: ['scissors'], cosmetici: ['sparkles', 'palette'], trucco: ['sparkles', 'palette'], profumo: ['spray-can', 'droplets'], igiene: ['droplets', 'sparkles'],

  // ---- Svago e cultura ----
  svago: ['gamepad-2', 'party-popper', 'popcorn', 'drama'], hobby: ['palette', 'puzzle', 'guitar', 'gamepad-2'], giochi: ['gamepad-2', 'dices', 'puzzle'], gioco: ['gamepad-2', 'dices', 'puzzle'],
  videogiochi: ['gamepad-2', 'joystick'], console: ['gamepad-2', 'joystick'], cinema: ['clapperboard', 'film', 'popcorn'], film: ['clapperboard', 'film', 'popcorn'],
  teatro: ['drama', 'ticket'], musica: ['music', 'headphones', 'guitar'], concerto: ['mic', 'music', 'guitar'], concerti: ['mic', 'music', 'guitar'], chitarra: ['guitar'],
  libro: ['book-open', 'book'], libri: ['book-open', 'library'], lettura: ['book-open', 'library'], biblioteca: ['library'], giornale: ['newspaper'], giornali: ['newspaper'],
  rivista: ['newspaper'], sport: ['dumbbell', 'trophy', 'medal', 'volleyball', 'sport-shoe'], palestra: ['dumbbell', 'biceps-flexed', 'weight', 'sport-shoe'], pesi: ['dumbbell', 'weight'], allenamento: ['dumbbell', 'biceps-flexed', 'activity', 'timer'], fitness: ['dumbbell', 'biceps-flexed', 'activity'], scarpe_da_corsa: ['sport-shoe'], arbitro: ['whistle'], rugby: ['rugby-ball'], canoa: ['kayak'], sci: ['mountain-snow', 'snowflake'], calcio: ['goal', 'trophy'], pallone: ['volleyball'],
  tennis: ['volleyball', 'trophy'], nuoto: ['waves', 'bath'], piscina: ['waves', 'bath'], corsa: ['footprints', 'timer'], camminata: ['footprints'], yoga: ['flower', 'heart'],
  foto: ['camera', 'image'], fotografia: ['camera', 'image'], arte: ['palette', 'brush', 'image'], disegno: ['pencil', 'pen-tool', 'palette'], pittura: ['palette', 'paintbrush'],
  festa: ['party-popper', 'cake', 'martini'], feste: ['party-popper', 'cake'], compleanno: ['cake', 'gift', 'party-popper'], regalo: ['gift'], regali: ['gift'], sorpresa: ['gift', 'sparkles'],
  natale: ['gift', 'tree-pine', 'snowflake'], dadi: ['dices'], puzzle: ['puzzle'], scacchi: ['crown', 'dices'], karaoke: ['mic'], discoteca: ['disc', 'music', 'martini'], disco: ['disc'],

  // ---- Shopping ----
  vestiti: ['shirt'], abbigliamento: ['shirt'], maglietta: ['shirt'], camicia: ['shirt'], scarpe: ['footprints'], borsa: ['shopping-bag', 'handbag'], borsetta: ['handbag'],
  zaino: ['backpack'], negozio: ['store'], negozi: ['store'], shopping: ['shopping-bag', 'shopping-cart'], carrello: ['shopping-cart'], gioielli: ['gem'], diamante: ['gem'],
  orologio: ['watch', 'clock'], cappello: ['hat-glasses', 'crown'], occhiali_da_sole: ['glasses', 'sun'], sconto: ['percent', 'tag'], offerta: ['percent', 'tag'], etichetta: ['tag'],

  // ---- Soldi e finanza ----
  soldi: ['banknote', 'coins', 'wallet'], denaro: ['banknote', 'coins', 'wallet'], contanti: ['banknote', 'coins'], stipendio: ['wallet', 'banknote', 'briefcase'],
  paga: ['wallet', 'banknote'], banca: ['landmark'], conto: ['landmark', 'wallet'], carta: ['credit-card'], bancomat: ['credit-card'], commissioni: ['percent', 'receipt', 'landmark'],
  commissione: ['percent', 'receipt'], tasse: ['percent', 'receipt', 'landmark'], tassa: ['percent', 'receipt', 'landmark'], imposte: ['percent', 'receipt', 'landmark'], ricevuta: ['receipt'],
  scontrino: ['receipt'], fattura: ['receipt', 'file-text'], risparmio: ['piggy-bank'], risparmi: ['piggy-bank'], salvadanaio: ['piggy-bank'], investimento: ['trending-up', 'chart-line'],
  investimenti: ['trending-up', 'chart-line', 'chart-candlestick'], azioni: ['chart-candlestick', 'chart-line'], borsa_valori: ['chart-candlestick'], bitcoin: ['bitcoin'], crypto: ['bitcoin'],
  prestito: ['hand-coins'], debito: ['hand-coins'], assicurazione: ['shield-check', 'shield'], polizza: ['shield-check', 'file-text'], multa: ['triangle-alert', 'octagon-alert'],
  rimborso: ['undo-2', 'hand-coins'], bonus: ['gift', 'sparkles'], interessi: ['piggy-bank', 'percent'], pensione: ['hourglass', 'piggy-bank'], donazione: ['hand-heart', 'heart'],
  beneficenza: ['hand-heart', 'heart'], mancia: ['coins', 'hand-coins'], monete: ['coins'], portafoglio: ['wallet'], cassa: ['coins', 'banknote'], euro: ['euro'],

  // ---- Tecnologia ----
  telefono: ['smartphone', 'phone'], cellulare: ['smartphone'], smartphone: ['smartphone'], computer: ['laptop', 'monitor'], pc: ['laptop', 'monitor'], portatile: ['laptop'],
  tv: ['tv'], televisione: ['tv'], streaming: ['tv', 'play', 'clapperboard'], abbonamento: ['repeat', 'refresh-cw'], abbonamenti: ['repeat', 'refresh-cw'], app: ['smartphone', 'app-window'],
  cuffie: ['headphones'], stampante: ['printer'], batteria: ['battery'], elettronica: ['cpu', 'plug', 'zap'], tecnologia: ['cpu', 'smartphone', 'laptop'], cloud: ['cloud'],
  software: ['app-window', 'code'], videocamera: ['video', 'camera'],

  // ---- Famiglia, scuola, lavoro ----
  bambino: ['baby'], bambini: ['baby'], figli: ['baby'], figlio: ['baby'], neonato: ['baby'], scuola: ['graduation-cap', 'school', 'backpack'], istruzione: ['graduation-cap', 'book-open'],
  universita: ['graduation-cap'], corso: ['book-open', 'graduation-cap'], corsi: ['book-open', 'graduation-cap'], giocattolo: ['blocks', 'puzzle', 'toy-brick'], giocattoli: ['blocks', 'puzzle', 'toy-brick'],
  famiglia: ['users', 'house'], amici: ['users', 'handshake'], amico: ['user', 'handshake'], coppia: ['heart', 'users'], amore: ['heart'], lavoro: ['briefcase', 'building-2', 'laptop'],
  ufficio: ['briefcase', 'building-2'], cancelleria: ['pencil', 'pen', 'paperclip', 'notebook'], penna: ['pen'], matita: ['pencil'], quaderno: ['notebook'], posta: ['mail', 'mailbox'],
  lettera: ['mail'], spedizione: ['package', 'truck'], spedizioni: ['package', 'truck'], pacco: ['package'], pacchi: ['package'], attrezzi: ['wrench', 'hammer'], riparazione: ['wrench', 'hammer'],
  riparazioni: ['wrench', 'hammer'], bricolage: ['hammer', 'drill', 'paintbrush'], martello: ['hammer'], trapano: ['drill'],

  // ---- Varie ----
  altro: ['ellipsis', 'package', 'circle-help'], varie: ['shapes', 'package', 'ellipsis'], extra: ['sparkles', 'plus'], emergenza: ['triangle-alert', 'siren'], imprevisti: ['triangle-alert', 'siren'],
  tempo: ['clock', 'hourglass', 'timer'], calendario: ['calendar'], scadenza: ['calendar-clock', 'calendar'], stella: ['star'], sole: ['sun'], luna: ['moon'], fuoco: ['flame'],
  idea: ['lightbulb'], meteo: ['cloud-sun'], neve: ['snowflake'], pioggia: ['cloud-rain'], ombrello: ['umbrella'], terra: ['globe'], mondo: ['globe'], bandiera: ['flag'], premio: ['trophy', 'award'],
  coppa: ['trophy'], medaglia: ['medal'], casino: ['dices'], scommesse: ['dices'], lotteria: ['ticket', 'dices'], religione: ['church'], chiesa: ['church'], tempio: ['landmark'],
};

/** Icone mostrate quando non si è ancora scritto nulla: le più adatte alle categorie di spesa. */
export const ICONE_SUGGERITE = [
  'shopping-cart', 'shopping-basket', 'shopping-bag', 'utensils', 'coffee', 'pizza', 'beer', 'wine', 'ice-cream-cone', 'croissant', 'apple', 'cup-soda',
  'car', 'fuel', 'bus', 'train-front', 'bike', 'plane', 'ship', 'square-parking', 'house', 'lightbulb', 'flame', 'wifi', 'armchair', 'washing-machine',
  'pill', 'heart-pulse', 'stethoscope', 'glasses', 'scissors', 'sparkles', 'shirt', 'gift', 'cat', 'dog', 'paw-print', 'baby', 'graduation-cap', 'book-open',
  'gamepad-2', 'clapperboard', 'music', 'dumbbell', 'camera', 'palette', 'party-popper', 'luggage', 'tree-palm', 'hotel', 'smartphone', 'laptop', 'tv', 'repeat',
  'receipt', 'percent', 'landmark', 'credit-card', 'wallet', 'banknote', 'coins', 'piggy-bank', 'trending-up', 'shield-check', 'briefcase', 'package', 'wrench',
  'mail', 'flower', 'tag', 'star', 'heart', 'ellipsis',
];
