import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'safe_notify.dart';

/// On-device internationalisation: every string is bundled and works fully offline.
/// English-first for the UK audience, with the five languages the reference parks offer.
const locales = [
  (code: 'en-GB', label: 'English', flag: '🇬🇧'),
  (code: 'fr', label: 'Français', flag: '🇫🇷'),
  (code: 'es', label: 'Español', flag: '🇪🇸'),
  (code: 'de', label: 'Deutsch', flag: '🇩🇪'),
  (code: 'nl', label: 'Nederlands', flag: '🇳🇱'),
];

const _en = <String, String>{
  'tab.today': 'Today',
  'tab.shows': 'Shows',
  'tab.map': 'Map',
  'tab.food': 'Food',
  'tab.plan': 'My Day',
  'tab.tickets': 'Tickets',
  'today.welcome': 'Welcome to The Storied Lands',
  'today.changes': 'Today’s changes',
  'today.comingUp': 'Coming up',
  'today.noMoreShows': 'No more shows scheduled today.',
  'today.planCta': 'Plan my perfect day →',
  'tickets.title': 'My Tickets',
  'tickets.prices': 'Ticket Prices',
  'tickets.book': '＋ Book tickets',
  'tickets.signInToBook': 'Sign in to see your tickets.',
  'common.signIn': 'Sign in',
  'common.signOut': 'Sign out',
  'common.language': 'Language',
  'food.title': 'Food & Drink',
  'food.myOrders': 'My orders',
  'plan.title': 'Build my perfect day',
  'plan.optimise': 'Optimise my route',
};

const _fr = <String, String>{
  'tab.today': 'Aujourd’hui',
  'tab.shows': 'Spectacles',
  'tab.map': 'Carte',
  'tab.food': 'Restauration',
  'tab.plan': 'Ma journée',
  'tab.tickets': 'Billets',
  'today.welcome': 'Bienvenue aux Storied Lands',
  'today.changes': 'Changements du jour',
  'today.comingUp': 'À venir',
  'today.noMoreShows': 'Plus de spectacles prévus aujourd’hui.',
  'today.planCta': 'Planifier ma journée idéale →',
  'tickets.title': 'Mes billets',
  'tickets.prices': 'Tarifs',
  'tickets.book': '＋ Réserver des billets',
  'tickets.signInToBook': 'Connectez-vous pour voir vos billets.',
  'common.signIn': 'Se connecter',
  'common.signOut': 'Se déconnecter',
  'common.language': 'Langue',
  'food.title': 'Restauration',
  'food.myOrders': 'Mes commandes',
  'plan.title': 'Composez votre journée',
  'plan.optimise': 'Optimiser mon parcours',
};

const _es = <String, String>{
  'tab.today': 'Hoy',
  'tab.shows': 'Espectáculos',
  'tab.map': 'Mapa',
  'tab.food': 'Comida',
  'tab.plan': 'Mi día',
  'tab.tickets': 'Entradas',
  'today.welcome': 'Bienvenido a The Storied Lands',
  'today.changes': 'Cambios de hoy',
  'today.comingUp': 'Próximamente',
  'today.noMoreShows': 'No hay más espectáculos hoy.',
  'today.planCta': 'Planear mi día perfecto →',
  'tickets.title': 'Mis entradas',
  'tickets.prices': 'Precios',
  'tickets.book': '＋ Comprar entradas',
  'tickets.signInToBook': 'Inicia sesión para ver tus entradas.',
  'common.signIn': 'Iniciar sesión',
  'common.signOut': 'Cerrar sesión',
  'common.language': 'Idioma',
  'food.title': 'Comida y bebida',
  'food.myOrders': 'Mis pedidos',
  'plan.title': 'Organiza tu día',
  'plan.optimise': 'Optimizar mi ruta',
};

const _de = <String, String>{
  'tab.today': 'Heute',
  'tab.shows': 'Shows',
  'tab.map': 'Karte',
  'tab.food': 'Essen',
  'tab.plan': 'Mein Tag',
  'tab.tickets': 'Tickets',
  'today.welcome': 'Willkommen in The Storied Lands',
  'today.changes': 'Änderungen heute',
  'today.comingUp': 'Demnächst',
  'today.noMoreShows': 'Heute keine weiteren Shows.',
  'today.planCta': 'Meinen perfekten Tag planen →',
  'tickets.title': 'Meine Tickets',
  'tickets.prices': 'Preise',
  'tickets.book': '＋ Tickets buchen',
  'tickets.signInToBook': 'Melde dich an, um deine Tickets zu sehen.',
  'common.signIn': 'Anmelden',
  'common.signOut': 'Abmelden',
  'common.language': 'Sprache',
  'food.title': 'Essen & Trinken',
  'food.myOrders': 'Meine Bestellungen',
  'plan.title': 'Plane deinen Tag',
  'plan.optimise': 'Meine Route optimieren',
};

const _nl = <String, String>{
  'tab.today': 'Vandaag',
  'tab.shows': 'Shows',
  'tab.map': 'Kaart',
  'tab.food': 'Eten',
  'tab.plan': 'Mijn dag',
  'tab.tickets': 'Tickets',
  'today.welcome': 'Welkom bij The Storied Lands',
  'today.changes': 'Wijzigingen vandaag',
  'today.comingUp': 'Binnenkort',
  'today.noMoreShows': 'Geen shows meer gepland vandaag.',
  'today.planCta': 'Mijn perfecte dag plannen →',
  'tickets.title': 'Mijn tickets',
  'tickets.prices': 'Prijzen',
  'tickets.book': '＋ Tickets boeken',
  'tickets.signInToBook': 'Log in om je tickets te zien.',
  'common.signIn': 'Inloggen',
  'common.signOut': 'Uitloggen',
  'common.language': 'Taal',
  'food.title': 'Eten & drinken',
  'food.myOrders': 'Mijn bestellingen',
  'plan.title': 'Stel je dag samen',
  'plan.optimise': 'Mijn route optimaliseren',
};

const _dicts = {'en-GB': _en, 'fr': _fr, 'es': _es, 'de': _de, 'nl': _nl};
const _storageKey = 'kynren_locale';

class I18nState extends ChangeNotifier with SafeNotify {
  String locale = 'en-GB';

  Future<void> load() async {
    final v = (await SharedPreferences.getInstance()).getString(_storageKey);
    if (v != null && _dicts.containsKey(v)) {
      locale = v;
      notifyListeners();
    }
  }

  void setLocale(String l) {
    locale = l;
    notifyListeners();
    SharedPreferences.getInstance().then((p) => p.setString(_storageKey, l));
  }

  String t(String key) => _dicts[locale]?[key] ?? _en[key] ?? key;
}
