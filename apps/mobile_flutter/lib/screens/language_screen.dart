import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/i18n.dart';
import '../core/theme.dart';
import '../ui/controls.dart';
import '../ui/screen.dart';

class LanguageScreen extends StatelessWidget {
  const LanguageScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final i18n = context.watch<I18nState>();
    return KScreen(
      title: i18n.t('common.language'),
      subtitle: 'Choose the language you read best',
      page: 'language',
      children: [
        Text('Every translation is built into the app and works offline.', style: TextStyle(fontSize: 14, height: 20 / 14, color: c.sub)),
        for (final l in locales)
          KCard(
            onTap: () => i18n.setLocale(l.code),
            color: i18n.locale == l.code ? c.tint : null,
            padding: const EdgeInsets.all(16),
            child: Row(children: [
              Text(l.flag, style: const TextStyle(fontSize: 21)),
              const SizedBox(width: 14),
              Expanded(child: Text(l.label, style: TextStyle(fontSize: 16, fontWeight: i18n.locale == l.code ? FontWeight.w800 : FontWeight.w600, color: i18n.locale == l.code ? c.link : c.text))),
              if (i18n.locale == l.code) Icon(Icons.check_rounded, color: c.link, size: 20),
            ]),
          ),
      ],
    );
  }
}
