import React, { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * On-device internationalisation. Unlike Puy du Fou's network-dependent live
 * translation (its most-complained-about feature), every string is bundled and
 * works fully offline. English-first for the UK audience, with the same five
 * languages Puy du Fou offers for international visitors.
 */
export const LOCALES = [
  { code: 'en-GB', label: 'English', flag: '🇬🇧' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
] as const;

export type LocaleCode = (typeof LOCALES)[number]['code'];

type Dict = Record<string, string>;

const en: Dict = {
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
  'tickets.signInToBook': 'Sign in to book and hold tickets.',
  'common.signIn': 'Sign in',
  'common.signOut': 'Sign out',
  'common.language': 'Language',
  'food.title': 'Food & Drink',
  'food.myOrders': 'My orders',
  'plan.title': 'Build my perfect day',
  'plan.optimise': 'Optimise my route',
};

const fr: Dict = {
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
  'tickets.signInToBook': 'Connectez-vous pour réserver et conserver vos billets.',
  'common.signIn': 'Se connecter',
  'common.signOut': 'Se déconnecter',
  'common.language': 'Langue',
  'food.title': 'Restauration',
  'food.myOrders': 'Mes commandes',
  'plan.title': 'Composez votre journée',
  'plan.optimise': 'Optimiser mon parcours',
};

const es: Dict = {
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
  'tickets.signInToBook': 'Inicia sesión para comprar y guardar tus entradas.',
  'common.signIn': 'Iniciar sesión',
  'common.signOut': 'Cerrar sesión',
  'common.language': 'Idioma',
  'food.title': 'Comida y bebida',
  'food.myOrders': 'Mis pedidos',
  'plan.title': 'Organiza tu día',
  'plan.optimise': 'Optimizar mi ruta',
};

const de: Dict = {
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
  'tickets.signInToBook': 'Melde dich an, um Tickets zu buchen und zu speichern.',
  'common.signIn': 'Anmelden',
  'common.signOut': 'Abmelden',
  'common.language': 'Sprache',
  'food.title': 'Essen & Trinken',
  'food.myOrders': 'Meine Bestellungen',
  'plan.title': 'Plane deinen Tag',
  'plan.optimise': 'Meine Route optimieren',
};

const nl: Dict = {
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
  'tickets.signInToBook': 'Log in om tickets te boeken en te bewaren.',
  'common.signIn': 'Inloggen',
  'common.signOut': 'Uitloggen',
  'common.language': 'Taal',
  'food.title': 'Eten & drinken',
  'food.myOrders': 'Mijn bestellingen',
  'plan.title': 'Stel je dag samen',
  'plan.optimise': 'Mijn route optimaliseren',
};

const DICTS: Record<LocaleCode, Dict> = { 'en-GB': en, fr, es, de, nl };

interface I18nState {
  locale: LocaleCode;
  setLocale: (l: LocaleCode) => void;
  t: (key: keyof typeof en) => string;
}

const I18nContext = createContext<I18nState | null>(null);
const STORAGE_KEY = 'kynren_locale';

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>('en-GB');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v && v in DICTS) setLocaleState(v as LocaleCode);
    });
  }, []);

  const setLocale = useCallback((l: LocaleCode) => {
    setLocaleState(l);
    AsyncStorage.setItem(STORAGE_KEY, l).catch(() => undefined);
  }, []);

  const t = useCallback(
    (key: keyof typeof en) => DICTS[locale][key] ?? en[key] ?? String(key),
    [locale],
  );

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
